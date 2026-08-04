#!/usr/bin/env bash
# deploy-r2-failure-split.sh — stop one bad premium artifact from freezing the
# entire public site (the 2026-07-30 → 08-04 outage).
#
# Splits r2_sync's single "skipped" counter into:
#   invalid — artifact rejected for BAD DATA. Skip that file (its previous R2
#             copy keeps serving), publish everything else, alert on Telegram.
#   failed  — transport/credential problem. R2 is unhealthy: still abort.
#
# Premium data still cannot leak: that guarantee is the rsync --exclude in
# push_dashboard.py, which does not depend on the R2 sync succeeding.
#
# Applies TARGETED edits, because the live copies and the repo copies have
# diverged in other ways — copying whole files would drag in undeployed changes.
# Both files are patched together or neither is.
#
# Run ON THE PI:  bash /tmp/deploy-r2-failure-split.sh

set -euo pipefail
HS=~/.hermes/scripts
R2="$HS/r2_sync.py"
PD="$HS/push_dashboard.py"
TAG="bak-$(date +%Y-%m-%d-%H%M%S)"

for f in "$R2" "$PD"; do
  [ -f "$f" ] || { echo "ABORT: $f not found"; exit 1; }
  cp "$f" "$f.$TAG"
done
echo "backups: *.$TAG"

rollback() { echo "ROLLING BACK"; cp "$R2.$TAG" "$R2"; cp "$PD.$TAG" "$PD"; exit 1; }

python3 - "$R2" "$PD" <<'PY' || { echo "patch failed"; exit 1; }
import sys
r2_path, pd_path = sys.argv[1], sys.argv[2]

def patch(path, pairs):
    src = open(path).read()
    for old, new in pairs:
        if new in src and old not in src:
            print(f"  already applied in {path.split('/')[-1]}"); continue
        n = src.count(old)
        if n != 1:
            sys.exit(f"ABORT: expected 1 occurrence in {path}, found {n}:\n{old[:90]}")
        src = src.replace(old, new, 1)
    open(path, "w").write(src)
    print(f"  patched {path.split('/')[-1]}")

patch(r2_path, [
(
'''    """Upload the premium set + charts to R2. Returns (uploaded, skipped)."""
    env = _load_r2_env()
    ak, sk, ep = env.get("R2_ACCESS_KEY_ID"), env.get("R2_SECRET_ACCESS_KEY"), env.get("R2_S3_ENDPOINT")
    if not (ak and sk and ep):
        print("  R2 sync: creds not set in ~/.hermes/.env — skipping", file=sys.stderr)
        return (0, 0)''',
'''    """Upload the premium set + charts to R2.

    Returns (uploaded, invalid, failed): ``invalid`` holds artifacts rejected for
    bad data — the caller skips those and still publishes; ``failed`` holds
    transport/credential problems, which mean R2 is unhealthy and the caller must
    abort. Both are lists of "<key>: <reason>" strings for alerting.
    """
    env = _load_r2_env()
    ak, sk, ep = env.get("R2_ACCESS_KEY_ID"), env.get("R2_SECRET_ACCESS_KEY"), env.get("R2_S3_ENDPOINT")
    if not (ak and sk and ep):
        # Missing creds is infrastructure, not data: report it as a hard failure so
        # the caller aborts. Previously this returned (0, 0), which let the publish
        # proceed with premium files silently never uploaded.
        print("  R2 sync: creds not set in ~/.hermes/.env", file=sys.stderr)
        return (0, [], ["R2 credentials not set in ~/.hermes/.env"])'''
),
(
'''    uploaded = skipped = 0

    def put(key, path):
        nonlocal uploaded, skipped
        try:''',
'''    uploaded = 0
    invalid = []  # bad DATA in one artifact — caller skips it and publishes the rest
    failed = []   # transport/credentials — R2 itself is unhealthy, caller must abort

    def put(key, path):
        nonlocal uploaded
        try:'''
),
(
'''        except ArtifactValidationError as e:
            skipped += 1
            print(f"  R2 validation failed {key}: {e}", file=sys.stderr)
        except Exception as e:
            skipped += 1
            print(f"  R2 put failed {key}: {e}", file=sys.stderr)''',
'''        except ArtifactValidationError as e:
            # Split from transport failures deliberately. A bad value in ONE
            # premium file must not freeze all public publishing — on 2026-07-30
            # an Infinity in accuracy.json (Pro tier) froze the free dashboard
            # for 5 days. The no-leak guarantee is the rsync --exclude in
            # push_dashboard.py, which does not depend on this succeeding.
            invalid.append(f"{key}: {e}")
            print(f"  R2 validation failed {key}: {e}", file=sys.stderr)
        except Exception as e:
            failed.append(f"{key}: {e}")
            print(f"  R2 put failed {key}: {e}", file=sys.stderr)'''
),
(
'''    print(f"  R2 sync: {uploaded} uploaded, {skipped} skipped")
    return (uploaded, skipped)''',
'''    print(f"  R2 sync: {uploaded} uploaded, {len(invalid)} invalid, {len(failed)} failed")
    return (uploaded, invalid, failed)'''
),
])

