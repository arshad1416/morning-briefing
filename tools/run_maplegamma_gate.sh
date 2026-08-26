#!/usr/bin/env bash
# Unattended MapleGamma gate launcher. Loads the entitled probe session from a
# private Pi-only environment file, then delegates all gate policy to
# monday_gate.sh.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ENV_FILE="${MAPLEGAMMA_GATE_ENV_FILE:-$HOME/.hermes/secrets/maplegamma_gate.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "FAIL: MapleGamma gate environment file missing: $ENV_FILE" >&2
  exit 1
fi

env_mode="$(python3 - "$ENV_FILE" <<'PY'
import os, stat, sys
print(f"{stat.S_IMODE(os.stat(sys.argv[1]).st_mode):04o}")
PY
)"
case "$env_mode" in
  0600|0400) ;;
  *)
    echo "FAIL: MapleGamma gate environment permissions are $env_mode; require 0600 or 0400: $ENV_FILE" >&2
    exit 1
    ;;
esac

set -a
# shellcheck disable=SC1090 -- the path is deliberately host-configurable.
. "$ENV_FILE"
set +a

: "${TEST_SESSION_COOKIE:?TEST_SESSION_COOKIE must be set in $ENV_FILE}"

if [ "${MAPLEGAMMA_GATE_CHECK_ONLY:-0}" = "1" ]; then
  echo "PASS: MapleGamma gate credential configuration valid"
  exit 0
fi

exec bash "$SCRIPT_DIR/monday_gate.sh"
