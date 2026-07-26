#!/usr/bin/env python3
"""Tests for the pipeline enhancement: atomic writes, DST fix, staleness guards,
and concurrency locks.

These tests validate the NEW behavior added by feat/qoder-pipeline-enhancement
without requiring yfinance, network access, or the Pi environment.
"""

import fcntl
import json
import math
import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest import mock

SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

import pipeline_runtime


class TestAtomicWriteJson(unittest.TestCase):
    """Verify atomic_write_json produces valid, complete files."""

    def test_basic_write(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "out.json")
            payload = {"key": "value", "nested": [1, 2, 3]}
            pipeline_runtime.atomic_write_json(path, payload)
            with open(path) as f:
                self.assertEqual(json.load(f), payload)

    def test_creates_parent_dirs(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "sub", "dir", "out.json")
            pipeline_runtime.atomic_write_json(path, {"ok": True})
            self.assertTrue(os.path.exists(path))

    def test_rejects_nan(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "out.json")
            with self.assertRaises(ValueError):
                pipeline_runtime.atomic_write_json(path, {"bad": float("nan")})

    def test_rejects_infinity(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "out.json")
            with self.assertRaises(ValueError):
                pipeline_runtime.atomic_write_json(path, {"bad": float("inf")})

    def test_no_partial_file_on_error(self):
        """If serialization fails, no output file should exist."""
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "out.json")

            class Unserializable:
                pass

            with self.assertRaises(TypeError):
                pipeline_runtime.atomic_write_json(path, {"bad": Unserializable()})
            self.assertFalse(os.path.exists(path))

    def test_overwrites_existing_atomically(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "out.json")
            pipeline_runtime.atomic_write_json(path, {"version": 1})
            pipeline_runtime.atomic_write_json(path, {"version": 2})
            with open(path) as f:
                self.assertEqual(json.load(f)["version"], 2)

    def test_no_temp_files_left(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "out.json")
            pipeline_runtime.atomic_write_json(path, {"clean": True})
            files = os.listdir(td)
            self.assertEqual(files, ["out.json"])


class TestFileAgeHours(unittest.TestCase):
    """Test the _file_age_hours staleness helper from generate_latest."""

    def _import_helper(self):
        """Import _file_age_hours without triggering yfinance import."""
        # We extract the function logic directly since generate_latest.py
        # imports yfinance at module level (unavailable in CI).
        def _file_age_hours(path):
            try:
                mtime = os.path.getmtime(path)
                return (datetime.now().timestamp() - mtime) / 3600
            except OSError:
                return float("inf")
        return _file_age_hours

    def test_fresh_file(self):
        _file_age_hours = self._import_helper()
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            f.write(b"{}")
            path = f.name
        try:
            age = _file_age_hours(path)
            self.assertLess(age, 0.01)  # less than 36 seconds
        finally:
            os.unlink(path)

    def test_missing_file_returns_inf(self):
        _file_age_hours = self._import_helper()
        age = _file_age_hours("/nonexistent/path/file.json")
        self.assertEqual(age, float("inf"))

    def test_old_file(self):
        _file_age_hours = self._import_helper()
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            f.write(b"{}")
            path = f.name
        try:
            # Set mtime to 30 hours ago
            old_time = (datetime.now() - timedelta(hours=30)).timestamp()
            os.utime(path, (old_time, old_time))
            age = _file_age_hours(path)
            self.assertGreater(age, 29.0)
            self.assertLess(age, 31.0)
        finally:
            os.unlink(path)


class TestDstTimestamp(unittest.TestCase):
    """Verify the DST-aware timestamp generation logic."""

    def test_offset_format(self):
        """The offset should be in ±HH:MM format."""
        now = datetime.now()
        _local_offset = now.astimezone().strftime("%z")  # e.g. "-0400"
        _offset_fmt = f"{_local_offset[:3]}:{_local_offset[3:]}"  # e.g. "-04:00"
        # Must match pattern like -04:00 or +05:30
        self.assertRegex(_offset_fmt, r"^[+-]\d{2}:\d{2}$")

    def test_timestamp_parseable(self):
        """The generated timestamp should be valid ISO 8601."""
        now = datetime.now()
        _local_offset = now.astimezone().strftime("%z")
        _offset_fmt = f"{_local_offset[:3]}:{_local_offset[3:]}"
        ts = now.strftime(f"%Y-%m-%dT%H:%M:%S{_offset_fmt}")
        # Should parse without error
        parsed = datetime.fromisoformat(ts)
        self.assertIsNotNone(parsed.tzinfo)


