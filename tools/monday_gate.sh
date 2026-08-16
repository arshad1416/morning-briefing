#!/usr/bin/env bash
# tools/monday_gate.sh — fail-closed gate for the Monday 07:20 scheduled run.
# Prints PASS:/FAIL: per check and exits non-zero on the first failure.
# Run from the Pi after 07:35 ET on a weekday: bash tools/monday_gate.sh
# Deps: curl, git, python3 (no jq — the Pi does not have it).
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

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; exit 1; }
skip() { echo "SKIP: $*"; }

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
latest_body="$(curl -fsS "$LIVE_BASE/data/latest.json")" || fail "could not fetch $LIVE_BASE/data/latest.json"
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
auth_code="$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: __session=$TEST_SESSION_COOKIE" "$LIVE_BASE/$GATED_PATH")" || fail "curl gated URL with cookie failed"
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

echo "PASS: monday_gate — all checks passed"

# Write the gate-passed sentinel (council CRITICAL #1): guarded downstream jobs
# (send_comprehensive_briefing, council_trade_executor, automated_paper_trader)
# exit 0 silently unless today's sentinel exists.
touch "/tmp/maplegamma_gate_passed_$TODAY_ET"
echo "SENTINEL: /tmp/maplegamma_gate_passed_$TODAY_ET"
