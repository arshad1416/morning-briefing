#!/usr/bin/env python3
"""
Fetch SEC EDGAR filings (10-K, 10-Q, Form 4) for tracked tickers.

SEC EDGAR is free — no API key needed. Rate limit: 10 requests/sec max.
Resolves ticker → CIK at runtime from the SEC's official mapping files
(company_tickers.json + company_tickers_mf.json), cached locally.

Saves filings to:
    ~/morning-briefing/data/sec/{TICKER}-filings.json

Usage:
    python3 fetch_sec_filings.py --ticker AAPL
    python3 fetch_sec_filings.py --ticker AAPL,MSFT,NVDA --limit 5
    python3 fetch_sec_filings.py --all-tickers

Note: SEC requires a User-Agent header in format "Company Name YourEmail".
Set SEC_USER_AGENT env var or pass --user-agent.
"""

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime

from pipeline_runtime import RequestFailed, atomic_write_json, request_json, run_blocking_pool

DATA_DIR = os.path.expanduser("~/morning-briefing/data")
SEC_DIR = os.path.join(DATA_DIR, "sec")

# Tracked tickers for --all-tickers. CIKs are resolved at runtime against the
# SEC's official mapping files — never hardcoded (hardcoded CIKs drifted and
# published other companies' filings under these tickers).
TRACKED_TICKERS = [
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA",
    "JPM", "BAC", "WFC", "C", "GS", "V", "MA",
    "JNJ", "PFE", "UNH", "ABBV", "MRK",
    "XOM", "CVX", "COP",
    "SPY", "QQQ", "IWM", "TLT",
    "XLF", "XLK", "XLE", "XLV", "XLI", "XLP", "XLU", "XLB", "XLRE", "XLC",
    "TD", "RY", "BNS", "BMO",
    "EFA", "DIA", "GDX", "IBIT",
    "NKE", "DIS", "NFLX", "ADBE", "CRM",
    "AMD", "INTC", "IBM", "ORCL", "QCOM", "CSCO", "TXN", "AVGO",
    "T", "VZ", "CMCSA",
    "COST", "WMT", "HD", "LOW", "MCD", "SBUX",
    "BA", "CAT", "GE", "HON", "UNP", "UPS",
    "AMAT", "KLAC", "LRCX",
]

# Official SEC ticker → CIK mapping files. company_tickers.json covers
# operating companies and many ETF trusts; company_tickers_mf.json covers
# funds/ETF share classes (e.g. the Select Sector SPDRs, iShares).
CIK_SOURCE_FILES = [
    ("company_tickers.json", "https://www.sec.gov/files/company_tickers.json"),
    ("company_tickers_mf.json", "https://www.sec.gov/files/company_tickers_mf.json"),
]
CIK_CACHE_MAX_AGE = 7 * 86400  # refresh weekly

_CIK_MAP = None  # lazy-built {TICKER: cik_str}

SEC_USER_AGENT = os.environ.get(
    "SEC_USER_AGENT",
    "MapleGamma/1.0 (contact@example.com)"
)

RATE_LIMIT_DELAY = 0.125  # 10/sec max, we do ~8/sec to be safe


def _fetch_cik_source(filename, url):
    """Download one SEC mapping file to a local cache, reusing a fresh copy.

    Falls back to a stale cache if the download fails; returns parsed JSON
    or None.
    """
    cache_path = os.path.join(SEC_DIR, filename)
    fresh = (
        os.path.exists(cache_path)
        and time.time() - os.path.getmtime(cache_path) < CIK_CACHE_MAX_AGE
    )
    if not fresh:
        headers = {
            "User-Agent": SEC_USER_AGENT,
            "Accept": "application/json",
        }
        try:
            data = request_json(url, headers=headers, timeout=30)
            os.makedirs(SEC_DIR, exist_ok=True)
            atomic_write_json(cache_path, data)
        except (RequestFailed, ValueError) as e:
            print(f"  Failed to download {url}: {e}", file=sys.stderr)
    try:
        with open(cache_path) as f:
            return json.load(f)
    except Exception:
        return None


def _build_cik_map():
    """Build {TICKER: cik_str} from the SEC's official mapping files."""
    cik_map = {}
    # Operating companies + many ETF trusts: {"0": {"cik_str": ..., "ticker": ...}, ...}
    data = _fetch_cik_source(*CIK_SOURCE_FILES[0])
    if isinstance(data, dict):
        for entry in data.values():
            try:
                cik_map.setdefault(entry["ticker"].upper(), str(int(entry["cik_str"])))
            except (KeyError, TypeError, ValueError):
                continue
    # Funds/ETFs: {"fields": ["cik","seriesId","classId","symbol"], "data": [[...], ...]}
    mf = _fetch_cik_source(*CIK_SOURCE_FILES[1])
    if isinstance(mf, dict) and isinstance(mf.get("data"), list):
        try:
            cik_i = mf["fields"].index("cik")
            sym_i = mf["fields"].index("symbol")
        except (KeyError, ValueError):
            cik_i, sym_i = 0, 3
        for row in mf["data"]:
            try:
                cik_map.setdefault(str(row[sym_i]).upper(), str(int(row[cik_i])))
            except (IndexError, TypeError, ValueError):
                continue
    return cik_map


def lookup_cik(ticker):
    """Look up CIK for a ticker via the SEC's official mapping (cached)."""
    global _CIK_MAP
    if _CIK_MAP is None:
        _CIK_MAP = _build_cik_map()
        if not _CIK_MAP:
            print("  Could not load SEC ticker→CIK mapping", file=sys.stderr)
    return _CIK_MAP.get(ticker.upper())


