import importlib.util
import json
import os
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent))  # the module imports pipeline_runtime
MODULE_PATH = Path(__file__).with_name("generate_prediction_accuracy.py")
spec = importlib.util.spec_from_file_location("generate_prediction_accuracy", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)


def test_profit_factor_is_json_null_when_there_are_no_losses():
    metrics = module.compute_expectancy([5.03])

    assert metrics["profit_factor"] is None
    assert "Infinity" not in json.dumps(metrics, allow_nan=False)


def test_profit_factor_remains_numeric_when_losses_exist():
    metrics = module.compute_expectancy([5.0, -2.0])

    assert metrics["profit_factor"] == 2.5
    assert json.loads(json.dumps(metrics, allow_nan=False))["profit_factor"] == 2.5


def test_main_writes_fresh_accuracy_json_when_no_closed_trades(tmp_path, monkeypatch):
    # Regression (2026-08-06): with zero closed trades main() returned early and
    # NEVER wrote accuracy.json — the file went stale and tripped the watchdog's
    # "accuracy.json not regenerated today" freshness check. A zero-trade day is
    # a valid state; the file must still be regenerated with a schema-identical,
    # zeroed payload so generated_at stays fresh.
    monkeypatch.setattr(module, "DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setattr(module, "INTEL_DIR", str(tmp_path / "intel"))
    monkeypatch.setattr(module, "OUTPUT", str(tmp_path / "data" / "accuracy.json"))
    monkeypatch.setattr(module, "LEDGER", str(tmp_path / "intel" / "paper_trading.json"))
    os.makedirs(module.DATA_DIR, exist_ok=True)
    os.makedirs(module.INTEL_DIR, exist_ok=True)

    ledger = {
        "account": {"starting_balance": 2000, "current_balance": 2050},
        "open_trades": [{"ticker": "SPY", "quantity": 10}],
        "closed_trades": [],
    }
    with open(module.LEDGER, "w") as f:
        json.dump(ledger, f)

    module.main()

    out = json.loads(Path(module.OUTPUT).read_text())
    assert out["generated_at"]
    assert out["summary"]["closed_trades"] == 0
    assert out["summary"]["open_positions"] == 1
    assert out["summary"]["total_trades"] == 1
    assert out["summary"]["win_rate"] == 0.0
    assert out["per_strategy"] == []
    assert out["rolling_20"]["current"] is None
    assert json.dumps(out, allow_nan=False)  # must be strict-JSON serializable
