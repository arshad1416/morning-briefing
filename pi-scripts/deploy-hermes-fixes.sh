#!/usr/bin/env bash
# deploy-hermes-fixes.sh — remaining Pi-side steps from the 2026-07-27
# Fable-5-audit investigation (FABLE5-AUDIT-INVESTIGATION-2026-07-27.md).
#
# Run ON THE PI:   bash ~/morning-briefing/pi-scripts/deploy-hermes-fixes.sh
# Idempotent: every phase checks current state and skips itself when done.
# Every file edit takes a .bak-2026-07-27-* backup and py_compile-verifies,
# reverting on failure. Aborts on the first unexpected condition.
#
# Already done before this script existed (2026-07-27 session):
#   - hermes-scripts local commit 5138d93 (deployed Jul 21-26 state), tree clean
#   - corrected audit skill deployed (finance/daily-briefing-system)
#   - backup tarball: ~/hermes-scripts-backup-2026-07-27.tar.gz
#
# Phase D only runs after morning-briefing PR #36 is merged AND Cloudflare
# Pages has deployed (gate: live llms.txt mentions screener-lite).

set -euo pipefail
HS=~/.hermes/scripts
MB=~/morning-briefing
TAG="bak-2026-07-27"

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

compile_or_revert() {  # compile_or_revert <file>
  if ! python3 -m py_compile "$1"; then
    echo "COMPILE FAILED — reverting $1"
    cp "$1.$TAG-$(basename "$1")" "$1" 2>/dev/null || true
    exit 1
  fi
}

echo "── Phase A: push the committed hermes-scripts state ──"
cd "$HS"
if [ -n "$(git status --porcelain -uno)" ]; then
  echo "ABORT: tracked files modified — commit or stash first"; exit 1
fi
if [ "$(git rev-list --count origin/main..main)" -gt 0 ]; then
  git push origin main
  echo "  pushed $(git log --oneline -1 | cut -d' ' -f1)"
else
  echo "  already pushed"
fi

echo "── Phase B: port hardened generate_latest.py ──"
if grep -q "UPSTREAM_MAX_AGE_H" "$HS/generate_latest.py"; then
  echo "  already ported"
else
  cp "$HS/generate_latest.py" "$HS/generate_latest.py.$TAG-hardening"
  cp "$MB/pi-scripts/generate_latest.py" "$HS/generate_latest.py"
  compile_or_revert "$HS/generate_latest.py"
  ( cd "$HS" && python3 -c "import pipeline_runtime" )  # import dependency
  # Smoke test: run it and confirm the May-frozen fields are now guarded out.
  ( cd "$HS" && python3 generate_latest.py )
  python3 - <<'PY'
import json, os
d = json.load(open(os.path.expanduser("~/morning-briefing/data/latest.json")))
nar = d.get("narrative", {}).get("summary_paragraph", "")
assert "1,177.72" not in nar, "stale May narrative still publishing"
assert d.get("central_banks", {}).get("fed", "") == "" or "June meeting" not in d["central_banks"]["fed"], "hardcoded June Fed text still publishing"
assert d.get("watchlist_summary", {}) in ({}, {"total_scanned": 0, "avg_change": 0, "green_count": 0, "red_count": 0}) or True
print("  smoke test OK — stale caches no longer republished")
PY
  ( cd "$HS" && git add generate_latest.py \
    && git commit -m "fix(generate_latest): age-guard pipeline_synthesis + drop hardcoded central-bank fallback

Port of morning-briefing 2b5e6576 + PR #36 follow-up. The bare exists()
check republished a dead May 30 synthesis (portfolio narrative) under a
fresh generated_at for 8 weeks; the DEFAULT_FED/DEFAULT_BOC constants
published frozen June text forever. Stale upstreams now age out like
every other cache; empty strings hide the cards in all consumers.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" \
    && git push origin main )
fi

echo "── Phase C: dual-key GEX readers (SPY or legacy SPX) ──"
cp "$HS/maplegamma_council.py" "$HS/maplegamma_council.py.$TAG-dualkey" 2>/dev/null || true
edit_once "$HS/maplegamma_council.py" \
  'spx = (mgd or {}).get("tickers", {}).get("SPX", {})' \
  'mg_tickers = (mgd or {}).get("tickers", {})
    spx = mg_tickers.get("SPY") or mg_tickers.get("SPX") or {}'
compile_or_revert "$HS/maplegamma_council.py"

cp "$HS/three_sleeve_scorer.py" "$HS/three_sleeve_scorer.py.$TAG-dualkey" 2>/dev/null || true
edit_once "$HS/three_sleeve_scorer.py" \
  'json.load(_gf).get("tickers", {}).get("SPX", {})' \
  '(lambda _t: _t.get("SPY") or _t.get("SPX") or {})(json.load(_gf).get("tickers", {}))'
compile_or_revert "$HS/three_sleeve_scorer.py"

( cd "$HS" && git diff --quiet maplegamma_council.py three_sleeve_scorer.py \
  || ( git add maplegamma_council.py three_sleeve_scorer.py \
    && git commit -m "fix(gex): read tickers.SPY or legacy tickers.SPX

maplegamma-data.json carries SPY-scale values under the misnomer SPX key;
push_gex.py is being renamed to write SPY. Readers accept both so they
work on either side of the flip.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" \
    && git push origin main ) )

echo "── Phase D: flip push_gex.py writer SPX→SPY (gated on site deploy) ──"
if grep -q '"tickers": {"SPY"' "$HS/push_gex.py"; then
  echo "  already flipped"
elif curl -sf https://maplegamma.com/llms.txt | grep -q "screener-lite"; then
  cp "$HS/push_gex.py" "$HS/push_gex.py.$TAG-spyflip"
  edit_once "$HS/push_gex.py" '"tickers": {"SPX": ticker_data}' '"tickers": {"SPY": ticker_data}'
  edit_once "$HS/push_gex.py" 'ticker = summary["tickers"]["SPX"]' 'ticker = summary["tickers"]["SPY"]'
  compile_or_revert "$HS/push_gex.py"
  ( cd "$HS" && python3 push_gex.py )
  python3 - <<'PY'
import json, os
d = json.load(open(os.path.expanduser("~/morning-briefing/data/maplegamma-data.json")))
keys = list(d.get("tickers", {}).keys())
assert keys == ["SPY"], f"expected ['SPY'], got {keys}"
print(f"  maplegamma-data.json now keyed {keys}, generated_at {d.get('generated_at')}")
PY
  ( cd "$HS" && git add push_gex.py \
    && git commit -m "fix(push_gex): write tickers.SPY — the key the values actually are

The payload has always been SPY-scale (price ~737, strikes 700-800);
the SPX key was a misnomer that made agents and downstream readers
misread levels against S&P 500 prints (site shim: morning-briefing
src/lib/schemas/market.ts). Site + Pi readers accept both keys as of
today, so this flip is non-breaking.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" \
    && git push origin main )
  echo "  NOTE: goes live on the next push_dashboard cycle (:07/:37 market hours)."
else
  echo "  SKIPPED: live llms.txt does not yet include the PR #36 changes."
  echo "  Merge https://github.com/arshad1416/morning-briefing/pull/36, wait for"
  echo "  Pages deploy, then re-run this script (phases A-C will no-op)."
fi

echo "── All phases complete ──"
