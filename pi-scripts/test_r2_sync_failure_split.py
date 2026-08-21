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
import os
import sys
import tempfile
import time
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


def write_fixtures(private_files, tmp, files):
    """Write fixture files, refusing names sync_private_to_r2 would never visit.

    The sync iterates PRIVATE_FILES only, so a fixture naming anything else
    silently asserts on nothing. That is exactly how this suite rotted silent:
    commit 65db938bd removed journal.json from PRIVATE_FILES (deliberately) and
    five tests kept driving fixtures the sync never touched. Takes the loaded
    module's list rather than loading one itself — re-loading here would
    re-stub boto3 and wipe a test's upload_raises wiring.
    """
    ungated = sorted(set(files) - set(private_files))
    if ungated:
        raise AssertionError(
            f"fixture file(s) {ungated} not in r2_sync.PRIVATE_FILES — "
            "sync_private_to_r2 never visits them, so these assertions exercise nothing"
        )
    for name, body in files.items():
        (Path(tmp) / name).write_text(body)


class FailureSplitTest(unittest.TestCase):
    def _run_with(self, files, upload_raises=()):
        mod = load_r2_sync(upload_raises)
        tmp = tempfile.mkdtemp()
        write_fixtures(mod.PRIVATE_FILES, tmp, files)
        mod.DATA_DIR = tmp
        mod.STATE_FILE = str(Path(tmp) / "state.json")  # never touch the real ~/.hermes
        return mod.sync_private_to_r2()

    def test_bad_data_is_invalid_not_failed_and_others_still_upload(self):
        uploaded, invalid, failed = self._run_with(
            {"accuracy.json": BAD, "sec_filings.json": GOOD, "earnings.json": GOOD}
        )
        # The whole point: the bad file does not stop the good ones.
        self.assertEqual(uploaded, 2)
        self.assertEqual(len(invalid), 1)
        self.assertIn("accuracy.json", invalid[0])
        self.assertEqual(failed, [], "bad data must never be reported as a transport failure")

    def test_transport_failure_is_failed_not_invalid(self):
        uploaded, invalid, failed = self._run_with(
            {"sec_filings.json": GOOD, "earnings.json": GOOD}, upload_raises={"sec_filings.json"}
        )
        self.assertEqual(uploaded, 1)
        self.assertEqual(invalid, [], "a transport failure must never be reported as bad data")
        self.assertEqual(len(failed), 1)
        self.assertIn("sec_filings.json", failed[0])

    def test_all_good_reports_nothing_wrong(self):
        uploaded, invalid, failed = self._run_with({"sec_filings.json": GOOD, "earnings.json": GOOD})
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


class SkipAndStaleTest(unittest.TestCase):
    """The 2026-08-14 audit: 10.7 MB re-uploaded every run, and 28-day-old
    ibkr_*.json still served at HTTP 200 because "exists" was the only check."""

    def _module(self, tmp, sent=None):
        mod = load_r2_sync()
        mod.DATA_DIR = tmp
        mod.STATE_FILE = str(Path(tmp) / "state.json")
        if sent is not None:
            class _Counting:
                def upload_file(self, path, bucket, key, ExtraArgs=None):
                    sent.append(key)
            sys.modules["boto3"].client = lambda *a, **kw: _Counting()
        return mod

    def test_unchanged_file_is_skipped_but_still_counts_as_uploaded(self):
        # push_dashboard raises when `uploaded` is 0, so a no-op run must not
        # report 0 — "uploaded" means "current in R2", not "bytes sent".
        tmp = tempfile.mkdtemp()
        sent = []
        mod = self._module(tmp, sent)
        write_fixtures(mod.PRIVATE_FILES, tmp, {"sec_filings.json": GOOD})
        self.assertEqual(mod.sync_private_to_r2()[0], 1)
        self.assertEqual(sent, ["sec_filings.json"])
        sent.clear()
        self.assertEqual(mod.sync_private_to_r2(), (1, [], []))
        self.assertEqual(sent, [], "an unchanged file must not be re-uploaded")
        # A real change must go back out.
        time.sleep(0.01)
        (Path(tmp) / "sec_filings.json").write_text(GOOD + " ")
        self.assertEqual(mod.sync_private_to_r2()[0], 1)
        self.assertEqual(sent, ["sec_filings.json"])

    def test_stale_file_is_refused_and_reported_without_blocking_the_publish(self):
        tmp = tempfile.mkdtemp()
        mod = self._module(tmp)
        write_fixtures(mod.PRIVATE_FILES, tmp, {"ibkr_account.json": GOOD, "sec_filings.json": GOOD})
        old = time.time() - 28 * 86400
        os.utime(Path(tmp) / "ibkr_account.json", (old, old))
        uploaded, invalid, failed = mod.sync_private_to_r2()
        self.assertEqual(uploaded, 1, "the fresh file must still publish")
        self.assertEqual(failed, [], "stale data must never abort the whole publish")
        self.assertEqual(len(invalid), 1)
        self.assertIn("STALE", invalid[0])

    def test_a_weekly_artifact_gets_a_weekly_bound(self):
        # run_walk_forward_v2.py is `0 6 * * 0`; the 96h default would flag it
        # every single Friday.
        tmp = tempfile.mkdtemp()
        mod = self._module(tmp)
        write_fixtures(mod.PRIVATE_FILES, tmp, {"walk_forward_v2.json": GOOD})
        old = time.time() - 6 * 86400
        os.utime(Path(tmp) / "walk_forward_v2.json", (old, old))
        self.assertEqual(mod.sync_private_to_r2(), (1, [], []))


if __name__ == "__main__":
    unittest.main()
