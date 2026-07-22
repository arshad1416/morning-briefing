#!/usr/bin/env python3
"""
Fetch SEC EDGAR filings (10-K, 10-Q, Form 4) for tracked tickers.

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
import asyncio
import json
import os
import sys
from datetime import datetime

from pipeline_runtime import RequestFailed, atomic_write_json, request_json, run_blocking_pool

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


def get_tickers_from_cik_mapping():
    """Get all tickers with CIK mappings."""
    return list(CIK_MAPPING.keys())


def main():
    parser = argparse.ArgumentParser(
        description="Fetch SEC EDGAR filings (10-K, 10-Q, Form 4) for tracked tickers"
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
        tickers = get_tickers_from_cik_mapping()
        print(f"  Found {len(tickers)} tickers with CIK mappings", file=sys.stderr)
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
            print(f"  No CIK mapping for {ticker}. Skipping.", file=sys.stderr)
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
