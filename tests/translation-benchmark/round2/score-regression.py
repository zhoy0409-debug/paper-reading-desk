"""Count default-view coverage on the older corpus, carrying over only identical sentence pairs."""
import argparse
from collections import Counter
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BENCH = ROOT.parent


def score():
    earlier = json.loads((BENCH/"runs/candidate-recovery-heldout.json").read_bytes())["rows"]
    current = json.loads((ROOT/"runs/regression-final.json").read_bytes())["rows"]
    originals = {}
    for line in (BENCH/"holdout-corpus/final-blinded-score/sentence-grades.tsv").read_text(encoding="utf8").splitlines():
        paper, grades, _, _ = line.split("|", 3)
        originals[paper] = grades
    changed = {}
    for line in (ROOT/"regression-changed.tsv").read_text(encoding="utf8").splitlines():
        unit, grade, reason = line.split("\t")
        assert unit not in changed and reason and grade in {"y","n","s","x"}
        changed[unit] = grade
    assert [r["id"] for r in current] == [r["id"] for r in earlier] == list(originals)
    counts = Counter()
    reviewed = set()
    for prev, now in zip(earlier, current):
        paper = now["id"]
        assert len(prev["units"]) == len(now["units"]) == len(originals[paper])
        unmarked = False
        for idx, (a,b) in enumerate(zip(prev["units"],now["units"])):
            assert a["source"] == b["source"], paper
            uid = f"{paper}.{idx+1}"
            if a["text"] == b["text"]:
                grade = originals[paper][idx]
            else:
                grade = changed[uid]
                reviewed.add(uid)
            assert bool(b["text"]) == (grade != "x"), uid
            issues = b["validation"]["issues"]
            shown = bool(b["text"]) and not any(e["severity"] == "severe" for e in issues)
            counts["sentences"] += 1
            counts["usefulByDefault"] += int(shown and grade == "y")
            counts["usefulHidden"] += int(not shown and grade == "y")
            counts["usefulIfExpanded"] += int(grade == "y")
            counts["visibleSevereSentences"] += int(shown and grade == "s")
            unmarked |= shown and grade == "s" and not issues and b["status"] == "translated"
        counts["passages"] += 1
        counts["unmarkedSeverePassages"] += int(unmarked)
    assert reviewed == set(changed)
    return dict(counts, newlyGradedSentences=len(changed))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    summary = score()
    result = ROOT/"regression-summary.json"
    if args.write:
        result.write_bytes((json.dumps(summary,indent=2)+"\n").encode())
    else:
        assert summary == json.loads(result.read_bytes())
    print(summary)
