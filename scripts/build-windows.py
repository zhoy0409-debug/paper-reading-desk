"""Build the portable Windows x64 release from a verified CPython embeddable ZIP."""
import argparse
import hashlib
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
# https://www.python.org/downloads/release/python-31410/
RUNTIME_SHA256 = '90905e64a840557d8c1bc4f5b74db3d7ee85e3ffb217611cac1c7813acea4159'


def build(runtime, output):
    if hashlib.sha256(runtime.read_bytes()).hexdigest() != RUNTIME_SHA256:
        raise ValueError('Expected python-3.14.10-embed-amd64.zip from python.org')
    files = ['start.cmd', 'VERSION', 'portable_launcher.py', 'portable_update.py', 'preview.py', 'reading_questions.py', 'reading_providers.py',
             'public_literature.py', 'THIRD-PARTY.md', 'README.md', 'README.en.md', 'README.zh-CN.md']
    with ZipFile(runtime) as source, ZipFile(output, 'x', compression=ZIP_DEFLATED) as bundle:
        for name in source.namelist():
            data = source.read(name)
            if name == 'python314._pth':
                data += b'\r\n..\r\n'
            bundle.writestr('Reading-Desk/runtime/' + name, data)
        guide = sorted((ROOT / 'docs' / 'guide').glob('*'))
        posters = sorted((ROOT / 'docs' / 'film').glob('poster-*.webp'))
        for path in [ROOT / name for name in files] + sorted((ROOT / 'dist').rglob('*')) + guide + posters:
            if path.is_file():
                bundle.write(path, 'Reading-Desk/' + path.relative_to(ROOT).as_posix())


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('runtime', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    build(args.runtime, args.output)
