"""Fetch pinned public PDFs for the optional cross-journal browser audit."""
import argparse
import hashlib
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.request import Request, urlopen

MANIFEST = Path(__file__).resolve().parents[1] / 'tests/fixtures/journal-layouts.json'


def fetch(paper, directory):
    target = directory / (paper['id'] + '.pdf')
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == paper['sha256']:
        return
    request = Request(paper['pdf'], headers={'User-Agent': 'ReadingDesk-Layout-Corpus/1.0'})
    with urlopen(request, timeout=60) as response:
        with NamedTemporaryFile(dir=directory, delete=False) as output:
            temp = Path(output.name)
            digest = hashlib.sha256()
            try:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
                    digest.update(chunk)
            except BaseException:
                output.close()
                temp.unlink(missing_ok=True)
                raise
    try:
        if digest.hexdigest() != paper['sha256']:
            raise ValueError('Downloaded content differs from the recorded PDF')
        temp.replace(target)
    finally:
        temp.unlink(missing_ok=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('ids', nargs='*', help='Omit to fetch the whole corpus')
    args = parser.parse_args()
    papers = json.loads(MANIFEST.read_text(encoding='utf-8'))['papers']
    if unknown := set(args.ids) - {p['id'] for p in papers}:
        parser.error('Unknown PDF ID: ' + ', '.join(sorted(unknown)))
    args.directory.mkdir(parents=True, exist_ok=True)
    failed = []
    for paper in papers:
        if args.ids and paper['id'] not in args.ids:
            continue
        try:
            fetch(paper, args.directory)
            print('OK', paper['id'], flush=True)
        except (OSError, ValueError) as exc:
            failed.append(paper['id'])
            print(paper['id'], exc, flush=True)
    raise SystemExit(bool(failed))
