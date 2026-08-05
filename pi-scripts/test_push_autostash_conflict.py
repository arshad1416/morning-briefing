"""`git pull --rebase --autostash` reports success even when the pop conflicts.

That is the whole bug, and it is surprising enough to pin against real git
rather than assert from memory: the rebase succeeds, THEN the stash is
restored, and a failed restore does not touch the exit code. push_dashboard
read rc==0 as "tree is clean", ran `git add -A`, and committed files full of
conflict markers under a "Live portfolio HH:MM" message.

These tests build a throwaway repo, force that exact collision, and check both
halves: that the pull really does return 0, and that `git ls-files --unmerged`
is a signal that catches it.

Runs anywhere git does — no Pi venv, no network.
"""

import os
import subprocess
import tempfile
import unittest


def git(*args, cwd, check=True):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise AssertionError(f"git {' '.join(args)} failed: {r.stderr or r.stdout}")
    return r


def unmerged_paths(cwd):
    """The check push_dashboard.py runs between pull and `git add -A`."""
    out = git("ls-files", "--unmerged", cwd=cwd).stdout.strip()
    if not out:
        return []
    return sorted({line.split("\t")[-1] for line in out.splitlines()})


class AutostashPopConflictTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = self.tmp.name
        self.origin = os.path.join(root, "origin")
        self.clone = os.path.join(root, "clone")

        os.makedirs(self.origin)
        git("init", "-q", "-b", "main", cwd=self.origin)
        for k, v in (("user.email", "t@t"), ("user.name", "t")):
            git("config", k, v, cwd=self.origin)
        self._write(self.origin, "data.json", '{"v": 1}\n')
        git("add", "-A", cwd=self.origin)
        git("commit", "-qm", "base", cwd=self.origin)

        git("clone", "-q", self.origin, self.clone, cwd=root)
        for k, v in (("user.email", "t@t"), ("user.name", "t")):
            git("config", k, v, cwd=self.clone)

        # Upstream moves...
        self._write(self.origin, "data.json", '{"v": 2, "from": "origin"}\n')
        git("commit", "-qam", "upstream change", cwd=self.origin)
        # ...and the Pi has an uncommitted edit to the SAME file. This is the
        # real shape: the Pi carries local pi-scripts/data edits between runs.
        self._write(self.clone, "data.json", '{"v": 2, "from": "pi"}\n')

    @staticmethod
    def _write(repo, name, text):
        with open(os.path.join(repo, name), "w") as fh:
            fh.write(text)

    def test_pull_returns_zero_despite_the_conflict(self):
        r = subprocess.run(
            "git pull --rebase --autostash origin main",
            shell=True, cwd=self.clone, capture_output=True, text=True,
        )
        # The premise. If a future git changes this, the guard is redundant and
        # this test says so loudly rather than the guard silently mattering less.
        self.assertEqual(r.returncode, 0, f"expected rc=0, got {r.returncode}: {r.stderr}")

    def test_unmerged_check_catches_what_the_exit_code_missed(self):
        subprocess.run(
            "git pull --rebase --autostash origin main",
            shell=True, cwd=self.clone, capture_output=True, text=True,
        )
        self.assertEqual(unmerged_paths(self.clone), ["data.json"])

    def test_conflict_markers_would_otherwise_reach_the_commit(self):
        subprocess.run(
            "git pull --rebase --autostash origin main",
            shell=True, cwd=self.clone, capture_output=True, text=True,
        )
        with open(os.path.join(self.clone, "data.json")) as fh:
            body = fh.read()
        self.assertIn("<<<<<<<", body)
        # Exactly what push_dashboard used to do next.
        git("add", "-A", cwd=self.clone)
        staged = git("show", ":data.json", cwd=self.clone).stdout
        self.assertIn("<<<<<<<", staged)

    def test_clean_pull_reports_no_unmerged_paths(self):
        # The guard must not fire on the ordinary case, which is every run.
        git("checkout", "--", "data.json", cwd=self.clone)
        r = subprocess.run(
            "git pull --rebase --autostash origin main",
            shell=True, cwd=self.clone, capture_output=True, text=True,
        )
        self.assertEqual(r.returncode, 0)
        self.assertEqual(unmerged_paths(self.clone), [])


if __name__ == "__main__":
    unittest.main()
