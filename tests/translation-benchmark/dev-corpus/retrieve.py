"""Download Creative Commons PLOS JATS articles used in the development set."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
PAPERS = {
    'forest': ('plosone', '10.1371/journal.pone.0249715', 'earth'),
    'paths': ('ploscompbiol', '10.1371/journal.pcbi.1012014', 'bioinformatics'),
    'insulate': ('plosone', '10.1371/journal.pone.0200842', 'materials'),
    'gravel': ('plosone', '10.1371/journal.pone.0285559', 'engineering'),
    'coffee': ('plosone', '10.1371/journal.pone.0161375', 'pharmacology'),
    'sleep': ('plosone', '10.1371/journal.pone.0319085', 'epidemiology'),
    'predation': ('plosone', '10.1371/journal.pone.0264881', 'ecology'),
    'curcumin': ('plosone', '10.1371/journal.pone.0202677', 'chemistry')
}
XLINK='{http://www.w3.org/1999/xlink}href'
def plain(el):
    return ' '.join(''.join(el.itertext()).split()) if el is not None else ''

def acquire(item):
    key,(journal,doi,field)=item
    url=f'https://journals.plos.org/{journal}/article/file?id={quote(doi,safe="")}&type=manuscript'
    f=ROOT/'inputs'/(key+'.xml')
    if not f.exists():
        with urlopen(Request(url,headers={'User-Agent':'PaperReadingDesk/benchmark-qa'}),timeout=60) as r:
            blob=r.read()
        ET.fromstring(blob)
        f.write_bytes(blob)
    raw=f.read_bytes()
    article=ET.fromstring(raw)
    metadata=article.find('front/article-meta')
    ids={e.get('pub-id-type'):plain(e) for e in metadata.findall('article-id')}
    assert ids['doi']==doi,(key,ids)
    lic=metadata.find('permissions/license')
    refs=[e.get(XLINK) for e in lic.iter() if e.get(XLINK)]
    link=next(v for v in refs if 'creativecommons.org/' in v)
    assert 'creativecommons.org/licenses/by/' in link or 'creativecommons.org/publicdomain/zero' in link,link
    authors=[(plain(a.find('name/given-names'))+' '+plain(a.find('name/surname'))).strip() or plain(a.find('collab')) for a in metadata.findall('contrib-group/contrib[@contrib-type="author"]')]
    year=metadata.findtext('pub-date/year')
    provenance={"format":"publisher JATS","identification":"front/article-meta/article-id[@pub-id-type='doi']","licenseLocation":"front/article-meta/permissions/license","excerptLocation":"per-record XPath and sentence index in locator"}
    if key=="paths":
        supplements=[]
        for suffix,checksum in (("001","c8c572ccc847d6f538e2162f5f8f7b96e427a62f3cc5f89e7026a2dcdfdea5ff"),("002","50919fd96817c2301f23a1b0e160e66f764020798f5c8407aaefef27fbd889b9")):
            supp_doi=f"{doi}.s{suffix}"
            supp_url=f"https://journals.plos.org/{journal}/article/file?id={supp_doi}&type=supplementary"
            path=ROOT/"inputs"/f"paths-s{suffix}.pdf"
            if not path.exists():
                with urlopen(Request(supp_url,headers={'User-Agent':'PaperReadingDesk/benchmark-qa'}),timeout=60) as r:
                    data=r.read()
                assert data.startswith(b"%PDF-") and hashlib.sha256(data).hexdigest()==checksum
                path.write_bytes(data)
            assert hashlib.sha256(path.read_bytes()).hexdigest()==checksum
            supplements.append(dict(doi=supp_doi,url=supp_url,sha256=checksum,extractor="pypdf 6.21.4; page 1; original line breaks retained"))
        provenance["supplementaryFiles"]=supplements
    return dict(key=key,doi=doi,title=plain(metadata.find('title-group/article-title')),authors=authors,year=year,journal=plain(article.find('front/journal-meta/journal-title-group/journal-title')),field=field,credit=plain(metadata.find('permissions/copyright-statement')) or ', '.join(authors),license=link,licenseNotice=plain(lic),url='https://doi.org/'+doi,xmlUrl=url,xmlSha256=hashlib.sha256(raw).hexdigest(),provenance=provenance)
if __name__=='__main__':
    (ROOT/'inputs').mkdir(exist_ok=True)
    with ThreadPoolExecutor(4) as pool: records=list(pool.map(acquire,PAPERS.items()))
    (ROOT/'sources.json').write_bytes((json.dumps(records,ensure_ascii=False,indent=2)+'\n').encode('utf8'))
    for r in records: print(r['key'],r['title'],r['license'])
