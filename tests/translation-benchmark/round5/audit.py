"""Replay the fifth scientific translation comparison against the actual evaluated assets."""
from pathlib import Path
import json
import runpy

ROOT = Path(__file__).resolve().parent
CORPUS_SHA256 = "7f3be464a6fb43246c02be0d50ff31748c6fe4985cd34fde0a5fe0dce2e8d833"


def verify_reader_replay():
    runs = ROOT / "runs"
    evaluated = json.loads((runs / "revised-fresh.json").read_bytes())
    current = json.loads((runs / "reader-0.4.19-fresh.json").read_bytes())
    fields = ("id", "status", "text", "units", "paperContext")
    assert len(current["rows"]) == len(evaluated["rows"]) == 48, "Incomplete reader replay"
    for original, replay in zip(evaluated["rows"], current["rows"]):
        for field in fields:
            assert original[field] == replay[field], (original["id"], field)
    for field in ("firstText", "reloadedText", "firstPaperContext"):
        assert current[field] == evaluated[field], field
    assert not current["externalPosts"], "Unexpected external translation request"


if __name__ == "__main__":
    verify_reader_replay()
    audit = runpy.run_path(str(ROOT.parent / "round3/audit.py"))
    audit["main"](ROOT, CORPUS_SHA256, archived_revision=None)
