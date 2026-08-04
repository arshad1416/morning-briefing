"""_run_step must never let an optional sub-script kill the publish.

push_gex.py has twice hit its 120s timeout in production. The bare
subprocess.run(..., timeout=120) raised TimeoutExpired, nothing caught it, and
main() died before the git commit at the end — a silent publish freeze with the
same shape as the 2026-07-30 outage. Every one of these steps already tolerated
a non-zero exit code, so a timeout is just another optional-step failure.

Runs without the Pi venv: push_dashboard's market-data imports are stubbed.
"""

import importlib.util
import subprocess
import sys
import textwrap
import tempfile
import types
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))


def load_push_dashboard():
    for name in ("pandas", "numpy", "yfinance"):
        sys.modules.setdefault(name, types.ModuleType(name))
    ys = types.ModuleType("yfinance_session")
    ys.download = lambda *a, **k: None
    ys.ticker = lambda *a, **k: None
    sys.modules.setdefault("yfinance_session", ys)
    spec = importlib.util.spec_from_file_location("push_dashboard_uut", SCRIPT_DIR / "push_dashboard.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def write_script(body):
    f = tempfile.NamedTemporaryFile("w", suffix=".py", delete=False)
    f.write(textwrap.dedent(body))
    f.close()
    return f.name


class RunStepTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_push_dashboard()

    def test_timeout_does_not_propagate(self):
        slow = write_script("import time; time.sleep(30)")
        # The regression: this used to raise TimeoutExpired and kill the publish.
        try:
            self.mod._run_step("slow step", slow, 1)
        except subprocess.TimeoutExpired:
            self.fail("_run_step let TimeoutExpired escape — publish would freeze")

    def test_nonzero_exit_does_not_propagate(self):
        failing = write_script("import sys; sys.stderr.write('boom'); sys.exit(3)")
        self.mod._run_step("failing step", failing, 10)  # must not raise

    def test_missing_script_is_skipped(self):
        self.mod._run_step("absent step", "/nonexistent/nope.py", 10)  # must not raise

    def test_success_still_runs(self):
        ok = write_script("print('did the work')")
        self.mod._run_step("ok step", ok, 10)  # must not raise


if __name__ == "__main__":
    unittest.main()
