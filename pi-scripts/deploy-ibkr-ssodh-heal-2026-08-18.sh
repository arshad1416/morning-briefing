#!/usr/bin/env bash
# deploy-ibkr-ssodh-heal-2026-08-18.sh — the 2026-08-18 fix for the stale
# ibkr_*.json premium artifacts ("3 premium artifact(s) failed validation …
# STALE, 4.0d old — generator has stopped").
#
# Run ON THE PI:   bash ~/morning-briefing/pi-scripts/deploy-ibkr-ssodh-heal-2026-08-18.sh
# Idempotent: every phase checks current state and skips itself when done.
# Takes a .bak-ssodh-heal-2026-08-18 backup and py_compile-verifies,
# reverting from that exact backup on failure. Aborts on the first
# unexpected condition. Commits/pushes nothing and restarts nothing.
#
# ibkr_portfolio_agent.py is a PI-ONLY script — no repo copy — so it is edited
# in place (AGENTS.md rule 4, same as deploy-ibkr-safefloat-2026-08-14.sh).
#
# ROOT CAUSE (verified live 2026-08-18): the Client Portal gateway process
# was restarted manually on 2026-08-14 and has stayed up, but the brokerage
# session (iserver bridge) drops overnight while the SSO session stays alive.
# Every weekday at 07:12 the agent checks auth status, sees
# connected:false, and exits 2 immediately — and the
# ibkr_gateway_sentinel.py cron, which re-establishes the session via
# POST /iserver/auth/ssodh/init {"publish":true,"compete":true} (no
# credentials needed), fires at the SAME minute (:12) seconds LATER.
# So each morning the agent lost the race by a few seconds and wrote
# nothing, while the sentinel healed the session and logged OK. Observed:
# "Gateway not connected — no IBKR data written" on 08-17 and 08-18 with
# the session healthy seconds later (re-verified by hand: ssodh/init
# restored connected:true, and it held).
#
# FIX: give the agent the same credential-free self-heal. When
# connected:false, call ssodh/init once, re-check, and only then give up.
# The existing _reauthenticate path (/iserver/reauthenticate) cannot help
# here: it needs a brokerage session to exist, and it is unreachable behind
# the connected check anyway.

set -euo pipefail
HS="${HS:-$HOME/.hermes/scripts}"
AGENT="$HS/ibkr_portfolio_agent.py"
TAG="bak-ssodh-heal-2026-08-18"

[ -f "$AGENT" ] || { echo "ABORT: $AGENT not found."; exit 1; }

edit_once() {  # edit_once <file> <old> <new> — replace exactly-once or abort
  python3 - "$1" "$2" "$3" <<'PY'
import sys
path, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(path).read()
if new in src:
    print(f"  already applied: {path}")
    sys.exit(0)
n = src.count(old)
if n != 1:
    sys.exit(f"ABORT: expected exactly 1 occurrence of the target in {path}, found {n}")
open(path, "w").write(src.replace(old, new, 1))
print(f"  edited: {path}")
PY
}

backup() {  # backup <file> — one .bak per file, kept for compile_or_revert
  [ -f "$1.$TAG" ] || cp "$1" "$1.$TAG"
}

compile_or_revert() {  # compile_or_revert <file> — reverts from THIS file's .bak
  if ! python3 -m py_compile "$1"; then
    echo "COMPILE FAILED — reverting $1 from $1.$TAG"
    cp "$1.$TAG" "$1"
    exit 1
  fi
}

backup "$AGENT"