def parse_submission_filings(payload, cik, count=10, forms=("10-K", "10-Q", "4")):
    """Parse SEC submissions JSON into stable filing records."""
    recent = payload.get("filings", {}).get("recent", {})
    accepted_forms = {form.upper() for form in forms}
    records = []
    length = len(recent.get("accessionNumber", []))

    def at(field, index):
        values = recent.get(field, [])
        return values[index] if index < len(values) else ""

    for index in range(length):
        form = str(at("form", index)).upper()
        if form not in accepted_forms:
            continue
        accession = at("accessionNumber", index)
        document = at("primaryDocument", index)
        accession_path = str(accession).replace("-", "")
        url = (
            f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession_path}/{document}"
            if accession and document
            else ""
        )
        records.append({
            "title": f"{form} — {payload.get('name', '')}".strip(" —"),
            "url": url,
            "date": at("filingDate", index),
            "accepted_at": at("acceptanceDateTime", index),
            "accession_number": accession,
            "type": form,
            "form": "Annual Report" if form == "10-K" else "Quarterly Report" if form == "10-Q" else "Insider Transaction",
            "period": at("reportDate", index),
        })
        if len(records) >= count:
            break
    return records


def fetch_filings(cik, count=10, forms=("10-K", "10-Q", "4")):
    """Fetch SEC filings from the official submissions JSON endpoint."""
    cik_padded = cik.zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{cik_padded}.json"

    headers = {
        "User-Agent": SEC_USER_AGENT,
        "Accept": "application/json",
        "Accept-Encoding": "identity",
    }

    try:
        payload = request_json(url, headers=headers, timeout=30)
        return parse_submission_filings(payload, cik, count, forms)
    except (RequestFailed, ValueError) as e:
        print(f"  Error fetching CIK {cik}: {e}", file=sys.stderr)
        return None


def get_tracked_tickers():
    """Get all tracked tickers (CIKs resolved at runtime)."""
    return list(TRACKED_TICKERS)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch SEC EDGAR filings (10-K, 10-Q, Form 4) for tracked tickers"
    )
    parser.add_argument("--ticker", help="Ticker(s) to fetch, comma-separated")
    parser.add_argument("--all-tickers", action="store_true",
                        help="Fetch for all tracked tickers")
    parser.add_argument("--limit", type=int, default=10,
                        help="Max filings per ticker (default: 10)")
    parser.add_argument("--output-dir", default=SEC_DIR,
                        help=f"Output directory (default: {SEC_DIR})")
    parser.add_argument("--user-agent", default=None,
                        help="SEC User-Agent (overrides SEC_USER_AGENT env var)")
    parser.add_argument("--delay", type=float, default=0.125,
                        help=f"Delay between API calls in seconds (default: {RATE_LIMIT_DELAY})")
    parser.add_argument("--workers", type=int, default=4,
                        help="Maximum concurrent SEC requests (default: 4)")
    parser.add_argument("--forms", default="10-K,10-Q,4",
                        help="Comma-separated SEC forms (default: 10-K,10-Q,4)")
    parser.add_argument("--sizer-pct", type=float, default=None,
                        help="Future use - reserved for position sizing context")

    args = parser.parse_args()

    # Resolve User-Agent
    global SEC_USER_AGENT
    if args.user_agent:
        SEC_USER_AGENT = args.user_agent 

    # Determine tickers
    tickers = []
    if args.all_tickers:
        tickers = get_tracked_tickers()
        print(f"  Found {len(tickers)} tracked tickers", file=sys.stderr)
    elif args.ticker:
        tickers = [t.strip().upper() for t in args.ticker.split(",")]

    if not tickers:
        print(json.dumps({"error": "No tickers specified. Use --ticker or --all-tickers."}))
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    forms = tuple(form.strip().upper() for form in args.forms.split(",") if form.strip())

    def process_ticker(ticker):
        cik = lookup_cik(ticker)
        if not cik:
            print(f"  No CIK found for {ticker} in SEC mapping. Skipping.", file=sys.stderr)
            return ticker, {"error": "no_cik_mapping"}

        print(f"  Fetching SEC filings for {ticker} (CIK: {cik})...", file=sys.stderr)
        filings = fetch_filings(cik, args.limit, forms)

        if filings is not None:
            result = {
                "status": "ok",
                "count": len(filings),
            }
            out_path = os.path.join(args.output_dir, f"{ticker}-filings.json")
            atomic_write_json(out_path, {
                "ticker": ticker,
                "cik": cik,
                "fetched_at": datetime.now().isoformat(),
                "forms": list(forms),
                "filings": filings,
                "count": len(filings),
            })
            print(f"    Saved {len(filings)} filings: {out_path}", file=sys.stderr)
        else:
            result = {"error": "fetch_failed"}
            print(f"    Failed to fetch filings for {ticker}", file=sys.stderr)
        return ticker, result

    pairs = asyncio.run(run_blocking_pool(
        tickers,
        process_ticker,
        max_concurrency=args.workers,
        min_start_interval=max(args.delay, RATE_LIMIT_DELAY),
    ))
    results = dict(pairs)

    # Output summary
    success_count = sum(1 for r in results.values() if r.get("status") == "ok")
    print(json.dumps({
        "status": "ok",
        "fetched_at": datetime.now().isoformat(),
        "results": results,
        "total": len(tickers),
        "success": success_count,
        "failed": len(tickers) - success_count,
    }, indent=2))


if __name__ == "__main__":
    main()
