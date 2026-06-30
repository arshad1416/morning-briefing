#!/usr/bin/env python3
"""
Fetch SEC EDGAR filings (10-K, 10-Q) for tracked tickers.

SEC EDGAR is free — no API key needed. Rate limit: 10 requests/sec max.
Uses a CIK lookup mapping for V3 tickers.

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
import json
import os
import sys
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime

DATA_DIR = os.path.expanduser("~/morning-briefing/data")
SEC_DIR = os.path.join(DATA_DIR, "sec")

# TIckER => CIK mapping for tracked tickers
# SEC requires CIK without leading zeros (though they accept padded)
CIK_MAPPING = {
    "AAPL": "320193",
    "MSFT": "789019",
    "GOOGL": "1652044",
    "GOOG": "1652044",
    "AMZN": "1018724",
    "NVDA": "1045810",
    "META": "1326801",
    "TSLA": "1318605",
    "JPM": "19617",
    "BAC": "70858",
    "WFC": "72971",
    "C": "831001",
    "GS": "886982",
    "V": "1403161",
    "MA": "1141391",
    "JNJ": "200406",
    "PFE": "78003",
    "UNH": "731766",
    "ABBV": "1551152",
    "MRK": "310158",
    "XOM": "34088",
    "CVX": "93410",
    "COP": "1163165",
    "SPY": "884887",
    "QQQ": "1067837",
    "IWM": "1047649",
    "TLT": "1223074",
    "XLF": "1094831",
    "XLK": "1094832",
    "XLE": "1094830",
    "XLV": "1094835",
    "XLI": "1094833",
    "XLP": "1094834",
    "XLU": "1094836",
    "XLB": "1094829",
    "XLRE": "1545457",
    "XLC": "1718730",
    "TD": "1002602",
    "RY": "1068760",
    "BNS": "9639",
    "BMO": "878510",
    "EFA": "1029091",
    "SPY": "884887",
    "DIA": "1067094",
    "GDX": "1224007",
    "IWM": "1047649",
    "IBIT": "1407797",
    "NKE": "320187",
    "DIS": "1744489",
    "NFLX": "1065280",
    "ADBE": "796343",
    "CRM": "1108524",
    "AMD": "2488",
    "INTC": "50863",
    "IBM": "51143",
    "ORCL": "1341439",
    "QCOM": "804328",
    "CSCO": "858877",
    "TXN": "97476",
    "AVGO": "1730168",
    "T": "732717",
    "VZ": "732712",
    "CMCSA": "1166691",
    "COST": "909832",
    "WMT": "104169",
    "HD": "354950",
    "LOW": "60667",
    "MCD": "63908",
    "SBUX": "829224",
    "BA": "12927",
    "CAT": "18230",
    "GE": "40545",
    "HON": "773840",
    "UNP": "1008835",
    "UPS": "1090727",
    "AMAT": "6951",
    "KLAC": "319201",
    "LRCX": "707549",
}

SEC_USER_AGENT = os.environ.get(
    "SEC_USER_AGENT",
    "MapleGamma/1.0 (contact@example.com)"
)

RATE_LIMIT_DELAY = 0.125  # 10/sec max, we do ~8/sec to be safe


def lookup_cik(ticker):
    """Look up CIK number for a ticker."""
    ticker = ticker.upper()
    if ticker in CIK_MAPPING:
        return CIK_MAPPING[ticker]
    return None


def fetch_filings(cik, count=10):
    """Fetch SEC filings via EDGAR Atom feed."""
    cik_padded = cik.zfill(10)
    url = (
        f"https://www.sec.gov/cgi-bin/browse-edgar"
        f"?action=getcompany&CIK={cik_padded}"
        f"&type=10-K,10-Q&output=atom&count={count}"
    )

    headers = {
        "User-Agent": SEC_USER_AGENT,
        "Accept": "application/xml, text/xml, */*",
        "Accept-Encoding": "gzip, deflate",
        "Host": "www.sec.gov",
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return parse_filings_xml(raw)
    except urllib.error.HTTPError as e:
        print(f"  HTTP error for CIK {cik}: {e.code} {e.reason}", file=sys.stderr)
        if e.code == 403:
            print("  (SEC blocking — check User-Agent header)", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  Error fetching CIK {cik}: {e}", file=sys.stderr)
        return None


def parse_filings_xml(xml_text):
    """Parse SEC Atom XML feed into structured filing entries."""
    filings = []
    try:
        root = ET.fromstring(xml_text)
        # Atom namespace
        ns = {
            "atom": "http://www.w3.org/2005/Atom",
            "sec": "http://schemas.xmlsoap.org/ws/2004/09/secext",
        }

        for entry in root.findall("atom:entry", ns):
            filing = {}
            title_el = entry.find("atom:title", ns)
            if title_el is not None:
                filing["title"] = title_el.text

            link_el = entry.find("atom:link", ns)
            if link_el is not None:
                filing["url"] = link_el.get("href", "")

            updated_el = entry.find("atom:updated", ns)
            if updated_el is not None:
                filing["date"] = updated_el.text[:10]

            summary_el = entry.find("atom:summary", ns)
            if summary_el is not None:
                filing["summary"] = summary_el.text

            # Extract filing type from title
            if filing.get("title"):
                title = filing["title"]
                if "10-K" in title:
                    filing["type"] = "10-K"
                    filing["form"] = "Annual Report"
                elif "10-Q" in title:
                    filing["type"] = "10-Q"
                    filing["form"] = "Quarterly Report"
                else:
                    filing["type"] = "Other"
                    filing["form"] = title

            # Extract period from summary if available
            if filing.get("summary"):
                summary = filing["summary"]
                for line in summary.split("."):
                    line = line.strip()
                    if "period" in line.lower() and ":" in line:
                        filing["period"] = line.split(":", 1)[1].strip()

            if filing.get("title"):
                filings.append(filing)

    except ET.ParseError as e:
        print(f"  XML parse error: {e}", file=sys.stderr)
        return None

    return filings


def get_tickers_from_cik_mapping():
    """Get all tickers with CIK mappings."""
    return list(CIK_MAPPING.keys())


def main():
    parser = argparse.ArgumentParser(
        description="Fetch SEC EDGAR filings (10-K, 10-Q) for tracked tickers"
    )
    parser.add_argument("--ticker", help="Ticker(s) to fetch, comma-separated")
    parser.add_argument("--all-tickers", action="store_true",
                        help="Fetch for all tickers with CIK mappings")
    parser.add_argument("--limit", type=int, default=10,
                        help="Max filings per ticker (default: 10)")
    parser.add_argument("--output-dir", default=SEC_DIR,
                        help=f"Output directory (default: {SEC_DIR})")
    parser.add_argument("--user-agent", default=None,
                        help="SEC User-Agent (overrides SEC_USER_AGENT env var)")
    parser.add_argument("--delay", type=float, default=0.125,
                        help=f"Delay between API calls in seconds (default: {RATE_LIMIT_DELAY})")
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
        tickers = get_tickers_from_cik_mapping()
        print(f"  Found {len(tickers)} tickers with CIK mappings", file=sys.stderr)
    elif args.ticker:
        tickers = [t.strip().upper() for t in args.ticker.split(",")]

    if not tickers:
        print(json.dumps({"error": "No tickers specified. Use --ticker or --all-tickers."}))
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    results = {}

    for ticker in tickers:
        cik = lookup_cik(ticker)
        if not cik:
            print(f"  No CIK mapping for {ticker}. Skipping.", file=sys.stderr)
            results[ticker] = {"error": "no_cik_mapping"}
            continue

        print(f"  Fetching SEC filings for {ticker} (CIK: {cik})...", file=sys.stderr)
        filings = fetch_filings(cik, args.limit)

        if filings is not None:
            results[ticker] = {
                "status": "ok",
                "count": len(filings),
            }
            out_path = os.path.join(args.output_dir, f"{ticker}-filings.json")
            with open(out_path, "w") as f:
                json.dump({
                    "ticker": ticker,
                    "cik": cik,
                    "fetched_at": datetime.now().isoformat(),
                    "filings": filings,
                    "count": len(filings),
                }, f, indent=2)
            print(f"    Saved {len(filings)} filings: {out_path}", file=sys.stderr)
        else:
            results[ticker] = {"error": "fetch_failed"}
            print(f"    Failed to fetch filings for {ticker}", file=sys.stderr)

        # Rate limiting — be nice to SEC
        time.sleep(args.delay)

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
