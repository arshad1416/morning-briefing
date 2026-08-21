#!/usr/bin/env bash
# deploy-council-dashboard-race-2026-08-21.sh — the 2026-08-21 fix for the two
# weekday publishes that stopped silently ("dashboard: freshness guard skipped
# 2 push(es) today — maplegamma_analysis.json is Ns old (max 600s)").
#
# Run ON THE PI:   bash ~/morning-briefing/pi-scripts/deploy-council-dashboard-race-2026-08-21.sh
# Idempotent: every phase checks current state and skips itself when done.
# Takes a .bak-council-race-2026-08-21 backup per file and verifies (bash -n /
# py_compile), reverting from that exact backup on failure. Aborts on the first
# unexpected condition. Commits/pushes nothing and restarts nothing.
#
# agents/agent_dashboard.sh and cron_watchdog.py are PI-ONLY scripts — no repo
# copy — so they are edited in place (AGENTS.md rule 4, same as
# deploy-ibkr-ssodh-heal-2026-08-18.sh). arshad1416/hermes-scripts is the Pi's
# BACKUP MIRROR, pushed FROM ~/.hermes/scripts (see deploy-hermes-fixes.sh
# Phase A) — it is not a deploy channel, so nothing here goes through it.
#
# Phase C (crontab) does NOT apply by default: it prints the proposed diff and
# needs APPLY_CRONTAB=1 to touch cron.
#
# ── ROOT CAUSE ──────────────────────────────────────────────────────────────
# agent_council.sh writes data/maplegamma_analysis.json; agent_dashboard.sh
# refuses to publish unless that file is younger than MAX_AGE=600s. They are
# SEPARATE crontab entries — council 07:23 and 10:20/12:20/14:20, dashboard
# 07:26 and 10:26/12:26/14:26 — so the guard silently depends on the council
# finishing inside a 3- or 6-minute gap. agent_dashboard.sh's own comment
# records where that assumption came from: "observed 9s-85s+".
#
# On 2026-08-16 the council moved to reasoning models via 9Router and its
# budgets went from call_api(timeout=90, max_tokens=3000) to EXPERT_TIMEOUT=240
# / AGGREGATOR_TIMEOUT=420 with 32000/65536 caps. The gaps did not move.
# Measured on the Pi 2026-08-20: council finished 07:26:23 against a wrapper
# start of 07:26:01 (missed by 22s), and 10:27:19 against 10:26:01 (78s). The
# wrapper therefore stat()s the PREVIOUS cycle's file and reports ITS age — the
# "about three hours" in the alert is the 07:2x->10:2x inter-cycle gap, not the
# council's runtime.
#
# origin/main, counting paired "Analysis"+"Live portfolio" commits: all four
# daily cycles published every weekday 2026-08-05..08-17; {07:26, 10:26} absent
# every weekday since 08-18. Public publishing was never affected — the :07/:37
# push_dashboard cron is independent and ran 21x on 08-20.
#
# ── FIXES ───────────────────────────────────────────────────────────────────
# A. Gate on meta.status, not just mtime. maplegamma_council.py writes the
#    artifact and returns 0 in FOUR states, all of which refresh the mtime:
#    "full"/"partial_Nof5" (aggregator succeeded), "aggregator_failed" (raw
#    expert text, no aggregated analysis) and "insufficient_experts" (below the
#    3-of-5 quorum). The last two have no market_pulse at all, so publishing
#    them ships a fallback as a healthy council. monday_gate.sh already rejects
#    them — but once a day at 07:40; the 10:26/12:26/14:26 cycles had no check.
# B. Let the watchdog clear. cron_watchdog.py check 8 is already today-scoped,
#    but it never clears within the day, so it kept reporting the morning
#    aborts as live after the 12:30 and 14:30 publishes succeeded. That is what
#    made the alert read "STILL being skipped".
# C. Chain producer and consumer. This is the actual race fix: run the wrapper
#    off the council's exit rather than a fixed offset, so the age is ~0 by
#    construction. A fixed stagger cannot work here — the satisfiable window is
#    [council worst case, MAX_AGE] and EXPERT_TIMEOUT+AGGREGATOR_TIMEOUT = 660s
#    already exceeds MAX_AGE=600s, so the window is empty. Chaining also keeps
#    the morning inside monday_gate.sh's 07:40 sentinel deadline (council 07:23
#    + ~3.5 min + publish ~3 min lands ~07:30); a 15-minute wait would not.
#
# Regression cover for A and C lives in the repo: tools/sunday_preflight.sh
# checks 3b (schedule/guard window) and 3c (meta.status is read at all). Both
# fail before this script runs and pass after.

