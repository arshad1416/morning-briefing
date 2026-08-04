"""Tests for the R2 sync failure split that ended the 2026-07-30 outage.

On 2026-07-30 an `Infinity` in accuracy.json (a Pro-tier artifact the free
dashboard never reads) made r2_sync report one "skipped" file, and
push_dashboard.py's fail-closed check refused to publish ANY public data. The
site served five-day-old numbers until it was found.

The property pinned here: a BAD-DATA rejection and a TRANSPORT failure are
different things. Bad data goes to `invalid` — the caller skips that one file
and publishes the rest. Transport/credential problems go to `failed` — the
caller aborts, because R2 itself is unhealthy. Collapsing the two back into one
counter reintroduces the outage.

Runs without the Pi venv: boto3/botocore/pydantic are stubbed.
"""

import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))


def _stub_deps(upload_raises=()):
    """Stub the deps r2_sync pulls in, so this runs off-Pi.

    ``upload_raises`` is a set of keys whose upload_file should blow up, which is
    how we simulate a transport failure without touching the network.
    """
    if "pydantic" not in sys.modules:
        pyd = types.ModuleType("pydantic")

        class BaseModel:
            model_config = None

            @classmethod
            def model_validate(cls, payload):
                return payload

        class ValidationError(Exception):
            pass

        pyd.BaseModel = BaseModel
        pyd.ValidationError = ValidationError
        pyd.ConfigDict = lambda **kw: kw
        pyd.Field = lambda *a, **kw: None
        sys.modules["pydantic"] = pyd

    class _Client:
        def upload_file(self, path, bucket, key, ExtraArgs=None):
            if key in upload_raises:
                raise OSError(f"simulated transport failure for {key}")

    boto3 = types.ModuleType("boto3")
    boto3.client = lambda *a, **kw: _Client()
    sys.modules["boto3"] = boto3

    botocore = types.ModuleType("botocore")
    cfg = types.ModuleType("botocore.config")
    cfg.Config = lambda **kw: None
    botocore.config = cfg
    sys.modules["botocore"] = botocore
    sys.modules["botocore.config"] = cfg


def load_r2_sync(upload_raises=()):
    _stub_deps(upload_raises)
    spec = importlib.util.spec_from_file_location("r2_sync_uut", SCRIPT_DIR / "r2_sync.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    # Pretend creds exist; _load_r2_env reads a file that is not there off-Pi.
    module._load_r2_env = lambda: {
        "R2_ACCESS_KEY_ID": "k",
        "R2_SECRET_ACCESS_KEY": "s",
        "R2_S3_ENDPOINT": "https://example.invalid",
    }
    return module


GOOD = '{"expectancy": {"profit_factor": 2.5}}'
BAD = '{"expectancy": {"profit_factor": Infinity}}'


class FailureSplitTest(unittest.TestCase):
    def _run_with(self, files, upload_raises=()):
        mod = load_r2_sync(upload_raises)
        tmp = tempfile.mkdtemp()
        for name, body in files.items():
            (Path(tmp) / name).write_text(body)
        mod.DATA_DIR = tmp
        return mod.sync_private_to_r2()

    def test_bad_data_is_invalid_not_failed_and_others_still_upload(self):
        uploaded, invalid, failed = self._run_with(
            {"accuracy.json": BAD, "journal.json": GOOD, "earnings.json": GOOD}
        )
        # The whole point: the bad file does not stop the good ones.
        self.assertEqual(uploaded, 2)
        self.assertEqual(len(invalid), 1)
        self.assertIn("accuracy.json", invalid[0])
        self.assertEqual(failed, [], "bad data must never be reported as a transport failure")

    def test_transport_failure_is_failed_not_invalid(self):
        uploaded, invalid, failed = self._run_with(
            {"journal.json": GOOD, "earnings.json": GOOD}, upload_raises={"journal.json"}
        )
        self.assertEqual(uploaded, 1)
        self.assertEqual(invalid, [], "a transport failure must never be reported as bad data")
        self.assertEqual(len(failed), 1)
        self.assertIn("journal.json", failed[0])

    def test_all_good_reports_nothing_wrong(self):
        uploaded, invalid, failed = self._run_with({"journal.json": GOOD, "earnings.json": GOOD})
        self.assertEqual((uploaded, invalid, failed), (2, [], []))

    def test_missing_credentials_is_a_hard_failure(self):
        # Used to return (0, 0), letting the publish proceed with premium files
        # silently never uploaded.
        mod = load_r2_sync()
        mod._load_r2_env = lambda: {}
        uploaded, invalid, failed = mod.sync_private_to_r2()
        self.assertEqual(uploaded, 0)
        self.assertEqual(invalid, [])
        self.assertTrue(failed, "missing R2 creds must abort the publish, not pass silently")


if __name__ == "__main__":
    unittest.main()
