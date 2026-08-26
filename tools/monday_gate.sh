#!/usr/bin/env bash
# tools/monday_gate.sh — fail-closed gate for the daily production morning run.
# Prints PASS:/FAIL: per check and exits non-zero on the first failure.
# Cron invokes run_maplegamma_gate.sh at 07:34/07:36/07:38 ET on weekdays.
# Deps: curl, git, python3 (no jq — the Pi does not have it).
#
# INVARIANT (R5 NEW-11): every production operating day requires that day's
# successful gate sentinel (~/.hermes/state/maplegamma_gate_passed_<date>,
# content 'ok YYYY-MM-DD HH:MM:SS'). Guards fail closed without it. Do not
# shrink MAPLEGAMMA_GATE_DAYS to bypass; document any mode change instead.
#
# GATE DEADLINE (R6 NEW-13): this gate must COMPLETE by 07:40 ET on gate days.
# Guarded consumers fire at 07:41+ (executor), 07:43 (send), 07:45 (paper) and
# fail closed if the sentinel is absent. The 07:40 watchdog alerts before the
# first consumer; 07:50 is a backstop. Never fabricate or backdate a sentinel.
set -uo pipefail
export TZ=America/Toronto

# ---- config (override via env) ----
ANALYSIS_JSON="${ANALYSIS_JSON:-$HOME/morning-briefing/data/maplegamma_analysis.json}"
ANALYSIS_PUBLIC="${ANALYSIS_PUBLIC:-$HOME/morning-briefing/public/data/analysis.json}"
DATA_REPO="${DATA_REPO:-$HOME/morning-briefing}"
LOG_DIR="${LOG_DIR:-$HOME/.hermes/logs}"
LIVE_BASE="${LIVE_BASE:-https://maplegamma.com}"
GATED_PATH="api/data/maplegamma_analysis.json"
TODAY_ET="$(date +%F)"
STATE_DIR="${STATE_DIR:-$HOME/.hermes/state}"
GATE_SENTINEL="$STATE_DIR/maplegamma_gate_passed_$TODAY_ET"

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; exit 1; }

# Cron retries the gate while the Pages deployment settles. Once one attempt
# writes a valid on-time sentinel, later attempts must be cheap and harmless.
if [ -f "$GATE_SENTINEL" ]; then
  marker=""
  sentinel_date=""
  sentinel_time=""
  trailing=""
  read -r marker sentinel_date sentinel_time trailing < "$GATE_SENTINEL" || true
  if [ "$marker" = "ok" ] && [ "$sentinel_date" = "$TODAY_ET" ] && [ -z "$trailing" ] \
      && [[ "$sentinel_time" =~ ^[0-9]{2}:[0-9]{2}:[0-9]{2}$ ]]; then
    sentinel_hour="${sentinel_time:0:2}"
    sentinel_minute="${sentinel_time:3:2}"
    sentinel_second="${sentinel_time:6:2}"
    sentinel_hm="$sentinel_hour$sentinel_minute"
    if [ "$((10#$sentinel_hour))" -le 23 ] \
        && [ "$((10#$sentinel_minute))" -le 59 ] \
        && [ "$((10#$sentinel_second))" -le 59 ] \
        && [ "$((10#$sentinel_hm))" -le 740 ]; then
      pass "monday_gate already passed at $sentinel_time ET"
      exit 0
    fi
  fi
fi

# 1) council artifact: full run, 5 experts, sane regime, generated TODAY (council CRITICAL #3 —
#    a stale Friday artifact must not pass Monday's gate)
[ -f "$ANALYSIS_JSON" ] || fail "analysis json missing: $ANALYSIS_JSON"
read -r status experts regime gen_at <<<"$(python3 - "$ANALYSIS_JSON" <<'PY'
import json, sys
d = json.load(open(sys.argv[1]))
print(d.get("meta", {}).get("status", ""), d.get("meta", {}).get("experts_succeeded", ""), d.get("market_pulse", {}).get("regime", ""), d.get("meta", {}).get("generated_at", ""))
PY
)" || fail "could not parse analysis json: $ANALYSIS_JSON"
[ "$status" = "full" ] || fail "meta.status != full (got '$status')"
[ "$experts" = "5" ] || fail "meta.experts_succeeded != 5 (got '$experts')"
case "$regime" in
  bullish|bearish|neutral) ;;
  *) fail "market_pulse.regime invalid (got '$regime')" ;;