echo "── Phase 1: _ssodh_heal helper ──"
edit_once "$AGENT" \
'def _reauthenticate(gateway_url: str) -> bool:' \
'def _ssodh_heal(gateway_url: str) -> bool:
    """Re-establish the brokerage session from the still-live SSO cookie.

    When the iserver bridge drops overnight (gateway up, SSO session alive)
    auth status reports connected:false, but POST /iserver/auth/ssodh/init
    rebuilds it WITHOUT credentials — the same self-heal
    ibkr_gateway_sentinel.py runs at :12/:42. That sentinel fires seconds
    AFTER the 07:12 agent cron, so before this existed each morning run
    lost the race and exited with nothing written (seen 08-17, 08-18).
    Returns True once auth status reports connected.
    """
    _lower = gateway_url.lower()
    verify = _lower.startswith("https://") and not any(
        _lower.startswith(f"https://{h}") for h in ("localhost", "127.0.0.1", "[::1]")
    )
    try:
        resp = _get_session().post(
            f"{gateway_url.rstrip(chr(47))}/v1/api/iserver/auth/ssodh/init",
            json={"publish": True, "compete": True},
            timeout=REQUEST_TIMEOUT,
            verify=verify,
        )
        resp.raise_for_status()
    except RequestException as e:
        logger.warning("ssodh/init unreachable: %s", e)
        return False
    time.sleep(3)
    for _ in range(5):
        try:
            status = _api_post(gateway_url, "/iserver/auth/status")
        except (ConnectionError, ValueError):
            time.sleep(1)
            continue
        if isinstance(status, dict) and status.get("connected"):
            return True
        time.sleep(1)
    return False


def _reauthenticate(gateway_url: str) -> bool:'

echo "── Phase 2: main() — self-heal before giving up on connected:false ──"
edit_once "$AGENT" \
'    if not status.get("connected"):
        logger.error("Gateway not connected — no IBKR data written")
        return 2' \
'    if not status.get("connected"):
        # connected:false with the gateway process up means the iserver
        # bridge dropped while SSO stayed alive — healable without
        # credentials, so try that before giving up (see _ssodh_heal).
        logger.warning("Gateway not connected — attempting ssodh/init self-heal")
        if not _ssodh_heal(gateway):
            logger.error("Self-heal failed — no IBKR data written")
            return 2
        try:
            status = _check_gateway(gateway)
        except (ConnectionError, ValueError) as e:
            logger.error("Gateway check failed after self-heal: %s — no IBKR data written", e)
            return 2
        except Exception:
            logger.exception("Unexpected error re-checking gateway after self-heal")
            return 2
        if not status.get("connected"):
            logger.error("Still not connected after self-heal — no IBKR data written")
            return 2
        logger.info("Self-heal succeeded — brokerage session re-established")'

compile_or_revert "$AGENT"

echo "── Self-check: structure and absence of the old hard exit ──"
python3 - "$HS" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
import ibkr_portfolio_agent as a

assert callable(a._ssodh_heal), "_ssodh_heal missing after edit"
src = open(sys.argv[1] + "/ibkr_portfolio_agent.py").read()
old_exit = (
    '    if not status.get("connected"):\n'
    '        logger.error("Gateway not connected — no IBKR data written")\n'
    '        return 2'
)
assert old_exit not in src, "old hard exit (no heal) still present"
assert src.count("_ssodh_heal(gateway)") == 1, "main() must call the heal exactly once"
assert src.count("v1/api/iserver/auth/ssodh/init") == 1, "exactly one ssodh/init call site"
assert src.index("def _ssodh_heal") < src.index("def _reauthenticate"), "helper placement"
print("  self-check passed")
PY

echo "── Live heal test (same call the sentinel makes; safe, no credentials) ──"
python3 - "$HS" <<'PY'
import sys
sys.path.insert(0, sys.argv[1])
import ibkr_portfolio_agent as a
ok = a._ssodh_heal(a.DEFAULT_GATEWAY)
print(f"  _ssodh_heal -> {ok}")
if not ok:
    print("  WARNING: heal returned False — SSO session may have fully")
    print("  expired; a manual browser login at https://localhost:5002 would")
    print("  then be required. The code patch itself is still valid.")
PY

echo "── All phases complete ──"
echo "Nothing was restarted; the 07:12 weekday cron run picks this up."
echo "Backup: $AGENT.$TAG"
