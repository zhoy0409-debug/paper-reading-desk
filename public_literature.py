"""Retrieve public publication records and their abstracts from scholarly indexes."""
import html
import json
import re
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from urllib.error import URLError
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen


def plain(value):
    return ' '.join(html.unescape(re.sub(r'<[^>]*>', ' ', value or '')).split())


def get_json(base, params):
    url = base + '?' + urlencode(params)
    request = Request(url, headers={'User-Agent': 'PaperReadingDesk/1.0', 'Accept': 'application/json'})
    with urlopen(request, timeout=7) as response:
        return json.loads(response.read(2_000_000))


def record(title, abstract, doi, pmid, year):
    title, abstract = plain(title), plain(abstract)
    doi = str(doi or '').strip().lower()
    if len(abstract) < 70 or not title:
        return None
    if re.fullmatch(r'10\.\d{4,9}/[^\s<>"?#]+', doi):
        url = 'https://doi.org/' + quote(doi, safe='/():._-')
    elif str(pmid or '').isdigit():
        url = 'https://pubmed.ncbi.nlm.nih.gov/' + str(pmid) + '/'
    else:
        return None
    return {'title': title[:350], 'url': url, 'year': str(year or '')[:4], 'abstract': abstract[:3600]}


def pubmed(query):
    base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'
    result = get_json(base + 'esearch.fcgi', {'db':'pubmed', 'term':query, 'retmode':'json', 'retmax':8, 'sort':'relevance'})
    ids = [i for i in result['esearchresult']['idlist'] if i.isdigit()]
    if not ids:
        return []
    url = base + 'efetch.fcgi?' + urlencode({'db':'pubmed','id':','.join(ids),'retmode':'xml'})
    with urlopen(Request(url, headers={'User-Agent':'PaperReadingDesk/1.0'}), timeout=8) as response:
        root = ET.fromstring(response.read(2_000_000))
    def content(node):
        return ''.join(node.itertext()) if node is not None else ''
    records = []
    for article in root.findall('PubmedArticle'):
        meta=article.find('MedlineCitation/Article')
        if meta is None:continue
        kinds={content(n).lower() for n in meta.findall('PublicationTypeList/PublicationType')}
        if kinds.intersection({'retracted publication','retraction of publication','published erratum'}):continue
        abstract=' '.join(content(t) for t in meta.findall('Abstract/AbstractText'))
        doi=article.findtext("PubmedData/ArticleIdList/ArticleId[@IdType='doi']")
        records.append(record(content(meta.find('ArticleTitle')),abstract,doi,article.findtext('MedlineCitation/PMID'),meta.findtext('Journal/JournalIssue/PubDate/Year')))
    return records


def crossref(query):
    data = get_json('https://api.crossref.org/works', {'query.bibliographic': query, 'filter': 'type:journal-article,has-abstract:true',
                                                      'rows': 4, 'select': 'title,abstract,DOI,published'})
    return [record((r.get('title') or [''])[0], r.get('abstract'), r.get('DOI'), None,
                   r.get('published', {}).get('date-parts', [['']])[0][0]) for r in data['message']['items']]


def words(text):
    return ' '.join(re.findall(r'[^\W_]+',plain(text).casefold(),re.UNICODE))


def same_publication(reference,title,doi,year):
    identifier=re.search(r'10\.\d{4,9}/[^\s<>"]+',reference,re.I)
    if identifier and doi and identifier.group().rstrip('.,;)').casefold()==doi.casefold():
        return True
    return (len(words(title).split())>=4 and words(title) in words(reference)
            and re.fullmatch(r'\d{4}',str(year)) and str(year) in reference)


def match_reference(reference):
    """A matching title plus year (or identifier) links an index record to the PDF."""
    if not reference or len(reference)>650:return None
    try:
        rows=get_json('https://api.crossref.org/works',{'query.bibliographic':reference[:360],'rows':3,'select':'title,DOI,abstract,published'})['message']['items']
        for item in rows:
            title=(item.get('title') or [''])[0]
            doi=item.get('DOI','');year=item.get('published',{}).get('date-parts',[['']])[0][0]
            if not same_publication(reference,title,doi,year):continue
            r=record(title,item.get('abstract'),doi,None,year)
            if r:return r
            for found in pubmed(doi+'[aid]'):
                if found and same_publication(reference,found['title'],doi,found['year']) and found['url'].casefold()=='https://doi.org/'+doi.casefold():return found
    except (OSError,ValueError,KeyError,TypeError,IndexError,ET.ParseError):
        pass
    return None


def evidence(query,reference=''):
    with ThreadPoolExecutor(max_workers=2) as pool:
        search=pool.submit(lookup,query)
        exact=pool.submit(match_reference,reference) if reference else None
        records,status=search.result()
        cited=exact.result() if exact else None
    if reference and not cited:
        cited=next((r for r in records if same_publication(reference,r['title'],r['url'].split('doi.org/')[-1],r['year'])),None)
    if cited:
        records=[dict(cited,cited=True)]+[r for r in records if r['url']!=cited['url']]
        status='found'
    return records[:8],status


def lookup(query):
    # One English topical query. The indexes never receive the paper,
    # the user's question, the selected passage or their conversation.
    if not isinstance(query, str) or not re.fullmatch(r"[\w][\w +,'()./-]{1,119}", query,re.UNICODE):
        return [], 'no_query'
    def fetch(provider):
        try:
            return [r for r in provider(query) if r], True
        except (OSError, URLError, ValueError, KeyError, TypeError, IndexError, ET.ParseError):
            return [], False
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(fetch, (pubmed, crossref)))
    terms={w.lower() for w in re.findall(r'[A-Za-z][A-Za-z0-9-]+',query) if len(w)>2}
    common={'with','the','and','for','against','narrow','spectrum','clinical','activity','study','studies','comparison','research','effects','analysis'}
    distinctive=terms-common or terms
    records = {}
    for rows, _ in results:
        for r in rows:
            body=(r['title']+' '+r['abstract']).lower()
            if (not distinctive or any(term in body for term in distinctive)) and not r['title'].lower().startswith(('retraction','correction to','erratum')):
                records.setdefault(r['url'], r)
    selected = list(records.values())[:8]
    return selected, 'found' if selected else ('no_results' if any(ok for _, ok in results) else 'unavailable')
