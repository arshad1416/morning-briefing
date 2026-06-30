#!/usr/bin/env python3
"""
Add a trading journal entry.

Appends structured journal entries to ~/morning-briefing/data/journal.json.
Each entry records trade psychology, grade, and lessons learned — similar
to TraderSync pattern.

Usage:
    python3 add_journal_entry.py --ticker AAPL --grade B --emotion "FOMO" --lesson "Stopped out too early"
    python3 add_journal_entry.py --ticker NVDA --grade A --emotion "Confident" --mistake "None" --lesson "Followed plan exactly"
    python3 add_journal_entry.py --trade-id "t20260630_001" --ticker TSLA --entry-date 2026-06-20 --exit-date 2026-06-30 --grade C --emotion "Anxiety" --mistake "Moved stop too tight" --lesson "Let winners run"

Optional --sizer-pct flag follows the backtest.py convention:
    --sizer-pct 0.02    Use 2% of account for sizing context
"""

import argparse
import json
import os
import sys
from datetime import datetime


DATA_DIR = os.path.expanduser("~/morning-briefing/data")
JOURNAL_FILE = os.path.join(DATA_DIR, "journal.json")


def load_journal():
    """Load existing journal entries."""
    if not os.path.exists(JOURNAL_FILE):
        return []
    try:
        with open(JOURNAL_FILE, "r") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        # Handle wrapped format
        if isinstance(data, dict) and "entries" in data:
            return data["entries"]
        return []
    except (json.JSONDecodeError, IOError):
        return []


def save_journal(entries):
    """Save journal entries to file."""
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(JOURNAL_FILE, "w") as f:
        json.dump({"entries": entries, "updated_at": datetime.now().isoformat()}, f, indent=2)


def generate_trade_id(ticker, entry_date):
    """Generate a unique trade ID."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"t{ts}_{ticker}"


def main():
    parser = argparse.ArgumentParser(
        description="Add a trading journal entry (TraderSync-style)"
    )
    parser.add_argument("--trade-id", help="Existing trade ID (auto-generated if omitted)")
    parser.add_argument("--ticker", required=True, help="Ticker symbol")
    parser.add_argument("--entry-date", help="Entry date (YYYY-MM-DD). Defaults to today.")
    parser.add_argument("--exit-date", help="Exit date (YYYY-MM-DD)")
    parser.add_argument("--emotion", default="Neutral",
                        help="Emotion at time of trade (FOMO, Anxiety, Confident, Greed, Hope, Fear, Neutral)")
    parser.add_argument("--grade", default="B",
                        choices=["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"],
                        help="Grade for the trade (A-F)")
    parser.add_argument("--lesson", default="", help="Key lesson learned")
    parser.add_argument("--mistake", default="", help="Mistake made (if any)")
    parser.add_argument("--sizer-pct", type=float, default=None,
                        help="Position size as fraction of account (e.g. 0.02 = 2%%)")
    parser.add_argument("--notes", default="", help="Free-form notes")
    parser.add_argument("--strategy", default="",
                        help="Strategy used (e.g. mean_reversion, breakout)")

    args = parser.parse_args()

    # Load existing entries
    entries = load_journal()

    # Generate trade ID if not provided
    trade_id = args.trade_id or generate_trade_id(args.ticker, args.entry_date or datetime.now().strftime("%Y-%m-%d"))
    entry_date = args.entry_date or datetime.now().strftime("%Y-%m-%d")

    # Build entry
    entry = {
        "trade_id": trade_id,
        "ticker": args.ticker.upper(),
        "entry_date": entry_date,
        "exit_date": args.exit_date or "",
        "emotion": args.emotion,
        "grade": args.grade,
        "lesson": args.lesson,
        "mistake": args.mistake,
        "notes": args.notes,
        "strategy": args.strategy,
        "created_at": datetime.now().isoformat(),
    }

    if args.sizer_pct is not None:
        entry["sizer_pct"] = args.sizer_pct

    entries.append(entry)
    save_journal(entries)

    result = {
        "status": "ok",
        "trade_id": trade_id,
        "total_entries": len(entries),
        "entry": entry,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
