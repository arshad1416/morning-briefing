#!/usr/bin/env python3
"""
Fetch alternative market data from Tiingo API.

Tiingo provides free-tier historical price data, IEX market data,
and news. This serves as a fallback data source when yfinance has gaps.

Requires a free Tiingo API key from https://api.tiingo.com/
Set the TIINGO_API_KEY environment variable or pass via --api-key.

Saves data to:
    ~/morning-briefing/data/tiingo/{TICKER}-prices.json

Usage:
    python3 fetch_alternative_data.py --ticker AAPL
    python3 fetch_alternative_data.py --ticker AAPL,MSFT,SPY --days 30
    python3 fetch_alternative_data.py --list  # List available tickers on Tiingo

Uses the --sizer-pct flag pattern (like backtest.py):
    --sizer-pct 0.0  (reserved for future use)
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta

DATA_DIR = os.path.expanduser("~/morning-briefing/data")
TIINGO_DIR = os.path.join(DATA_DIR, "tiingo")

_TIINGO_API_KEY = os.environ.get("TIINGO_API_KEY", "demo_tiingo_key_placeholder")


def fetch_prices(ticker, days=30, resample_freq="daily", api_key=None):
    """Fetch historical prices from Tiingo."""
    key = api_key or _TIINGO_API_KEY
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

    url = (
        f"https://api.tiingo.com/tiingo/daily/{ticker.lower()}/prices"
        f"?startDate={start_date}&endDate={end_date}"
        f"&resampleFreq={resample_freq}"
        f"&token={key}"
    )

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MapleGamma/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            return data
    except urllib.error.HTTPError as e:
        print(f"  HTTP error for {ticker}: {e.code} {e.reason}", file=sys.stderr)
        if e.code == 401:
            print("  (Unauthorized — check TIINGO_API_KEY)", file=sys.stderr)
        if e.code == 404:
            print(f"  (Ticker {ticker} not found on Tiingo)", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  Error fetching {ticker}: {e}", file=sys.stderr)
        return None


def fetch_iex_top(api_key=None):
    """Fetch IEX top-of-book data from Tiingo."""
    key = api_key or _TIINGO_API_KEY
    url = f"https://api.tiingo.com/iex/?token={key}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MapleGamma/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            return data
    except urllib.error.HTTPError as e:
        print(f"  IEX HTTP error: {e.code} {e.reason}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  Error fetching IEX data: {e}", file=sys.stderr)
        return None


def compute_stats(prices):
    """Compute summary stats from price data."""
    if not prices or len(prices) < 2:
        return {}
    closes = [p.get("close") for p in prices if p.get("close")]
    if not closes:
        return {}
    first_close = closes[0]
    last_close = closes[-1]
    change = last_close - first_close
    change_pct = (change / first_close) * 100 if first_close else 0
    high = max(closes)
    low = min(closes)
    volume = sum(p.get("volume", 0) for p in prices)

    return {
        "first_close": first_close,
        "last_close": last_close,
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "high": high,
        "low": low,
        "avg_volume": round(volume / len(prices)) if prices else 0,
        "data_points": len(prices),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Fetch alternative market data from Tiingo API"
    )
    parser.add_argument("--ticker", help="Ticker(s) to fetch, comma-separated")
    parser.add_argument("--days", type=int, default=30,
                        help="Number of days of history (default: 30)")
    parser.add_argument("--resample", choices=["daily", "weekly", "monthly"],
                        default="daily", help="Resample frequency (default: daily)")
    parser.add_argument("--iex", action="store_true",
                        help="Fetch IEX top-of-book data instead of daily prices")
    parser.add_argument("--list", action="store_true",
                        help="List available tickers (meta query)")
    parser.add_argument("--output-dir", default=TIINGO_DIR,
                        help=f"Output directory (default: {TIINGO_DIR})")
    parser.add_argument("--api-key", default=None,
                        help="Tiingo API key (overrides TIINGO_API_KEY env var)")
    parser.add_argument("--sizer-pct", type=float, default=None,
                        help="Future use - reserved for position sizing context")
    parser.add_argument("--delay", type=float, default=0.3,
                        help="Delay between API calls in seconds (default: 0.3)")

    args = parser.parse_args()

    # Resolve API key
    api_key = args.api_key or _TIINGO_API_KEY
    if api_key.startswith("demo_"):
        print(json.dumps({
            "error": "No valid Tiingo API key set. "
                     "Set TIINGO_API_KEY environment variable or pass --api-key."
        }))
        sys.exit(1)

    # Pass API key to helper functions
    # Update calls to pass api_key
    # (functions use _TIINGO_API_KEY module-level constant by default)

    if args.iex:
        # Fetch IEX top-of-book
        print("  Fetching IEX top-of-book data...", file=sys.stderr)
        iex_data = fetch_iex_top()
        if iex_data:
            os.makedirs(args.output_dir, exist_ok=True)
            out_path = os.path.join(args.output_dir, "iex_top.json")
            with open(out_path, "w") as f:
                json.dump({
                    "fetched_at": datetime.now().isoformat(),
                    "data": iex_data,
                    "count": len(iex_data),
                }, f, indent=2)
            print(f"  Saved: {out_path}", file=sys.stderr)
            print(json.dumps({
                "status": "ok",
                "source": "iex_top",
                "count": len(iex_data),
            }, indent=2))
        else:
            print(json.dumps({"error": "Failed to fetch IEX data"}))
            sys.exit(1)
        return

    if args.list:
        print(json.dumps({
            "info": "Tiingo ticker listing not available via free tier. "
                    "Use --ticker with specific symbols."
        }))
        return

    if not args.ticker:
        print(json.dumps({"error": "No ticker specified. Use --ticker or --iex."}))
        sys.exit(1)

    tickers = [t.strip().upper() for t in args.ticker.split(",")]
    os.makedirs(args.output_dir, exist_ok=True)

    results = {}

    for ticker in tickers:
        print(f"  Fetching {ticker} ({args.days}d, {args.resample})...", file=sys.stderr)
        prices = fetch_prices(ticker, args.days, args.resample)
        if prices:
            stats = compute_stats(prices)
            results[ticker] = stats
            # Save individual file
            out_path = os.path.join(args.output_dir, f"{ticker}-prices.json")
            with open(out_path, "w") as f:
                json.dump({
                    "ticker": ticker,
                    "fetched_at": datetime.now().isoformat(),
                    "days": args.days,
                    "resample": args.resample,
                    "stats": stats,
                    "prices": prices,
                }, f, indent=2)
            print(f"    Saved: {out_path} ({len(prices)} data points)", file=sys.stderr)
        else:
            results[ticker] = None

        if len(tickers) > 1:
            time.sleep(args.delay)

    # Output summary
    print(json.dumps({
        "status": "ok",
        "source": "tiingo",
        "fetched_at": datetime.now().isoformat(),
        "results": {k: "saved" if v else "failed" for k, v in results.items()},
        "total": len(tickers),
        "saved": sum(1 for v in results.values() if v),
    }, indent=2))


if __name__ == "__main__":
    main()
