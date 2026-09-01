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
for needle in "25 7 \* \* 1-5" "41 7 \* \* 1-5" "20 7 \* \*" "22 7 \* \* 0,6" "7,37 9-15" "32 7 \* \* 1-5" "40,50 7 \* \* 1-5" "verdict_chain" "45 7 \* \* 1-5" "43 7 \* \*"; do
  grep -qE "$needle" /tmp/preflight_cron.txt || fail "crontab missing: $needle"
done
grep -qE "^MAPLEGAMMA_GATE_DAYS=[0-9,]+" /tmp/preflight_cron.txt || fail "crontab missing MAPLEGAMMA_GATE_DAYS"
python3 "$DATA_REPO/tools/check_maplegamma_gate_schedule.py" /tmp/preflight_cron.txt \
  || fail "crontab MapleGamma gate schedule invalid"
pass "crontab has bounded gate producer before watchdog and guarded consumers"

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
for needle in 'AGGREGATOR_MAX_TOKENS = 65536' 'EXPERT_MAX_TOKENS = 32000' '"stream": False' 'ag/gemini-3.7-flash-medium' 'ocg/deepseek-v4-pro' 'ocg/glm-5.2' 'qd/qmodel_38max' 'cx/gpt-5.6-sol' 'ROUTER_BASE = "http://127.0.0.1:20128/v1"'; do
  grep -qF "$needle" "$SCRIPTS/maplegamma_council.py" || fail "maplegamma_council.py missing: $needle"
done
pass "council routing + token caps + stream:False present"

# 3b. Council -> dashboard ordering (regression 2026-08-18, found 2026-08-21).
# agent_dashboard.sh refuses to publish unless maplegamma_analysis.json is
# younger than its MAX_AGE guard, and agent_council.sh is the only thing that
# writes that file. The two are scheduled as INDEPENDENT crontab entries, so the
# guard silently depends on the council finishing inside the gap between them.
# On 2026-08-16 the council's budgets were raised for reasoning models
# (call_api timeout 90 -> EXPERT_TIMEOUT 240 / AGGREGATOR_TIMEOUT 420,
# max_tokens 3000 -> 32000/65536). The 3-minute 07:23->07:26 gap did not move,
# so from 2026-08-18 the 07:26 and 10:26 runs stat()'d the PREVIOUS cycle's
# file, measured it in hours and aborted (exit 4) every weekday. Nothing failed:
# the pushes just stopped, and only cron_watchdog.py's check 8 ever said so.
#
# The satisfiable window is W <= (dashboard - council) <= MAX_AGE, where W is the
# council's worst-case runtime. W > MAX_AGE makes it EMPTY — no gap can work, and
# the only fix is to chain the two so the dashboard runs when the council returns.
# Chaining also passes this check: it looks for an independent dashboard entry.
council_py="$SCRIPTS/maplegamma_council.py"
dash_sh="$SCRIPTS/agents/agent_dashboard.sh"
[ -f "$dash_sh" ] || fail "agent_dashboard.sh missing: $dash_sh"
python3 - "$council_py" "$dash_sh" /tmp/preflight_cron.txt <<'PY' || fail "council -> dashboard schedule cannot satisfy the freshness guard (see above)"
import re, sys

council_py, dash_sh, cron = sys.argv[1], sys.argv[2], sys.argv[3]

def const(path, name):
    m = re.search(rf"^{name}\s*=\s*(\d+)", open(path).read(), re.M)
    return int(m.group(1)) if m else None

max_age = const(dash_sh, "MAX_AGE")
expert = const(council_py, "EXPERT_TIMEOUT")
agg = const(council_py, "AGGREGATOR_TIMEOUT")
if max_age is None:
    sys.exit("could not read MAX_AGE from agent_dashboard.sh")
if expert is None or agg is None:
    sys.exit("could not read EXPERT_TIMEOUT/AGGREGATOR_TIMEOUT from maplegamma_council.py")

# Conservative LOWER bound on the council's worst case: one expert burning its
# timeout, then the aggregator burning its own. The real ceiling is higher (each
# expert retries once, and the joins are sequential), so a pass here is not proof
# the schedule is generous — only that it is not provably impossible.
worst = expert + agg

def slots(needle, exclude=None):
    """Cron minutes that invoke `needle`, skipping lines that also run `exclude`.

    A chained line (`... && bash agent_council.sh ... && bash agent_dashboard.sh ...`)
    mentions BOTH scripts. Counting it as an independent dashboard slot would score
    the gap as 0 and fail the very configuration this check recommends, so the
    dashboard lookup excludes council lines.
    """
    out = []
    for line in open(cron):
        line = line.strip()
        if line.startswith("#") or needle not in line:
            continue
        if exclude and exclude in line:
            continue
        f = line.split()
        if len(f) < 5:
            continue
        for h in re.findall(r"\d+", f[1]):
            for m in re.findall(r"\d+", f[0]):
                out.append(int(h) * 60 + int(m))
    return sorted(set(out))

