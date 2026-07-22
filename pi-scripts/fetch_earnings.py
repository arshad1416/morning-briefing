#!/usr/bin/env python3
"""
Fetch earnings call transcripts from Financial Modeling Prep (FMP) API.

Uses the free tier of fmp.cloud to retrieve earnings call transcripts
for tracked tickers. Saves each transcript to:
    ~/morning-briefing/data/earnings/{TICKER}-latest.json

Usage:
    python3 fetch_earnings.py --ticker AAPL
    python3 fetch_earnings.py --ticker AAPL,MSFT,NVDA --output-dir ~/morning-briefing/data/earnings
    python3 fetch_earnings.py --all-tickers  # reads from screener-data.json

Uses the --sizer-pct flag pattern (like backtest.py):
    --sizer-pct 0.0  (reserved for future position sizing in transcripts)
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime

from pipeline_runtime import RequestFailed, atomic_write_json, request_json, run_blocking_pool

DATA_DIR = os.path.expanduser("~/morning-briefing/data")
EARNINGS_DIR = os.path.join(DATA_DIR, "earnings")
FMP_API_KEY = os.environ.get("FMP_API_KEY", "demo")  # Replace with your key


def fetch_transcript(ticker, year=None, quarter=None, api_key=None):
    """Fetch earnings call transcript from FMP API."""
    base_url = "https://financialmodelingprep.com/api/v3/earning_call_transcript"
    params = f"?symbol={ticker.lower()}"
    if year:
        params += f"&year={year}"
    if quarter:
        params += f"&quarter={quarter}"
    params += f"&apikey={api_key or FMP_API_KEY}"

    url = base_url + params
    try:
        return request_json(url, headers={"User-Agent": "MapleGamma/1.0"}, timeout=30)
    except (RequestFailed, ValueError) as e:
        print(f"  Error fetching {ticker}: {e}", file=sys.stderr)
        return None


def get_tickers_from_screener():
    """Get tracked tickers from screener-data.json."""
    path = os.path.join(DATA_DIR, "screener-data.json")
    if not os.path.exists(path):
        print("  screener-data.json not found", file=sys.stderr)
        return []
    try:
        with open(path) as f:
            data = json.load(f)
        # Current screener schema stores rows in ``tickers``; retain the legacy
        # object scan as a fallback for older Pi snapshots.
        rows = data.get("tickers", []) if isinstance(data, dict) else []
        tickers = [row.get("ticker") for row in rows if isinstance(row, dict) and row.get("ticker")]
        if not tickers and isinstance(data, dict):
            tickers = [
                value["ticker"]
                for value in data.values()
                if isinstance(value, dict) and value.get("ticker")
            ]
        return tickers[:20]  # Limit to 20 due to API rate limits
    except Exception as e:
        print(f"  Error reading screener-data.json: {e}", file=sys.stderr)
        return []


def main():
    parser = argparse.ArgumentParser(
        description="Fetch earnings call transcripts from FMP API"
    )
    parser.add_argument("--ticker", help="Ticker(s) to fetch, comma-separated")
    parser.add_argument("--all-tickers", action="store_true",
                        help="Fetch for all tracked tickers in screener-data.json")
    parser.add_argument("--year", type=int, default=None,
                        help="Year of earnings call (default: latest)")
    parser.add_argument("--quarter", type=int, choices=[1, 2, 3, 4], default=None,
                        help="Quarter (default: latest)")
    parser.add_argument("--output-dir", default=EARNINGS_DIR,
                        help=f"Output directory (default: {EARNINGS_DIR})")
    parser.add_argument("--sizer-pct", type=float, default=None,
                        help="Future use - reserved for position sizing context")
    parser.add_argument("--delay", type=float, default=0.5,
                        help="Delay between API calls in seconds (default: 0.5)")
    parser.add_argument("--workers", type=int, default=3,
                        help="Maximum concurrent transcript requests (default: 3)")
    parser.add_argument("--api-key", default=None,
                        help="FMP API key (overrides FMP_API_KEY)")

    args = parser.parse_args()

    # Determine tickers
    tickers = []
    if args.all_tickers:
        tickers = get_tickers_from_screener()
        print(f"  Found {len(tickers)} tickers from screener", file=sys.stderr)
    elif args.ticker:
        tickers = [t.strip().upper() for t in args.ticker.split(",")]

    if not tickers:
        print(json.dumps({"error": "No tickers specified. Use --ticker or --all-tickers."}))
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    api_key = args.api_key or FMP_API_KEY

    def process_ticker(ticker):
        print(f"  Fetching transcript for {ticker}...", file=sys.stderr)
        data = fetch_transcript(ticker, args.year, args.quarter, api_key)
        if data:
            # Save individual file
            out_path = os.path.join(args.output_dir, f"{ticker}-latest.json")
            atomic_write_json(out_path, {
                "ticker": ticker,
                "fetched_at": datetime.now().isoformat(),
                "transcript": data,
            })
            print(f"    Saved: {out_path}", file=sys.stderr)
            return ticker, "saved"
        else:
            print(f"    No data for {ticker}", file=sys.stderr)
            return ticker, "no_data"

    pairs = asyncio.run(run_blocking_pool(
        tickers,
        process_ticker,
        max_concurrency=args.workers,
        min_start_interval=args.delay if len(tickers) > 1 else 0,
    ))
    results = dict(pairs)

    # Output summary
    print(json.dumps({
        "status": "ok",
        "fetched_at": datetime.now().isoformat(),
        "results": results,
        "total": len(tickers),
        "saved": sum(1 for value in results.values() if value == "saved"),
    }, indent=2))


if __name__ == "__main__":
    main()
