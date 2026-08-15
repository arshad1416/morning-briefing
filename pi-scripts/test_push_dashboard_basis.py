"""/positions must publish ONE cost basis: Σ row pnl == the header tile.

The header sums the ledger cost (`Σ market_value − Σ entry_value`), but the rows
used to derive `entry_price` from a yfinance close on the entry date and compute
`(current − that) × qty`. Two different bases for the same account. On the
2026-08-14 17:15 payload the header said 425.07 and the rows summed to 361.67 —
a $63.40 gap that was NOT a fixed constant (same-day entries contributed 0 until
the next session). The same column, labelled "Entry Price", published the
entry-date close instead of the booked fill: IWM 299.98 vs the booked 296.19,
which mis-rendered the badge as "Up 0-2%" where the booked basis gives 3.00%.

push_dashboard.py imports yfinance/pandas at module scope, so these pin the
*expressions* rather than importing the module — the same approach
test_push_autostash_conflict.py takes. Runs anywhere python3 does.
"""

import pathlib
import re
import unittest

SOURCE = (pathlib.Path(__file__).parent / "push_dashboard.py").read_text()


class ShippedSourceTests(unittest.TestCase):
    """The arithmetic below is a copy, so it stays green even if push_dashboard.py
    is reverted. These bind it to the file that actually ships."""

    def test_entry_price_comes_from_the_ledger(self):
        self.assertIn("entry_price = round(ledger_entry_value / qty, 2)", SOURCE)

    def test_no_yfinance_rederivation_survives(self):
        self.assertNotIn("get_entry_price", SOURCE)
        # the reverted row pnl: (current_price - entry_price) * qty
        self.assertIsNone(
            re.search(r"'pnl':\s*round\(\(current_price - entry_price\) \* qty", SOURCE)
        )

    def test_row_pnl_differences_the_same_numbers_the_header_does(self):
        self.assertIn("'pnl': round(market_val - ledger_entry_value, 2)", SOURCE)


def open_row(qty, entry_value, current_price):
    """push_dashboard.py open-positions loop — the entry_price / market_value /
    pnl trio, verbatim."""
    entry_price = round(entry_value / qty, 2)
    market_val = round(current_price * qty, 2)
    return {
        'entry_price': entry_price,
        'entry_value': entry_value,
        'market_value': market_val,
        'pnl': round(market_val - entry_value, 2),
        'pnl_pct': round((current_price - entry_price) / entry_price * 100, 2) if entry_price > 0 else 0,
    }


def header(rows):
    """The portfolio tile: invested / market_value / unrealized_pnl."""
    invested = round(sum(float(r['entry_value']) for r in rows), 2)
    market_value = round(sum(float(r['market_value']) for r in rows), 2)
    return round(market_value - invested, 2)


# The five open positions in the 2026-08-14 17:15:03 payload, with the
# entry_value the engine actually debited from cash (ledger paper_trading.json).
LIVE = [
    # ticker, qty, entry_value, current_price
    ("DIA", 16, 8646.88, 536.80),
    ("IWM", 30, 8885.70, 305.09),
    ("XLK", 47, 8784.30, 190.01),
    ("XLV", 53, 8927.32, 167.37),
    ("KO", 103, 8907.44, 87.71),
]


class OneCostBasisTests(unittest.TestCase):
    def test_live_payload_rows_sum_to_the_header(self):
        rows = [open_row(q, ev, cp) for _, q, ev, cp in LIVE]
        self.assertEqual(round(sum(r['pnl'] for r in rows), 2), header(rows))
        # The header was always right; it is the rows that moved onto its basis.
        self.assertEqual(header(rows), 425.07)

    def test_fractional_quantity_still_reconciles(self):
        # entry_value/qty does not round-trip through 2dp here, which is exactly
        # what the hoisted market_val absorbs: pnl is market_value − entry_value,
        # never (current − entry_price) × qty.
        rows = [open_row(0.5, 50.01, 110.0), open_row(1.5, 150.02, 99.99)]
        self.assertEqual(round(sum(r['pnl'] for r in rows), 2), header(rows))

    def test_entry_price_is_the_booked_fill_not_the_entry_date_close(self):
        booked = {"DIA": 540.43, "IWM": 296.19, "XLK": 186.90}
        for ticker, qty, ev, cp in LIVE:
            if ticker in booked:
                with self.subTest(ticker=ticker):
                    self.assertEqual(open_row(qty, ev, cp)['entry_price'], booked[ticker])

    def test_iwm_badge_crosses_the_two_percent_band(self):
        # 1.70 rendered "Up 0-2%"; the booked basis is 3.00 -> "Up 2-5%".
        self.assertEqual(open_row(30, 8885.70, 305.09)['pnl_pct'], 3.00)


def closed_row(c, qty):
    """push_dashboard.py closed-trades loop — booked fills and booked pnl."""
    entry_price = round(float(c.get('entry_price') or 0), 2)
    exit_price = round(float(c.get('exit_price') or 0), 2)
    entry_value = float(c.get("entry_value") or 0) or round(entry_price * qty, 2)
    pnl_usd = round(float(c.get('pnl') or 0), 2)
    return {
        'entry_price': entry_price,
        'exit_price': exit_price,
        'pnl_usd': pnl_usd,
        'pnl_pct': round(pnl_usd / entry_value * 100, 2) if entry_value else 0,
    }


class ClosedTradeBasisTests(unittest.TestCase):
    """closed_trades is empty in the live ledger, so these pin the contract
    against what paper_trading.py close_trade() writes."""

    def test_stock_pnl_is_the_booked_number_not_a_yfinance_rederivation(self):
        # close_trade: pnl = (exit − entry) × qty, cash += entry_value + pnl.
        r = closed_row({'entry_price': 100.0, 'exit_price': 110.0,
                        'entry_value': 1000.0, 'pnl': 100.0}, 10)
        self.assertEqual(r['pnl_usd'], 100.0)
        self.assertEqual(r['pnl_pct'], 10.0)
        self.assertEqual(r['entry_price'], 100.0)

    def test_option_pct_survives_the_100x_cad_multiplier(self):
        # entry_value = qty × premium × 100 × rate, and pnl carries the same
        # factor, so it cancels in pnl/entry_value. Per-unit prices stay native.
        rate = 1.38
        r = closed_row({'entry_price': 2.00, 'exit_price': 3.00,
                        'entry_value': round(2 * 2.00 * 100 * rate, 2),
                        'pnl': round((3.00 - 2.00) * 2 * 100 * rate, 2)}, 2)
        self.assertEqual(r['entry_price'], 2.00)
        self.assertEqual(r['pnl_pct'], 50.0)

    def test_demo_rows_lack_entry_value_and_fall_back_to_price_times_qty(self):
        # load_demo_account() emits pnl/entry_price/quantity but no entry_value.
        r = closed_row({'entry_price': 50.0, 'exit_price': 55.0, 'pnl': 25.0}, 5)
        self.assertEqual(r['pnl_usd'], 25.0)
        self.assertEqual(r['pnl_pct'], 10.0)


if __name__ == '__main__':
    unittest.main()
