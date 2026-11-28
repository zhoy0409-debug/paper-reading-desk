// A bilingual surface check, not a semantic quality score. Normalize only the
// comparison copy. The reader retains the exact selected text alongside it.
import {chemicalNames, missingAssignments, missingBoundRoles, symbolicKeys} from './translation-anchors.js?rev=evidence2';
const superscripts='⁰¹²³⁴⁵⁶⁷⁸⁹', digits='零一二三四五六七八九';
const words=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
const counts='samples?|groups?|sites?|days?|hours?|minutes?|times?|participants?|subjects?|patients?|replicates?|times?|units?|approaches|methods?|structures?|structural|fold|classes|trials?|cases?|categories|stages?';
const numberWord=new RegExp('\\b('+words.join('|')+')(?=[ -]?(?:'+counts+')\\b)','gi');
const ordinals=['first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthYear=new RegExp('\\b('+months.join('|')+')\\s+(\\d{4})\\b','gi');
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
    .replace(/(\d+(?:\.\d+)?)\s*(十亿|百万|万|亿|千(?!克|米|赫|瓦|焦|帕))/g,(_,v,k)=>String(Number(v)*({十亿:1e9,百万:1e6,万:1e4,亿:1e8,千:1e3})[k]))
    .replace(/(\d+(?:\.\d+)?)\s*[×x·]\s*10\s*\^\s*([+-]?\d+)/g,'$1e$2')
    .replace(numberWord,m=>String(words.indexOf(m.toLowerCase())))
    .replace(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?!-[a-z])/gi,m=>String(words.indexOf(m.toLowerCase())))
    .replace(/\b((?:set|fixed|equal) (?:to|at)) (one|zero)\b/gi,(_,verb,n)=>verb+' '+words.indexOf(n.toLowerCase()))
    .replace(/((?:设|定|固定)为|等于|取值为|为)([零一两二三四五六七八九十]+)(?=[，。；,;.)）\s]|$)/g,(_,v,n)=>v+chineseCount(n))
    .replace(monthYear,(_,month,year)=>year+'年'+(months.findIndex(m=>m.toLowerCase()===month.toLowerCase())+1)+'月')
    .replace(/\b(?:in|of) (duplicate|triplicate|quadruplicate)\b/gi,(_,w)=>({duplicate:'2',triplicate:'3',quadruplicate:'4'})[w.toLowerCase()])
    .replace(/\b(?:the |a |an )?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)(?=\s+[a-z]{2})/gi,(_m,n)=>'第'+(ordinals.indexOf(n.toLowerCase())+1)+' ')
    .replace(/第([一二三四五六七八九十]+)/g,(_m,n)=>'第'+chineseCount(n))
    .replace(/([零一二三四五六七八九两十]{1,3})(?=个|组|种|例|名|项|类|倍|次|天|小时|分钟|份|处|阶段|套|位)/g,(m)=>String(chineseCount(m)))
    .replace(/(?:no fewer than|no less than|not less than|greater (?:than )?or equal to|at least|不小于|不低于|不少于|至少(?:为)?|大于(?:或)?等于|≥|>=)\s*/gi,'≥')
    .replace(/(?:no more than|not more than|no greater than|less (?:than )?or equal to|at most|不高于|不大于|不超过|至多(?:为)?|小于(?:或)?等于|≤|<=)\s*/gi,'≤')
    .replace(/(?:greater than|more than|大于|高于|超过)\s*(?=[.\d]|[A-Za-zα-ω](?![A-Za-z\d_]))/gi,'>')
    .replace(/(?:fewer than|less than|lower than|below|低于|小于|少于)\s*(?=[.\d]|[A-Za-zα-ω](?![A-Za-z\d_]))/gi,'<')
    .replace(/([A-Za-zα-ω])(?=[<>≥≤])/gi,'$1 ')
    .replace(/((?:[=<>≤≥[(,]|为|是|\bwas\b|\bis\b)\s*|^)([-+])\s+(?=[.\d])/gi,'$1$2')
    .replace(/毫克/g,'mg').replace(/微克/g,'µg').replace(/纳克/g,'ng').replace(/千克|公斤/g,'kg').replace(/克/g,'g')
    .replace(/千米|公里/g,'km').replace(/厘米/g,'cm').replace(/毫米/g,'mm').replace(/微米/g,'µm').replace(/纳米/g,'nm').replace(/米(?=\s*[/／])/g,'m')
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
const quantity=new RegExp('(?<![A-Za-z\\d.])([<>≤≥]?)\\s*([+-]?'+number+')\\s*(?:('+symbols+')(?:(?<=%)|(?![A-Za-z]))(?:\\s*[/／]\\s*('+symbols+')(?![A-Za-z]))?)?','g');
const figures=/(?:\bfig(?:ure)?s?\.?\s*|图\s*)(S?\d+[a-z]?(?:\s*[-–]\s*(?:S?\d+)?[a-z])?)(?![a-z\d])/gi;
const panels=/(?:\bpanels?\b\s*|分图\s*|小图\s*)\(?([a-z])\)?(?![a-z])|\(([a-z])\)/gi;
const groupPattern=/\b(?:group|arm)\s+([a-z\d])\b|(?<![A-Za-z])([a-z\d])\s*组|\b(control|treatment|experimental|placebo)\s+(?:group|arm)\b|(对照|控制|处理|治疗|实验|安慰剂)组/gi;
const groupNames={对照:'control',控制:'control',处理:'treatment',治疗:'treatment',实验:'experimental',安慰剂:'placebo'};
const sorted=list=>[...list].sort().join('|');
function unmatched(left,right){
  const rest=right.slice(),missing=[];
  for(const value of left){
    const index=rest.indexOf(value);
    if(index<0)missing.push(value);else rest.splice(index,1);
  }
  return [missing,rest];
}
function measurements(text){
  // A range separator is distinct from a unary minus.
  const s=text.replace(/(?<=\d)\s*[-–~至到]\s*(?=[.\d])/g,' … ').replace(/(?<=\d)-(?=fold\b)/gi,' ');
  return Array.from(s.matchAll(quantity),m=>{
    const [dimension,factor]=units.get(m[3])||['',1];
    const [divisor,denominator]=units.get(m[4])||['',1];
    const value=Number((Number(m[2])*factor/denominator).toPrecision(12));
    return {key:m[1]+value+dimension+(divisor?'/'+divisor:''),label:m[0].trim()};
  });
}
const quantities=s=>measurements(s).map(m=>m.key);
const directions=s=>{
  const flags=[];
  if(/\b(?:increas\w*|rose|rises?|higher|upregulat\w*|grew)\b|增加|增长|增多|升高|上升|提高|上调|高于|增强|较高|更高|增大/i.test(s))flags.push('up');
  if(/\b(?:decreas\w*|declin\w*|fell|falls?|reduc\w*|lower(?! (?:panel|left|right|case|limb)s?\b)|downregulat\w*)\b|减少|降低|下降|下调|减弱|低于|减小|较低|更低|变低/i.test(s))flags.push('down');
  return flags;
};
function associations(s){
  const out=new Map();
  const marks=[...s.matchAll(groupPattern)];
  for(let i=0;i<marks.length;i++){
    const m=marks[i],label=(m[1]||m[2]||m[3]||groupNames[m[4]]).toLowerCase();
    const part=s.slice(m.index+m[0].length,marks[i+1]?.index).split(/[;；。]/,1)[0];
    const measured=measurements(part),moves=directions(part);
    if(!measured.length&&!moves.length)continue;
    const binding=out.get(label)||{keys:[],labels:[]};
    binding.keys.push(...measured.map(v=>v.key),...moves);
    binding.labels.push(...measured.map(v=>v.label),...moves.map(v=>v==='up'?'↑':'↓'));
    out.set(label,binding);
  }
  return out;
}
const statLabels=[
  ['HR',/\bhazard ratios?\b|\bHR\b|风险比|危险比/i],['OR',/\bodds ratios?\b|\bOR\b|比值比|优势比/],
  ['RR',/\brelative risks?\b|\brisk ratios?\b|\bRR\b|相对风险|相对危险度/i],
  ['CI',/\bconfidence intervals?\b|\bCI\b|置信区间/i],['P',/\b[pP]\s*(?:值\s*)?(?=[=<>≤≥])/],
  ['MIC',/\bMIC\b|minimum inhibitory concentration|最低抑菌浓度/i],['MBC',/\bMBC\b|minimum bactericidal concentration|最低杀菌浓度/i]
];
function negationMismatch(en,zh){
  const explicit=/\b(?:not(?! only)|no|without|neither|never|fail(?:ed|s)? to|none)\b/i.test(en);
  if(explicit)return !/不(?!同|等式|确定性|良)|未(?!来|知数)|并非|无(?!监督|线|限|机|损|量纲)|没有|缺乏|缺少|与否/.test(zh);
  const chineseNegative=/没有|并未|并非|未能|不存在|不(?:显著|显着|升高|上升|增加|降低|下降|减少)|无统计学意义/.test(zh);
  return chineseNegative&&!/\b(?:non[- ]?significant|insignificant|unchanged|unchanging|absen\w*|lack\w*|unlikely|unable|undetect\w*|unaffected|unrelated|remain(?:ed)? stable)\b/i.test(en);
}
const significant=s=>/\b(?:statistically significant|significant(?:ly)?)\b|统计学意义|显[著着]/i.test(s);
const notSignificantEn=/\b(?:statistically (?:insignificant|non[- ]?significant)|not (?:statistically )?significant|no (?:statistically )?significant)\b/i;
const notSignificantZh=/(?:无|未[达到见获显有]*|不[具备有]?|没有|缺乏)(?:[^。，；,;]{0,10})(?:统计学意义|显[著着])|差异不显[著着]/;
const assoc=s=>/\b(?:associat\w*|correlat\w*|linked to)\b|相关|关联/i.test(s);
const cause=s=>/\b(?:caus(?:e|es|ed)|(?:lead(?:s|ing)?|led) to|result(?:s|ed|ing)? in)\b|导致|引起|造成/i.test(s);
// Operational meanings shared across disciplines. Compare specific lexical
// relations, not every isolated "more", "mean" or "positive".
const relations=[
  ['positive-association',/\bpositiv\w* (?:and \w+ )?(?:correlat|associa|relat)|正(?:向)?(?:相?关|联系)/i],
  ['negative-association',/\bnegativ\w* (?:and \w+ )?(?:correlat|associa|relat)|负(?:向)?(?:相?关|联系)/i],
  ['from-above',/\btop[- ]down\b|自上(?:而|向)下|从上(?:往|到)下/i],
  ['from-below',/\bbottom[- ]up\b|自下(?:而|向)上|从下(?:往|到)上/i],
  ['sampling-interval',/\bevery\s+\d|\b(?:at\s+)?\d+(?:\.\d+)?[- ](?:second|minute|hour|day|s|min|h)s? intervals?\b|(?:每隔?|间隔)\s*\d|\d+(?:\.\d+)?\s*(?:s|min|h|天)(?:的)?间隔/i],
  ['statistical-mean',/\baverag(?:e|es)\b|\b(?:arithmetic|geometric|group|sample) means?\b|\bmeans?\s*(?:±|values?|of (?:three|four|\d+)\s+(?:independent\s+)?(?:replicates?|experiments?|observations?|measurements?))|平均(?:值|数)?|均值/i]
];
function protectedIds(s){
  return s.match(/\b(?:[A-Z]{2,}[A-Z0-9]*[-_][A-Za-z\d_-]*\d[A-Za-z\d_-]*|[A-Z][A-Za-z]*\d+[A-Za-z\d_-]*|[A-Z][a-z]+[A-Z][\w-]*)\b/g)||[];
}
export function validateScientific(source,target,{from='en',terms=[]}={}){
  const a=comparisonText(source),b=comparisonText(target),issues=[];
  const flag=(code,severity='severe',detail='',evidence)=>issues.push({code,severity,detail,...evidence});
  const han=/[\u3400-\u9fff]/u;
  if(!target?.trim()||source.trim()===target.trim()||(from==='en'?!han.test(b):!/[A-Za-z]{2}/.test(b)))flag('target');
  const refs=s=>[...s.matchAll(figures)].map(m=>m[1].replace(/\s/g,'').replace('–','-').toLowerCase());
  if(sorted(refs(a))!==sorted(refs(b)))flag('figure');
  const subs=s=>[...s.matchAll(panels)].map(m=>(m[1]||m[2]).toLowerCase());
  if(sorted(subs(a))!==sorted(subs(b)))flag('panel');
  const left=measurements(a.replace(figures,' ')),right=measurements(b.replace(figures,' '));
  const [missing,extra]=unmatched(left.map(v=>v.key),right.map(v=>v.key));
  if(missing.length||extra.length){
    // An indefinite article often becomes 一个/一种. It cannot excuse a
    // missing explicit measurement, a changed value, or any extra value other than 1.
    const zh=from==='en'?target:source,en=from==='en'?source:target;
    const optional=from==='en'?extra:missing, required=from==='en'?missing:extra;
    const articles=(en.match(/\b(?:a|an)\b/gi)||[]).length;
    const classifiers=(zh.match(/一(?:个|种|项|位|名|处|套)/g)||[]).length;
    if(required.length||optional.some(v=>v!=='1')||optional.length>Math.min(articles,classifiers))
      flag('quantity','severe','',{sourceEvidence:missing.map(k=>left.find(v=>v.key===k).label).join(', '),
        targetEvidence:extra.map(k=>right.find(v=>v.key===k).label).join(', ')});
  }
  const lhs=symbolicKeys(source),rhs=symbolicKeys(target);
  if(sorted(lhs)!==sorted(rhs))flag('bound','severe','',{sourceEvidence:lhs.join(', '),targetEvidence:rhs.join(', ')});
  if(from==='en'){
    if(lhs.length&&sorted(lhs)===sorted(rhs)){
      for(const bound of missingBoundRoles(source,target))
        flag('bound','severe','',{sourceEvidence:bound.original,targetEvidence:bound.key});
    }
    for(const assignment of missingAssignments(source,target))
      flag('assignment','severe','',{sourceEvidence:assignment.original});
    const canonical=s=>s.toLowerCase().normalize('NFKC').replace(/\s+/g,'');
    for(const term of chemicalNames(source,terms)){
      if(!canonical(target).includes(canonical(term.value))&&!canonical(target).includes(canonical(term.original)))
        flag('chemical-identity','severe',term.original,{sourceEvidence:term.original});
    }
  }
  const ga=associations(a),gb=associations(b);
  for(const [group,bindings] of ga){
    const other=gb.get(group);
    if(!other||sorted(bindings.keys)!==sorted(other.keys))
      flag('group','severe',group,{sourceEvidence:group+' '+bindings.labels.join(', '),
        targetEvidence:other?group+' '+other.labels.join(', '):''});
  }
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
  if(from==='en'?negationMismatch(a,b):negationMismatch(b,a))flag('negation');
  if(significant(a)&&!significant(b))flag('significance');
  if(from==='en'&&notSignificantEn.test(source)&&!notSignificantZh.test(target))
    flag('significance','severe','',{sourceEvidence:source.match(notSignificantEn)[0]});
  const repeats=from==='en'&&source.match(/\bin (?:duplicate|triplicate|quadruplicate)\b/i);
  if(repeats&&!/重复|复测|平行|一式[二三四两234]|(?:[二三四两234]\s*次)/.test(target))
    flag('replicates','severe','',{sourceEvidence:repeats[0]});
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