set -euo pipefail
HS="${HS:-$HOME/.hermes/scripts}"
DASH="$HS/agents/agent_dashboard.sh"
WATCHDOG="$HS/cron_watchdog.py"
TAG="bak-council-race-2026-08-21"

for f in "$DASH" "$WATCHDOG"; do
  [ -f "$f" ] || { echo "ABORT: $f not found."; exit 1; }
done

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

backup() {  # backup <file> — one .bak per file, kept for the revert helpers
  [ -f "$1.$TAG" ] || cp "$1" "$1.$TAG"
}

syntax_or_revert() {  # syntax_or_revert <file> — bash -n, revert from THIS file's .bak
  if ! bash -n "$1"; then
    echo "SYNTAX CHECK FAILED — reverting $1 from $1.$TAG"
    cp "$1.$TAG" "$1"
    exit 1
  fi
}

compile_or_revert() {  # compile_or_revert <file> — py_compile, revert from THIS file's .bak
  if ! python3 -m py_compile "$1"; then
    echo "COMPILE FAILED — reverting $1 from $1.$TAG"
    cp "$1.$TAG" "$1"
    exit 1
  fi
}

backup "$DASH"
backup "$WATCHDOG"

echo "── Phase A1: agent_dashboard.sh — gate on council meta.status ──"
edit_once "$DASH" \
'log "  Council output fresh (${council_age}s old) — proceeding"' \
'# Freshness is not health. maplegamma_council.py returns 0 and refreshes the
# mtime in four states; two of them carry raw expert text with NO aggregated
# analysis ("aggregator_failed" when every aggregator failed, and
# "insufficient_experts" below the 3-of-5 quorum). Publishing those ships a
# fallback as a healthy council. monday_gate.sh applies the same idea once a
# day at 07:40 (meta.status = full AND experts_succeeded = 5); this is the
# intraday equivalent, deliberately looser: a partial_Nof5 still has a real
# aggregated analysis and is worth publishing. Exit 6, not 4, so a persistent
# degrade is greppable apart from a stale artifact.
council_status="$(python3 -c '"'"'import json,sys; print(json.load(open(sys.argv[1])).get("meta", {}).get("status", ""))'"'"' "$COUNCIL_OUTPUT" 2>/dev/null || echo unreadable)"
case "$council_status" in
  full|partial_*)
    ;;
  unreadable|"")
    log "  ABORT: could not read meta.status from maplegamma_analysis.json — malformed or pre-status artifact; skipping push"
    exit 6
    ;;
  *)
    log "  ABORT: council meta.status=$council_status — no aggregated analysis in this artifact; skipping push"
    exit 6
    ;;
esac
log "  Council output fresh (${council_age}s old, status=$council_status) — proceeding"'

echo "── Phase A2: agent_dashboard.sh — document exit 6 ──"
edit_once "$DASH" \
'# Exit:  0 ok | 2 analysis failed | 3 push failed | 4 council stale | 5 push skipped (lock held)' \
'# Exit:  0 ok | 2 analysis failed | 3 push failed | 4 council stale | 5 push skipped (lock held)
#        6 council degraded (meta.status has no aggregated analysis)'

syntax_or_revert "$DASH"

