import asyncio
import importlib.util
import json
import math
import sys
import tempfile
import unittest
import urllib.error
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock


SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

import council_weighting
import pipeline_runtime
import pipeline_schemas


def load_script(name):
    path = SCRIPT_DIR / name
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


fetch_sec_filings = load_script("fetch_sec_filings.py")
fetch_alternative_data = load_script("fetch_alternative_data.py")
fetch_earnings = load_script("fetch_earnings.py")


class PipelineRuntimeTests(unittest.TestCase):
    def test_request_json_retries_429_and_honors_finite_json(self):
        response = mock.MagicMock()
        response.__enter__.return_value.read.return_value = b'{"ok": true}'
        limited = urllib.error.HTTPError("https://example.test", 429, "limited", {"Retry-After": "0"}, None)
        with mock.patch("urllib.request.urlopen", side_effect=[limited, response]) as urlopen:
            result = pipeline_runtime.request_json(
                "https://example.test",
                retry=pipeline_runtime.RetryConfig(attempts=2, base_delay=0, jitter=0),
            )
        self.assertEqual(result, {"ok": True})
        self.assertEqual(urlopen.call_count, 2)

    def test_pool_bounds_concurrency_and_preserves_order(self):
        active = 0
        peak = 0

        def worker(value):
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            import time
            time.sleep(0.01)
            active -= 1
            return value * 2

        result = asyncio.run(pipeline_runtime.run_blocking_pool(range(6), worker, max_concurrency=2))
        self.assertEqual(result, [0, 2, 4, 6, 8, 10])
        self.assertLessEqual(peak, 2)


class ArtifactSchemaTests(unittest.TestCase):
    def test_rejects_non_finite_values(self):
        with self.assertRaises(pipeline_schemas.ArtifactValidationError):
            pipeline_schemas.validate_artifact("accuracy.json", {"profit_factor": math.inf})

    def test_validates_council_envelope(self):
        payload = {
            "meta": {"generated_at": "2026-07-22T00:00:00Z"},
            "market_pulse": {"regime": "neutral", "score": 5, "confidence": 7, "one_liner": "Mixed."},
            "risks": ["Macro event"],
            "trades": [],
            "narrative": "Balanced conditions.",
        }
        self.assertIs(pipeline_schemas.validate_artifact("maplegamma_analysis.json", payload), payload)

    def test_strict_loader_rejects_infinity(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "accuracy.json"
            path.write_text('{"profit_factor": Infinity}')
            with self.assertRaises(pipeline_schemas.ArtifactValidationError):
                pipeline_schemas.load_and_validate_artifact(path)


class CollectorRegressionTests(unittest.TestCase):
    def test_sec_parser_includes_form_4_and_builds_archive_url(self):
        payload = {
            "name": "Example Corp",
            "filings": {"recent": {
                "accessionNumber": ["0000320193-26-000001", "0000320193-26-000002"],
                "form": ["4", "8-K"],
                "primaryDocument": ["xslF345X02/form4.xml", "report.htm"],
                "filingDate": ["2026-07-21", "2026-07-20"],
                "acceptanceDateTime": ["20260721120000", "20260720120000"],
                "reportDate": ["2026-07-21", "2026-07-20"],
            }},
        }
        filings = fetch_sec_filings.parse_submission_filings(payload, "320193")
        self.assertEqual([item["type"] for item in filings], ["4"])
        self.assertIn("/320193/000032019326000001/xslF345X02/form4.xml", filings[0]["url"])

    def test_tiingo_key_is_used_before_fallback(self):
        prices = [{"close": 10}, {"close": 11}]
        with mock.patch.object(fetch_alternative_data, "fetch_prices", return_value=prices) as tiingo, mock.patch.object(
            fetch_alternative_data, "fetch_yfinance_prices"
        ) as fallback:
            result, source = fetch_alternative_data.fetch_price_chain("AAPL", api_key="secret")
        self.assertEqual((result, source), (prices, "tiingo"))
        tiingo.assert_called_once_with("AAPL", 30, "daily", "secret")
        fallback.assert_not_called()

    def test_earnings_all_tickers_reads_current_screener_schema(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, "screener-data.json").write_text(json.dumps({
                "tickers": [{"ticker": "AAPL"}, {"ticker": "MSFT"}],
            }))
            with mock.patch.object(fetch_earnings, "DATA_DIR", directory):
                self.assertEqual(fetch_earnings.get_tickers_from_screener(), ["AAPL", "MSFT"])


class CouncilWeightingTests(unittest.TestCase):
    def test_pin_heavy_opex_increases_quantitative_weight(self):
        context = council_weighting.RegimeContext(vix=18, pin_distance_pct=0.2, days_to_expiry=1)
        weights = council_weighting.dynamic_model_weights(context, [])
        self.assertGreater(weights["quantitative_gex"], weights["momentum"])
        self.assertAlmostEqual(sum(weights.values()), 1.0, places=5)

    def test_recent_matching_outcomes_outweigh_old_mismatched_history(self):
        now = datetime(2026, 7, 22, tzinfo=timezone.utc)
        outcomes = [
            council_weighting.ScoredOutcome("risk_contrarian", True, now - timedelta(days=1), frozenset({"high_vix"})),
            council_weighting.ScoredOutcome("momentum", True, now - timedelta(days=180), frozenset({"low_vix"})),
        ]
        weights = council_weighting.dynamic_model_weights(
            council_weighting.RegimeContext(vix=31), outcomes, now=now
        )
        self.assertGreater(weights["risk_contrarian"], weights["momentum"])


if __name__ == "__main__":
    unittest.main()
