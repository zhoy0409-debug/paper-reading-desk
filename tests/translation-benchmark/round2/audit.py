"""Prepare anonymous reading pairs, or replay the scored fresh-paper comparison."""
import argparse
from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path
import statistics
import subprocess

ROOT = Path(__file__).resolve().parent
VERSIONS = ("release", "previous", "revised")
CORPUS_SHA256 = "a5c18cd25a97c0bbca3c2630203dc8228b546247f01f6aeb31e5ede6e1c2cc8a"
HISTORICAL_REVISION = "cefc94eddbbae35bc34af9521d96dd4fbc84f380"


def read_lines(path):
    return [json.loads(line) for line in path.read_text(encoding="utf8").splitlines()]


def write_json(path, obj):
    path.write_bytes((json.dumps(obj, ensure_ascii=False, indent=2) + "\n").encode())


def write_lines(path, rows):
    path.write_bytes("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows).encode())


def prepare(raw, dest, corpus=ROOT):
    dest.mkdir(exist_ok=True, parents=True)
    sources = read_lines(corpus / "fresh.jsonl")
    observed, blind = [], {}
    runs = {}
    for name, file in zip(VERSIONS, ("stable-fresh.json", "previous-fresh.json", "revised-fresh.json")):
        run = json.loads((raw / file).read_bytes())
        assert not run.get("error") and [r["id"] for r in run["rows"]] == [s["id"] for s in sources]
        runs[name] = run["rows"]
    for i, source in enumerate(sources):
        parts = [u["source"] for u in runs["revised"][i]["units"]]
        item = {"id": source["id"], "parts": parts, "runs": {}}
        for version in VERSIONS:
            row = runs[version][i]
            units = row.get("units")
            if units is not None:
                assert parts == [u["source"] for u in units]
                shown = [bool(u.get("text")) and not any(v["severity"] == "severe" for v in u["validation"]["issues"]) for u in units]
                warned = [u["status"] in ("review", "failed") or bool(u["validation"]["issues"]) for u in units]
                content = " ".join(u.get("text", "") for u in units).strip()
            else:
                content = row.get("text", "")
                shown = [bool(content)] * len(parts)
                warned = [not bool(content)] * len(parts)
            key = sha256((source["id"] + "\n" + content).encode()).hexdigest()[:12]
            blind[key] = {"key": key, "id": source["id"], "originalSentences":parts, "candidate":content}
            item["runs"][version] = dict(key=key, shown=shown, warned=warned, ms=row["ms"], status=row["status"],
                                         details=[u["validation"]["issues"] for u in units] if units else [],
                                         error=row.get("error"))
        observed.append(item)
    write_lines(dest / "anonymous.jsonl", [blind[k] for k in sorted(blind)])
    write_lines(dest / "observations.jsonl", observed)
    print("Prepared", len(blind), "anonymous passages from", len(sources), "selections")


def score(root, dest, corpus_sha=CORPUS_SHA256, passages=36, papers=6):
    assert sha256((root / "fresh.jsonl").read_bytes()).hexdigest() == corpus_sha, "Fresh corpus has changed"
    blind = {r["key"]: r for r in read_lines(root / "anonymous.jsonl")}
    observed = read_lines(root / "observations.jsonl")
    sources = read_lines(root / "fresh.jsonl")
    assert len(sources) == passages and len({s["doi"] for s in sources}) == papers
    assert [r["id"] for r in observed] == [s["id"] for s in sources]
    for source, row in zip(sources, observed):
        assert " ".join(source["source"].split()) == " ".join(" ".join(row["parts"]).split()), row["id"]
    grades = {}
    for line in (root / "semantic.tsv").read_text(encoding="utf8").splitlines():
        key, grade, reasoning = line.split("\t", 2)
        assert key not in grades and reasoning and set(grade) <= set("ymsx")
        assert len(grade) == len(blind[key]["originalSentences"])
        assert bool(blind[key]["candidate"]) == bool(set(grade) - {"x"})
        grades[key] = (grade, reasoning)
    assert set(grades) == set(blind)
    summary, failures = {}, []
    for version in VERSIONS:
        counts = Counter()
        elapsed = []
        for r in observed:
            result = r["runs"][version]
            key = result["key"]
            entry = blind[key]
            assert entry["id"] == r["id"] and r["parts"] == entry["originalSentences"]
            assert sha256((r["id"] + "\n" + entry["candidate"]).encode()).hexdigest()[:12] == key
            g, reason = grades[key]
            shown, warned = result["shown"], result["warned"]
            assert len(shown) == len(warned) == len(g)
            severe_visible = any(v == "s" and d for v, d in zip(g, shown))
            unmarked = any(v == "s" and d and not w for v, d, w in zip(g, shown, warned))
            counts.update(passages=1, sentences=len(g), fullyUseful=int(set(g) == {"y"} and all(shown)),
                          visibleSeverePassages=int(severe_visible), unmarkedSeverePassages=int(unmarked))
            for status, displayed in zip(g, shown):
                counts["usefulByDefault"] += int(status == "y" and displayed)
                counts["usefulHidden"] += int(status == "y" and not displayed)
                counts["usefulIfExpanded"] += int(status == "y")
                counts["missing"] += int(status == "x")
            if set(g) != {"y"} or not all(shown):
                failures.append({"id":r["id"],"version":version,"key":key,"grades":g,
                                 "visible":shown,"warnings":warned,"reason":reason})
            elapsed.append(result["ms"])
        counts["medianMs"] = statistics.median(elapsed)
        counts["p95Ms"] = sorted(elapsed)[math.ceil(.95 * len(elapsed)) - 1]
        summary[version] = dict(sorted(counts.items()))
    new = summary["revised"]
    summary["passesScientificGate"] = new["usefulByDefault"] / new["sentences"] >= .98 and new["unmarkedSeverePassages"] == 0
    dest.mkdir(exist_ok=True, parents=True)
    write_json(dest / "summary.json", summary)
    write_lines(dest / "failures.jsonl", failures)
    return summary


def verify_assets(root, revision=None):
    dist = ROOT.parents[2] / "dist"
    for name, expected in json.loads((root / "engine-freeze.json").read_bytes()).items():
        content = (subprocess.check_output(["git", "show", f"{revision}:dist/{name}"], cwd=dist.parent)
                   if revision else (dist / name).read_bytes())
        if not name.startswith("vendor/"):
            content = content.replace(b"\r\n", b"\n")
        if sha256(content).hexdigest() != expected:
            raise SystemExit(f"Translation code or a model differs from the evaluated version: {name}")


def verify_runs(root, dest):
    prepare(root/"runs", dest, root)
    for name in ("anonymous.jsonl", "observations.jsonl"):
        assert (root/name).read_bytes() == (dest/name).read_bytes(), name
    def outputs(filename):
        rows = json.loads((root/"runs"/filename).read_bytes())["rows"]
        return [(r["id"], r["status"], r["text"], r["units"]) for r in rows]
    assert outputs("final-input-fresh.json") == outputs("revised-fresh.json"), "PDF-only follow-up changed frozen outputs"


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("action", choices=["prepare","score","verify","release"])
    cli.add_argument("input", type=Path)
    cli.add_argument("output", type=Path)
    cli.add_argument("--historical", action="store_true", help="Replay the archived round against its original commit.")
    args = cli.parse_args()
    if args.historical and args.action != "verify":
        cli.error("Only an archival verification may use the historical commit.")
    if args.action == "prepare":
        prepare(args.input,args.output)
    else:
        if args.action in {"verify","release"}:
            if args.input.resolve() == args.output.resolve():
                cli.error("Replay into a separate directory to preserve the evidence.")
            verify_runs(args.input, args.output)
            verify_assets(args.input, HISTORICAL_REVISION if args.historical else None)
        results = score(args.input,args.output)
        if args.action in {"verify","release"}:
            for name in ["summary.json","failures.jsonl"]:
                assert (args.output/name).read_bytes() == (args.input/name).read_bytes(), name
        print(json.dumps(results, indent=2))
        if args.action == "release" and not results["passesScientificGate"]:
            raise SystemExit("Scientific translation release criteria have not been met.")
