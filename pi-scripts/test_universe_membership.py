"""Tests for the screener's multi-index universe membership.

The property that matters here is that a ticker can belong to more than one
universe. Under the old single-valued `universe` field the membership map was
first-wins, so ~85% of the Nasdaq-100 (which is almost entirely a subset of the
S&P 500) was unreachable through a Nasdaq-100 filter. These tests pin that down
along with the guarantee that the DEFAULT scan is unchanged — the Pi cron runs
generate-screener-data.py with no arguments, and an accidental 4x scan would
blow past its rate-limited fetch budget.
"""

import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))


def load_generator():
    """Import generate-screener-data.py with its market-data deps stubbed.

    The module imports pandas/numpy/yfinance at top level for the fetch and
    scoring paths. None of that is exercised by the universe logic, and the
    stubs keep this test runnable anywhere the Pi venv is not installed.
    """
    for name in ("pandas", "numpy", "yfinance"):
        sys.modules.setdefault(name, types.ModuleType(name))
    path = SCRIPT_DIR / "generate-screener-data.py"
    spec = importlib.util.spec_from_file_location("generate_screener_data", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


gs = load_generator()


class DefaultScanUnchangedTests(unittest.TestCase):
    def test_default_scan_matches_the_legacy_curated_walk(self):
        """No --universes must reproduce the pre-multi-index ticker list exactly."""
        legacy, seen = [], set()
        for tickers in gs.CURATED_UNIVERSES.values():
            for ticker in tickers:
                if ticker not in seen:
                    legacy.append(ticker)
                    seen.add(ticker)

        scanned, _labels = gs.resolve_scan_set(None)
        self.assertEqual(scanned, legacy)

    def test_default_scan_does_not_pull_in_index_constituents(self):
        scanned, labels = gs.resolve_scan_set(None)
        self.assertNotIn("Russell 2000", labels)
        # The curated lists are a few hundred names; the indices together are
        # thousands. A default that grew past the curated total would mean the
        # unattended cron silently started a multi-hour scan.
        self.assertLessEqual(len(scanned), sum(len(t) for t in gs.CURATED_UNIVERSES.values()))


class MultiMembershipTests(unittest.TestCase):
    def test_a_ticker_may_belong_to_several_universes(self):
        memberships = gs.TICKER_UNIVERSES.get("AAPL", set())
        # AAPL is in both, and the whole point of the array is that asking for
        # either index finds it.
        self.assertIn("S&P 500", memberships)
        if "Nasdaq-100" in gs.INDEX_UNIVERSES:
            self.assertIn("Nasdaq-100", memberships)

    def test_nasdaq_100_is_not_swallowed_by_the_sp500(self):
        """The regression the single-valued field caused, stated as a test."""
        if "Nasdaq-100" not in gs.INDEX_UNIVERSES:
            self.skipTest("no Nasdaq-100 in the constituent cache")
        nasdaq = gs.INDEX_UNIVERSES["Nasdaq-100"]
        reachable = [t for t in nasdaq if "Nasdaq-100" in gs.TICKER_UNIVERSES.get(t, set())]
        self.assertEqual(len(reachable), len(nasdaq))

    def test_continued_splits_collapse_to_one_canonical_name(self):
        self.assertEqual(gs.canonical_universe("S&P 500 (continued 2)"), "S&P 500")
        self.assertEqual(gs.canonical_universe("TSX 60"), "TSX 60")
        for memberships in gs.TICKER_UNIVERSES.values():
            for name in memberships:
                self.assertNotIn("(continued", name)

    def test_singular_universe_is_retained_for_back_compat(self):
        """Consumers written against the old shape must keep working."""
        self.assertEqual(gs.TICKER_UNIVERSE.get("AAPL"), "S&P 500")
        self.assertEqual(gs.TICKER_UNIVERSE.get("TD.TO"), "TSX 60")


class ResolveScanSetTests(unittest.TestCase):
    def test_named_index_uses_the_fetched_list_not_the_curated_sample(self):
        """The hand-typed sample is stale; the fetched list is the index."""
        if "S&P 500" not in gs.INDEX_UNIVERSES:
            self.skipTest("no S&P 500 in the constituent cache")
        scanned, labels = gs.resolve_scan_set(["S&P 500"])
        self.assertEqual(labels, ["S&P 500"])
        self.assertEqual(sorted(scanned), sorted(gs.INDEX_UNIVERSES["S&P 500"]))
        self.assertEqual(len(scanned), len(set(scanned)), "scan set must be deduplicated")

    def test_a_stale_curated_symbol_does_not_claim_index_membership(self):
        """The rot the fetch-don't-type design exists to keep out of the filter.

        The curated "S&P 500" chunks still list names the index dropped (ZION
        was removed in 2024, CAG in 2026). They stay in the default scan, but
        they must not answer an "is it in the S&P 500?" filter with yes.
        """
        if "S&P 500" not in gs.INDEX_UNIVERSES:
            self.skipTest("no S&P 500 in the constituent cache")
        curated = set()
        for key, members in gs.CURATED_UNIVERSES.items():
            if key.startswith("S&P 500"):
                curated |= set(members)
        stale = curated - set(gs.INDEX_UNIVERSES["S&P 500"])
        self.assertTrue(stale, "expected the hand-typed sample to have drifted")
        for ticker in stale:
            self.assertNotIn(
                "S&P 500", gs.TICKER_UNIVERSES.get(ticker, set()),
                f"{ticker} is not in the fetched index but claims membership",
            )

    def test_a_current_index_member_does_claim_membership(self):
        if "S&P 500" not in gs.INDEX_UNIVERSES:
            self.skipTest("no S&P 500 in the constituent cache")
        for ticker in gs.INDEX_UNIVERSES["S&P 500"][:50]:
            self.assertIn("S&P 500", gs.TICKER_UNIVERSES.get(ticker, set()))

    def test_add_universes_extends_the_default_instead_of_replacing_it(self):
        """The output file is the whole screener, not a per-universe shard.

        --universes REPLACES, so naming only the new indices would drop every
        name it did not name. --add-universes is the union, and adding an index
        to the live site has to be a union or the site loses coverage.
        """
        available = [n for n in ("S&P 400", "S&P 600", "Nasdaq-100") if n in gs.INDEX_UNIVERSES]
        if not available:
            self.skipTest("no index constituents cached")

        default, default_labels = gs.resolve_scan_set(None)
        replaced, _ = gs.resolve_scan_set(available)
        extended, extended_labels = gs.resolve_scan_set(None, added=available)

        self.assertTrue(set(default) - set(replaced), "--universes should drop names (that is the trap)")
        self.assertEqual(set(default) - set(extended), set(), "--add-universes must drop nothing")
        self.assertEqual(extended[:len(default)], default, "default names keep their order and position")
        self.assertEqual(len(extended), len(set(extended)), "union must be deduplicated")
        for label in default_labels + available:
            self.assertIn(label, extended_labels)

    def test_unknown_universe_fails_loudly(self):
        with self.assertRaises(SystemExit):
            gs.resolve_scan_set(["Definitely Not An Index"])

    def test_multiple_universes_are_deduplicated_across_overlap(self):
        available = [n for n in ("S&P 600", "Russell 2000") if n in gs.INDEX_UNIVERSES]
        if len(available) < 2:
            self.skipTest("need both S&P 600 and Russell 2000 in the cache")
        scanned, labels = gs.resolve_scan_set(available)
        self.assertEqual(labels, available)
        self.assertEqual(len(scanned), len(set(scanned)))
        # These two indices overlap heavily, so the union must be smaller than
        # the sum — otherwise the same ticker gets fetched twice.
        self.assertLess(len(scanned), sum(len(gs.INDEX_UNIVERSES[n]) for n in available))


class ConstituentCacheTests(unittest.TestCase):
    def test_missing_cache_degrades_to_curated_lists(self):
        with tempfile.TemporaryDirectory() as directory:
            members, sources = gs.load_index_constituents(Path(directory) / "absent.json")
        self.assertEqual(members, {})
        self.assertEqual(sources, {})

    def test_an_index_with_no_members_is_dropped_rather_than_offered_empty(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump({"indices": {
                "Empty Index": {"members": [], "source_url": "x", "as_of": "2026-01-01"},
                "Real Index": {"members": [{"symbol": "aapl"}], "source_url": "y", "as_of": "2026-01-01"},
            }}, handle)
            path = handle.name
        members, sources = gs.load_index_constituents(path)
        self.assertNotIn("Empty Index", members)
        self.assertEqual(members["Real Index"], ["AAPL"], "symbols are upper-cased on load")
        self.assertEqual(sources["Real Index"]["member_count"], 1)


if __name__ == "__main__":
    unittest.main()
