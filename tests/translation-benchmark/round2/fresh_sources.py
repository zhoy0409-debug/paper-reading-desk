"""Recreate the unseen prose sample from licensed JATS, without translation outputs."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


PAPERS = [
    ("10.1371/journal.pone.0212088", "plosone"),
    ("10.1371/journal.pbio.3001389", "plosbiology"),
    ("10.1371/journal.pcbi.1006487", "ploscompbiol"),
    ("10.1371/journal.pclm.0000278", "climate"),
    ("10.1371/journal.pmed.1003487", "plosmedicine"),
    ("10.7554/eLife.58734", "PMC7963487"),
]
SALT = "desk-scientific-reading-round2-1"
GAP = re.compile(r"(?<=[.!?])\s+(?=[A-Z])")
THRESHOLD = re.compile(r"\b(threshold|at least|less than|greater than|higher|lower|increase\w*|decrease\w*|compared|association)\b|[≤≥]", re.I)
MEASURE = re.compile(r"\d+(?:\.\d+)?\s*(?:%|°C|nm\b|µm\b|mm\b|mL\b|mg\b|s\b|h\b|hours?\b)|\b(?:concentration|spectra|intervals?|polymer|polyethylene)\b", re.I)


def plain(element):
    return " ".join("".join(element.itertext()).split()) if element is not None else ""


def sample(paper, cache):
    doi, journal = paper
    url = (f"https://www.ebi.ac.uk/europepmc/webservices/rest/{journal}/fullTextXML" if journal.startswith("PMC")
           else f"https://journals.plos.org/{journal}/article/file?id={doi}&type=manuscript")
    path = cache / (doi.split("/")[-1] + ".xml")
    if not path.exists():
        req = Request(url, headers={"User-Agent": "PaperReadingDesk-translation-validation/2"})
        with urlopen(req, timeout=60) as response:
            data = response.read()
        ET.fromstring(data)
        path.write_bytes(data)
    raw = path.read_bytes()
    doc = ET.fromstring(raw)
    meta = doc.find("front/article-meta")
    assert meta.findtext("article-id[@pub-id-type='doi']").lower() == doi.lower()
    license_element = meta.find("permissions/license")
    links = [v for e in license_element.iter() for v in e.attrib.values()]
    license_url = next(v for v in links if re.search(r"creativecommons.org/(?:licenses/by/|publicdomain/zero/)", v))
    authors = [plain(e.find("given-names")) + " " + plain(e.find("surname")) for e in meta.findall("contrib-group/contrib[@contrib-type='author']/name")]
    credit = dict(doi=doi, title=plain(meta.find("title-group/article-title")), authors=authors,
                  journal=plain(doc.find("front/journal-meta/journal-title-group/journal-title")),
                  url=url, license=license_url, xmlSha256=sha256(raw).hexdigest())
    pools = {"abstract": [], "body": [], "caption": []}
    used = set()
    paths = (("abstract", "front/article-meta/abstract//p"), ("body", "body//sec/p"),
             ("caption", "body//fig/caption/p"))
    for section, xpath in paths:
        for n, el in enumerate(doc.findall(xpath)):
            if list(el.iter("table")) or any("math" in str(e.tag).lower() for e in el.iter()):
                continue
            sentences = []
            for bit in GAP.split(plain(el)):
                if sentences and re.search(r"\b(?:Fig|Eq|Dr|vs|et al|[A-Z])\.$", sentences[-1]):
                    sentences[-1] += " " + bit
                else:
                    sentences.append(bit)
            for i, s in enumerate(sentences):
                if 65 <= len(s) <= 330 and s.endswith((".", "?", "!")) and s[0].isupper() and not s.startswith(("Copyright", "https:")):
                    pools[section].append((s, f"{xpath} [{n+1}], sentence {i+1}", sentences[i+1:i+2]))
    selected = []
    for label, section, condition in (
        ("abstract", "abstract", lambda s: True),
        ("caption", "caption", lambda s: True),
        ("measurement", "body", lambda s: MEASURE.search(s)),
        ("comparison", "body", lambda s: THRESHOLD.search(s)),
        ("body", "body", lambda s: True),
        ("two-sentence", "body", lambda s: True),
    ):
        candidates = []
        for s, loc, following in pools[section]:
            if s in used or not condition(s):
                continue
            if label == "two-sentence":
                if not following or not 65 <= len(following[0]) <= 330 or not following[0].endswith(".") or following[0] in used:
                    continue
                s += " " + following[0]
            key = sha256(f"{SALT}|{doi}|{label}|{s}".encode()).digest()
            candidates.append((key, s, loc))
        _, source, locator = min(candidates)
        used.add(source)
        selected.append(dict(doi=doi, kind=label, locator=locator, source=source))
    return credit, selected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.cache.mkdir(exist_ok=True, parents=True)
    args.output.mkdir(exist_ok=True, parents=True)
    with ThreadPoolExecutor(4) as pool:
        articles = list(pool.map(lambda p: sample(p, args.cache), PAPERS))
    rows = [row for _, records in articles for row in records]
    assert len({row["source"] for row in rows}) == len(rows) == 36
    for i, row in enumerate(rows, 1):
        row["id"] = f"F{i:02}"
    corpus = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows).encode()
    (args.output / "fresh.jsonl").write_bytes(corpus)
    (args.output / "sources.json").write_bytes((json.dumps([a for a, _ in articles], ensure_ascii=False, indent=2) + "\n").encode())
    print(f"{len(rows)} passages, {len(articles)} papers, SHA-256 {sha256(corpus).hexdigest()}")


if __name__ == "__main__":
    main()