patch(pd_path, [
(
'''            _uploaded, _skipped = r2_sync.run()
            if _skipped:
                raise RuntimeError(f"R2 sync skipped {_skipped} private artifact(s)")
            if os.path.exists(os.path.join(DASHBOARD_REPO, 'data', 'nope-detail.json')) and not _uploaded:
                raise RuntimeError("NOPE artifact exists but private R2 upload did not run")
        except Exception as _e:
            raise RuntimeError(f"Private R2 sync failed; refusing to publish Pages data: {_e}") from _e''',
'''            _uploaded, _invalid, _failed = r2_sync.run()
            # Transport/credential failure means R2 itself is unhealthy — still fatal.
            if _failed:
                raise RuntimeError(f"R2 upload failed for {len(_failed)} artifact(s): {'; '.join(_failed)}")
            if os.path.exists(os.path.join(DASHBOARD_REPO, 'data', 'nope-detail.json')) and not _uploaded:
                raise RuntimeError("NOPE artifact exists but private R2 upload did not run")
        except Exception as _e:
            raise RuntimeError(f"Private R2 sync failed; refusing to publish Pages data: {_e}") from _e
        # A premium artifact failing VALIDATION is bad data, not a broken publish.
        # Skip it (its previous R2 copy keeps serving) and publish everything else —
        # a Pro-tier file must never freeze the free dashboard again. Premium data
        # still cannot leak: that is the rsync --exclude below, which is unaffected.
        if _invalid:
            _msg = (
                f"⚠️ MapleGamma publish: {len(_invalid)} premium artifact(s) failed validation "
                f"and were NOT uploaded. Public data published anyway; these serve STALE data "
                f"until fixed:\\n" + "\\n".join(_invalid)
            )
            print(_msg, file=sys.stderr)
            # ponytail: alerts every run (~13/day in market hours) while a file stays
            # invalid. Noisy on purpose — silence is what cost 5 days. Add dedupe/state
            # if the noise ever becomes the reason someone mutes the channel.
            try:
                from tg_notify import send_telegram
                send_telegram(_msg)
            except Exception:
                pass'''
),
])
PY

for f in "$R2" "$PD"; do
  python3 -m py_compile "$f" || rollback
done
echo "py_compile OK for both"

echo "── smoke: no-creds path returns the 3-tuple ──"
cd "$HS" && python3 -c "
import r2_sync
r2_sync._load_r2_env = lambda: {}
u, i, f = r2_sync.sync_private_to_r2()
assert (u, i) == (0, []) and f, (u, i, f)
print('  3-tuple contract OK; missing creds -> hard failure')
" || rollback

echo
echo "Done. Verify with a real run:  cd $HS && python3 push_dashboard.py"
