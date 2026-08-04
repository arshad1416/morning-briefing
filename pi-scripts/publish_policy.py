"""Fail-closed policy shared by the MapleGamma Pi publisher and its tests."""
import shutil
from pathlib import Path

NOPE_DETAIL_FILE = "nope-detail.json"

# Paths under data/ that must never reach Pages but are NOT premium R2 artifacts.
#
# Kept deliberately separate from PRIVATE_FILES. That list does two jobs —
# "upload this to R2" and "keep this off Pages" — and r2_sync iterates it to
# upload every entry. Putting a DIRECTORY there would make s3.upload_file fail,
# which counts as a transport failure, which fail-closes the entire publish.
# These paths need only the second job.
#
# sec/  Per-ticker SEC filings from fetch_sec_filings.py. Purely an intermediate:
#       publish_research_tabs aggregates them into sec_filings.json (Basic-gated,
#       R2-only) and publish_ticker_details bakes 5 per ticker into
#       data/tickers/*.json. Nothing under src/ or public/ has ever fetched
#       /data/sec/, yet the directory was published unauthenticated — so the
#       gated aggregate could be reconstructed one ticker at a time.
UNPUBLISHED_PATHS = ("sec/",)


def _purge_unpublished(public_data):
    """Delete never-publish paths already staged under public/data.

    push_dashboard's rsync runs without --delete, so anything published before a
    path joined UNPUBLISHED_PATHS would otherwise linger in public/data — and in
    the repo, and on the live site — forever.
    """
    for relative_path in UNPUBLISHED_PATHS:
        stale = public_data / relative_path.rstrip("/")
        if stale.is_dir():
            shutil.rmtree(stale)
        elif stale.exists():
            stale.unlink()


def enforce_private_pages_exclusion(repo_root, private_files):
    """Remove private artifacts from Pages output and verify NOPE remains private."""
    private_files = set(private_files)
    if NOPE_DETAIL_FILE not in private_files:
        raise RuntimeError("NOPE detail must be listed as private R2-only data")

    public_data = Path(repo_root) / "public" / "data"
    for relative_path in private_files:
        public_path = public_data / relative_path
        if public_path.exists():
            public_path.unlink()

    _purge_unpublished(public_data)

    nope_public_path = public_data / NOPE_DETAIL_FILE
    if nope_public_path.exists():
        raise RuntimeError("Refusing to stage a public NOPE artifact")


def pages_excludes(private_files):
    """Return the rsync exclusions: premium artifacts + never-published paths."""
    private_files = set(private_files)
    if NOPE_DETAIL_FILE not in private_files:
        raise RuntimeError("NOPE detail must be listed as private R2-only data")
    return sorted(private_files) + list(UNPUBLISHED_PATHS)
