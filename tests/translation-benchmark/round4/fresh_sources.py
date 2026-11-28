"""Select new paper passages without using predictions, scores, or model prompts."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("paper_sampler",ROOT.parent/"round2/fresh_sources.py")
sampler=importlib.util.module_from_spec(spec)
spec.loader.exec_module(sampler)
sampler.SALT="independent-scientific-paper-selection-round4"

def plos(*numbers):
    return [("10.1371/journal.pone."+n,"plosone") for n in numbers]

GROUPS=[
    ("position measurement",plos("0215562")),
    ("biomechanics",plos("0203839","0300108")),
    ("reading comprehension",plos("0198791","0215902","0276546")),
    ("streamflow",plos("0203872","0242682","0248489")),
    ("tree-ring ecology",plos("0210438","0219770","0234421")),
    ("optical imaging",[("10.1364/BOE.9.003122","PMC6033572"),*plos("0148183")]),
    ("water treatment",[("10.3390/molecules23102473","PMC6222675"),*plos("0196428","0191229")]),
    ("visual attention",plos("0190165","0189855","0193311")),
]

def main(cache,out):
    cache.mkdir(parents=True,exist_ok=True)
    out.mkdir(parents=True,exist_ok=True)
    old="\n".join(p.read_text(encoding="utf8").lower() for n in ("dev-corpus","holdout-corpus","round2","round3")
                  for p in (ROOT.parent/n).glob("*.jsonl"))
    def take(group):
        name,candidates=group
        skipped=[]
        for doi,journal in candidates:
            if doi.lower() in old:
                skipped.append([doi,"Previously sampled"])
                continue
            try:
                paper,passages=sampler.sample((doi,journal),cache)
            except (OSError,ValueError,AttributeError,StopIteration) as exc:
                skipped.append([doi,type(exc).__name__+" "+str(exc)])
                continue
            return dict(paper,subject=name,alternativesSkipped=skipped),passages
        raise ValueError(f"No eligible source for {name}: {skipped}")
    with ThreadPoolExecutor(4) as pool:
        selected=list(pool.map(take,GROUPS))
    rows=[r for _,items in selected for r in items]
    assert len(rows)==len({r["source"] for r in rows})==48
    for i,row in enumerate(rows,1):
        row["id"]=f"K{i:02}"
    payload="".join(json.dumps(r,ensure_ascii=False)+"\n" for r in rows).encode()
    (out/"fresh.jsonl").write_bytes(payload)
    (out/"sources.json").write_bytes((json.dumps([d for d,_ in selected],indent=2,ensure_ascii=False)+"\n").encode())
    print(len(rows),"selections from",len(selected),"papers",sha256(payload).hexdigest())

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache",type=Path)
    parser.add_argument("out",type=Path)
    args=parser.parse_args()
    main(args.cache,args.out)
