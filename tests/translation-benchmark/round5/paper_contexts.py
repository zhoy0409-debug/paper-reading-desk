"""Prepare local reader context from exactly the licensed JATS used by the sampler."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import xml.etree.ElementTree as ET


def build(sources, cache, destination):
    documents = {}
    for paper in json.loads(sources.read_bytes()):
        xml = (cache / (paper["doi"].split("/")[-1] + ".xml")).read_bytes()
        assert sha256(xml).hexdigest() == paper["xmlSha256"]
        doc = ET.fromstring(xml)
        rows = []
        for section, path in (("abstract","front/article-meta/abstract//p"),
                              ("body","body//sec/p"), ("caption","body//fig/caption/p")):
            for el in doc.findall(path):
                text = " ".join("".join(el.itertext()).split())
                if text:
                    rows.append({"text":text,"section":section})
        documents[paper["doi"]] = {"title":paper["title"],"rows":rows}
    destination.write_text(json.dumps(documents, ensure_ascii=False), encoding="utf8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ("sources","cache","destination"):
        parser.add_argument(arg, type=Path)
    args = parser.parse_args()
    build(args.sources, args.cache, args.destination)
