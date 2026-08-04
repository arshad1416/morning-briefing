#!/usr/bin/env python3
"""Verify the four-place premium-file registration AGENTS.md rule 5 describes.

Adding or reclassifying a gated file means touching four things:

    1. pi-scripts/r2_sync.py          PRIVATE_FILES   (upload it to R2)
    2. .gitignore                     data/<f>        (keep it out of the repo)
    3. .gitignore                     public/data/<f> (keep it off Pages)
    4. cloudflare-worker/src/data_gate.js             (serve it, gated)

Miss one and you get a silent, specific failure:

    in PRIVATE_FILES, not gitignored   -> the file LEAKS onto the public site
    in PRIVATE_FILES, not in data_gate -> uploaded to R2 but unreachable; PAYING
                                          subscribers get 404 "not_found"
    in data_gate, not in PRIVATE_FILES -> the gated route always 404s
                                          "not_generated"

None of those raises anything at publish time, which is exactly why the rule
needs a check rather than a paragraph. Runs in CI on every PR touching code;
stdlib only, no deps.

    python3 scripts/check_premium_registration.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def private_files() -> set[str]:
    """PRIVATE_FILES from r2_sync.py, read as text (it imports Pi-only deps)."""
    src = (ROOT / "pi-scripts" / "r2_sync.py").read_text()
    m = re.search(r"PRIVATE_FILES\s*=\s*\[(.*?)\]", src, re.S)
    if not m:
        sys.exit("FAIL: could not find PRIVATE_FILES in pi-scripts/r2_sync.py")
    return set(re.findall(r'"([^"]+\.json)"', m.group(1)))


def gated_files() -> set[str]:
    """PRO_FILES + BASIC_FILES from the Worker's data_gate.js."""
    src = (ROOT / "cloudflare-worker" / "src" / "data_gate.js").read_text()
    names: set[str] = set()
    for const in ("PRO_FILES", "BASIC_FILES"):
        m = re.search(const + r"\s*=\s*new Set\(\[(.*?)\]\)", src, re.S)
        if not m:
            sys.exit(f"FAIL: could not find {const} in cloudflare-worker/src/data_gate.js")
        names |= set(re.findall(r"'([^']+\.json)'", m.group(1)))
    return names


def gitignored() -> set[str]:
    lines = {
        ln.strip()
        for ln in (ROOT / ".gitignore").read_text().splitlines()
        if ln.strip() and not ln.lstrip().startswith("#")
    }
    return lines


def main() -> int:
    private = private_files()
    gated = gated_files()
    ignored = gitignored()
    problems: list[str] = []

    for name in sorted(private):
        if f"data/{name}" not in ignored:
            problems.append(
                f"{name}: in PRIVATE_FILES but 'data/{name}' is not gitignored "
                f"— the premium file would be COMMITTED and LEAK onto Pages")
        if f"public/data/{name}" not in ignored:
            problems.append(
                f"{name}: in PRIVATE_FILES but 'public/data/{name}' is not gitignored "
                f"— the premium file would be PUBLISHED to the live site")
        if name not in gated:
            problems.append(
                f"{name}: in PRIVATE_FILES but not in data_gate.js "
                f"— uploaded to R2 yet unreachable; paying subscribers get 404")

    for name in sorted(gated - private):
        problems.append(
            f"{name}: gated in data_gate.js but not in PRIVATE_FILES "
            f"— never uploaded to R2, so the route always 404s 'not_generated'")

    if problems:
        print(f"Premium registration is inconsistent ({len(problems)} problem(s)):\n")
        for p in problems:
            print(f"  • {p}")
        print("\nSee AGENTS.md rule 5 — a gated file must be registered in all four places.")
        return 1

    print(f"Premium registration consistent: {len(private)} files "
          f"registered in r2_sync, .gitignore (both trees) and data_gate.js.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
