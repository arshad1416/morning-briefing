#!/usr/bin/env python3
"""
fetch_universe_constituents.py — refresh the index membership cache.

Writes pi-scripts/universe_constituents.json, the file generate-screener-data.py
reads to decide which index each ticker belongs to. Index membership changes
several times a year (additions, deletions, mergers, ticker changes), so the
lists are FETCHED from a named upstream rather than typed into source: a
hand-maintained list silently rots into delisted symbols that the screener then
records as failed_count, or — worse — into symbols that have been reassigned to
a different company.

Every entry records its source URL and the date it was fetched, so a stale
cache is visible rather than assumed current.

Stdlib only (urllib + html.parser + json), because this runs on the Pi where
the screener venv carries no HTML-parsing dependency.

Usage:
    python3 pi-scripts/fetch_universe_constituents.py            # all indices
    python3 pi-scripts/fetch_universe_constituents.py --only "Russell 2000"
    python3 pi-scripts/fetch_universe_constituents.py --dry-run  # report only

A source that fails leaves the PREVIOUS list in place (fail-soft) rather than
writing an empty index, so one upstream outage cannot silently shrink the
scanned universe. Exit code is non-zero if any requested index failed.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import sys
from datetime import date
from html.parser import HTMLParser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline_runtime import RequestFailed, atomic_write_json, request_json, request_text

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(HERE, "universe_constituents.json")

# Two header sets, because the upstreams want opposite things and urllib's
# default UA is refused by all of them.
#
# Wikipedia's User-Agent policy asks automated clients to identify themselves
# with a contact, so WIKI_HEADERS does that. The JSON endpoints do the reverse:
# Nasdaq's API silently BLACK-HOLES a request carrying a "compatible; <bot>"
# UA — the connection hangs until the read times out rather than returning an
# error — so API_HEADERS sends a plain browser UA. Verified 2026-07-26: the
# descriptive UA times out on every retry, the plain one returns in 0.3s.
WIKI_HEADERS = {
    "User-Agent": "maplegamma-universe-fetch/1.0 (https://maplegamma.com; index constituent cache)",
    "Accept": "text/html",
}
API_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
}


# ── Ticker normalisation ───────────────────────────────────────
# Upstreams disagree on how to punctuate share classes. Wikipedia writes
# "BRK.B", Vanguard writes "MOG.A", yfinance wants "BRK-B" / "MOG-A" — the
# convention the existing curated lists in generate-screener-data.py already
# use. Normalise once here so the screener never has to care where a symbol
# came from.
def normalize_symbol(raw: str) -> str | None:
    symbol = (raw or "").strip().upper()
    if not symbol:
        return None
    symbol = symbol.replace(".", "-").replace("/", "-")
    # Cash, futures and FX rows in ETF holdings files carry placeholder
    # "tickers" that are not tradable equities.
    if symbol in {"-", "--", "CASH", "USD", "N-A", "NA"}:
        return None
    if not all(c.isalnum() or c == "-" for c in symbol):
        return None
    if len(symbol) > 12:
        return None
    return symbol


# ── Wikipedia constituent tables ───────────────────────────────

class _WikiTable(HTMLParser):
    """Extract the rows of the <table id="constituents"> wikitable."""

    def __init__(self, table_id: str):
        super().__init__()
        self.table_id = table_id
        self.rows: list[list[str]] = []
        self._depth = 0
        self._active = False
        self._row: list[str] | None = None
        self._cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "table":
            if not self._active and attributes.get("id") == self.table_id:
                self._active = True
            if self._active:
                self._depth += 1
        elif self._active:
            if tag == "tr":
                self._row = []
            elif tag in ("td", "th"):
                self._cell = []

    def handle_endtag(self, tag):
        if not self._active:
            return
        if tag == "table":
            self._depth -= 1
            if self._depth == 0:
                self._active = False
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None
        elif tag in ("td", "th") and self._cell is not None:
            if self._row is not None:
                self._row.append(" ".join("".join(self._cell).split()))
            self._cell = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)

    def handle_entityref(self, name):
        if self._cell is not None:
            self._cell.append(html.unescape(f"&{name};"))

    def handle_charref(self, name):
        if self._cell is not None:
            self._cell.append(html.unescape(f"&#{name};"))


def fetch_wikipedia(url: str, table_id: str = "constituents") -> list[dict[str, str]]:
    """Rows of a Wikipedia index-constituents table as {symbol, name}."""
    parser = _WikiTable(table_id)
    parser.feed(request_text(url, headers=WIKI_HEADERS, timeout=45))
    rows = parser.rows
    if len(rows) < 2:
        raise RequestFailed(f"no rows in table#{table_id} at {url}")

    header = [c.lower() for c in rows[0]]
    try:
        symbol_col = next(i for i, h in enumerate(header) if h in ("symbol", "ticker"))
    except StopIteration as exc:
        raise RequestFailed(f"no symbol column in table#{table_id} at {url}: {header}") from exc
    name_col = next((i for i, h in enumerate(header) if h in ("security", "company", "name")), None)

    out: list[dict[str, str]] = []
    for row in rows[1:]:
        if len(row) <= symbol_col:
            continue
        symbol = normalize_symbol(row[symbol_col])
        if not symbol:
            continue
        name = row[name_col] if name_col is not None and len(row) > name_col else ""
        out.append({"symbol": symbol, "name": name})
    return out


# ── Nasdaq-100 ─────────────────────────────────────────────────
# The Nasdaq-100 components table was removed from the Wikipedia article, so
# this reads Nasdaq's own index-membership endpoint instead.

def fetch_nasdaq100(url: str) -> list[dict[str, str]]:
    payload = request_json(url, headers=API_HEADERS, timeout=45)
    rows = (((payload or {}).get("data") or {}).get("data") or {}).get("rows") or []
    out: list[dict[str, str]] = []
    for row in rows:
        symbol = normalize_symbol(str(row.get("symbol") or ""))
        if symbol:
            out.append({"symbol": symbol, "name": str(row.get("companyName") or "")})
    if not out:
        raise RequestFailed(f"no rows in Nasdaq-100 payload at {url}")
    return out


# ── Russell 2000 ───────────────────────────────────────────────
# Russell publishes no free constituent file, so this reads the holdings of a
# Russell 2000 index tracker (Vanguard VTWO) as a proxy. Consequences worth
# knowing: holdings are dated to a month-end reporting date, not today, and an
# index fund's holdings can differ slightly from the index itself (sampling,
# pending-trade timing, cash). The as-of date is recorded in the cache.

def fetch_vanguard_holdings(url: str) -> tuple[list[dict[str, str]], str]:
    out: list[dict[str, str]] = []
    seen: set[str] = set()
    start = 1
    as_of = ""
    while True:
        page = request_json(f"{url}?start={start}&count=500", headers=API_HEADERS, timeout=60)
        as_of = as_of or str(page.get("asOfDate") or "")[:10]
        entities = ((page or {}).get("fund") or {}).get("entity") or []
        if not entities:
            break
        for entity in entities:
            symbol = normalize_symbol(str(entity.get("ticker") or ""))
            if symbol and symbol not in seen:
                seen.add(symbol)
                out.append({"symbol": symbol, "name": str(entity.get("longName") or "")})
        if not page.get("next"):
            break
        start += 500
        if start > 5000:  # runaway guard
            break
    if not out:
        raise RequestFailed(f"no holdings returned by {url}")
    return out, as_of


# ── Source registry ────────────────────────────────────────────
# Keys are the universe labels the screener and the site UI display verbatim.

SOURCES = {
    "S&P 500": {
        "url": "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies",
        "kind": "wikipedia",
        "note": "Wikipedia 'List of S&P 500 companies', table#constituents.",
    },
    "S&P 400": {
        "url": "https://en.wikipedia.org/wiki/List_of_S%26P_400_companies",
        "kind": "wikipedia",
        "note": "S&P MidCap 400. Wikipedia 'List of S&P 400 companies', table#constituents.",
    },
    "S&P 600": {
        "url": "https://en.wikipedia.org/wiki/List_of_S%26P_600_companies",
        "kind": "wikipedia",
        "note": "S&P SmallCap 600. Wikipedia 'List of S&P 600 companies', table#constituents.",
    },
    "Nasdaq-100": {
        "url": "https://api.nasdaq.com/api/quote/list-type/nasdaq100",
        "kind": "nasdaq",
        "note": "Nasdaq's own index-membership endpoint (the Wikipedia article no longer carries a components table).",
    },
    "Russell 2000": {
        "url": "https://investor.vanguard.com/investment-products/etfs/profile/api/vtwo/portfolio-holding/stock",
        "kind": "vanguard",
        "note": (
            "Proxy: holdings of Vanguard's Russell 2000 ETF (VTWO), not the index itself. "
            "Holdings are reported to a month-end date and can differ slightly from index "
            "membership."
        ),
    },
}


def load_cache() -> dict:
    try:
        with open(CACHE_PATH, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh the index constituent cache.")
    parser.add_argument("--only", action="append", default=None,
                        help="Refresh just this index (repeatable). Default: all.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch and report counts without writing the cache.")
    args = parser.parse_args()

    wanted = args.only or list(SOURCES)
    unknown = [name for name in wanted if name not in SOURCES]
    if unknown:
        print(f"Unknown index name(s): {unknown}. Known: {list(SOURCES)}", file=sys.stderr)
        return 2

    cache = load_cache()
    indices = cache.get("indices") or {}
    today = date.today().isoformat()
    failures: list[str] = []

    for name in wanted:
        source = SOURCES[name]
        try:
            as_of = ""
            if source["kind"] == "wikipedia":
                members = fetch_wikipedia(source["url"])
            elif source["kind"] == "nasdaq":
                members = fetch_nasdaq100(source["url"])
            elif source["kind"] == "vanguard":
                members, as_of = fetch_vanguard_holdings(source["url"])
            else:
                raise RequestFailed(f"unknown source kind {source['kind']!r}")
        except Exception as exc:  # noqa: BLE001 — one bad upstream must not abort the rest
            failures.append(name)
            previous = len((indices.get(name) or {}).get("members") or [])
            print(f"  {name}: FAILED ({type(exc).__name__}: {exc}) — keeping previous {previous} member(s)",
                  file=sys.stderr)
            continue

        indices[name] = {
            "source_url": source["url"],
            "source_note": source["note"],
            "fetched_at": today,
            "as_of": as_of or today,
            "member_count": len(members),
            "members": sorted(members, key=lambda m: m["symbol"]),
        }
        print(f"  {name}: {len(members)} members", file=sys.stderr)

    if args.dry_run:
        print("Dry run — cache not written.", file=sys.stderr)
        return 1 if failures else 0

    atomic_write_json(CACHE_PATH, {
        "_note": (
            "Index membership cache for generate-screener-data.py. Regenerate with "
            "fetch_universe_constituents.py — do not hand-edit; membership changes "
            "several times a year and a stale hand-edit becomes wrong silently."
        ),
        "generated_at": today,
        "indices": indices,
    })
    print(f"Wrote {CACHE_PATH}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