esac
if [ -n "$gen_at" ]; then
  gen_date="$(python3 - "$gen_at" <<'PY'
import sys, datetime, zoneinfo
raw = sys.argv[1].strip()
if raw.endswith("Z"):
    raw = raw[:-1] + "+00:00"
dt = datetime.datetime.fromisoformat(raw)
if dt.tzinfo is None:
    dt = dt.replace(tzinfo=datetime.timezone.utc)
print(dt.astimezone(zoneinfo.ZoneInfo("America/Toronto")).strftime("%Y-%m-%d"))
PY
)" || gen_date=""
  [ "$gen_date" = "$TODAY_ET" ] || fail "council artifact generated $gen_date, not today ($TODAY_ET) — stale run"
fi
pass "analysis json full / 5 experts / regime=$regime / generated today"

# 2) public analysis.json exists, non-empty, modified today (ET)
[ -s "$ANALYSIS_PUBLIC" ] || fail "public analysis.json missing or empty: $ANALYSIS_PUBLIC"
analysis_date="$(date -r "$ANALYSIS_PUBLIC" +%F)"
[ "$analysis_date" = "$TODAY_ET" ] || fail "public analysis.json mtime $analysis_date != today ($TODAY_ET)"
pass "public analysis.json present and fresh (mtime $analysis_date)"

# 3) live latest.json generated_at is today (ET); ISO with Z handled
latest_body="$(curl -fsS --max-time 15 --retry 2 --retry-delay 2 "$LIVE_BASE/data/latest.json?gate=$(date +%s)")" || fail "could not fetch $LIVE_BASE/data/latest.json"
generated_at="$(python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('generated_at',''))" <<<"$latest_body")" || fail "could not parse latest.json"
[ -n "$generated_at" ] || fail "latest.json missing generated_at"
gen_date="$(python3 - "$generated_at" <<'PY'
import sys, datetime, zoneinfo
raw = sys.argv[1].strip()
if raw.endswith("Z"):
    raw = raw[:-1] + "+00:00"
dt = datetime.datetime.fromisoformat(raw)
if dt.tzinfo is None:
    dt = dt.replace(tzinfo=datetime.timezone.utc)
print(dt.astimezone(zoneinfo.ZoneInfo("America/Toronto")).strftime("%Y-%m-%d"))
PY
)" || fail "could not parse latest.json generated_at: $generated_at"
[ "$gen_date" = "$TODAY_ET" ] || fail "latest.json generated_at $generated_at is $gen_date ET, not $TODAY_ET"
pass "latest.json generated_at is today ET ($generated_at)"

# 3b) production verdict.json is fresh today (council round-2 CRITICAL #2 — the
#     07:30 generate_verdict && push chain publishes it; verify the DEPLOYED copy,
#     not just local repo state)
verdict_body="$(curl -fsS --max-time 15 --retry 2 --retry-delay 2 "$LIVE_BASE/data/verdict.json?gate=$(date +%s)")" || fail "could not fetch $LIVE_BASE/data/verdict.json"
vgen_at="$(python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('generated_at',''))" <<<"$verdict_body")" || fail "could not parse verdict.json"
[ -n "$vgen_at" ] || fail "verdict.json missing generated_at"
vgen_date="$(python3 - "$vgen_at" <<'PY'
import sys, datetime, zoneinfo
raw = sys.argv[1].strip()
if raw.endswith("Z"):
    raw = raw[:-1] + "+00:00"
dt = datetime.datetime.fromisoformat(raw)
if dt.tzinfo is None:
    dt = dt.replace(tzinfo=datetime.timezone.utc)
print(dt.astimezone(zoneinfo.ZoneInfo("America/Toronto")).strftime("%Y-%m-%d"))
PY
)" || fail "could not parse verdict.json generated_at: $vgen_at"
[ "$vgen_date" = "$TODAY_ET" ] || fail "verdict.json generated_at $vgen_at is $vgen_date ET, not $TODAY_ET"
pass "production verdict.json generated_at is today ET ($vgen_at)"

