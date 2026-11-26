"""Assemble the same standalone reader for Pages and the portable distribution."""
import argparse
import hashlib
import re
from pathlib import Path
from shutil import copytree

ROOT = Path(__file__).resolve().parents[1]


def assemble(destination):
    copytree(ROOT / "dist", destination, dirs_exist_ok=True)
    html = (destination / "index.html").read_text(encoding="utf-8")

    def bundle(pattern, extension, tag, separator):
        nonlocal html
        matches = list(re.finditer(pattern, html))
        paths = [destination / m[1] for m in matches]
        data = separator.join(path.read_bytes().replace(b"\r\n", b"\n") for path in paths)
        name = f"reader-{hashlib.sha256(data).hexdigest()[:16]}.{extension}"
        (destination / name).write_bytes(data)
        html = re.sub(pattern, lambda m: tag.format(name) if m.start() == matches[0].start() else "", html)

    # Deferred and module scripts keep their original execution semantics.
    bundle(r'<script src="\./([^"?]+\.js)(?:\?[^"]*)?"></script>', "js",
           '<script src="./{}"></script>', b"\n;\n")
    bundle(r'<link rel="stylesheet" href="\./([^"?]+\.css)(?:\?[^"]*)?">', "css",
           '<link rel="stylesheet" href="./{}">', b"\n")
    (destination / "VERSION").write_bytes((ROOT / "VERSION").read_bytes())
    (destination / "index.html").write_text(html, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("destination", type=Path)
    assemble(parser.parse_args().destination)
