// Scientific expressions with explicit boundaries in the author's text. Only the
// comparison copy is normalized. Reinsert the original spelling unless a glossary
// actually supplies a translation of the entire chemical name.
export const retainedScientificNames = ['abaucin'];

export function chemicalNames(text, terms = []) {
  const spans = [];
  const compact = s => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  function add(index, original) {
    const entry = terms.find(t => compact(t.original) === compact(original));
    spans.push({index, original, value:entry?.value || original});
  }
  for (const match of text.matchAll(/\bpoly\s*\(/gi)) {
    let depth = 1, end = match.index + match[0].length;
    const start = end;
    while (depth && end < text.length && end - start < 180) {
      const c = text[end++];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (!/[\p{L}\d ,.'′/+-]/u.test(c)) break;
    }
    if (!depth && /[a-z]{3}/i.test(text.slice(start, end - 1)))
      add(match.index, text.slice(match.index, end));
  }
  // A systematic locant, or a polymer stem followed by a chemical head, is
  // stronger evidence than capitalization or a parenthesized acronym alone.
  const systematic = /\b(?:[NOS]|\d+)(?:,(?:[NOS]|\d+))*-(?:[a-z\d,-]+(?:amide|amine|benzene|phenol|oxide|anol|anone|acetate|ylate)|[a-z\d,-]+(?:ic|ous) acid)\b|\bpoly(?:ethylene|propylene|vinyl|methyl|ethyl|butyl|lactic)\s+(?:terephthalate|naphthalate|glycol|oxide|alcohol|chloride|acetate|lactate|acid)\b/gi;
  for (const m of text.matchAll(systematic)) {
    if (!spans.some(s => s.index <= m.index && m.index < s.index + s.original.length)) add(m.index,m[0]);
  }
  if (/\b(?:chemical|moiet(?:y|ies)|functional groups?|substituents?|molecul\w*)\b/i.test(text)) {
    const component = /\b([a-z][a-z\d-]*(?:oxazine|azine|idine|anone|azole|amide|phenyl|alkyl|ethyl|enoate))\b(\s+groups?\b)?/gi;
    for (const m of text.matchAll(component)) {
      if (spans.some(s => s.index <= m.index && m.index < s.index + s.original.length)) continue;
      const preferred = terms.find(t => compact(t.original) === compact(m[0]));
      const name = terms.find(t => compact(t.original) === compact(m[1]))?.value ?? m[1];
      const group = m[2] ? (/\p{Script=Han}$/u.test(name) ? '基团' : ' 基团') : '';
      spans.push({index:m.index, original:m[0], value:preferred?.value ?? name + group});
    }
  }
  for (const m of text.matchAll(/\b[A-Za-z][A-Za-z-]*\b/g)) {
    if (retainedScientificNames.includes(m[0].toLowerCase()) &&
        !spans.some(s => s.index <= m.index && m.index < s.index + s.original.length)) add(m.index, m[0]);
  }
  return spans.sort((a,b) => a.index-b.index);
}

// Keep each occurrence identifiable, including repeated names. A dropped, invented,
// or duplicated marker leaves the direct translation available for review.
export function maskChemicalNames(source, spans) {
  let prefix = 'ZXQ';
  while (source.toUpperCase().includes(prefix)) prefix += 'Z';
  let end = 0, text = '';
  const markers = new Map();
  for (const span of spans) {
    const key = prefix + String(markers.size + 1) + 'QXZ';
    markers.set(key, span.value);
    text += source.slice(end, span.index) + key;
    end = span.index + span.original.length;
  }
  return {text:text + source.slice(end), restore(translation) {
    const matches = translation.match(new RegExp(prefix + '\\d+QXZ', 'g')) ?? [];
    if (matches.length !== markers.size || new Set(matches).size !== markers.size ||
        matches.some(key => !markers.has(key))) return null;
    return translation.replace(new RegExp(prefix + '\\d+QXZ', 'g'), key => markers.get(key));
  }};
}

const limitPatterns = [
  ['≥', '至少', /no fewer than|no less than|not less than|greater than or equal to|at least/],
  ['≤', '至多', /no more than|not more than|no greater than|less than or equal to|at most/],
  ['>', '大于', /greater than|more than|above/],
  ['<', '小于', /fewer than|less than|lower than|below/]
];
const variable = '[A-Za-zα-ωΑ-Ω](?:[₀-₉]+)?';
const counted = {
  observation:['个观测值',/观测|观察/], event:['个事件',/事件/],
  sample:['个样本',/样本|样品/], trial:['次试验',/试验|实验|试次/],
  pixel:['个像素',/像素/], read:['条读段',/读段|读数|读取|测序片段/]
};
const scopeNouns = {sample:['个样本','样本|样品'],window:['个窗口','窗口|时间窗'],trial:['次试验','试验|实验|试次'],group:['组','组']};
const countWords = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const hanCounts = [...'零一二三四五六七八九十','十一','十二'];
const assigned = new RegExp('\\b(set to|fixed at|equal to)\\s+(' + countWords.join('|') + '|\\d+(?:\\.\\d+)?)(?=\\s*[,;.)]|$)','gi');
export function assignedValues(text) {
  return [...text.matchAll(assigned)].map(m => {
    const word = countWords.indexOf(m[2].toLowerCase());
    const number = word < 0 ? Number(m[2]) : word;
    const verb = {'set to':'设为','fixed at':'固定为','equal to':'等于'}[m[1].toLowerCase()];
    return {index:m.index, original:m[0], key:number, value:verb + ' ' + number};
  });
}
export function missingAssignments(source, target) {
  const values = [...target.normalize('NFKC').matchAll(/(?:设为|设定为|设置为|固定[为在]|等于|取值为|为|取|(?<![<>])=)\s*(\d+(?:\.\d+)?|十二|十一|十|[零一二两三四五六七八九])/g)]
    .map(m => /^\d/.test(m[1]) ? Number(m[1]) : hanCounts.indexOf(m[1].replace('两','二')));
  return assignedValues(source).filter(a => {
    const i = values.indexOf(a.key);
    if (i < 0) return true;
    values.splice(i,1);
    return false;
  });
}
export function symbolicBounds(text) {
  const found = [];
  for (const [operator, zh, words] of limitPatterns) {
    const pattern = new RegExp('\\b(?:' + words.source + ')\\s+(' + variable + ')(?![\\p{L}\\d_])', 'giu');
    for (const m of text.matchAll(pattern)) {
      if (m[1] === 'a' && /^\s+[a-z]/.test(text.slice(m.index + m[0].length))) continue;
      if (found.some(s => s.index <= m.index && m.index < s.index + s.original.length)) continue;
      const rest=text.slice(m.index+m[0].length);
      const tail=rest.match(/^\s+(observations?|events?|samples?|trials?|pixels?|reads?)\b(?:\s+(?:per|in each|in every|for each)\s+(sample|window|trial|group)\b)?/i);
      const noun=tail?.[1].toLowerCase().replace(/s$/,''), scope=tail?.[2]?.toLowerCase();
      let unit=noun?counted[noun][0]:'';
      if(noun==='read'&&!/read counts?|sequenc|spike-in|genom|align(?:ed|ment)/i.test(text))unit='次读取';
      const qualifier=scope?'每'+scopeNouns[scope][0]:'';
      const value=qualifier+zh+' '+m[1]+(unit?' '+unit:'');
      found.push({index:m.index,original:m[0]+(tail?.[0]||''),value,key:operator+m[1].normalize('NFKC'),noun,scope});
    }
  }
  return found.sort((a,b) => a.index - b.index);
}

export function symbolicKeys(text) {
  const zh = text.replace(/不小于|不低于|不少于|至少(?:为|有|需要|达到)?|大于(?:或)?等于/g,'≥')
    .replace(/不大于|不高于|不超过|至多(?:为)?|小于(?:或)?等于/g,'≤')
    .replace(/大于|多于|高于|超过/g,'>').replace(/小于|少于|低于/g,'<')
    .replace(/>=/g,'≥').replace(/<=/g,'≤');
  const keys = symbolicBounds(text).map(x => x.key);
  for (const m of zh.matchAll(new RegExp('([<>≥≤])\\s*(' + variable + ')(?![A-Za-zα-ωΑ-Ω\\d_])','gu')))
    keys.push(m[1] + m[2].normalize('NFKC'));
  for (const m of zh.matchAll(new RegExp('(?<![A-Za-z0-9_])(' + variable + ')\\s*(?:个|条|次|项)?(?:及)?(以上|以下)','gu')))
    keys.push((m[2] === '以上' ? '≥' : '≤') + m[1].normalize('NFKC'));
  return keys;
}

export function missingBoundRoles(source,target) {
  const required=symbolicBounds(source).filter(a=>a.noun);
  if(!required.length)return [];
  const clauses=target.split(/[；;。！？]/u);
  return required.filter(a=>!clauses.some(clause=>{
    if(!symbolicKeys(clause).includes(a.key)||!counted[a.noun][1].test(clause))return false;
    return !a.scope||new RegExp('(?:每|各|逐)(?:个|次|一|份)?(?:'+scopeNouns[a.scope][1]+')').test(clause);
  }));
}
