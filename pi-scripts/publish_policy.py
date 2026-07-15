"""Fail-closed policy shared by the MapleGamma Pi publisher and its tests."""
from pathlib import Path

NOPE_DETAIL_FILE = "nope-detail.json"


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

    nope_public_path = public_data / NOPE_DETAIL_FILE
    if nope_public_path.exists():
        raise RuntimeError("Refusing to stage a public NOPE artifact")


def pages_excludes(private_files):
    """Return the rsync exclusions for the sole private-data policy list."""
    private_files = set(private_files)
    if NOPE_DETAIL_FILE not in private_files:
        raise RuntimeError("NOPE detail must be listed as private R2-only data")
    return sorted(private_files)
