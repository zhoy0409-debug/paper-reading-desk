"""Sample one unseen, openly licensed paper per topic without using translation outputs."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
import runpy
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
TOPICS = ("actigraphy", "coral bleaching", "soil moisture", "eye movements",
          "Raman spectroscopy", "hydrogel", "working memory", "photovoltaic")
sample = runpy.run_path(str(ROOT.parent / "round2/fresh_sources.py"))["sample"]
sample.__globals__["SALT"] = "desk-fifth-independent-scientific-reading"


def build(cache, output):
    cache.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    prior = "\n".join(p.read_text(encoding="utf8").lower() for p in ROOT.parent.glob("*/*.jsonl")
                      if p.parent != ROOT)

    def choose(topic):
        params = {"q": f'title:("{topic}") AND article_type:"Research Article" AND publication_date:[2017-01-01T00:00:00Z TO 2024-12-31T23:59:59Z]',
                  "fl": "id,journal", "wt": "json", "rows": 18, "sort": "publication_date asc,id asc"}
        index = cache / (topic.replace(" ", "-") + ".json")
        if not index.exists():
            url = "https://api.plos.org/search?" + urlencode(params)
            with urlopen(Request(url, headers={"User-Agent": "PaperReadingDesk-QA/5"}), timeout=35) as response:
                index.write_bytes(response.read())
        journals = {"pone":"plosone", "pbio":"plosbiology", "pcbi":"ploscompbiol",
                    "pmed":"plosmedicine", "pclm":"climate", "pwat":"water", "pgph":"globalpublichealth"}
        for hit in json.loads(index.read_bytes())["response"]["docs"]:
            doi = hit["id"]
            journal = journals.get(doi.split(".")[-2])
            if not journal or doi.lower() in prior:
                continue
            try:
                paper, rows = sample((doi, journal), cache)
            except (ValueError, StopIteration, AssertionError, OSError, AttributeError, ET.ParseError):
                continue
            return dict(paper, topic=topic), rows
        raise ValueError("No licensed, previously unused paper with all six strata for " + topic)

    with ThreadPoolExecutor(4) as pool:
        chosen = list(pool.map(choose, TOPICS))
    papers = [p for p, _ in chosen]
    rows = [r for _, group in chosen for r in group]
    assert len({p["doi"] for p in papers}) == len(TOPICS)
    assert len(rows) == len({r["source"] for r in rows}) == 48
    for i, row in enumerate(rows, 1):
        row["id"] = f"L{i:02}"
    corpus = "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows).encode()
    (output / "fresh.jsonl").write_bytes(corpus)
    (output / "sources.json").write_bytes((json.dumps(papers, indent=2, ensure_ascii=False) + "\n").encode())
    print(f"{len(rows)} passages from {len(papers)} papers, SHA-256 {sha256(corpus).hexdigest()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cache", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.cache, args.output)
