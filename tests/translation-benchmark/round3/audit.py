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


def main(root=ROOT, corpus_sha=sha, archived_revision="7caf4e87a263b27eab95b95f8beacf784e42c530"):
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("action", choices=["prepare", "score", "verify", "release"])
    cli.add_argument("output", type=Path)
    if archived_revision:
        cli.add_argument("--historical", action="store_true", help="Verify the original evaluated revision.")
    args = cli.parse_args()
    historical = getattr(args, "historical", False)
    if historical and args.action != "verify":
        cli.error("Only an archived verification may use the historical revision.")
    dest = args.output.resolve()
    if args.action in ("verify", "release") and dest == root:
        cli.error("Verify in a separate directory to retain the frozen evidence.")
    if args.action == "prepare":
        audit.prepare(root / "runs", dest, root)
        return
    if args.action in ("verify", "release"):
        audit.verify_assets(root, archived_revision if historical else None)
        audit.prepare(root / "runs", dest, root)
        for name in ("observations.jsonl", "anonymous.jsonl"):
            assert (root / name).read_bytes() == (dest / name).read_bytes(), name
    results = audit.score(root, dest, corpus_sha=corpus_sha, passages=48, papers=8)
    if args.action in ("verify", "release"):
        for name in ("summary.json", "failures.jsonl"):
            assert (root / name).read_bytes() == (dest / name).read_bytes(), name
    print(json.dumps(results, ensure_ascii=False, indent=2))
    if args.action == "release" and not results["passesScientificGate"]:
        raise SystemExit("Independent scientific translation acceptance criteria have not been met.")


if __name__ == "__main__":
    main()
