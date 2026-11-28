"""Replay the fifth scientific translation comparison against the actual evaluated assets."""
from pathlib import Path
import runpy

ROOT = Path(__file__).resolve().parent
CORPUS_SHA256 = "7f3be464a6fb43246c02be0d50ff31748c6fe4985cd34fde0a5fe0dce2e8d833"

if __name__ == "__main__":
    audit = runpy.run_path(str(ROOT.parent / "round3/audit.py"))
    audit["main"](ROOT, CORPUS_SHA256, archived_revision=None)
