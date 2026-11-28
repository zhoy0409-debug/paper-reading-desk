"""Checks of denominator/label handling; these fixtures are not model results."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from score_holdout import ROOT, anchor_present, assign_slots, comparison_text, index_unique, load_lines, quantiles, run, write_lines


class IndependentScoring(unittest.TestCase):
    def test_frozen_references_and_unchanged_sources(self):
        with TemporaryDirectory(dir=ROOT) as d:
            dest=Path(d)
            cases=[]
            for r in load_lines(ROOT/"holdout.jsonl"):
                cases.append({"id":r["id"],
                    "A":{"displayed":True,"translation":r["reference"],"status":"reference-control"},
                    "B":{"displayed":True,"translation":r["source"],"status":"source-control"}})
            write_lines(dest/"cases.jsonl",cases)
            run(dest/"cases.jsonl",dest)
            summary=json.loads((dest/"score-summary.json").read_text("utf-8"))
            for metric,total in (("displayedChinese",105),("literalFactAnchorMatches",260),
                                 ("literalTermAnchorMatches",177),("allAnchorsInOneDisplayedResponse",105)):
                with self.subTest(metric=metric):
                    self.assertEqual(summary["A"]["all"][metric]["numerator"],total)
                    self.assertEqual(summary["B"]["all"][metric]["numerator"],0)

    def test_numeric_units_and_boundaries(self):
        for expected,actual,matched in [
            ("0.61","结果为 0.61",True),("0.61","结果为 −0.61",False),
            ("0.61","结果为 0.611",False),("5","25",False),("0.6","10.6",False),
            ("21,236","21236",True),("−0.1","-0.1",True),("0.38–0.96","0.38-0.96",True),
            ("1 Hz","1 hz",False),("50 mg","50 Mg",False),("≥9","<9",False),
            ("DNA","cDNA",False),("5,000","5,000",True)]:
            with self.subTest(expected=expected,actual=actual):
                self.assertEqual(anchor_present(expected,comparison_text(actual)),matched)

    def test_duplicates_and_quantiles(self):
        self.assertEqual(quantiles([3,5,7,9]),{"n":4,"p50":5,"p95":9})
        self.assertEqual(quantiles([]),{"n":0,"p50":None,"p95":None})
        with self.assertRaises(ValueError):
            index_unique([{"id":"H001"},{"id":"H001"}],{"H001"},require_all=False)

    def test_missing_source_fallback_and_false_rejection(self):
        with TemporaryDirectory(dir=ROOT) as d:
            dest=Path(d)
            source=load_lines(ROOT/"holdout.jsonl")[0]
            ok=dict(displayed=True,translation=source["reference"],rawCandidate=source["reference"],
                    accepted=True,flagged=False,status="success",latencyMs=20,retries=0,extraActions=0)
            refused=dict(displayed=False,translation=source["source"],rawCandidate=source["reference"],
                         accepted=False,flagged=True,status="rejected")
            write_lines(dest/"results.jsonl",[dict(id=source["id"],A=ok,B=refused)])
            run(dest/"results.jsonl",dest/"score")
            form=load_lines(dest/"score"/"blind-form.jsonl")[0]
            reviews={"id":source["id"]}
            for slot,system in assign_slots(source["id"]).items():
                self.assertNotIn("accepted",form[slot])
                self.assertNotIn("flagged",form[slot])
                self.assertNotIn("status",form[slot])
                success=system=="A"
                reviews[slot]={"completeReadable":success,"effective":success,"seriousError":False,
                    "rawAcceptable":True,"factsCorrect":[success]*len(source["facts"]),
                    "termsCorrect":[success]*len(source["terms"]),"note":"" if success else "No translated result."}
            write_lines(dest/"decisions.jsonl",[reviews])
            run(dest/"results.jsonl",dest/"score",dest/"decisions.jsonl")
            sr=json.loads((dest/"score"/"score-summary.json").read_text("utf-8"))
            self.assertEqual(sr["A"]["all"]["displayedChinese"]["denominator"],105)
            self.assertEqual(sr["A"]["all"]["literalFactAnchorMatches"]["denominator"],260)
            self.assertEqual(sr["A"]["all"]["literalTermAnchorMatches"]["denominator"],177)
            self.assertEqual(sr["A"]["all"]["semanticReview"]["factsPreserved"]["rate"],1)
            self.assertEqual(sr["B"]["all"]["semanticReview"]["rejectedCorrectRaw"]["rate"],1)
            self.assertEqual(sr["B"]["all"]["semanticReview"]["factsPreserved"]["rate"],0)
            self.assertEqual(sr["B"]["all"]["displayedChinese"]["numerator"],0)
            self.assertEqual(sr["B"]["all"]["statuses"]["missing"],104)
            self.assertEqual(sr["A"]["all"]["durationMs"]["n"],1)


if __name__=="__main__":
    unittest.main()