echo "── Phase B: cron_watchdog.py — clear check 8 after a later publish ──"
edit_once "$WATCHDOG" \
'            tail = (HERMES / "logs" / "agent_dashboard_writer.log").read_text()[-20000:]
            aborts = [l for l in tail.splitlines() if today in l and "ABORT:" in l]
            if aborts:
                probs.append(
                    f"dashboard: freshness guard skipped {len(aborts)} push(es) today "
                    f"— {aborts[-1].split('"'"'ABORT:'"'"')[-1].strip()[:90]}")' \
'            tail = (HERMES / "logs" / "agent_dashboard_writer.log").read_text()[-20000:]
            # Was: alert whenever today held ANY abort. Today-scoped already, but
            # it never cleared, so on 2026-08-20 it still reported the 07:26 and
            # 10:26 aborts as live after the 12:30 and 14:30 publishes had
            # succeeded — which is what made the alert read "STILL being
            # skipped". Page only on aborts with no successful publish after
            # them; keep the day'"'"'s total in the text so a recovered morning is
            # still visible when a later cycle does fail.
            lines = [l for l in tail.splitlines() if today in l]
            aborts = [i for i, l in enumerate(lines) if "ABORT:" in l]
            published = [i for i, l in enumerate(lines) if "OK: push_dashboard.py completed" in l]
            last_ok = published[-1] if published else -1
            unresolved = [i for i in aborts if i > last_ok]
            if unresolved:
                probs.append(
                    f"dashboard: freshness guard skipped {len(unresolved)} push(es) with no "
                    f"publish since ({len(aborts)} abort(s) today) "
                    f"— {lines[unresolved[-1]].split('"'"'ABORT:'"'"')[-1].strip()[:90]}")'

compile_or_revert "$WATCHDOG"

echo "── Self-check A: the status gate accepts and rejects the right artifacts ──"
python3 - "$DASH" <<'PY'
import json, os, subprocess, sys, tempfile, textwrap
dash = sys.argv[1]
src = open(dash).read()
assert 'council_status=' in src, "status read missing after edit"
assert src.count("exit 6") == 2, f"expected 2 exit-6 sites, found {src.count('exit 6')}"
assert src.index("council_age") < src.index("council_status"), "status gate must follow the age gate"
assert "status=$council_status" in src, "proceed log must record the status"

# Exercise the extracted case/esac against every status maplegamma_council.py emits.
start = src.index('council_status="$(')
end = src.index('log "  Council output fresh', start)
snippet = src[start:end]
for status, want_ok in [("full", True), ("partial_4of5", True), ("partial_3of5", True),
                        ("aggregator_failed", False), ("insufficient_experts", False),
                        ("", False)]:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump({"meta": ({"status": status} if status else {})}, fh)
        art = fh.name
    prog = textwrap.dedent("""\
        set -uo pipefail
        COUNCIL_OUTPUT="%s"
        log() { :; }
        %s
        exit 0
        """) % (art, snippet)
    rc = subprocess.run(["bash", "-c", prog]).returncode
    os.unlink(art)
    got_ok = rc == 0
    assert got_ok == want_ok, f"status={status!r}: expected {'accept' if want_ok else 'reject'}, rc={rc}"
    print(f"  status={status or '(absent)':<20} -> {'publish' if got_ok else f'skip (exit {rc})'}")
print("  self-check A passed")
PY

echo "── Self-check B: the watchdog clears on a later publish ──"
python3 - "$HS" <<'PY'
import sys, datetime, importlib.util, pathlib, tempfile
hs = pathlib.Path(sys.argv[1])
src = (hs / "cron_watchdog.py").read_text()
assert "publish since (" in src, "new message missing"
assert "unresolved = [i for i in aborts if i > last_ok]" in src, "clearing logic missing"
assert "OK: push_dashboard.py completed" in src, "success marker missing"
assert 'if today in l and "ABORT:" in l' not in src, "old unconditional filter still present"

# Replay check 8's logic standalone against three synthetic days.
today = "2026-08-21"
def unresolved(lines):
    lines = [l for l in lines if today in l]
    aborts = [i for i, l in enumerate(lines) if "ABORT:" in l]
    published = [i for i, l in enumerate(lines) if "OK: push_dashboard.py completed" in l]
    last_ok = published[-1] if published else -1
    return len([i for i in aborts if i > last_ok]), len(aborts)

A, OK = f"[{today} 07:26:01]   ABORT: stale", f"[{today} 12:30:04]   OK: push_dashboard.py completed"
cases = [
    ("two aborts then a publish (the 08-20 shape)", [A, A, OK], 0, 2),
    ("two aborts, nothing since",                   [A, A],     2, 2),
    ("publish, then an abort",                      [OK, A],    1, 1),
]
for name, lines, want_u, want_a in cases:
    u, a = unresolved(lines)
    assert (u, a) == (want_u, want_a), f"{name}: got {(u, a)}, want {(want_u, want_a)}"
    print(f"  {name:<45} -> pages={'yes' if u else 'no '} ({u} unresolved / {a} today)")
