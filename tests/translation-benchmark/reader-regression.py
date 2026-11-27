"""Run the upload regressions with supplied original PDFs and inspect the exported slides."""
import argparse
import json
from pathlib import Path
import re
import subprocess
from tempfile import TemporaryDirectory
from xml.etree import ElementTree as ET
from zipfile import ZipFile

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
for name in ('url', 'neuron', 'review', 'abaucin', 'output'):
    parser.add_argument(name)
args = parser.parse_args()
results = {}

def run(script, *files):
    proc = subprocess.run(['node', 'tests/' + script, args.url, *files], cwd=root,
                          check=True, capture_output=True, encoding='utf-8')
    results[script] = {'exitCode': proc.returncode, 'observations': proc.stdout.strip().splitlines()}

run('paper-map-browser.cjs', args.neuron, args.review)
run('figure-explanation-entry-browser.cjs')
run('subject-glossary-browser.cjs')
run('obsidian-browser.cjs')
with TemporaryDirectory() as temp:
    run('slide-basket-browser.cjs', args.abaucin, temp)
    file, = Path(temp).glob('*.pptx')
    ns = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
          'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
    with ZipFile(file) as ppt:
        slides = sorted(p for p in ppt.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml', p))
        figure_ids, images, notes = [], 0, []
        for p in slides:
            xml = ET.fromstring(ppt.read(p))
            images += len(xml.findall('.//p:pic', ns))
            for t in xml.findall('.//a:t', ns):
                label = re.fullmatch(r'Fig\. 2 · ([A-Z]) · PDF p\.4', t.text or '')
                if label:
                    figure_ids.append(label[1])
                if t.text and any(word in t.text for word in ('整肺照片', '肺切片', '肺损伤评分。柱')):
                    notes.append(t.text)
        assert figure_ids == ['E', 'B', 'C'] and images == 3 and len(notes) == 3
        assert ppt.testzip() is None
        results['export'] = {'slides': len(slides), 'embeddedImages': images, 'panelOrder': figure_ids,
                             'sourcePage': 4, 'editableFigureExplanations': len(notes), 'validZip': True}
Path(args.output).write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('PASS paper maps, figure entry, terminology, Obsidian and editable E/B/C slides')