council = slots("agent_council.sh")
dash = slots("agent_dashboard.sh", exclude="agent_council.sh")

if not council:
    sys.exit("crontab has no agent_council.sh entry")
if not dash:
    print(f"INFO: agent_dashboard.sh has no independent crontab entry — chained off "
          f"the council, so the {max_age}s guard cannot race the schedule")
    sys.exit(0)

if worst > max_age:
    sys.exit(
        f"agent_dashboard.sh MAX_AGE={max_age}s is below the council's worst case "
        f"{worst}s (EXPERT_TIMEOUT {expert} + AGGREGATOR_TIMEOUT {agg}). No cron gap "
        f"can satisfy the guard — chain agent_dashboard.sh off agent_council.sh "
        f"instead of scheduling it separately, or raise MAX_AGE above {worst}s AND "
        f"move the dashboard slot into [{worst}s, {max_age}s] after the council.")

bad = []
for d in dash:
    prior = [c for c in council if c <= d]
    if not prior:
        bad.append(f"{d//60:02d}:{d%60:02d} runs before any council slot")
        continue
    gap = (d - prior[-1]) * 60
    if gap < worst:
        bad.append(f"{d//60:02d}:{d%60:02d} is {gap}s after the council slot "
                   f"{prior[-1]//60:02d}:{prior[-1]%60:02d}, under the {worst}s worst case")
    elif gap > max_age:
        bad.append(f"{d//60:02d}:{d%60:02d} is {gap}s after the council slot "
                   f"{prior[-1]//60:02d}:{prior[-1]%60:02d}, over the {max_age}s guard")
if bad:
    sys.exit("council -> dashboard gaps outside [%ds, %ds]: %s" % (worst, max_age, "; ".join(bad)))
print(f"INFO: council worst case >= {worst}s, guard {max_age}s, all "
      f"{len(dash)} dashboard slot(s) inside the window")
PY
pass "council -> dashboard schedule satisfies agent_dashboard.sh's freshness guard"

# 3c. Freshness is not health (Sol, 2026-08-21). maplegamma_council.py writes the
# artifact in FOUR states and returns 0 in all of them: "full"/"partial_Nof5"
# (:655), "aggregator_failed" (:672, raw expert outputs, no aggregated analysis)
# and "insufficient_experts" (:551). Every one goes through _write_output(), so
# every one refreshes the mtime and sails past agent_dashboard.sh's MAX_AGE check
# — the wrapper publishes a fallback as if it were a healthy council. monday_gate.sh
# catches it (meta.status = full AND experts_succeeded = 5) but only once a day at
# 07:40; the other three cycles have no such check. The wrapper must read
# meta.status, not just the mtime.
grep -qE 'meta.*status|\["status"\]|get\("status"|\.meta\.status' "$dash_sh" \
  || fail "agent_dashboard.sh gates on file age alone — it never reads meta.status, so a
  council that wrote status=aggregator_failed or insufficient_experts still publishes as
  healthy (both refresh the mtime and exit 0). Require meta.status like monday_gate.sh does."
pass "agent_dashboard.sh validates council meta.status, not just mtime"

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
# The weekend/Monday grace windows are Pi-cron windows; a bare .astimezone() on a
# UTC runner evaluates them 4-5h early and false-pages every Monday 04:00-07:25 ET.
grep -q "America/New_York" "$DATA_REPO/.github/workflows/deadman.yml" || fail "deadman grace windows not ET-anchored"
pass "deadman grace windows ET-anchored"

# 7. Gate script present + executable
[ -x "$DATA_REPO/tools/monday_gate.sh" ] || fail "monday_gate.sh missing/not executable"
[ -x "$DATA_REPO/tools/run_maplegamma_gate.sh" ] || fail "run_maplegamma_gate.sh missing/not executable"
[ -x "$DATA_REPO/tools/check_maplegamma_gate_schedule.py" ] || fail "gate schedule checker missing/not executable"
bash -n "$DATA_REPO/tools/monday_gate.sh" || fail "monday_gate.sh syntax"
bash -n "$DATA_REPO/tools/run_maplegamma_gate.sh" || fail "run_maplegamma_gate.sh syntax"
pass "gate scripts present + executable + syntax OK"
MAPLEGAMMA_GATE_CHECK_ONLY=1 bash "$DATA_REPO/tools/run_maplegamma_gate.sh" \
  || fail "MapleGamma gate credential configuration invalid"
pass "gate credential file present, private, and populated"

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
