// A bilingual surface check, not a semantic quality score. Normalize only the
// comparison copy. The reader retains the exact selected text alongside it.
const superscripts='⁰¹²³⁴⁵⁶⁷⁸⁹', digits='零一二三四五六七八九';
const words=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const counts='samples?|groups?|sites?|days?|hours?|minutes?|times?|participants?|subjects?|patients?|replicates?|times?|units?|approaches|methods?|structures?|structural|fold|classes|trials?|cases?|categories|stages?';
const numberWord=new RegExp('\\b('+words.join('|')+')(?=[ -]?(?:'+counts+')\\b)','gi');
const ordinals=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
function chineseCount(s){
  if(s==='两')return 2;
  if(!s.includes('十'))return digits.indexOf(s);
  const [t,u]=s.split('十');return (t?digits.indexOf(t):1)*10+(u?digits.indexOf(u):0);
}
const number='(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+−-]?\\d+)?';
export function comparisonText(s){
  return String(s??'').replace(/10([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g,(_,exp)=>'10^'+[...exp].map(c=>c==='⁻'?'-':c==='⁺'?'+':superscripts.indexOf(c)).join(''))
    .normalize('NFKC').replace(/μ/g,'µ').replace(/−/g,'-').replace(/[‐‑]/g,'-')
    .replace(/\b(alpha|beta|gamma|delta|theta|kappa|lambda|omega)\b/gi,v=>({alpha:'α',beta:'β',gamma:'γ',delta:'δ',theta:'θ',kappa:'κ',lambda:'λ',omega:'ω'})[v.toLowerCase()])
    .replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g,(_all,list)=>{
      const refs=list.split(/\s*,\s*/).flatMap(part=>{
        const [lo,hi]=part.split(/\s*[–-]\s*/).map(Number);
        return hi>=lo&&hi-lo<100?Array.from({length:hi-lo+1},(_,i)=>lo+i):[part.trim()];
      });
      return '['+refs.sort((a,b)=>Number(a)-Number(b)).join(', ')+']';
    })
    .replace(/(\d),(?=\d{3}(?:\D|$))/g,'$1')
    .replace(/(\d+(?:\.\d+)?)\s*(thousand|million|billion)\b/gi,(_,v,k)=>String(Number(v)*({thousand:1e3,million:1e6,billion:1e9})[k.toLowerCase()]))
    .replace(/(\d+(?:\.\d+)?)\s*(十亿|百万|万|亿|千)/g,(_,v,k)=>String(Number(v)*({十亿:1e9,百万:1e6,万:1e4,亿:1e8,千:1e3})[k]))
    .replace(/(\d+(?:\.\d+)?)\s*[×x·]\s*10\s*\^\s*([+-]?\d+)/g,'$1e$2')
    .replace(numberWord,m=>String(words.indexOf(m.toLowerCase())))
    .replace(/\b(?:the |a |an )?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?=\s+[a-z]{2})/gi,(_m,n)=>'第'+(ordinals.indexOf(n.toLowerCase())+1)+' ')
    .replace(/第([一二三四五六七八九十]+)/g,(_m,n)=>'第'+chineseCount(n))
    .replace(/([零一二三四五六七八九两十]{1,3})(?=个|组|种|例|名|项|类|倍|次|天|小时|分钟|份|处|阶段|套|位)/g,(m)=>String(chineseCount(m)))
    .replace(/(?:not less than|at least|不低于|不少于|至少(?:为)?|大于等于|≥|>=)\s*/gi,'≥')
    .replace(/(?:no more than|at most|不超过|至多|小于等于|≤|<=)\s*/gi,'≤')
    .replace(/(?:greater than|more than|大于|高于|超过)\s*(?=[.\d])/gi,'>')
    .replace(/(?:less than|lower than|below|低于|小于)\s*(?=[.\d])/gi,'<')
    .replace(/毫克/g,'mg').replace(/微克/g,'µg').replace(/纳克/g,'ng').replace(/千克|公斤/g,'kg').replace(/克/g,'g')
    .replace(/毫升/g,'mL').replace(/微升/g,'µL').replace(/升(?=\s*(?:[/.。]|$))/g,'L')
    .replace(/小时|hours?\b/gi,'h').replace(/分钟|minutes?\b/gi,'min').replace(/秒钟?|seconds?\b/gi,'s')
    .replace(/摄氏度|degrees?\s+Celsius/gi,'°C').replace(/百分之\s*(\d+(?:\.\d+)?)/g,'$1%');
}
const units=new Map(Object.entries({
  '%':['%',1],'‰':['%',.1],'°C':['°C',1],'K':['K',1],Hz:['Hz',1],kHz:['Hz',1e3],MHz:['Hz',1e6],
  mg:['g',1e-3],'µg':['g',1e-6],ug:['g',1e-6],ng:['g',1e-9],kg:['g',1e3],g:['g',1],
  L:['L',1],mL:['L',1e-3],'µL':['L',1e-6],uL:['L',1e-6],
  mol:['mol',1],mmol:['mol',1e-3],'µmol':['mol',1e-6],nmol:['mol',1e-9],
  M:['M',1],mM:['M',1e-3],'µM':['M',1e-6],uM:['M',1e-6],nM:['M',1e-9],
  h:['s',3600],min:['s',60],s:['s',1],ms:['s',1e-3],days:['s',86400],day:['s',86400],d:['s',86400],天:['s',86400],
  m:['m',1],mm:['m',1e-3],cm:['m',1e-2],nm:['m',1e-9],'µm':['m',1e-6],km:['m',1e3],
  '倍':['fold',1],fold:['fold',1]
}));
const symbols=[...units.keys()].sort((a,b)=>b.length-a.length).join('|');
const quantity=new RegExp('(?<![A-Za-z\\d.])([<>≤≥]?)\\s*([+-]?'+number+')\\s*(?:('+symbols+')(?![A-Za-z])(?:\\s*[/／]\\s*('+symbols+')(?![A-Za-z]))?)?','g');
const figures=/(?:\bfig(?:ure)?s?\.?\s*|图\s*)(S?\d+[a-z]?(?:\s*[-–]\s*(?:S?\d+)?[a-z])?)(?![a-z\d])/gi;
const panels=/(?:\bpanels?\s*|分图\s*|小图\s*)\(?([a-z])\)?(?![a-z])|\(([a-z])\)/gi;
const groupPattern=/\b(?:group|arm)\s+([a-z\d])\b|(?<![A-Za-z])([a-z\d])\s*组|\b(control|treatment|experimental|placebo)\s+(?:group|arm)\b|(对照|控制|处理|治疗|实验|安慰剂)组/gi;
const groupNames={对照:'control',控制:'control',处理:'treatment',治疗:'treatment',实验:'experimental',安慰剂:'placebo'};
const sorted=list=>[...list].sort().join('|');
function quantities(text){
  // A range separator is distinct from a unary minus.
  const s=text.replace(/(?<=\d)\s*[-–~至到]\s*(?=[.\d])/g,' … ').replace(/(?<=\d)-(?=fold\b)/gi,' ');
  return Array.from(s.matchAll(quantity),m=>{
    const [dimension,factor]=units.get(m[3])||['',1];
    const [divisor,denominator]=units.get(m[4])||['',1];
    const value=Number((Number(m[2])*factor/denominator).toPrecision(12));
    return m[1]+value+dimension+(divisor?'/'+divisor:'');
  });
}
const directions=s=>{
  const flags=[];
  if(/\b(?:increas\w*|rose|rises?|higher|upregulat\w*|grew)\b|增加|增长|增多|升高|上升|提高|上调|高于|增强/i.test(s))flags.push('up');
  if(/\b(?:decreas\w*|declin\w*|fell|falls?|reduc\w*|lower|downregulat\w*)\b|减少|降低|下降|下调|减弱|低于|减小/i.test(s))flags.push('down');
  return flags;
};
function associations(s){
  const out=new Map();
  const marks=[...s.matchAll(groupPattern)];
  for(let i=0;i<marks.length;i++){
    const m=marks[i],label=(m[1]||m[2]||m[3]||groupNames[m[4]]).toLowerCase();
    const part=s.slice(m.index+m[0].length,marks[i+1]?.index).split(/[;；。]/,1)[0];
    const features=[...quantities(part),...directions(part)];
    if(features.length)out.set(label,[...(out.get(label)||[]),...features]);
  }
  return out;
}
const statLabels=[
  ['HR',/\bhazard ratios?\b|\bHR\b|风险比|危险比/i],['OR',/\bodds ratios?\b|\bOR\b|比值比|优势比/],
  ['RR',/\brelative risks?\b|\brisk ratios?\b|\bRR\b|相对风险|相对危险度/i],
  ['CI',/\bconfidence intervals?\b|\bCI\b|置信区间/i],['P',/\b[pP]\s*(?:值\s*)?(?=[=<>≤≥])/],
  ['MIC',/\bMIC\b|minimum inhibitory concentration|最低抑菌浓度/i],['MBC',/\bMBC\b|minimum bactericidal concentration|最低杀菌浓度/i]
];
const neg=s=>/\b(?:not(?! only)|no|without|neither|never|failed to)\b|不(?!同|等式|确定性)|未(?!来|知数)|并非|无(?!监督|线|限|机|损|量纲)|没有/i.test(s);
const significant=s=>/\b(?:statistically significant|significant(?:ly)?)\b|统计学意义|显著/i.test(s);
const assoc=s=>/\b(?:associat\w*|correlat\w*|linked to)\b|相关|关联/i.test(s);
const cause=s=>/\b(?:caus(?:e|es|ed)|led to|resulted in)\b|导致|引起|造成/i.test(s);
// Operational meanings shared across disciplines. Compare specific lexical
// relations, not every isolated "more", "mean" or "positive".
const relations=[
  ['positive-association',/\bpositiv\w* (?:and \w+ )?(?:correlat|associa|relat)|正(?:向)?(?:相?关|联系)/i],
  ['negative-association',/\bnegativ\w* (?:and \w+ )?(?:correlat|associa|relat)|负(?:向)?(?:相?关|联系)/i],
  ['from-above',/\btop[- ]down\b|自上(?:而|向)下|从上(?:往|到)下/i],
  ['from-below',/\bbottom[- ]up\b|自下(?:而|向)上|从下(?:往|到)上/i],
  ['sampling-interval',/\bevery\s+\d|\b(?:at\s+)?\d+(?:\.\d+)?[- ](?:second|minute|hour|day|s|min|h)s? intervals?\b|(?:每隔?|间隔)\s*\d|\d+(?:\.\d+)?\s*(?:s|min|h|天)(?:的)?间隔/i],
  ['statistical-mean',/\baverag(?:e|es)\b|\b(?:arithmetic|geometric|group|sample) means?\b|\bmeans?\s*(?:±|values?|of (?:three|four|\d+)\s+(?:replicates?|experiments?|observations?|measurements?))|平均(?:值|数)?|均值/i]
];
function protectedIds(s){
  return s.match(/\b(?:[A-Z]{2,}[A-Z0-9]*[-_][A-Za-z\d_-]*\d[A-Za-z\d_-]*|[A-Z][A-Za-z]*\d+[A-Za-z\d_-]*|[A-Z][a-z]+[A-Z][\w-]*)\b/g)||[];
}
export function validateScientific(source,target,{from='en',terms=[]}={}){
  const a=comparisonText(source),b=comparisonText(target),issues=[];
  const flag=(code,severity='severe',detail='')=>issues.push({code,severity,detail});
  const han=/[\u3400-\u9fff]/u;
  if(!target?.trim()||source.trim()===target.trim()||(from==='en'?!han.test(b):!/[A-Za-z]{2}/.test(b)))flag('target');
  const refs=s=>[...s.matchAll(figures)].map(m=>m[1].replace(/\s/g,'').replace('–','-').toLowerCase());
  if(sorted(refs(a))!==sorted(refs(b)))flag('figure');
  const subs=s=>[...s.matchAll(panels)].map(m=>(m[1]||m[2]).toLowerCase());
  if(sorted(subs(a))!==sorted(subs(b)))flag('panel');
  const nums=s=>quantities(s.replace(figures,' ').replace(/\b(?:group|arm)\s+[A-Z\d]\b/gi,' ').replace(/(?<![A-Za-z])[A-Z\d]\s*组/g,' '));
  if(sorted(nums(a))!==sorted(nums(b)))flag('quantity');
  const ga=associations(a),gb=associations(b);
  for(const [group,bindings] of ga)if(!gb.has(group)||sorted(bindings)!==sorted(gb.get(group)))flag('group','severe',group);
  for(const [label,re] of statLabels){
    const x=re.exec(a),y=re.exec(b);
    if(!x)continue;
    if(!y){flag('statistic','severe',label);continue}
    if(label==='CI')continue; // The level commonly precedes the CI label.
    const next=(s,m)=>quantities(s.slice(m.index+m[0].length).split(/[;,；，()]/)[0])[0];
    const left=next(a,x),right=next(b,y);
    if(left&&right&&left!==right)flag('statistic','severe',label);
  }
  const sourceIds=protectedIds(a);for(const id of new Set(sourceIds))if(!b.includes(id))flag('identifier','severe',id);
  for(const symbol of new Set(a.match(/[αβγδθκλω]/gi)||[]))if(!b.includes(symbol))flag('identifier','severe',symbol);
  if(sorted(directions(a))!==sorted(directions(b)))flag('direction');
  if(neg(a)!==neg(b))flag('negation');
  if(significant(a)&&!significant(b))flag('significance');
  if(assoc(a)&&!cause(a)&&cause(b))flag('causality');
  for(const [key,re] of relations)if(re.test(a)&&!re.test(b))flag('relation','severe',key);
  for(const term of terms){
    if(!target.includes(term.value)){
      if(target.toLowerCase().includes(term.original.toLowerCase()))flag('retained-term','advisory',term.original);
      else flag('term','advisory',term.original);
    }
  }
  if(from==='en'){
    const unresolved=[...source.matchAll(/\b[a-z][a-z-]{2,}(?:diamine|triamine|amine|amide|imidazole|pyridine|decarboxylase|dehydrogenase|transferase|synthase)\b/gi)]
      .map(m=>m[0]).filter(n=>!target.toLowerCase().includes(n.toLowerCase())&&!terms.some(t=>t.original.toLowerCase().includes(n.toLowerCase())&&target.includes(t.value)));
    if(unresolved.length)flag('chemical-name','advisory',[...new Set(unresolved)].join(', '));
  }
  return {status:issues.some(i=>i.severity==='severe')?'review':'checked',issues};
}
