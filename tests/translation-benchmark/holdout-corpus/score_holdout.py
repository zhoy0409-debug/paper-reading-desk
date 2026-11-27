"""Independent, deterministic surface screening of a *frozen* bilingual corpus.

    python score_holdout.py anonymous.jsonl --out scores
    python score_holdout.py anonymous.jsonl --out scores --reviews decisions.jsonl

See scoring-protocol.md for the assessment unit, denominators, and blind decisions.
No code or lexicon from the translation product is imported.
"""
import argparse
from collections import Counter
from hashlib import sha256
import json
import math
from pathlib import Path
import re
import unicodedata

ROOT = Path(__file__).resolve().parent
SYSTEMS = ("A", "B")
HOLDOUT_SHA = "c4520d34824cdfd9507b92599c139a67bcef297c579d4ae3b43e9254115297d2"


def load_lines(path):
    return [json.loads(line) for line in Path(path).read_text(encoding="utf-8-sig").splitlines() if line.strip()]


def write_lines(path, values):
    path.write_bytes("".join(json.dumps(v,ensure_ascii=False,separators=(",",":"))+"\n" for v in values).encode("utf-8"))


def write_json(path, value):
    path.write_bytes((json.dumps(value,ensure_ascii=False,indent=2)+"\n").encode("utf-8"))


def comparison_text(text):
    """Preserve digit identities, case-sensitive units, polarity and inequality."""
    value = unicodedata.normalize("NFKC", text).replace("\u00ad","")
    value = value.translate(str.maketrans({"−":"-", "–":"-", "﹣":"-", "／":"/", "′":"'"}))
    value = re.sub(r"(?<=\d),(?=\d{3}(?!\d))","",value)
    return re.sub(r"\s+","",value)


def anchor_present(choice, normalized):
    """A literal signal. Full semantic adjudication is performed separately."""
    needle = comparison_text(choice)
    if not needle:
        return False
    left = ""
    right = ""
    if needle[0].isdigit():
        left = r"(?<![0-9.+\-])"
    elif needle[0].isascii() and needle[0].isalpha():
        left = r"(?<![A-Za-z])"
    if needle[-1].isdigit():
        right = r"(?![0-9]|\.\d)"
    elif needle[-1].isascii() and needle[-1].isalpha():
        right = r"(?![A-Za-z])"
    return bool(re.search(left+re.escape(needle)+right,normalized))


def has_chinese(text):
    return bool(re.search(r"[\u3400-\u9fff]",text))


def get_signals(items, output):
    normalized = comparison_text(output)
    return [next((choice for choice in [item["zh"],*item.get("alternatives",[])]
                  if anchor_present(choice,normalized)),None) for item in items]


def numeric(value, key):
    if value is None:
        return None
    if type(value) not in (int,float) or not math.isfinite(value) or value < 0:
        raise ValueError(f"{key}: expected a finite nonnegative number or null")
    if key != "latencyMs" and int(value)!=value:
        raise ValueError(f"{key}: expected an integer")
    return value


def read_system(row, ident):
    if row is None:
        return dict(status="missing",displayed=False,accepted=None,translation="",rawCandidate=None,
                    flagged=None,latencyMs=None,retries=None,extraActions=None,cacheState=None)
    if not isinstance(row,dict):
        raise ValueError(f"{ident}: expected system object or null")
    for name in ("translation","rawCandidate"):
        if row.get(name) is not None and not isinstance(row[name],str):
            raise ValueError(f"{ident}: expected string or null for {name}")
    for name in ("displayed","accepted","flagged"):
        if row.get(name) is not None and not isinstance(row[name],bool):
            raise ValueError(f"{ident}: expected boolean or null for {name}")
    if row.get("displayed") is None:
        raise ValueError(f"{ident}: displayed must explicitly record whether the reader saw a translation")
    return dict(status=row.get("status","unknown"),displayed=row["displayed"],accepted=row.get("accepted"),
                translation=row.get("translation") or "",rawCandidate=row.get("rawCandidate"),
                flagged=row.get("flagged"),cacheState=row.get("cacheState"),
                **{k:numeric(row.get(k),k) for k in ("latencyMs","retries","extraActions")})


def index_unique(rows, ids, *, require_all):
    indexed = {}
    for row in rows:
        i=row["id"]
        if i not in ids or i in indexed:
            raise ValueError(f"Unrecognized or duplicate ID: {i}")
        indexed[i]=row
    if require_all and set(indexed)!=set(ids):
        raise ValueError(f"Missing required IDs: {sorted(set(ids)-set(indexed))}")
    return indexed


