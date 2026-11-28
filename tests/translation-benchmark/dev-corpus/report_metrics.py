"""Summarize exact development-set reviews with their denominators."""
import argparse
from collections import defaultdict, Counter
import json
from math import ceil
from pathlib import Path
from retrieve import ROOT

def score(review_path, run_path):
    records={x['id']:x for x in map(json.loads,(ROOT/'development.jsonl').read_text(encoding='utf8').splitlines())}
    review=json.loads(Path(review_path).read_bytes())
    run=json.loads(Path(run_path).read_bytes())
    import hashlib
    assert hashlib.sha256(Path(run_path).read_bytes()).hexdigest()==review['runSha256']
    def summarize(rows):
        sum_category=lambda key: sum(r['review']['severity']==key for r in rows)
        complete=sum(r['review']['completeReadable'] for r in rows)
        has_chinese=sum(r['review']['severity']!='no_translation' for r in rows)
        serious=[r for r in rows if r['review']['severity']=='serious']
        def totals(key):
            return (sum(sum(x['review'][key]) for x in rows),sum(len(x['review'][key]) for x in rows))
        incomplete_review=Counter(x['validation'].get('status') for x in serious)
        return dict(n=len(rows),completeAndReadable=[complete,len(rows)],visibleChinese=[has_chinese,len(rows)],semanticallyUsefulSourceUnits=[sum(x['review']['coveredUnits'] for x in rows),sum(x['units'] for x in rows)],factsRetained=totals('facts'),termsAccurate=totals('terms'),seriousDisplayedErrors=[len(serious),has_chinese],seriousFullyAcceptedIds=[x['id'] for x in serious if x['validation'].get('status')=='translated'],seriousByDisplayedStatus=dict(incomplete_review),readableButReviewOrPartialIds=[x['id'] for x in rows if x['review']['completeReadable'] and x['validation'].get('status') in ('review','partial')])
    sections=defaultdict(list)
    fields=defaultdict(list)
    for row in review['rows']:
        sample=records[row['id']]
        sections[sample['section']].append(row)
        fields[sample['field']].append(row)
    timings=sorted(r['ms'] for r in run['rows'] if r.get('ms') is not None)
    return dict(runSha256=review['runSha256'],overall=summarize(review['rows']),byField={k:summarize(v) for k,v in fields.items()},bySection={k:summarize(v) for k,v in sections.items()},timings=dict(n=len(timings),allAttemptsNearestRankP50Ms=timings[ceil(0.5*len(timings))-1],allAttemptsNearestRankP95Ms=timings[ceil(0.95*len(timings))-1]))
if __name__=='__main__':
    args=argparse.ArgumentParser()
    args.add_argument('review')
    args.add_argument('browser_run')
    args.add_argument('output')
    a=args.parse_args()
    result=score(a.review,a.browser_run)
    Path(a.output).write_bytes((json.dumps(result,ensure_ascii=False,indent=2)+'\n').encode('utf8'))
    print(result['overall'])
