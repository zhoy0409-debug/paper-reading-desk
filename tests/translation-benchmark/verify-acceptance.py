"""Replay the archived independent review. No network, engine or model account needed."""
from hashlib import sha256
import json
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent
holdout = root / 'holdout-corpus'
review = holdout / 'final-blinded-score'
pairs = root / 'runs' / 'anonymous-pairs-final.jsonl'
frozen = json.loads((holdout / 'freeze.json').read_bytes())
for name, expected in frozen['files'].items():
    assert sha256((holdout / name).read_bytes()).hexdigest() == expected, name
assert sha256((root / 'dev-corpus/development.jsonl').read_bytes()).hexdigest() == '35e47e58014c7f64a7441762d4ce81c10045222ea83a0a7f228479061f274c84'
assert sha256(pairs.read_bytes()).hexdigest() == '23779ab1b34fa1c58e6f3f5432d4329acfa793842a124f89631b88573f3a1edc'

with tempfile.TemporaryDirectory() as target:
    dest = Path(target)
    subprocess.run([sys.executable, holdout / 'score_holdout.py', pairs, '--out', dest,
                    '--reviews', review / 'carried-decisions.jsonl'], check=True)
    subprocess.run([sys.executable, holdout / 'sentence_coverage.py', 'audit', pairs,
                    '--grades', review / 'sentence-grades.tsv', '--dest', dest], check=True)
    for name in ('score-summary.json', 'adjudicated.jsonl', 'sentence-summary.json', 'sentence-audit.jsonl'):
        assert (dest / name).read_bytes() == (review / name).read_bytes(), name
print('PASS frozen sources, bilingual pairs and independent passage and sentence scores')
