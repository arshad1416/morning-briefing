#!/usr/bin/env bash
# Mutation test: break the staleness module in ways a plausible refactor might,
# and confirm the suite catches each one. A green suite means nothing until it
# has been shown it can go red.
#
# The fix is APPLIED, so this mutates the REAL module, src/lib/staleness.ts,
# in place and runs `npm run check:staleness` against it. The original is
# restamped after every mutant and by an EXIT trap, so an interrupted run can
# never leave the working tree mutated. See README.md for the design history.
set -uo pipefail
cd "$(dirname "$0")/../.."

TARGET="src/lib/staleness.ts"
ORIG="$(cat "$TARGET")"
trap 'printf "%s" "$ORIG" > "$TARGET"' EXIT

run_suite() { npm run --silent check:staleness >/dev/null 2>&1; }

# Guard against a harness that reports everything as "killed" because the
# runner itself is broken: the unmutated original MUST pass first.
if ! run_suite; then
  echo "  !! baseline suite fails before any mutation -- harness is broken"; exit 1
fi

declare -a NAMES=() RESULTS=()

mutate() {
  local name="$1" from="$2" to="$3"
  TARGET="$TARGET" python3 - "$from" "$to" <<'PY'
import sys, os, pathlib
frm, to = sys.argv[1], sys.argv[2]
p = pathlib.Path(os.environ['TARGET'])
s = p.read_text()
if frm not in s:
    sys.exit(3)
p.write_text(s.replace(frm, to, 1))
PY
  if [ $? -eq 3 ]; then
    NAMES+=("$name"); RESULTS+=("PATTERN NOT FOUND")
  elif run_suite; then
    NAMES+=("$name"); RESULTS+=("SURVIVED")
  else
    NAMES+=("$name"); RESULTS+=("killed")
  fi
  printf '%s' "$ORIG" > "$TARGET"
}

# 1. Treat weekends as business days -> reintroduces the original bug exactly.
mutate "weekend counts as a business day" \
  'return idx >= 1 && idx <= 5;' 'return true;'
# 2. Off-by-one on the weekday range (Sat included).
mutate "business days off-by-one (includes Sat)" \
  'return idx >= 1 && idx <= 5;' 'return idx >= 1 && idx <= 6;'
# 3. Alarm on a single missed run -> noisy for transient blips.
mutate "alarm after 1 missed run" \
  'isStale: missedRuns >= 2' 'isStale: missedRuns >= 1'
# 4. Never alarm -> the check becomes decorative.
mutate "never alarms" \
  'isStale: missedRuns >= 2' 'isStale: false'
# 5. Drop the DST correction.
mutate "ignore DST offset correction" \
  'return new Date(naiveUtc - offset);' 'return new Date(naiveUtc);'
# 6. EQUIVALENT MUTANT (expected to survive): the loop advances a full calendar
# day before its first comparison, so `scheduled` can never equal `asOf`.
mutate "[equiv] count the originating run too" \
  'if (scheduled > asOf &&' 'if (scheduled >= asOf &&'
# 7. Wrong scheduled hour.
mutate "wrong cron hour (8 not 7)" \
  'const AGENT_HOUR = 7;' 'const AGENT_HOUR = 8;'
# 8. Wrong cron minute (found as a real gap by probing the harness).
mutate "wrong cron minute (59 not 12)" \
  'const AGENT_MIN = 12;' 'const AGENT_MIN = 59;'
# 9. Wrong timezone -> UTC.
mutate "wrong timezone (UTC)" \
  "const AGENT_TZ = 'America/Toronto';" "const AGENT_TZ = 'UTC';"
# 10. EQUIVALENT MUTANT (expected to survive): with now < asOf the first
# scheduled instant already exceeds now, so the loop breaks and returns 0 anyway.
mutate "[equiv] no clamp on reversed range" \
  'if (now <= asOf) return 0;' 'if (false) return 0;'
# 11. Bad-input guard removed.
mutate "NaN guard removed" \
  'if (Number.isNaN(ms)) return { isStale: false, missedRuns: 0, ageDays: null };' ''

echo
killed=0; survived=0; equiv=0; notfound=0
for i in "${!NAMES[@]}"; do
  printf '  %-42s %s\n' "${NAMES[$i]}" "${RESULTS[$i]}"
  case "${RESULTS[$i]}" in
    killed) killed=$((killed+1));;
    SURVIVED)
      survived=$((survived+1))
      case "${NAMES[$i]}" in "[equiv]"*) equiv=$((equiv+1));; esac ;;
    *) notfound=$((notfound+1));;
  esac
done
echo
echo "  $killed killed, $survived survived, $notfound pattern-not-found"
echo "  ($equiv of the survivors are the documented equivalent mutants)"

# A stale pattern silently stops testing anything, so treat it as failure.
if [ "$notfound" -ne 0 ]; then
  echo "  !! a mutation pattern no longer matches the source -- update mutate.sh"; exit 1
fi
# The honest bar: only the two provably-equivalent mutants may survive.
if [ "$survived" -ne "$equiv" ]; then
  echo "  !! a non-equivalent mutant survived -- real gap in the tests"; exit 1
fi
# The equivalent mutants must actually BE equivalent; if one gets killed, the
# reasoning behind it changed and the comment is now wrong.
if [ "$equiv" -ne 2 ]; then
  echo "  !! expected exactly 2 equivalent survivors, got $equiv"; exit 1
fi
echo "  OK"
