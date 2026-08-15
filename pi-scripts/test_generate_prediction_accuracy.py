import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))  # the module imports pipeline_runtime
MODULE_PATH = Path(__file__).with_name("generate_prediction_accuracy.py")
spec = importlib.util.spec_from_file_location("generate_prediction_accuracy", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)


class ProfitFactorTest(unittest.TestCase):
    def test_profit_factor_is_json_null_when_there_are_no_losses(self):
        metrics = module.compute_expectancy([5.03])

        assert metrics["profit_factor"] is None
        assert "Infinity" not in json.dumps(metrics, allow_nan=False)

    def test_profit_factor_remains_numeric_when_losses_exist(self):
        metrics = module.compute_expectancy([5.0, -2.0])

        assert metrics["profit_factor"] == 2.5
        assert json.loads(json.dumps(metrics, allow_nan=False))["profit_factor"] == 2.5


class MainOutputTest(unittest.TestCase):
    # These were pytest-style functions (tmp_path/monkeypatch fixtures) in a repo
    # with no pytest anywhere in CI, so `python3 -m unittest` collected zero of
    # them and reported success. unittest so they actually run.
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        tmp_path = Path(self._tmp.name)
        self._saved = {k: getattr(module, k) for k in ("DATA_DIR", "INTEL_DIR", "OUTPUT", "LEDGER")}
        module.DATA_DIR = str(tmp_path / "data")
        module.INTEL_DIR = str(tmp_path / "intel")
        module.OUTPUT = str(tmp_path / "data" / "accuracy.json")
        module.LEDGER = str(tmp_path / "intel" / "paper_trading.json")
        os.makedirs(module.DATA_DIR, exist_ok=True)
        os.makedirs(module.INTEL_DIR, exist_ok=True)

    def tearDown(self):
        for k, v in self._saved.items():
            setattr(module, k, v)
        self._tmp.cleanup()

    def _run(self, ledger):
        with open(module.LEDGER, "w") as f:
            json.dump(ledger, f)
        module.main()
        return json.loads(Path(module.OUTPUT).read_text())

    def test_main_writes_fresh_accuracy_json_when_no_closed_trades(self):
        # Regression (2026-08-06): with zero closed trades main() returned early and
        # NEVER wrote accuracy.json — the file went stale and tripped the watchdog's
        # "accuracy.json not regenerated today" freshness check. A zero-trade day is
        # a valid state; the file must still be regenerated with a schema-identical,
        # zeroed payload so generated_at stays fresh.
        out = self._run({
            "account": {"starting_balance": 2000, "current_balance": 2050},
            "open_trades": [{"ticker": "SPY", "quantity": 10}],
            "closed_trades": [],
        })

        assert out["generated_at"]
        assert out["summary"]["closed_trades"] == 0
        assert out["summary"]["open_positions"] == 1
        assert out["summary"]["total_trades"] == 1
        assert out["summary"]["win_rate"] == 0.0
        assert out["per_strategy"] == []
        assert out["rolling_20"]["current"] is None
        assert json.dumps(out, allow_nan=False)  # must be strict-JSON serializable

    def test_summary_reports_the_prune_immune_lifetime_window(self):
        # The 08:00 Turso archive empties closed_trades but not metadata's
        # counters. summary must publish the lifetime window — the same one
        # push_dashboard.py puts on /positions — or the site shows two win rates
        # for one account under the same label.
        out = self._run({
            "account": {"starting_balance": 100000, "current_balance": 89655.18},
            "open_trades": [{"ticker": t} for t in ("XLV", "KO", "DIA", "IWM", "XLK")],
            "closed_trades": [],
            "metadata": {"total_trades": 84, "winning_trades": 37, "losing_trades": 42},
        })

        assert out["summary"]["closed_trades"] == 79
        assert out["summary"]["win_rate"] == 46.8
        assert out["summary"]["total_trades"] == 84
        assert out["summary"]["open_positions"] == 5

    def test_win_rate_and_closed_trades_always_share_one_denominator(self):
        # The consistency check the file was missing: a win rate is only
        # publishable next to the count it was computed from. Fails if summary
        # is ever re-pointed at the pruned closed_trades list.
        meta = {"winning_trades": 3, "losing_trades": 5}
        out = self._run({
            "account": {"starting_balance": 2000, "current_balance": 2100},
            "open_trades": [],
            "closed_trades": [{"ticker": "SPY", "pnl_pct": 4.0, "strategy": "momentum"}],
            "metadata": meta,
        })

        wins, losses = meta["winning_trades"], meta["losing_trades"]
        assert out["summary"]["closed_trades"] == wins + losses
        assert out["summary"]["win_rate"] == round(wins / (wins + losses) * 100, 1)
        # the pnl-derived block keeps its own, smaller sample — it is the only
        # window that still has pnl_pct data, and it must stay distinguishable
        assert out["expectancy"]["n_trades"] == 1


if __name__ == "__main__":
    unittest.main()
