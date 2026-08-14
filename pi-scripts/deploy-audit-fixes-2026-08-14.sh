#!/usr/bin/env bash
# deploy-audit-fixes-2026-08-14.sh — Pi-side steps from the 2026-08-14
# morning-briefing pipeline audit.
#
# Run ON THE PI:   bash ~/morning-briefing/pi-scripts/deploy-audit-fixes-2026-08-14.sh
# Idempotent: every phase checks current state and skips itself when done.
# Every file edit takes a .bak-2026-08-14 backup and py_compile-verifies,
# reverting from that exact backup on failure. Aborts on the first unexpected
# condition. Commits/pushes nothing and restarts nothing.
#
# Two mechanisms, deliberately not mixed:
#   Phase A — scripts that HAVE a repo copy (the repo is their source of truth):
#             cp over the ~/.hermes/scripts/ copy, then assert `diff` is clean.
#   Phase B — Pi-ONLY scripts (no repo copy): edit_once in place.
#
# Phase C (crontab) does NOT apply by default: it prints the proposed diff and
# needs APPLY_CRONTAB=1 to touch cron.
#
# Prerequisite: the repo edits must be merged and pulled first —
#   cd ~/morning-briefing && git pull

set -euo pipefail
HS=~/.hermes/scripts
MB=~/morning-briefing
TAG="bak-2026-08-14"