# 4) /api/health is 200
health_code="$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_BASE/api/health")" || fail "curl /api/health failed"
[ "$health_code" = "200" ] || fail "/api/health returned $health_code"
pass "/api/health returned 200"

# 5) anonymous gated GET is 401
anon_code="$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_BASE/$GATED_PATH")" || fail "curl gated URL failed"
[ "$anon_code" = "401" ] || fail "anonymous gated GET returned $anon_code, expected 401"
pass "anonymous gated GET returned 401"

# 6) entitled gated GET is 200 — REQUIRED, fail-closed (council CRITICAL #9)
: "${TEST_SESSION_COOKIE:?TEST_SESSION_COOKIE must be set (a valid session cookie for an entitled user)}"
auth_code="$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: mg_session=$TEST_SESSION_COOKIE" "$LIVE_BASE/$GATED_PATH")" || fail "curl gated URL with cookie failed"
[ "$auth_code" = "200" ] || fail "entitled gated GET returned $auth_code, expected 200"
pass "entitled gated GET returned 200"

# 7) data repo has nothing pending against origin/main (push happened)
[ -d "$DATA_REPO/.git" ] || fail "data repo not found: $DATA_REPO"
ahead="$(git -C "$DATA_REPO" rev-list --count origin/main..HEAD)" || fail "git rev-list failed in $DATA_REPO"
[ "$ahead" = "0" ] || fail "data repo is $ahead commit(s) ahead of origin/main"
pass "data repo in sync with origin/main"

# 8) no LLM truncation (finish_reason=length) in council logs from the last 24h
[ -d "$LOG_DIR" ] || fail "log dir not found: $LOG_DIR"
trunc="$(find "$LOG_DIR" -type f -name '*.log' -mmin -1440 -print0 2>/dev/null | xargs -0 -r grep -lE 'finish_reason.*length' 2>/dev/null || true)"
[ -z "$trunc" ] || fail "truncation (finish_reason=length) in council logs (24h): $trunc"
pass "no truncation in council logs (last 24h)"

# R7 (Sol round-7): hard deadline enforcement. Sentinel is written ONLY if the
# gate completes by 07:40 ET. A late completion = exit 1, NO sentinel, alert.
now_hm="$(TZ=America/Toronto date +%H%M)"
# Sol round-9: `10#` forces base-10 — immune to octal parsing for EVERY case
# (0800, 0008, 0059, 0915). `${now_hm#0}` only stripped one zero; hour-00 values
# with 8/9 remained invalid octal. `[ $((10#HHMM)) -gt 740 ]` is deterministic.
if [ "$((10#$now_hm))" -gt 740 ]; then
  echo "FAIL: gate completed at $now_hm ET — AFTER the 07:40 deadline. No sentinel written; guarded consumers will skip (fail-closed)."
  python3 "$HOME/.hermes/scripts/tg_notify.py" "🚨 MapleGamma gate FAILED: completed after 07:40 ET deadline ($now_hm ET). No sentinel — consumers skipped. Investigate and re-run: bash ~/morning-briefing/tools/monday_gate.sh" >/dev/null 2>&1 || true
  exit 1
fi

echo "PASS: monday_gate — all checks passed"

# Write the gate-passed sentinel (round-2): persistent private state dir, not /tmp
# (tmpfs/reboot-cleared/world-writable — council round-2 HIGH). Guarded jobs
# (send_comprehensive_briefing, council_trade_executor, automated_paper_trader)
# only enforce on gate days; the sentinel makes the daily production chain safe.
# Round-7: this write is unreachable after 07:40 — a late run never publishes.
install -d -m 700 "$STATE_DIR"
umask 077
SENTINEL_TMP="$STATE_DIR/.maplegamma_gate_passed_$TODAY_ET.tmp"
printf 'ok %s %s\n' "$TODAY_ET" "$(TZ=America/Toronto date +%H:%M:%S)" > "$SENTINEL_TMP"
mv -f "$SENTINEL_TMP" "$GATE_SENTINEL"   # atomic replace
echo "SENTINEL: $GATE_SENTINEL"
