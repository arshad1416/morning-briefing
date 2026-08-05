"""Tests for fetch_universe_constituents.py's Russell 2000 sources.

The iShares IWM feed (BlackRock's undocumented product-data API) became the
primary Russell 2000 proxy on 2026-08-04, replacing Vanguard's month-end VTWO
file. These tests pin down the parsing contract: equity-only filtering, symbol
normalisation, dedupe, the yyyymmdd -> ISO as-of conversion, and the VTWO
fallback path when BlackRock is unreachable.
"""

import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fetch_universe_constituents as f  # noqa: E402


def make_payload(tickers, classes, as_of=20260803, names=None):
    """A minimal BlackRock product-data payload shaped like the live one."""
    return {
        "componentsByNameMap": {
            "holdings": {
                "containersByNameMap": {
                    "all": {
                        "dataPointsByNameMap": {
                            "ticker": {"value": tickers},
                            "issueName": {"value": names or [f"NAME {t}" for t in tickers]},
                            "assetClass": {"value": classes},
                            "asOfDate": {"value": as_of},
                        }
                    }
                }
            }
        }
    }


class IWMHoldingsParsingTests(unittest.TestCase):
    def test_keeps_equities_and_dedupes(self):
        payload = make_payload(
            ["AAA", "BBB", "USD", "AAA"],
            ["Equity", "Equity", "Cash", "Equity"],
        )
        with patch.object(f, "request_json", return_value=payload):
            members, as_of = f.fetch_ishares_holdings("https://example.test/api")
        symbols = [m["symbol"] for m in members]
        self.assertEqual(symbols, ["AAA", "BBB"])  # duplicate AAA dropped
        self.assertEqual(members[0]["name"], "NAME AAA")

    def test_filters_all_non_equity_balances(self):
        payload = make_payload(
            ["AAA", "CASH", "MM1", "FUT"],
            ["Equity", "Cash", "Money Market", "Futures"],
        )
        with patch.object(f, "request_json", return_value=payload):
            members, _ = f.fetch_ishares_holdings("https://example.test/api")
        self.assertEqual([m["symbol"] for m in members], ["AAA"])

    def test_normalises_share_class_punctuation(self):
        payload = make_payload(["BRK.B", "MOG.A"], ["Equity", "Equity"])
        with patch.object(f, "request_json", return_value=payload):
            members, _ = f.fetch_ishares_holdings("https://example.test/api")
        self.assertEqual([m["symbol"] for m in members], ["BRK-B", "MOG-A"])

    def test_as_of_integer_converts_to_iso(self):
        payload = make_payload(["AAA"], ["Equity"], as_of=20260803)
        with patch.object(f, "request_json", return_value=payload):
            _, as_of = f.fetch_ishares_holdings("https://example.test/api")
        self.assertEqual(as_of, "2026-08-03")

    def test_raises_when_payload_has_no_equity_rows(self):
        payload = make_payload(["USD", "CASH"], ["Cash", "Cash"])
        with patch.object(f, "request_json", return_value=payload):
            with self.assertRaises(f.RequestFailed):
                f.fetch_ishares_holdings("https://example.test/api")

    def test_raises_when_payload_is_malformed(self):
        with patch.object(f, "request_json", return_value={"unexpected": True}):
            with self.assertRaises(f.RequestFailed):
                f.fetch_ishares_holdings("https://example.test/api")


class RussellFallbackTests(unittest.TestCase):
    def test_primary_success_reports_no_fallback(self):
        source = {"url": "iwm-url", "fallback_url": "vtwo-url"}
        with patch.object(f, "fetch_ishares_holdings", return_value=([{"symbol": "AAA"}], "2026-08-03")):
            members, as_of, used_fallback = f.fetch_russell2000(source)
        self.assertEqual(members, [{"symbol": "AAA"}])
        self.assertEqual(as_of, "2026-08-03")
        self.assertFalse(used_fallback)

    def test_blackrock_failure_falls_back_to_vanguard(self):
        source = {"url": "iwm-url", "fallback_url": "vtwo-url"}
        with patch.object(f, "fetch_ishares_holdings", side_effect=f.RequestFailed("boom")), \
             patch.object(f, "fetch_vanguard_holdings",
                          return_value=([{"symbol": "BBB"}], "2026-06-30")):
            members, as_of, used_fallback = f.fetch_russell2000(source)
        self.assertEqual(members, [{"symbol": "BBB"}])
        self.assertEqual(as_of, "2026-06-30")
        self.assertTrue(used_fallback)

    def test_fallback_failure_propagates(self):
        source = {"url": "iwm-url", "fallback_url": "vtwo-url"}
        with patch.object(f, "fetch_ishares_holdings", side_effect=f.RequestFailed("boom")), \
             patch.object(f, "fetch_vanguard_holdings", side_effect=f.RequestFailed("boom2")):
            with self.assertRaises(f.RequestFailed):
                f.fetch_russell2000(source)


if __name__ == "__main__":
    unittest.main()
