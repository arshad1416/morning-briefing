"""A NaN volume bar must null one field, not drop the whole ticker.

int(NaN) raises, and it raised INSIDE fetch_ticker_data's try — so it never
reached the NaN-scrubbing loop at the end and instead fell through to the
except handler, which logs and returns None for the entire company. The
2026-08-04 scan lost 27 tickers that way, 23 of them Russell 2000 constituents;
thin small caps are exactly where a session has no trades and where a listing
has under 50 bars for rolling(50).

Runs without the Pi venv — see load_generator() in test_universe_membership.
"""

import unittest

from test_universe_membership import load_generator

gs = load_generator()

NAN = float('nan')


class FiniteIntTests(unittest.TestCase):
    def test_nan_becomes_none_instead_of_raising(self):
        self.assertIsNone(gs._finite_int(NAN))

    def test_infinities_and_missing_become_none(self):
        for bad in (float('inf'), float('-inf'), None, '', 'n/a'):
            with self.subTest(bad=bad):
                self.assertIsNone(gs._finite_int(bad))

    def test_real_volume_survives_as_an_int(self):
        # yfinance hands back numpy floats, so truncation is the contract.
        self.assertEqual(gs._finite_int(1234567.0), 1234567)
        self.assertIsInstance(gs._finite_int(1234567.0), int)


class VolumeRatioTests(unittest.TestCase):
    """The expression at the `volume_ratio` key, which _finite_int now feeds Nones into."""

    @staticmethod
    def ratio(volume, avg_vol):
        return round(volume / avg_vol, 2) if volume is not None and avg_vol else None

    def test_unknown_volume_does_not_raise(self):
        # None / int was the second crash waiting behind the first fix.
        self.assertIsNone(self.ratio(None, 500))
        self.assertIsNone(self.ratio(1000, None))
        self.assertIsNone(self.ratio(None, None))

    def test_zero_average_is_unknown_not_average(self):
        self.assertIsNone(self.ratio(1000, 0))

    def test_known_volume_still_computes(self):
        self.assertEqual(self.ratio(1500, 1000), 1.5)


class ScoringToleratesMissingVolumeTests(unittest.TestCase):
    def test_none_ratio_scores_without_the_volume_surge_signal(self):
        _, reasons = gs.compute_score({'volume_ratio': None})
        self.assertNotIn('volume_surge', reasons)

    def test_a_real_surge_still_earns_the_signal(self):
        # Pins the pair: the absence above is the None path, not a dead branch.
        _, reasons = gs.compute_score({'volume_ratio': 2.0})
        self.assertIn('volume_surge', reasons)


if __name__ == '__main__':
    unittest.main()
