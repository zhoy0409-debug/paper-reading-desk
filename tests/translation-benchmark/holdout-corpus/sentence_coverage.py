"""Independent, sentence-level audit with a shared segmentation across variants."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
import unicodedata
from score_holdout import load_lines, write_lines, write_json, ROOT


def compact(s):
    return re.sub(r"\s+"," ",s or "").strip()


def surface(s):
    # A comparison aid for human inspection only. Human judgments remain separate.
    return re.sub(r"\s+","",unicodedata.normalize("NFKC",s or "")).replace("。",".").replace("，",",")


def view(pairs, first, count):
    for r in pairs[first-1:first-1+count]:
        units=r["A"]["units"]
        b=r["B"]["translation"] if r["B"]["displayed"] else ""
        print(r["id"], "B matches all candidates" if b and all(surface(u["rawCandidate"]) in surface(b) for u in units) else
              "B: "+(compact(b) if b else "∅"))
        for u in units:
            print(str(u["id"])+("+" if u["inlineText"] else "−"),compact(u["source"])," // ",compact(u["rawCandidate"]))


def audit(pairs, grading, dest):
    grades={}
    for line in grading.read_text("utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        i,a,b,note=line.split("|",3)
        if i in grades:
            raise ValueError(f"Duplicate grade {i}")
        grades[i]=(a,b,note)
    assert set(grades)=={r["id"] for r in pairs}
    records=[]
    for r in pairs:
        i=r["id"]
        units=r["A"]["units"]
        a,b,note=grades[i]
        if b=="=":
            b=a
        assert len(units)==len(a)==len(b),(i,len(units),a,b)
        for u,aa,bb in zip(units,a,b):
            inline=u.get("inlineText") or ""
            candidate=u.get("rawCandidate") or ""
            assert not inline or inline==candidate, (i,"different default and raw text need separate assessment")
            assert aa in "ynsx" and bb in "ynsx"
            assert bool(candidate)==(aa!="x"),i
            assert bool(r["B"]["displayed"])==(bb!="x"),i
            state = "inline" if inline else "expandable" if candidate else "unavailable"
            records.append({"id":i,"unit":u["id"],"source":u["source"],"AState":state,
                "AInline":inline,"ACandidate":candidate,"AValidationStatus":u["status"],"AValidationIssues":u["issues"],
                "AContentGrade":aa, "AEffectiveByDefault":aa=="y" and state=="inline",
                "AEffectiveAfterExpansion":aa=="y","BContentGrade":bb,"BEffectiveByDefault":bb=="y",
                "BShownPassage":r["B"].get("translation") if r["B"]["displayed"] else None,"auditNote":note})
    write_lines(dest/"sentence-audit.jsonl",records)
    selected=set(json.loads((ROOT/"freeze.json").read_text("utf-8"))["blindReviewIds"])
    summary={}
    for name,rr in [("all",records),("preselected35",[r for r in records if r["id"] in selected]),
                    ("remainder70",[r for r in records if r["id"] not in selected])]:
        byid={}
        for r in rr:
            byid.setdefault(r["id"],[]).append(r)
        hidden=[r for r in rr if r["AState"]=="expandable"]
        summary[name]={"units":len(rr),"passages":len(byid),
              "AInline":sum(r["AState"]=="inline" for r in rr),"AExpandable":len(hidden),
              "AUnavailable":sum(r["AState"]=="unavailable" for r in rr),
              "AEffectiveDefault":sum(r["AEffectiveByDefault"] for r in rr),
              "AEffectiveAfterExpansion":sum(r["AEffectiveAfterExpansion"] for r in rr),
              "BEffectiveDefault":sum(r["BEffectiveByDefault"] for r in rr),
              "BUnavailable":sum(r["BContentGrade"]=="x" for r in rr),
              "AExpandableGrades":dict(Counter(r["AContentGrade"] for r in hidden)),
              "AInlineGrades":dict(Counter(r["AContentGrade"] for r in rr if r["AState"]=="inline")),
              "BGrades":dict(Counter(r["BContentGrade"] for r in rr)),
              "ADefaultPassageStates":dict(Counter("allInline" if all(u["AState"]=="inline" for u in us) else
                  "noneInline" if not any(u["AState"]=="inline" for u in us) else "partiallyInline"
                  for us in byid.values())),
              "AExpandableCorrect":[f"{r['id']}.{r['unit']}" for r in hidden if r["AContentGrade"]=="y"],
              "AExpandableSerious":[f"{r['id']}.{r['unit']}" for r in hidden if r["AContentGrade"]=="s"]}
    write_json(dest/"sentence-summary.json",summary)
    all_rows=summary["all"]
    hidden_grades=all_rows["AExpandableGrades"]
    default_states=all_rows["ADefaultPassageStates"]
    lines=["# 默认阅读区与折叠候选的逐句核查","",
        "两个匿名版本使用同一份最终原文分句。145 个单位对应 105 段原文；B 使用整段返回时，将其内容与同一个原文单位逐个对齐。空白、警示占位、只有原文、关键判断错误均不计入有效句。主要事实、对象、方向及必要定量条件可读计为有效。局部生硬但原句主要事实清楚可以计入，本指标比整段完整可用的要求宽。",
        "", "| 范围 | A 默认有效 | A 展开全部后有效 | B 默认有效 |","| --- | --- | --- | --- |"]
    for k,name in (("all","105 段"),("preselected35","预选 35 段"),("remainder70","其余 70 段")):
        s=summary[k]
        lines.append("| "+" | ".join([name,*[f"{s[m]}/{s['units']}（{s[m]/s['units']:.1%}）" for m in
            ("AEffectiveDefault","AEffectiveAfterExpansion","BEffectiveDefault")]])+" |")
    lines+=["","## 可见性","",
        f"A 默认展示 {all_rows['AInline']} 句（含带提醒的正文），另外 {all_rows['AExpandable']} 句在折叠候选中可取，实际完全无候选 {all_rows['AUnavailable']} 句。{all_rows['passages']} 段中 {default_states.get('allInline',0)} 段默认显示全部原句的中文候选，{default_states.get('partiallyInline',0)} 段显示部分，{default_states.get('noneInline',0)} 段的默认阅读区没有中文候选。B 有 {all_rows['BUnavailable']} 句无可见译文。",
        "",f"在 {all_rows['AExpandable']} 个折叠候选中，{hidden_grades.get('y',0)} 句能补回主要事实，{hidden_grades.get('n',0)} 句仍不合格，{hidden_grades.get('s',0)} 句含改变核心含义的错误。这 {all_rows['AExpandable']} 句的引擎记录均有严重级别警示。警示反映引擎自身判断，是否真的有科学错误另由逐句审读决定。",
        "", "例如 H024.1 展开后可核对三个相关关系、方向和显著性，H077.1 可核对绝经前女性的比值比和置信区间。H039.1 的候选丢失波长变量和一个不等号，H051.2 把七个跨步周期缩为七步。展开增加可用信息，也增加直接接触不正确候选的机会。",
        "",f"A 默认展示的译句中有 {all_rows['AInlineGrades'].get('s',0)} 句严重错误；主动展开全部后另外可见 {hidden_grades.get('s',0)} 句。B 默认结果中有 {all_rows['BGrades'].get('s',0)} 句严重错误。一个选段可有多句，此处严重错句数与整段级严重错误数使用不同分母。",
        "", "sentence-audit.jsonl 留有每项原文、显示状态、候选、警示、A/B 实际结果、独立判断和原因，sentence-summary.json 提供分层统计。该补充评审沿用原始匿名结果，整段盲评分文件保持独立。"]
    (dest/"sentence-review.md").write_bytes(("\n".join(lines)+"\n").encode("utf-8"))
    print({k:{name:v[name] for name in ("units","AEffectiveDefault","AEffectiveAfterExpansion","BEffectiveDefault","AExpandableGrades")} for k,v in summary.items()})


if __name__=="__main__":
    cli=argparse.ArgumentParser()
    cli.add_argument("action",choices=["view","audit"])
    cli.add_argument("input",type=Path)
    cli.add_argument("--first",type=int,default=1)
    cli.add_argument("--count",type=int,default=10)
    cli.add_argument("--grades",type=Path)
    cli.add_argument("--dest",type=Path)
    args=cli.parse_args()
    pairs=load_lines(args.input)
    if args.action=="view":
        view(pairs,args.first,args.count)
    else:
        audit(pairs,args.grades,args.dest)
