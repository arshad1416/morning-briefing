#!/usr/bin/env python3
"""Regression test for the pre-batch-snapshot bug in automated_paper_trader.py.

Every limit used to be evaluated once, before the entry loop, against the book
as it stood pre-batch. Reproduces the two breaches observed on 2026-08-03:
  - 10 positions entered under MAX_PORTFOLIO_POSITIONS = 5
  - JPM, V and XLF all entered as group='financial' under MAX_IN_HIGH_GROUP = 2

Run on the Pi:  python3 ~/.hermes/scripts/test_entry_recheck.py
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.expanduser("~/.hermes/scripts"))
sys.path.insert(0, os.path.expanduser("~/.hermes/skills/finance/scripts"))
# Whatever sits next to this test wins, so the suite can be run against a
# candidate copy without touching the deployed script.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import automated_paper_trader as apt
import signal_validator as sv


def pos(ticker, qty=10, price=100.0):
    return {"ticker": ticker, "quantity": qty, "entry_price": price,
            "direction": "long", "stop_loss": None}


class PreBatchSnapshot(unittest.TestCase):
    """entry_blocked() must read the CURRENT book, not a pre-batch snapshot."""

    EQUITY = 100_000.0

    def block(self, book, ticker, price=100.0, stop=97.0):
        return apt.entry_blocked(book, ticker, "long", price, stop, self.EQUITY)

    # ── the count cap actually binds, per entry ──

    def test_empty_book_allows_entry(self):
        self.assertIsNone(self.block([], "AAPL"))

    def test_blocks_at_the_cap_not_past_it(self):
        # One ticker per correlation group, so the COUNT cap is what binds here
        # and not the correlation cap (which has its own test below).
        book = [pos(t) for t in ("SPY", "IWM", "XLE", "XLP")]
        self.assertEqual(len(book), apt.MAX_PORTFOLIO_POSITIONS - 1)
        self.assertIsNone(self.block(book, "MRK"), "4 open under a cap of 5 must pass")
        book.append(pos("MRK"))
        self.assertIn("portfolio limit", self.block(book, "NVDA") or "",
                      "5th open position must block the 6th")

    def test_the_aug3_batch_cannot_repeat(self):
        """The real failure: gate passes at 4 open, then 10 go in.

        Simulate the loop the way the fixed code runs it — re-check against the
        growing book. It must stop at the cap instead of running to 10.
        """
        book, entered = [pos(t) for t in ("IWM", "XLF", "XLU", "TSLA")], []
        candidates = ["AMZN", "JPM", "V", "ABBV", "CPER",
                      "SPY", "XLE", "XLP", "MRK", "KO"]
        for tk in candidates:
            if self.block(book, tk):
                break
            book.append(pos(tk))
            entered.append(tk)
        self.assertLessEqual(len(book), apt.MAX_PORTFOLIO_POSITIONS)
        self.assertLess(len(entered), 10, "pre-fix behaviour: all 10 entered")

    # ── the correlation cap actually binds, per entry ──

    def test_third_financial_is_blocked(self):
        """JPM/V/XLF all entered on Aug 3 against MAX_IN_HIGH_GROUP = 2."""
        for t in ("JPM", "V", "XLF"):
            self.assertEqual(sv.get_correlation_group(t), "financial",
                             f"{t} must be in the financial group for this test")
        book = []
        self.assertIsNone(self.block(book, "JPM"))
        book.append(pos("JPM"))
        self.assertIsNone(self.block(book, "V"))
        book.append(pos("V"))
        self.assertIn("financial", self.block(book, "XLF") or "",
                      "3rd financial must be blocked by the correlation cap")

    def test_uncorrelated_name_still_allowed_beside_two_financials(self):
        book = [pos("JPM"), pos("V")]
        self.assertIsNone(self.block(book, "XLE"),
                          "energy is a different group — must not be blocked")

    # ── ordering: the exit sweep must precede the gate ──

    def test_exits_run_before_the_position_gate(self):
        """Source-order check: the bug was that check_trade_exits ran only from
        inside enter_trade, i.e. after the gate had already counted the book."""
        with open(apt.__file__) as f:
            src = f.read()
        sweep = src.index("check_trade_exits()")
        gate = src.index("if open_positions >= MAX_PORTFOLIO_POSITIONS")
        self.assertLess(sweep, gate,
                        "check_trade_exits must run before the position gate")

    def test_loop_rechecks_before_every_entry(self):
        with open(apt.__file__) as f:
            src = f.read()
        recheck = src.index("entry_blocked(")
        enter = src.index("result = enter_trade(")
        self.assertLess(recheck, enter,
                        "entry_blocked must be evaluated before enter_trade")


if __name__ == "__main__":
    unittest.main(verbosity=2)
