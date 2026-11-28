"""Replay the fourth independent reading comparison against the evaluated release assets."""
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parent
CORPUS_SHA256 = "deeb69bd9571f02ad615d0fd5150f5e1c077a153462f2c714c4b00407763a2e1"

if __name__ == "__main__":
    audit = runpy.run_path(str(ROOT.parent / "round3/audit.py"))
    audit["main"](ROOT, CORPUS_SHA256, archived_revision=None)