def rate(n,d):
    return {"numerator":n,"denominator":d,"rate":round(n/d,6) if d else None}


def quantiles(samples):
    ordered=sorted(samples)
    def q(p):
        return ordered[math.ceil(p*len(ordered))-1] if ordered else None
    return {"n":len(ordered),"p50":q(.5),"p95":q(.95)}


def add_review_stats(summary, subset, decisions):
    reviewed=[row for row in subset if row["id"] in decisions]
    grades=[(r,decisions[r["id"]][r["system"]]) for r in reviewed]
    source_name=f"{len(reviewed)} reviewed / {len(subset)} assigned"
    facts=[v for _,g in grades for v in g["factsCorrect"]]
    terms=[v for _,g in grades for v in g["termsCorrect"]]
    serious=[(r,g) for r,g in grades if g["seriousError"]]
    eligible=[(r,g) for r,g in grades if r["accepted"] is not None and g["rawAcceptable"] is not None]
    correct=[r for r,g in eligible if g["rawAcceptable"]]
    bad=[r for r,g in eligible if not g["rawAcceptable"]]
    summary["semanticReview"]={
        "sample":source_name,
        "completeReadable":rate(sum(g["completeReadable"] for _,g in grades),len(grades)),
        "effectivePassages":rate(sum(g["effective"] for _,g in grades),len(grades)),
        "factsPreserved":rate(sum(x is True for x in facts),len(facts)),
        "termsCorrect":rate(sum(x is True for x in terms),len(terms)),
        "seriousDisplayedErrors":rate(len(serious),len(grades)),
        "seriousUnflagged": [r["id"] for r,_ in serious if r["flagged"] is False],
        "seriousFlagStatusUnknown":[r["id"] for r,_ in serious if r["flagged"] is None],
        "rejectedCorrectRaw":rate(sum(not r["accepted"] for r in correct),len(correct)),
        "acceptedIncorrectRaw":rate(sum(r["accepted"] for r in bad),len(bad)),
        "validationDecisionsUnassessable":len(grades)-len(eligible)}


def summarize(subset, decisions=None):
    n=len(subset)
    fact_den=sum(len(r["factSignals"]) for r in subset)
    term_den=sum(len(r["termSignals"]) for r in subset)
    answer={
        "n":n,"statuses":dict(Counter(r["status"] for r in subset)),
        "displayedChinese":rate(sum(r["hasChineseTranslation"] for r in subset),n),
        "literalFactAnchorMatches":rate(sum(sum(x is not None for x in r["factSignals"])
                                        for r in subset),fact_den),
        "literalTermAnchorMatches":rate(sum(sum(x is not None for x in r["termSignals"])
                                        for r in subset),term_den),
        "allAnchorsInOneDisplayedResponse":rate(sum(r["hasChineseTranslation"] and all(r["factSignals"]) and all(r["termSignals"]) for r in subset),n),
        "rawCandidateCaptured":rate(sum(r["rawAvailable"] for r in subset),n),
        "durationMs":quantiles([r["latencyMs"] for r in subset if r["latencyMs"] is not None]),
        "durationByCacheState":{str(state):quantiles([r["latencyMs"] for r in subset if r["latencyMs"] is not None and r["cacheState"]==state]) for state in sorted({r["cacheState"] for r in subset if r["cacheState"] is not None})}}
    for metric in ("retries","extraActions"):
        samples=[r[metric] for r in subset if r[metric] is not None]
        answer[metric]={"observed":len(samples),"total":sum(samples) if samples else None,"p50":quantiles(samples)["p50"],"p95":quantiles(samples)["p95"]}
    if decisions is not None:
        add_review_stats(answer,subset,decisions)
    return answer


def assign_slots(item_id):
    v=int(sha256(("ReadingDesk-holdout-order-v1/"+item_id).encode()).hexdigest()[:2],16)
    return {"U":"A","V":"B"} if v%2 else {"U":"B","V":"A"}


