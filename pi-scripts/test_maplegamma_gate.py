import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import textwrap
import unittest


ROOT = Path(__file__).resolve().parents[1]
GATE = ROOT / "tools" / "monday_gate.sh"
RUNNER = ROOT / "tools" / "run_maplegamma_gate.sh"
SCHEDULE_CHECK = ROOT / "tools" / "check_maplegamma_gate_schedule.py"
PREFLIGHT = ROOT / "tools" / "sunday_preflight.sh"
CRONTAB_SNAPSHOT = ROOT / "pi-scripts" / "crontab.txt"


def write_executable(path: Path, body: str) -> None:
    path.write_text(textwrap.dedent(body).lstrip(), encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


class GateFixture:
    def __init__(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.base = Path(self._tmp.name)
        self.home = self.base / "home"
        self.fake_bin = self.base / "bin"
        self.data_repo = self.base / "repo"
        self.logs = self.base / "logs"
        self.home.mkdir()
        self.fake_bin.mkdir()
        (self.data_repo / ".git").mkdir(parents=True)
        self.logs.mkdir()

        self.analysis = self.base / "maplegamma_analysis.json"
        self.analysis.write_text(
            json.dumps(
                {
                    "meta": {
                        "status": "full",
                        "experts_succeeded": 5,
                        "generated_at": "2026-08-26T11:27:37+00:00",
                    },
                    "market_pulse": {"regime": "neutral"},
                }
            ),
            encoding="utf-8",
        )
        self.public_analysis = self.base / "analysis.json"
        self.public_analysis.write_text("{}\n", encoding="utf-8")

        write_executable(
            self.fake_bin / "date",
            r"""
            #!/usr/bin/env bash
            set -eu
            if [ "${1:-}" = "-r" ]; then
              printf '2026-08-26\n'
              exit 0
            fi
            case "${1:-}" in
              +%F) printf '2026-08-26\n' ;;
              +%s) printf '1787744280\n' ;;
              +%H%M) printf '0738\n' ;;
              +%H:%M:%S) printf '07:38:00\n' ;;
              *) printf 'unexpected date args: %s\n' "$*" >&2; exit 2 ;;
            esac
            """,
        )
        write_executable(
            self.fake_bin / "git",
            r"""
            #!/usr/bin/env bash
            set -eu
            printf '0\n'
            """,
        )
        write_executable(
            self.fake_bin / "curl",
            r"""
            #!/usr/bin/env bash
            set -eu
            args="$*"
            case "$args" in
              *data/latest.json*)
                printf '{"generated_at":"2026-08-26T07:32:03-04:00"}'
                ;;
              *data/verdict.json*)
                printf '{"generated_at":"2026-08-26T11:30:01+00:00"}'
                ;;
              *api/health*)
                printf '200'
                ;;
              *api/data/maplegamma_analysis.json*)
                if [[ "$args" == *"Cookie: mg_session=test-token"* ]]; then
                  printf '200'
                else
                  printf '401'
                fi
                ;;
              *)
                printf 'unexpected curl args: %s\n' "$args" >&2
                exit 2
                ;;
            esac
            """,
        )

    def close(self) -> None:
        self._tmp.cleanup()

    def environment(self, **overrides: str) -> dict[str, str]:
        env = os.environ.copy()
        env.pop("TEST_SESSION_COOKIE", None)
        env.update(
            {
                "PATH": f"{self.fake_bin}:{env['PATH']}",
                "HOME": str(self.home),
                "ANALYSIS_JSON": str(self.analysis),
                "ANALYSIS_PUBLIC": str(self.public_analysis),
                "DATA_REPO": str(self.data_repo),
                "LOG_DIR": str(self.logs),
                "LIVE_BASE": "https://maplegamma.test",
            }
        )
        env.update(overrides)
        return env

    def run(self, script: Path, **overrides: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["bash", str(script)],
            cwd=ROOT,
            env=self.environment(**overrides),
            text=True,
            capture_output=True,
            check=False,
        )


class MondayGateTest(unittest.TestCase):
    def setUp(self):
        self.fixture = GateFixture()

    def tearDown(self):
        self.fixture.close()

    def test_valid_entitled_session_creates_the_daily_sentinel(self):
        """Catches a gate probe that sends a cookie name the Worker ignores."""
        result = self.fixture.run(GATE, TEST_SESSION_COOKIE="test-token")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: entitled gated GET returned 200", result.stdout)
        sentinel = (
            self.fixture.home
            / ".hermes"
            / "state"
            / "maplegamma_gate_passed_2026-08-26"
        )
        self.assertEqual(
            sentinel.read_text(encoding="utf-8"), "ok 2026-08-26 07:38:00\n"
        )

    def test_existing_valid_sentinel_makes_retries_idempotent(self):
        """Catches retry invocations that repeat external checks after success."""
        state = self.fixture.home / ".hermes" / "state"
        state.mkdir(parents=True)
        sentinel = state / "maplegamma_gate_passed_2026-08-26"
        sentinel.write_text("ok 2026-08-26 07:36:00\n", encoding="utf-8")
        write_executable(
            self.fixture.fake_bin / "curl",
            """
            #!/usr/bin/env bash
            echo 'curl must not run after a valid sentinel exists' >&2
            exit 99
            """,
        )

        result = self.fixture.run(GATE)

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("already passed", result.stdout)

    def test_malformed_sentinel_time_never_bypasses_the_gate(self):
        """Catches numeric-looking but impossible times being treated as valid."""
        state = self.fixture.home / ".hermes" / "state"
        state.mkdir(parents=True)
        sentinel = state / "maplegamma_gate_passed_2026-08-26"
        sentinel.write_text("ok 2026-08-26 06:99:00\n", encoding="utf-8")
        write_executable(
            self.fixture.fake_bin / "curl",
            """
            #!/usr/bin/env bash
            exit 99
            """,
        )

        result = self.fixture.run(GATE)

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("already passed", result.stdout)

    def test_runner_loads_session_from_a_private_environment_file(self):
        """Catches an unattended gate runner with no secure credential loader."""
        secret = self.fixture.base / "maplegamma_gate.env"
        secret.write_text("TEST_SESSION_COOKIE='test-token'\n", encoding="utf-8")
        secret.chmod(0o600)

        result = self.fixture.run(
            RUNNER, MAPLEGAMMA_GATE_ENV_FILE=str(secret)
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: monday_gate", result.stdout)

    def test_runner_rejects_a_group_or_world_readable_session_file(self):
        """Catches accidental exposure of the entitled session on the Pi."""
        secret = self.fixture.base / "maplegamma_gate.env"
        secret.write_text("TEST_SESSION_COOKIE='test-token'\n", encoding="utf-8")
        secret.chmod(0o644)

        result = self.fixture.run(
            RUNNER, MAPLEGAMMA_GATE_ENV_FILE=str(secret)
        )

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("permissions", result.stdout + result.stderr)

    def test_runner_check_only_validates_credentials_without_running_the_gate(self):
        """Lets preflight validate secret wiring without publishing a sentinel."""
        secret = self.fixture.base / "maplegamma_gate.env"
        secret.write_text("TEST_SESSION_COOKIE='test-token'\n", encoding="utf-8")
        secret.chmod(0o600)
        write_executable(
            self.fixture.fake_bin / "curl",
            """
            #!/usr/bin/env bash
            echo 'gate must not execute in check-only mode' >&2
            exit 99
            """,
        )

        result = self.fixture.run(
            RUNNER,
            MAPLEGAMMA_GATE_ENV_FILE=str(secret),
            MAPLEGAMMA_GATE_CHECK_ONLY="1",
        )

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("configuration valid", result.stdout)


class GateScheduleTest(unittest.TestCase):
    @staticmethod
    def run_check(contents: str) -> subprocess.CompletedProcess[str]:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8") as cron:
            cron.write(contents)
            cron.flush()
            return subprocess.run(
                ["python3", str(SCHEDULE_CHECK), cron.name],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )

    @staticmethod
    def valid_schedule() -> str:
        current = CRONTAB_SNAPSHOT.read_text(encoding="utf-8")
        producer = (
            "34,36,38 7 * * 1-5 cd /home/arshad14/morning-briefing && "
            "/usr/bin/flock -n /tmp/maplegamma_gate.lock "
            "/usr/bin/timeout 90 bash tools/run_maplegamma_gate.sh "
            ">> /home/arshad14/.hermes/logs/maplegamma_gate.log 2>&1\n"
        )
        anchor = (
            "32 7 * * 1-5 cd /home/arshad14/.hermes/scripts && "
            "python3 push_dashboard.py >> "
            "/home/arshad14/.hermes/logs/push_dashboard.log 2>&1\n"
        )
        if "run_maplegamma_gate.sh" not in current:
            current = current.replace(anchor, anchor + producer, 1)
        return current.replace(
            "44,50 7 * * 1-5 cd /home/arshad14/.hermes/scripts && "
            "python3 mg_gate_watchdog.py",
            "40,50 7 * * 1-5 cd /home/arshad14/.hermes/scripts && "
            "python3 mg_gate_watchdog.py",
            1,
        )

    def test_missing_gate_producer_is_rejected(self):
        """Catches consumers being scheduled without any sentinel producer."""
        schedule = "\n".join(
            line
            for line in self.valid_schedule().splitlines()
            if "run_maplegamma_gate.sh" not in line
        )
        result = self.run_check(schedule)

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("gate producer", result.stdout + result.stderr)

    def test_bounded_locked_producer_before_watchdog_and_consumers_passes(self):
        """Protects the intended publish -> gate -> watchdog -> consumer order."""
        result = self.run_check(self.valid_schedule())

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("gate schedule OK", result.stdout)

    def test_repository_snapshot_has_a_valid_gate_schedule(self):
        """Catches the versioned rebuild snapshot drifting back to no producer."""
        result = self.run_check(CRONTAB_SNAPSHOT.read_text(encoding="utf-8"))

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_watchdog_after_the_first_consumer_is_rejected(self):
        """Catches a watchdog that can only report after damage is already done."""
        schedule = self.valid_schedule().replace(
            "40,50 7 * * 1-5", "44,50 7 * * 1-5", 1
        )
        result = self.run_check(schedule)

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("watchdog", result.stdout + result.stderr)

    def test_preflight_rejects_a_live_crontab_without_the_gate_producer(self):
        """Catches preflight checking consumers while overlooking their producer."""
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            home = base / "home"
            fake_bin = base / "bin"
            scripts = base / "scripts"
            home.mkdir()
            fake_bin.mkdir()
            scripts.mkdir()
            (home / ".hermes" / "logs").mkdir(parents=True)

            schedule = "\n".join(
                line
                for line in self.valid_schedule().splitlines()
                if "run_maplegamma_gate.sh" not in line
            )
            fake_crontab = base / "crontab.txt"
            fake_crontab.write_text(schedule + "\n", encoding="utf-8")

            write_executable(
                fake_bin / "crontab",
                """
                #!/usr/bin/env bash
                cat "$FAKE_CRONTAB"
                """,
            )
            write_executable(
                fake_bin / "df",
                """
                #!/usr/bin/env bash
                printf 'Filesystem Size Used Avail Capacity Mounted on\n'
                printf '/dev/test 100G 10G 90G 10%% /\n'
                """,
            )
            write_executable(
                fake_bin / "timedatectl",
                """
                #!/usr/bin/env bash
                printf 'yes\n'
                """,
            )
            write_executable(
                fake_bin / "git",
                """
                #!/usr/bin/env bash
                if [[ "$*" == *"rev-list"* ]]; then
                  printf '0\n'
                fi
                exit 0
                """,
            )

            (scripts / "maplegamma_council.py").write_text(
                "\n".join(
                    [
                        "AGGREGATOR_MAX_TOKENS = 65536",
                        "EXPERT_MAX_TOKENS = 32000",
                        'payload = {\"stream\": False}',
                        "ag/gemini-3.7-flash-medium",
                        "ocg/deepseek-v4-pro",
                        "ocg/glm-5.2",
                        "qd/qmodel_38max",
                        "cx/gpt-5.6-sol",
                        'ROUTER_BASE = \"http://127.0.0.1:20128/v1\"',
                    ]
                ),
                encoding="utf-8",
            )
            (scripts / "push_dashboard.py").write_text(
                "rev-list --count origin/main..HEAD\n", encoding="utf-8"
            )

            env = os.environ.copy()
            env.update(
                {
                    "PATH": f"{fake_bin}:{env['PATH']}",
                    "HOME": str(home),
                    "DATA_REPO": str(ROOT),
                    "SCRIPTS": str(scripts),
                    "FAKE_CRONTAB": str(fake_crontab),
                }
            )
            result = subprocess.run(
                ["bash", str(PREFLIGHT)],
                cwd=ROOT,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("gate producer", result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
