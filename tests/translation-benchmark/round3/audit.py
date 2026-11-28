"""Prepare masked bilingual pairs and reproduce the independent eight-paper acceptance test."""
import argparse
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sha = "c6ea0fca623a92d5d1d82206adff05fb2a8999e19fe2457d93c89496358aca2a"
spec = importlib.util.spec_from_file_location("reading_desk_benchmark", ROOT.parent / "round2/audit.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("action", choices=["prepare", "score", "verify", "release"])
    cli.add_argument("output", type=Path)
    args = cli.parse_args()
    dest = args.output.resolve()
    if args.action in ("verify", "release") and dest == ROOT:
        cli.error("Verify in a separate directory to retain the frozen evidence.")
    if args.action == "prepare":
        audit.prepare(ROOT / "runs", dest, ROOT)
        return
    if args.action in ("verify", "release"):
        audit.verify_assets(ROOT)
        audit.prepare(ROOT / "runs", dest, ROOT)
        for name in ("observations.jsonl", "anonymous.jsonl"):
            assert (ROOT / name).read_bytes() == (dest / name).read_bytes(), name
    results = audit.score(ROOT, dest, corpus_sha=sha, passages=48, papers=8)
    if args.action in ("verify", "release"):
        for name in ("summary.json", "failures.jsonl"):
            assert (ROOT / name).read_bytes() == (dest / name).read_bytes(), name
    print(json.dumps(results, ensure_ascii=False, indent=2))
    if args.action == "release" and not results["passesScientificGate"]:
        raise SystemExit("Independent scientific translation acceptance criteria have not been met.")


if __name__ == "__main__":
    main()