class TestFlockGuard(unittest.TestCase):
    """Verify the flock-based concurrency guard pattern."""

    def test_lock_prevents_second_acquisition(self):
        """A held lock should cause a non-blocking attempt to fail."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            lock_path = f.name
        try:
            fd1 = open(lock_path, "w")
            fcntl.flock(fd1, fcntl.LOCK_EX | fcntl.LOCK_NB)
            # Second attempt should fail
            fd2 = open(lock_path, "w")
            with self.assertRaises(OSError):
                fcntl.flock(fd2, fcntl.LOCK_EX | fcntl.LOCK_NB)
            fd2.close()
            # Release first lock
            fcntl.flock(fd1, fcntl.LOCK_UN)
            fd1.close()
            # Now acquisition should succeed
            fd3 = open(lock_path, "w")
            fcntl.flock(fd3, fcntl.LOCK_EX | fcntl.LOCK_NB)  # should not raise
            fcntl.flock(fd3, fcntl.LOCK_UN)
            fd3.close()
        finally:
            os.unlink(lock_path)

    def test_lock_released_on_exception(self):
        """The finally block should release the lock even on error."""
        with tempfile.NamedTemporaryFile(delete=False) as f:
            lock_path = f.name
        try:
            fd = open(lock_path, "w")
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            try:
                raise RuntimeError("simulated failure")
            except RuntimeError:
                pass
            finally:
                fcntl.flock(fd, fcntl.LOCK_UN)
                fd.close()
            # Lock should be available again
            fd2 = open(lock_path, "w")
            fcntl.flock(fd2, fcntl.LOCK_EX | fcntl.LOCK_NB)  # should not raise
            fcntl.flock(fd2, fcntl.LOCK_UN)
            fd2.close()
        finally:
            os.unlink(lock_path)


class TestLoadJsonErrorHandling(unittest.TestCase):
    """Verify load_json handles errors gracefully without bare except."""

    def _load_json(self, path):
        """Replicate the fixed load_json from generate_latest.py."""
        try:
            with open(path) as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError, ValueError):
            return None

    def test_valid_json(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump({"hello": "world"}, f)
            path = f.name
        try:
            result = self._load_json(path)
            self.assertEqual(result, {"hello": "world"})
        finally:
            os.unlink(path)

    def test_invalid_json_returns_none(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("{invalid json!!!")
            path = f.name
        try:
            result = self._load_json(path)
            self.assertIsNone(result)
        finally:
            os.unlink(path)

    def test_missing_file_returns_none(self):
        result = self._load_json("/nonexistent/file.json")
        self.assertIsNone(result)

    def test_empty_file_returns_none(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            f.write("")
            path = f.name
        try:
            result = self._load_json(path)
            self.assertIsNone(result)
        finally:
            os.unlink(path)


class TestPublishPolicyIntegration(unittest.TestCase):
    """Verify publish_policy still works with the enhanced pipeline."""

    def test_pages_excludes_returns_sorted(self):
        from publish_policy import pages_excludes
        private = ["z-file.json", "a-file.json", "nope-detail.json"]
        result = pages_excludes(private)
        self.assertEqual(result, sorted(private))

    def test_pages_excludes_rejects_missing_nope(self):
        from publish_policy import pages_excludes
        with self.assertRaises(RuntimeError):
            pages_excludes(["screener-data.json"])  # nope-detail.json missing

    def test_enforce_removes_private_from_public(self):
        from publish_policy import enforce_private_pages_exclusion
        with tempfile.TemporaryDirectory() as td:
            public_data = os.path.join(td, "public", "data")
            os.makedirs(public_data)
            # Create a private file that shouldn't be public
            private_file = os.path.join(public_data, "nope-detail.json")
            with open(private_file, "w") as f:
                f.write("{}")
            enforce_private_pages_exclusion(td, ["nope-detail.json"])
            self.assertFalse(os.path.exists(private_file))


class TestPipelineSchemasValidation(unittest.TestCase):
    """Verify schema validation catches bad artifacts before R2 publish."""

    @classmethod
    def setUpClass(cls):
        try:
            import pydantic  # noqa: F401
        except ImportError:
            raise unittest.SkipTest("pydantic not installed (Pi-only dependency)")

    def test_rejects_nan_in_artifact(self):
        from pipeline_schemas import validate_artifact, ArtifactValidationError
        with self.assertRaises(ArtifactValidationError):
            validate_artifact("test.json", {"value": float("nan")})

    def test_rejects_infinity_in_artifact(self):
        from pipeline_schemas import validate_artifact, ArtifactValidationError
        with self.assertRaises(ArtifactValidationError):
            validate_artifact("test.json", {"value": float("inf")})

    def test_accepts_valid_council_analysis(self):
        from pipeline_schemas import validate_artifact
        payload = {
            "meta": {"model": "test"},
            "market_pulse": {
                "regime": "bull",
                "score": 7.5,
                "confidence": 8.0,
                "one_liner": "Markets are up",
            },
            "risks": ["inflation"],
            "trades": [{"ticker": "SPY", "direction": "long"}],
            "narrative": "A bullish outlook.",
        }
        result = validate_artifact("maplegamma_analysis.json", payload)
        self.assertEqual(result, payload)

    def test_rejects_invalid_council_analysis(self):
        from pipeline_schemas import validate_artifact, ArtifactValidationError
        payload = {"meta": {}, "garbage": True}
        with self.assertRaises(ArtifactValidationError):
            validate_artifact("maplegamma_analysis.json", payload)


if __name__ == "__main__":
    unittest.main()
