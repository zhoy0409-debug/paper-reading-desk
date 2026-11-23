// Translate supported scientific constructions from their captured subjects and modifiers.
// Keep the source visible for every passage; opaque identifiers must survive machine translation.
export function normalizeSelection(text){
  return text.replace(/\u00ad/g,'').replace(/(\b[A-Z]{2,8}-)\s+(?=[A-Z0-9])/g,'$1')
    .replace(/\b(vul)-\s+(gatus)\b|\b(experi)-\s+(ments?)\b/gi,(_,a,b,c,d)=>(a||c)+(b||d))
    .replace(/-\s+(?=producing\b|resistant\b|susceptible\b)/gi,'-').replace(/\s+/g,' ').trim();
}
const terminology=[
  ['extended-spectrum β-lactamase','超广谱 β-内酰胺酶'],['clinical isolates','临床分离株'],
  ['Gram-negative pathogens','革兰阴性病原菌'],['gut commensal bacteria','肠道共生菌'],
  ['carbapenem-resistant','耐碳青霉烯类'],['carbapenem-susceptible','对碳青霉烯类敏感的'],
  ['Acinetobacter baumannii','鲍曼不动杆菌'],['A. baumannii','鲍曼不动杆菌'],['Escherichia coli','大肠埃希菌'],['E. coli','大肠埃希菌'],
  ['Klebsiella pneumoniae','肺炎克雷伯菌'],['Bacteroides vulgatus','普通拟杆菌'],['Bacteroides thetaiotaomicron','多形拟杆菌'],['Bacteroides fragilis','脆弱拟杆菌'],
  ['distance modulus','距离模数'],['redshift','红移'],['minimum inhibitory concentration','最低抑菌浓度'],['abaucin','abaucin']
];
const exactNames=new Map(terminology);
function taxon(s){return exactNames.has(s)?exactNames.get(s)+'（'+s+'）':s}
function subject(s){
  const phenotype=s.match(/^carbapenem-(resistant|susceptible) \(([^()]+)\) and carbapenem-(resistant|susceptible) \(([^()]+)\) clinical isolates of ([A-Z][a-z]*\.? [a-z]+)$/);
  if(phenotype){
    const trait=t=>t==='resistant'?'耐碳青霉烯类':'对碳青霉烯类敏感';
    const ids=v=>v.split(/,\s*(?:and\s+)?|\s+and\s+/).join('、');
    return taxon(phenotype[5])+'临床分离株，分为'+trait(phenotype[1])+'的分离株（'+ids(phenotype[2])+'）和'+trait(phenotype[3])+'的分离株（'+ids(phenotype[4])+'）';
  }
  const commensal=s.match(/^representative gut commensal isolates \((.+)\)$/i);
  if(commensal){
    const parts=commensal[1].split(/,\s*/);
    if(!parts.length||parts.length%2||parts.some((v,i)=>i%2?!/^[\w–-]+$/.test(v):!/^[A-Z][a-z]+ [a-z]+$/.test(v)))return null;
    return '代表性肠道共生菌分离株，包括'+parts.filter((_,i)=>!(i%2)).map((n,i)=>taxon(n)+' '+parts[i*2+1]).join('、');
  }
  const bacteria=s.split(/,?\s+and\s+(?=carbapenem-|extended-spectrum)/).map(part=>{
    const m=part.match(/^(extended-spectrum β-lactamase \(ESBL\)-producing|carbapenem-resistant|carbapenem-susceptible) ([A-Z][a-z]*\.? [a-z]+) \(([^()]+)\)$/i);
    if(!m)return null;
    return (/^extended/i.test(m[1])?'产超广谱 β-内酰胺酶（ESBL）的':/resistant/i.test(m[1])?'耐碳青霉烯类的':'对碳青霉烯类敏感的')+taxon(m[2])+'（'+m[3].replace(/,\s*/g,'，')+'）';
  });
  return bacteria.every(Boolean)?bacteria.join('，以及'):null;
}
function assay(sentence){
  const quantitative=sentence.match(/^(?:The )?(?:MIC|minimum inhibitory concentration) of ([\w-]+) (?:against|for) ([A-Z][a-z]*\.? [a-z]+)(?: \(([^()]+)\))? was (<?=?|>?=?|[≤≥])?\s*(\d+(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?)\s*([μµu]g\/mL|mg\/L)\.?$/i);
  if(quantitative){
    const [,drug,species,isolate,sign,amount,unit]=quantitative;
    const relation=({'<':'低于','>':'高于','<=':'不超过','>=':'不低于','≤':'不超过','≥':'不低于'})[sign]||'为';
    return drug+' 对'+taxon(species)+(isolate?'分离株 '+isolate:'')+' 的最低抑菌浓度（MIC）'+relation+' '+amount+' '+unit.replace(/^[uµ]g/,'μg')+'。';
  }
  const tested=sentence.match(/^(?:The authors|We) tested ([\w-]+) against ([A-Z][a-z]*\.? [a-z]+)(?: \(([^()]+)\))?\.$/);
  if(tested)return '研究者检测了 '+tested[1]+' 对'+taxon(tested[2])+(tested[3]?'分离株 '+tested[3]:'')+' 的作用。';
  const header=sentence.match(/^(?:(?:Fig(?:ure)?\.?)\s*([S\d]+)\s*(?:[.|:]\s*)?)?MICs? of ([\w-]+) against clinically isolated Gram-negative pathogens and gut commensal bacteria[.]?$/i);
  if(header)return (header[1]?'图 '+header[1]+'　':'')+header[2]+' 对临床分离的革兰阴性病原菌及肠道共生菌的最低抑菌浓度（MIC）。';
  const measure=sentence.match(/^MICs? (?:were determined|were measured) for (.+?)\.?$/i);
  if(measure){
    const fragments=[];let end=0;
    for(const m of measure[1].matchAll(/\s+in \(([a-z])\)(?=,|$)/gi)){
      const value=measure[1].slice(end,m.index).replace(/^,\s*(?:(?:and|as well as)\s+)?/,'');
      const name=subject(value);if(!name)return null;
      fragments.push('图 '+m[1]+'　'+name+'。');end=m.index+m[0].length;
    }
    if(fragments.length&&end===measure[1].length)return '各小图分别测定了以下菌株的 MIC。\n'+fragments.join('\n');
  }
  const replicate=sentence.match(/^MIC measurements were consistent across (two|three|four|\d+) independent experiments initiated from single colonies[.]?$/i);
  if(replicate)return '分别从单菌落开始的 '+({two:2,three:3,four:4}[replicate[1]]||replicate[1])+' 次独立实验中，MIC 测量结果一致。';
  const origin=sentence.match(/^All strains were isolated from (.+?)[.]?$/i);
  if(origin)return '所有菌株均分离自'+(origin[1]==='West China Hospital, Sichuan University'?'四川大学华西医院':origin[1])+'。';
  return null;
}
export function sentences(text){
  // Only split completed sentences. A genus initial, figure abbreviation or decimal is internal.
  return normalizeSelection(text).replace(/\bFigs\.\s*(?=\d)/gi,'Figures ').replace(/\bFig\.\s*(?=\d)/gi,'Figure ').split(/(?<!\b[A-Z])(?<!\bFig)(?<=[.!?])\s+(?=[A-Z])/).reduce((out,s)=>{
    if(out.length&&/(?:\b[A-Z]|\bFig|\bet al)\.$/.test(out.at(-1)))out[out.length-1]+=' '+s;else out.push(s);return out;
  },[]);
}
export async function translatePassage(original,from,translate){
  if(from!=='en')return {text:await translate(original,from),warnings:[]};
  const lines=[],warnings=[];
  for(const s of sentences(original)){
    const checked=assay(s);
    if(checked){lines.push(checked);continue}
    const exact=terminology.find(([en])=>s.toLowerCase()===en.toLowerCase());
    if(exact){lines.push(exact[1]);continue}
    const fig=s.match(/^(?:Fig(?:ure)?\.?)\s*([S\d]+[a-z]?)\s*(?:[|.:]\s*)?/i);
    const body=fig?s.slice(fig[0].length):s;
    const keys=[...new Set([...body.matchAll(/\b(?:[A-Z]{2,8}-[A-Z0-9]+(?:[-–][A-Z0-9]+)*|[A-Z]{2,}\d*|[A-Z][a-z]+[A-Z][A-Za-z\d]*|abaucin)\b/g)].map(m=>m[0]))];
    const terms=terminology.filter(([en])=>body.toLowerCase().includes(en.toLowerCase()));
    const prepared=body.replace(/\bIn cellulo validation\b/gi,'Validation in cells').replace(/\bin cellulo\b/gi,'in cells');
    let result=body?await translate(prepared,from):'';
    if(/\bTimer probe\b/.test(body))result=result.replace(/定时器探针/g,'Timer 探针');
    if(/\blog[- ]posterior\b/i.test(body))result=result.replace(/日志后部|对数后部/g,'对数后验');
    if(/\b(?:imaging|image[- ]based|analysis|processing|data) pipeline\b/i.test(body))result=result.replace(/管道/g,'分析流程');
    // Translators often spell out standard abbreviations. Keep the original token searchable as well.
    const expanded={TB:'结核病',DNA:'脱氧核糖核酸',RNA:'核糖核酸',MRI:'磁共振成像',ATP:'三磷酸腺苷',PCR:'聚合酶链式反应'};
    for(const k of keys){
      if(expanded[k]&&!result.includes(k)&&result.includes(expanded[k]))result=result.replace(expanded[k],expanded[k]+'（'+k+'）');
    }
    if(/\bresiduals?\b/i.test(body)&&/\b(?:cosmolog\w*|Hubble|best[- ]fit|distance modul\w*)\b/i.test(body))
      result=result.replace(/残余物|残留物|残余量/g,'残差').replace(/最适合的宇宙学(?!模型)/g,'最佳拟合宇宙学模型');
    const numbers=body.match(/(?:[<>≤≥−-]\s*)?\d+(?:\.\d+)?/g)||[];
    const resultNumbers=result.match(/(?:[<>≤≥−-]\s*)?\d+(?:\.\d+)?/g)||[];
    const equalNumbers=numbers.map(n=>n.replace(/\s/g,'')).sort().join('|')===resultNumbers.map(n=>n.replace(/\s/g,'')).sort().join('|');
    const panelRefs=s=>Array.from(s.matchAll(/\(([a-z])\)|[（(]([a-z])[)）]|(?:图|小图)\s*([a-z])\b/gi),m=>(m[1]||m[2]||m[3]).toLowerCase()).sort().join(',');
    if(!equalNumbers||keys.some(k=>!result.includes(k))||terms.some(([en,zh])=>!result.toLowerCase().includes(en.toLowerCase())&&!result.includes(zh))||
      panelRefs(body)!==panelRefs(result)||(/\b(?:not|no|without)\b/i.test(body)&&!/[无不未没非]/.test(result))){
      warnings.push(s);result=body+(terms.length?'\n'+terms.map(([en,zh])=>en+' · '+zh).join('　'):'');
    }
    lines.push((fig?'图 '+fig[1]+'　':'')+result);
  }
  return {text:lines.join('\n\n'),warnings};
}