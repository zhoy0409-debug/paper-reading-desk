"""Freeze eight new papers before inference, using the previous round's sampling method."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import importlib.util
import json
from pathlib import Path

# Alternates are used only for incompatible licenses, unavailable XML, or an
# empty sampling stratum. Never select a paper using a translation or its grade.
PAPERS = [
    ("wearables", [("10.1371/journal.pdig.0000171", "digitalhealth"), ("10.1371/journal.pdig.0000178", "digitalhealth")]),
    ("computational vision", [("10.1371/journal.pcbi.1010648", "ploscompbiol"), ("10.1371/journal.pcbi.1007050", "ploscompbiol")]),
    ("water economics", [("10.1371/journal.pwat.0000452", "water"), ("10.1371/journal.pone.0250979", "plosone")]),
    ("materials", [("10.1371/journal.pone.0342266", "plosone"), ("10.1371/journal.pone.0193520", "plosone")]),
    ("urban climate", [("10.1371/journal.pclm.0000841", "climate"), ("10.1371/journal.pclm.0000396", "climate")]),
    ("education", [("10.1371/journal.pone.0200767", "plosone"), ("10.1371/journal.pone.0090656", "plosone")]),
    ("sensory decisions", [("10.7554/eLife.03005", "PMC4102720")]),
    ("optical imaging", [("10.1364/BOE.545377", "PMC11919357"), ("10.1371/journal.pone.0148183", "plosone")]),
]

def select_papers(repo, cache, output):
    tests = repo / "tests/translation-benchmark"
    spec = importlib.util.spec_from_file_location("previous_sampler", tests / "round2/fresh_sources.py")
    sampler = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sampler)
    sampler.SALT = "reading-desk-independent-journal-passages-round3"
    cache.mkdir(exist_ok=True, parents=True)
    output.mkdir(exist_ok=True, parents=True)
    known = set()
    for old in [tests / "dev-corpus/development.jsonl", tests / "round2/fresh.jsonl"]:
        for line in old.read_text(encoding="utf-8").splitlines():
            r = json.loads(line)
            known.add((r.get("doi") or r["paper"]).casefold())
    for _, choices in PAPERS:
        for doi,_ in choices:
            assert doi.casefold() not in known
            assert not any(doi.casefold() in f.read_text(encoding="utf-8").casefold()
                           for f in (tests / "holdout-corpus").glob("*.jsonl")), doi
    def select(group):
        subject, choices = group
        skips = []
        for doi, journal in choices:
            try:
                credit, rows = sampler.sample((doi, journal), cache)
            except (StopIteration, ValueError, OSError, AttributeError) as exc:
                skips.append({"doi":doi, "reason":type(exc).__name__ + ": " + str(exc)})
                continue
            credit.update(subject=subject, alternativesSkipped=skips)
            return credit, rows
        raise RuntimeError(f"No eligible paper for {subject}: {skips}")
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(select, PAPERS))
    sources = [s for s,rows in results]
    rows = [r for s,items in results for r in items]
    assert len(rows) == len({r["source"] for r in rows}) == 48
    for i, row in enumerate(rows, 1):
        row["id"] = f"J{i:02}"
    corpus = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows).encode()
    (output / "fresh.jsonl").write_bytes(corpus)
    (output / "sources.json").write_bytes((json.dumps(sources, ensure_ascii=False, indent=2) + "\n").encode())
    print(f"Frozen {len(sources)} papers, {len(rows)} passages: {hashlib.sha256(corpus).hexdigest()}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("repository",type=Path)
    ap.add_argument("cache",type=Path)
    ap.add_argument("output",type=Path)
    args=ap.parse_args()
    select_papers(args.repository, args.cache, args.output)