def check_grade(value, row, src):
    for key in ("completeReadable","effective","seriousError"):
        if type(value.get(key)) is not bool:
            raise ValueError(f"{row['id']}: missing blind review outcome {key}")
    raw=value.get("rawAcceptable")
    if not (raw is None or type(raw) is bool):
        raise ValueError("rawAcceptable must be true, false or null")
    if not row["rawAvailable"] and raw is not None:
        raise ValueError("A raw candidate has not been captured")
    if value["effective"] and (not value["completeReadable"] or value["seriousError"]):
        raise ValueError("Effective coverage requires a complete, usable rendering")
    if not row["hasChineseTranslation"] and (value["effective"] or value["completeReadable"] or value["seriousError"]):
        raise ValueError("A source-only/empty result has no displayed translation")
    for name,kind in (("factsCorrect","facts"),("termsCorrect","terms")):
        marks=value.get(name)
        if not isinstance(marks,list) or len(marks)!=len(src[kind]) or any(type(v) is not bool for v in marks):
            raise ValueError(f"{row['id']}: invalid {name} array")
        if not row["hasChineseTranslation"] and any(marks):
            raise ValueError("Fallback cannot contribute fulfilled facts or terms")
    if not value["effective"] and not value.get("note"):
        raise ValueError("An unavailable/incomplete/incorrect rendering needs a reason")
    return {**value,"rawAcceptable":raw}


def run(inp,out,reviews=None):
    corpus=ROOT/"holdout.jsonl"
    if sha256(corpus.read_bytes()).hexdigest()!=HOLDOUT_SHA:
        raise ValueError("Frozen source corpus hash mismatch")
    frozen=json.loads((ROOT/"freeze.json").read_text("utf-8"))
    preselected=set(frozen["blindReviewIds"])
    sources=load_lines(corpus)
    ids={r["id"] for r in sources}
    results=index_unique(load_lines(inp),ids,require_all=False)
    verdicts=index_unique(load_lines(reviews),ids,require_all=False) if reviews else {}
    raw_rows=[]
    forms=[]
    decisions={}
    for source in sources:
        i=source["id"]
        pair=results.get(i,{})
        source_norm=comparison_text(source["source"])
        form={k:source[k] for k in ("id","source","reference","facts","terms","section","field")}
        form["preselected"]=i in preselected
        ordering=assign_slots(i)
        for slot,system in ordering.items():
            r=read_system(pair.get(system),i)
            shown=r["translation"] if r["displayed"] else ""
            has_result=bool(has_chinese(shown) and comparison_text(shown)!=source_norm)
            raw=r["rawCandidate"]
            raw_available=raw is not None and bool(raw.strip())
            row={"id":i,"system":system,"section":source["section"],"field":source["field"],
                 "difficulty":source["difficulty"],"tags":source["tags"],"preselected":i in preselected,
                 **{k:r[k] for k in ("status","displayed","accepted","flagged","latencyMs","cacheState","retries","extraActions")},
                 "hasChineseTranslation":has_result,"rawAvailable":raw_available,
                 "factSignals":get_signals(source["facts"],shown if has_result else ""),
                 "termSignals":get_signals(source["terms"],shown if has_result else "")}
            raw_rows.append(row)
            form[slot]={"shown":shown, "candidate":raw if raw_available else None,
                        "decision":{"completeReadable":None,"effective":None,"seriousError":None,
                           "rawAcceptable":None,"factsCorrect":[None]*len(source["facts"]),
                           "termsCorrect":[None]*len(source["terms"]), "note":""}}
            if i in verdicts:
                decisions.setdefault(i,{})[system]=check_grade(verdicts[i][slot],row,source)
        forms.append(form)
    out=Path(out)
    out.mkdir(parents=True,exist_ok=True)
    write_lines(out/"anchor-screen.jsonl",raw_rows)
    write_lines(out/"blind-form.jsonl",forms)
    aggregate={}
    for system in SYSTEMS:
        rr=[r for r in raw_rows if r["system"]==system]
        d=decisions if reviews else None
        aggregate[system]={"all":summarize(rr,d),"preselected35":summarize([r for r in rr if r["preselected"]],d),
                           "remainder70":summarize([r for r in rr if not r["preselected"]],d)}
        for prop in ("field","section","difficulty"):
            aggregate[system][prop]={k:summarize([r for r in rr if r[prop]==k],d) for k in sorted({r[prop] for r in rr})}
    write_json(out/"score-summary.json",aggregate)
    if reviews:
        write_lines(out/"adjudicated.jsonl",[{"id":i,**d} for i,d in sorted(decisions.items())])
    print(f"{len(sources)} assigned, {len(results)} pairs supplied, {len(decisions)} pairs reviewed")


if __name__=="__main__":
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument("input",type=Path)
    cli.add_argument("--out",type=Path,required=True)
    cli.add_argument("--reviews",type=Path)
    args=cli.parse_args()
    run(args.input,args.out,args.reviews)
