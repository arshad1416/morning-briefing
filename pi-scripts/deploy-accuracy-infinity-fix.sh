#!/usr/bin/env bash
# deploy-accuracy-infinity-fix.sh — port the 2026-07-22 accuracy.json fix (commit
# 79686e62, "fix(models): emit valid accuracy JSON") to the LIVE Pi script.
#
# The fix landed in pi-scripts/ on 2026-07-22 but was never copied to
# ~/.hermes/scripts/, which is what cron actually runs (AGENTS.md rule 4).
# On 2026-07-30 15:37 the paper book hit "1 closed trade, a winner, zero losses",
# so compute_expectancy() took the no-losses branch, wrote profit_factor: Infinity,
# and r2_sync's validator rejected the file. push_dashboard.py is fail-closed on a
# skipped private artifact, so it has refused to publish ANY public data since.
#
# Run ON THE PI:  bash ~/morning-briefing/pi-scripts/deploy-accuracy-infinity-fix.sh
# Idempotent, backs up, py_compile-verifies, reverts on failure.

set -euo pipefail
HS=~/.hermes/scripts
F="$HS/generate_prediction_accuracy.py"
TAG="bak-$(date +%Y-%m-%d-%H%M%S)"

[ -f "$F" ] || { echo "ABORT: $F not found"; exit 1; }
cp "$F" "$F.$TAG"
echo "backup: $F.$TAG"

python3 - "$F" <<'PY'
import sys
path = sys.argv[1]
src = open(path).read()
edits = 0

# 1. Root cause: no losses must yield JSON null, never Infinity.
old = "else float('inf'),"
new = "else None,"
if old in src:
    n = src.count(old)
    if n != 1:
        sys.exit(f"ABORT: expected 1 occurrence of {old!r}, found {n}")
    src = src.replace(old, new, 1); edits += 1
    print("  applied: profit_factor float('inf') -> None")
elif new in src:
    print("  already applied: profit_factor -> None")
else:
    sys.exit("ABORT: could not find the profit_factor branch to patch")

# 2. Hardening: fail loudly in THIS script's own log if any non-finite value ever
#    reappears, instead of silently poisoning the publish 30 minutes later.
old2 = "json.dump(output, f, indent=2)"
new2 = "json.dump(output, f, indent=2, allow_nan=False)"
if old2 in src and new2 not in src:
    src = src.replace(old2, new2, 1); edits += 1
    print("  applied: json.dump allow_nan=False")
elif new2 in src:
    print("  already applied: allow_nan=False")

open(path, "w").write(src)
print(f"  {edits} edit(s) written")
PY

if ! python3 -m py_compile "$F"; then
  echo "COMPILE FAILED — reverting"; cp "$F.$TAG" "$F"; exit 1
fi
echo "py_compile OK"

echo "── regenerating accuracy.json ──"
cd "$HS" && python3 generate_prediction_accuracy.py

echo "── validating against the gate that was blocking publish ──"
cd "$HS" && python3 -c "
from pipeline_schemas import load_and_validate_artifact
load_and_validate_artifact('/home/arshad14/morning-briefing/data/accuracy.json')
print('  accuracy.json PASSES validation')
"

echo
echo "Done. Next publish run will unfreeze the site, or force one now with:"
echo "  cd $HS && python3 push_dashboard.py"
