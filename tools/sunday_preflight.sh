#!/usr/bin/env bash
# tools/sunday_preflight.sh — Sunday-before-launch preflight (Pi).
# Prints PASS:/FAIL: per check, exits non-zero on first failure.
# Run: bash tools/sunday_preflight.sh
set -uo pipefail
export TZ=America/Toronto

DATA_REPO="${DATA_REPO:-$HOME/morning-briefing}"
SCRIPTS="${SCRIPTS:-$HOME/.hermes/scripts}"

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; exit 1; }

# 1. Disk
disk_used="$(df -h "$HOME" | awk 'NR==2{print $5}' | tr -d '%')"
[ "${disk_used:-100}" -lt 85 ] || fail "disk ${disk_used}% used (>=85%)"
pass "disk ${disk_used}% used"

# 2. Cron: required lines present
crontab -l > /tmp/preflight_cron.txt 2>/dev/null || fail "crontab -l failed"
for needle in "25 7 \* \* 1-5" "40 7 \* \* 1-5" "20 7 \* \*" "22 7 \* \* 0,6" "7,37 9-15" "32 7 \* \* 1-5" "34,44 7 \* \* 1-5" "verdict_chain"; do
  grep -qE "$needle" /tmp/preflight_cron.txt || fail "crontab missing: $needle"
done
grep -qE "^MAPLEGAMMA_GATE_DAYS=[0-9,]+" /tmp/preflight_cron.txt || fail "crontab missing MAPLEGAMMA_GATE_DAYS"
pass "crontab has 07:25/07:32 push, verdict chain, watchdog, GATE_DAYS, paper_trader, council, intraday"

# 2b. Time sync (council R3-9): gate depends on correct ET date
if command -v timedatectl >/dev/null 2>&1; then
  ntp_sync="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || echo no)"
  [ "$ntp_sync" = "yes" ] || fail "NTP not synchronized (NTPSynchronized=$ntp_sync)"
  pass "NTP synchronized"
else
  http_date="$(curl -sI --max-time 10 https://maplegamma.com/api/health | grep -i '^date:' | sed 's/^[Dd]ate: //' | tr -d '\r')"
  [ -n "$http_date" ] || fail "could not fetch reference clock"
  offset=$(( $(date -d "$http_date" +%s) - $(date +%s) ))
  [ "${offset#-}" -lt 300 ] || fail "clock offset ${offset}s vs HTTP reference (>300s)"
  pass "clock within ${offset}s of HTTP reference"
fi

# 3. Council script: token lines + routing present
for needle in 'AGGREGATOR_MAX_TOKENS = 65536' 'EXPERT_MAX_TOKENS = 32000' '"stream": False' 'ag/gemini-3.7-flash-high' 'ocg/deepseek-v4-pro' 'ocg/glm-5.2' 'qd/qmodel_38max' 'cx/gpt-5.6-sol' 'ROUTER_BASE = "http://127.0.0.1:20128/v1"' 'claude-opus-5'; do
  grep -qF "$needle" "$SCRIPTS/maplegamma_council.py" || fail "maplegamma_council.py missing: $needle"
done
pass "council routing + token caps + stream:False present"

# 4. push_dashboard skip logic present
grep -qF "rev-list --count origin/main..HEAD" "$SCRIPTS/push_dashboard.py" || fail "push_dashboard.py missing skip logic"
pass "push_dashboard.py has push-skip"

# 5. Repo clean + synced
[ -d "$DATA_REPO/.git" ] || fail "data repo missing"
git -C "$DATA_REPO" fetch origin -q 2>/dev/null || fail "git fetch failed"
behind="$(git -C "$DATA_REPO" rev-list --count HEAD..origin/main 2>/dev/null || echo "?")"
[ "$behind" = "0" ] || fail "data repo is $behind commit(s) BEHIND origin/main — run: ssh pi pull"
ahead="$(git -C "$DATA_REPO" rev-list --count origin/main..HEAD 2>/dev/null || echo "?")"
[ "$ahead" = "0" ] || fail "data repo is $ahead commit(s) AHEAD (unpushed)"
pass "data repo in sync with origin/main"

# 6. Deadman workflow present in repo
[ -f "$DATA_REPO/.github/workflows/deadman.yml" ] || fail "deadman.yml missing"
grep -qE "maplegamma-data.json 20" "$DATA_REPO/.github/workflows/deadman.yml" || fail "deadman thresholds not 20h"
pass "deadman.yml thresholds 20h"

# 7. Gate script present + executable
[ -x "$DATA_REPO/tools/monday_gate.sh" ] || fail "monday_gate.sh missing/not executable"
bash -n "$DATA_REPO/tools/monday_gate.sh" || fail "monday_gate.sh syntax"
pass "monday_gate.sh present + syntax OK"

# 8. Latest council artifact state (informational — not a fail at weekend)
if [ -f "$DATA_REPO/data/maplegamma_analysis.json" ]; then
  status="$(python3 -c "import json;print(json.load(open('$DATA_REPO/data/maplegamma_analysis.json')).get('meta',{}).get('status','?'))" 2>/dev/null || echo "?")"
  echo "INFO: last council artifact status=$status (gate requires full on Monday)"
else
  echo "INFO: no council artifact yet (expected if never run)"
fi

# 9. Key log paths writable
for f in push_dashboard morning_analysis briefing_delivery paper_trader; do
  touch "$HOME/.hermes/logs/$f.log" 2>/dev/null || fail "log not writable: $f.log"
done
pass "log paths writable"

echo "PASS: sunday_preflight — all checks passed"
