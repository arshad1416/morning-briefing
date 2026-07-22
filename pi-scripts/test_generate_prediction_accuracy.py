import importlib.util
import json
from pathlib import Path


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