edit_once() {  # edit_once <file> <old> <new> — replace exactly-once or abort
  python3 - "$1" "$2" "$3" <<'PY'
import sys
path, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(path).read()
if new in src and old not in src:
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

echo "── Phase A: cp the three repo-owned scripts over the ~/.hermes/scripts copies ──"
for f in generate_prediction_accuracy.py nope_calculator.py r2_sync.py; do
  if diff -q "$MB/pi-scripts/$f" "$HS/$f" >/dev/null; then
    echo "  already identical: $f"
    continue
  fi
  backup "$HS/$f"
  cp "$MB/pi-scripts/$f" "$HS/$f"
  compile_or_revert "$HS/$f"
  diff -q "$MB/pi-scripts/$f" "$HS/$f" >/dev/null \
    || { echo "ABORT: $f still differs after cp"; exit 1; }
  echo "  deployed: $f"
done
# r2_sync now imports `time` and writes ~/.hermes/.r2_sync_state.json; confirm it
# still imports cleanly against the Pi's own module set before anything runs it.
( cd "$HS" && python3 -c "import r2_sync; print('  r2_sync imports OK,', len(r2_sync.PRIVATE_FILES), 'private files')" )

echo "── Phase B1: publish_ticker_details.py — core ETFs frozen since 2026-07-13 ──"
# `have` was the WHOLE tickers/ directory, so it already contained the SPY.json a
# PREVIOUS run wrote: the four core ETFs were written exactly once, ever
# (/ticker/SPY served $749.17 for 32 days while GEX said 777.88). The intent was
# "already covered THIS run" — that is exactly the screener loop's ticker set.
backup "$HS/publish_ticker_details.py"
edit_once "$HS/publish_ticker_details.py" \
'    have = {f[:-5] for f in os.listdir(TICKERS_DIR) if f.endswith(".json")}
    for tk, (name, sector) in CORE_ETFS.items():
        if tk in have:
            continue' \
'    # Only skip ETFs the screener loop wrote THIS run. listdir() also matched a
    # previous run'"'"'s own output, so these four were written once and never again.
    written_now = {t["ticker"] for t in sc["tickers"]}
    for tk, (name, sector) in CORE_ETFS.items():
        if tk in written_now:
            continue'
compile_or_revert "$HS/publish_ticker_details.py"

echo "── Phase B2: generate_analysis.py — drop the redundant self-push ──"
# push_dashboard.py always runs `git add -A` + `git push origin main` (and
# retries the push even on a no-op commit), so this second push published
# nothing new — just ~118 Cloudflare Pages builds per 30 days against a 500/mo
# quota. The local commit stays: push_dashboard's next push carries it.
backup "$HS/generate_analysis.py"
edit_once "$HS/generate_analysis.py" \
'        r = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True)
        if r.returncode == 0:
            print(f"  Pushed to GitHub")' \
'        # No push here: push_dashboard.py pushes this commit minutes later.
        # Pushing twice burned a Pages build per run for nothing.'
compile_or_revert "$HS/generate_analysis.py"

echo "── Phase B3: ibkr_portfolio_agent.py — stop exiting 0 on a dead gateway ──"
# 20 consecutive runs logged ERROR and returned 0, so nothing ever noticed that
# ibkr_*.json had stopped being written. Every branch below means "no IBKR data
# was produced"; 2 is this script's own documented "complete failure" code.
backup "$HS/ibkr_portfolio_agent.py"
edit_once "$HS/ibkr_portfolio_agent.py" \
'        logger.error("Gateway unreachable at %s: %s — pipeline continues (no IBKR data)", gateway, e)
        return 0' \
'        logger.error("Gateway unreachable at %s: %s — no IBKR data written", gateway, e)
        return 2'
edit_once "$HS/ibkr_portfolio_agent.py" \
'        logger.exception("Unexpected error checking gateway")
        return 0' \
'        logger.exception("Unexpected error checking gateway")
        return 2'
edit_once "$HS/ibkr_portfolio_agent.py" \
'        logger.error("Gateway not connected — pipeline continues (no IBKR data)")
        return 0' \
'        logger.error("Gateway not connected — no IBKR data written")
        return 2'
edit_once "$HS/ibkr_portfolio_agent.py" \
'            logger.error("Re-authentication failed — pipeline continues (no IBKR data)")
            return 0' \
'            logger.error("Re-authentication failed — no IBKR data written")
            return 2'
edit_once "$HS/ibkr_portfolio_agent.py" \
'            logger.error("Cannot reach Gateway after reauth: %s — pipeline continues", e)
            return 0' \
'            logger.error("Cannot reach Gateway after reauth: %s — no IBKR data written", e)
            return 2'
edit_once "$HS/ibkr_portfolio_agent.py" \
'            logger.error("Still not authenticated — pipeline continues (no IBKR data)")
            return 0' \
'            logger.error("Still not authenticated — no IBKR data written")
            return 2'
compile_or_revert "$HS/ibkr_portfolio_agent.py"
python3 - "$HS/ibkr_portfolio_agent.py" <<'PY'
import sys
src = open(sys.argv[1]).read()
assert "pipeline continues" not in src, "a silent-exit branch was missed"
print("  all six no-data branches now exit non-zero")
PY

echo "── Phase C: crontab (NOT applied unless APPLY_CRONTAB=1) ──"
# 1. generate_verdict.py at 07:23 reads morning_analysis.json, which
#    run_morning_analysis.py (07:20) is often still writing — verdict.json has
#    republished the PREVIOUS day's narrative under a fresh generated_at
#    (byte-identical narrative on 2026-08-12 and 08-13).
# 2. send_comprehensive_briefing.py (07:28) READS verdict.json, so verdict
#    cannot simply be pushed later without making the email stale instead.
#    Both move: verdict 07:30 (10 min of slack after the analysis), briefing
#    07:37. Order becomes analysis 07:20 → verdict 07:30 → email 07:37, and
#    push_dashboard's first weekday run (09:07) still publishes it.
# 3. ibkr_portfolio_agent.py redirects stderr into its log and this crontab has
#    no MAILTO, so cron mails nothing no matter what the exit code is. Phase B3
#    is necessary but not sufficient — the `||` telegram guard is what actually
#    surfaces it (same pattern as the fetch_universe_constituents line).
CRON_NEW=$(mktemp)
crontab -l > "$CRON_NEW.orig"
python3 - "$CRON_NEW.orig" "$CRON_NEW" <<'PY'
import sys
src = open(sys.argv[1]).read()
EDITS = [
    ("23 7 * * 1-5 cd /home/arshad14/.hermes/scripts && python3 generate_verdict.py",
     "30 7 * * 1-5 cd /home/arshad14/.hermes/scripts && python3 generate_verdict.py"),
    ("28 7 * * * cd /home/arshad14/.hermes/scripts && python3 send_comprehensive_briefing.py",
     "37 7 * * * cd /home/arshad14/.hermes/scripts && python3 send_comprehensive_briefing.py"),
    ("12 7 * * 1-5 cd /home/arshad14/.hermes/scripts && python3 ibkr_portfolio_agent.py >> /home/arshad14/.hermes/logs/ibkr_portfolio.log 2>&1",
     "12 7 * * 1-5 cd /home/arshad14/.hermes/scripts && python3 ibkr_portfolio_agent.py >> /home/arshad14/.hermes/logs/ibkr_portfolio.log 2>&1 || python3 -c \"import sys; sys.path.insert(0, '/home/arshad14/.hermes/scripts'); from tg_notify import send_telegram; send_telegram('MapleGamma: ibkr_portfolio_agent FAILED - ibkr_*.json is not being refreshed. See ~/.hermes/logs/ibkr_portfolio.log')\""),
]
for old, new in EDITS:
    if new in src:  # `old` is a PREFIX of the ibkr `new`, so test `new` only
        continue
    n = src.count(old)
    if n != 1:
        sys.exit(f"ABORT: expected exactly 1 crontab line matching {old!r}, found {n}")
    src = src.replace(old, new, 1)
open(sys.argv[2], "w").write(src)
PY
if diff -q "$CRON_NEW.orig" "$CRON_NEW" >/dev/null; then
  echo "  already applied — crontab unchanged"
  rm -f "$CRON_NEW" "$CRON_NEW.orig"
else
  echo "  proposed crontab diff:"
  diff -u "$CRON_NEW.orig" "$CRON_NEW" || true
  if [ "${APPLY_CRONTAB:-0}" = "1" ]; then
    cp "$CRON_NEW.orig" ~/crontab.$TAG
    crontab "$CRON_NEW"
    echo "  APPLIED (previous crontab saved to ~/crontab.$TAG)"
  else
    echo "  NOT APPLIED. Review the diff above, then re-run with APPLY_CRONTAB=1."
  fi
  rm -f "$CRON_NEW" "$CRON_NEW.orig"
fi

echo "── All phases complete ──"
echo "Reminder: cron_watchdog.py check #7 compares pi-scripts/ against ~/.hermes/scripts/;"
echo "it will keep flagging drift until Phase A has run on this Pi."