print("  self-check B passed")
PY

echo "── Phase C: crontab (NOT applied unless APPLY_CRONTAB=1) ──"
# The race fix proper: append the wrapper to each council line with && and drop
# the two standalone wrapper entries. `&&` is deliberate — when the council
# fails (agent_council.sh exits 2) there is no new analysis to publish, and the
# :07/:37 push_dashboard cron still carries the public payload regardless.
CRON_ORIG="$(mktemp)"; CRON_NEW="$(mktemp)"
crontab -l > "$CRON_ORIG"
python3 - "$CRON_ORIG" "$CRON_NEW" <<'PY'
import sys
src = open(sys.argv[1]).read()
A = "/home/arshad14/.hermes/scripts/agents"
CHAIN = (" && bash agent_dashboard.sh"
         " >> /home/arshad14/.hermes/logs/agent_dashboard_writer.log 2>&1")
COUNCIL = [
    f"23 7 * * 1-5 cd {A} && bash agent_council.sh >> /home/arshad14/.hermes/logs/agent_council.log 2>&1",
    f"20 10,12,14 * * 1-5 cd {A} && bash agent_council.sh >> /home/arshad14/.hermes/logs/agent_council.log 2>&1",
]
DASHBOARD = [
    f"26 7 * * 1-5 cd {A} && bash agent_dashboard.sh >> /home/arshad14/.hermes/logs/agent_dashboard_writer.log 2>&1",
    f"26 10,12,14 * * 1-5 cd {A} && bash agent_dashboard.sh >> /home/arshad14/.hermes/logs/agent_dashboard_writer.log 2>&1",
]
if all(c + CHAIN in src for c in COUNCIL) and not any(d + "\n" in src for d in DASHBOARD):
    print("  already applied")
    open(sys.argv[2], "w").write(src)
    sys.exit(0)
for line in COUNCIL + DASHBOARD:
    n = src.count(line + "\n")
    if n != 1:
        sys.exit(
            f"ABORT: expected exactly 1 live crontab line\n    {line}\n  found {n}. The live "
            "crontab has drifted from pi-scripts/crontab.txt (last verified 2026-08-16). "
            "Reconcile by hand first:\n    diff <(crontab -l) ~/morning-briefing/pi-scripts/crontab.txt\n"
            "  Note the unexplained 2026-08-20 11:41 publish, which matches no snapshot slot.")
for line in COUNCIL:
    src = src.replace(line + "\n", line + CHAIN + "\n", 1)
for line in DASHBOARD:
    src = src.replace(line + "\n", "", 1)
open(sys.argv[2], "w").write(src)
print("  built the proposed crontab")
PY
echo "  proposed diff (current -> proposed):"
diff -u "$CRON_ORIG" "$CRON_NEW" | sed 's/^/    /' || true
if [ "${APPLY_CRONTAB:-0}" = "1" ]; then
  cp "$CRON_ORIG" "$HOME/.hermes/crontab.$TAG"
  crontab "$CRON_NEW"
  echo "  APPLIED. Previous crontab saved to ~/.hermes/crontab.$TAG"
  echo "  Restore with: crontab ~/.hermes/crontab.$TAG"
else
  echo "  NOT APPLIED. Re-run with APPLY_CRONTAB=1 to apply."
fi
rm -f "$CRON_ORIG" "$CRON_NEW"

echo "── All phases complete ──"
echo "Nothing was restarted; the next council cycle picks Phases A and B up."
echo "Backups: $DASH.$TAG, $WATCHDOG.$TAG"
echo
echo "After applying Phase C, do both of these:"
echo "  1. Re-snapshot the crontab (AGENTS.md rule 4 — keep it verbatim):"
echo "       crontab -l > ~/morning-briefing/pi-scripts/crontab.txt"
echo "     then restore the snapshot's header block above the VERBATIM marker."
echo "  2. Confirm the regression checks now pass:"
echo "       bash ~/morning-briefing/tools/sunday_preflight.sh"
echo "     Checks 3b and 3c fail before this script and pass after."
