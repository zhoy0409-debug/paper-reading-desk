import {assignedValues,chemicalNames,missingAssignments,missingBoundRoles,symbolicBounds,symbolicKeys} from './translation-anchors.js?rev=evidence2';
import {comparisonText} from './translation-facts.js?rev=evidence2';
const {fieldTerms,resolveField}=await (globalThis.PaperLanguageText?.glossary()??import('./discipline-glossary.js?rev=evidence2'));
// Translate supported scientific constructions from their captured subjects and modifiers.
// Keep the source visible for every passage; opaque identifiers must survive machine translation.
export function normalizeSelection(text){
  const normalized=text.replace(/\u00ad(?:[ \t]*\r?\n[ \t]*)?/g,'')
    .replace(/[ﬀ-ﬆ]/g,ch=>ch.normalize('NFKC'))
    .replace(/\b(mono|di|tri|tetra|per)\s+(?=fluoro[a-z])/gi,'$1');
  return normalized.replace(/(\b[A-Za-z][a-z]+)[-‐‑]\s+([a-z]+)\b/g,(whole,left,right)=>{
    // A repeated spelling in the selection disambiguates a printed line-end hyphen.
    if(new RegExp('\\b'+left+right+'\\b','i').test(normalized)||/^(?:tions?|ments?|vatus|gatus|xazine|idine|uoromethyl)$/i.test(right))
      return left+right;
    return left+'-'+right;
  }).replace(/(\b[A-Z]{2,8}-)\s+(?=[A-Z0-9])/g,'$1')
    .replace(/\b([A-Z][A-Z\d]*\d)\s*\/\s*(?=[A-Z][A-Z\d]*\d\b)/g,'$1/')
    .replace(/\b(vul)-\s+(gatus)\b|\b(experi)-\s+(ments?)\b/gi,(_,a,b,c,d)=>(a||c)+(b||d))
    .replace(/[-‐‑]\s+(?=producing\b|resistant\b|susceptible\b|treated\b)/gi,'-')
    .replace(/\b(vehicle|[a-z]{3,}(?:cillin|penem|mycin|cin))treated\b/gi,'$1-treated').replace(/\s+/g,' ').trim();
}
const terminology=[
  ['attraction-repulsion spectrum','吸引力与排斥力谱'],['neighbor embeddings','邻域嵌入'],['neighbor embedding','邻域嵌入'],
  ['attractive forces','吸引力'],['repulsive forces','排斥力'],['attraction and repulsion','吸引力与排斥力'],
  ['exaggeration parameter','夸大系数'],['kNN graph neighbors','kNN 图上的近邻点'],
  ['t-distributed stochastic neighbor embedding','t 分布随机邻域嵌入'],['immune adaptation','免疫适应'],
  ['neural stem and progenitor cells','神经干细胞和祖细胞'],['neurorepair','神经修复'],
  ['conformational hijacking','构象劫持'],['lipoprotein transporter','脂蛋白转运蛋白'],
  ['precision antimicrobial activity','精准抗菌作用'],
  ['attraction','吸引力'],['repulsion','排斥力'],
  ['distance correlations','距离相关性'],
  ['chemokine signaling networks','趋化因子信号网络'],['skeletal disorders','骨骼疾病'],
  ['chemokine-mediated signaling cascades','趋化因子介导的信号级联'],['chemokine axes','趋化因子轴'],
  ['pharyngeal neuronal','咽部神经元'],['sour taste perception','酸味感知'],['Drosophila melanogaster','黑腹果蝇'],
  ['single-cell RNA sequencing algorithms','单细胞 RNA 测序算法'],['single-molecule RNA imaging','单分子 RNA 成像'],
  ['changes in transcriptional noise','转录噪声的变化'],
  ['osteogenesis','成骨作用'],['osteoclastogenesis','破骨细胞形成'],['osteoporosis','骨质疏松症'],['osteoarthritis','骨关节炎'],
  ['osteoblasts','成骨细胞'],['osteoclasts','破骨细胞'],['bone resorption','骨吸收'],['bone remodeling','骨重塑'],
  ['skeletal homeostasis','骨稳态'],['bone homeostasis','骨稳态'],['bone microenvironment','骨微环境'],
  ['bone remodeling and regeneration','骨重塑和骨再生'],['inflammatory bone loss','炎症性骨丢失'],['tissue regeneration','组织再生'],
  ['multiple myeloma','多发性骨髓瘤'],['bone metastasis','骨转移'],['chemokine','趋化因子'],
  ['receptor redundancy','受体冗余'],['context-dependent specificity','情境依赖的特异性'],['in vivo validation','体内验证'],
  ['limited in vivo validation','体内验证有限'],['canonical pathways','经典通路'],['cellular communication','细胞间通讯'],
  ['translational barriers','转化障碍'],['graph kernels','图核'],['graph kernel','图核'],
  ['graph classification','图分类'],['classification tasks on graphs','图分类任务'],['graph features','图特征'],['kernel-based','基于核方法的'],
  ['extended-spectrum β-lactamase','超广谱 β-内酰胺酶'],['clinical isolates','临床分离株'],
  ['Gram-negative pathogens','革兰阴性病原菌'],['gut commensal bacteria','肠道共生菌'],
  ['carbapenem-resistant','耐碳青霉烯类'],['carbapenem-susceptible','对碳青霉烯类敏感的'],
  ['Acinetobacter baumannii','鲍曼不动杆菌'],['A. baumannii','鲍曼不动杆菌'],['Escherichia coli','大肠埃希菌'],['E. coli','大肠埃希菌'],
  ['Klebsiella pneumoniae','肺炎克雷伯菌'],['Bacteroides vulgatus','普通拟杆菌'],['Bacteroides thetaiotaomicron','多形拟杆菌'],['Bacteroides fragilis','脆弱拟杆菌'],
  ['scanning electron microscopy','扫描电子显微镜'],['transmission electron microscopy','透射电子显微镜'],['wild-type','野生型'],
  ['murine lung infection model','小鼠肺部感染模型'],['murine pneumonia model','小鼠肺炎模型'],['lipoprotein trafficking','脂蛋白转运'],
  ['single-crop testing','单裁剪测试'],['multi-crop testing','多裁剪测试'],['learned parameters','模型参数量'],['FLOPs','浮点运算次数（FLOPs）'],
  ['Staphylococcus aureus','金黄色葡萄球菌'],['S. aureus','金黄色葡萄球菌'],['impetigo','脓疱疮'],
  ['atopic dermatitis','特应性皮炎'],['pruriceptors','瘙痒感受神经元'],['pruriceptor','瘙痒感受神经元'],
  ['pruritic conditions','瘙痒性疾病'],['eczematous lesions','湿疹样皮损'],['itchy lesions','伴瘙痒的皮损'],
  ['nonlesional skin','非皮损皮肤'],['non-lesional skin','非皮损皮肤'],['lesional skin','皮损皮肤'],
  ['skin swabs','皮肤拭子'],['host-directed therapy','宿主靶向治疗'],
  ['outer membrane vesicles','外膜囊泡'],['cytotoxicity','细胞毒性'],
  ['distance modulus','距离模数'],['redshift','红移'],['minimum inhibitory concentration','最低抑菌浓度'],['abaucin','abaucin']
];
const exactNames=new Map(terminology);
function modelText(value){
  if(typeof value!=='string'||!value.trim())throw Object.assign(new Error('The translation engine returned no text'),{stage:'empty'});
  return value.trim();
}
function validation(reason,detail){
  return Object.assign(new Error(detail),{stage:'validation',reason});
}
// Chemical names in a structure description must survive even when the MT model
// substitutes a different compound. A supplied subject glossary can localize them.
function compounds(s,domain){
  const spans=chemicalNames(s,domain);
  if(!/\b(?:chemical|moiet(?:y|ies)|functional groups?|substituents?|molecul\w*)\b/i.test(s))return spans;
  const chemical=/\b([a-z][a-z\d-]*(?:oxazine|azine|idine|anone|azole|amide|phenyl|alkyl|ethyl|enoate))\b(\s+groups?\b)?/gi;
  for(const m of s.matchAll(chemical)){
    if(spans.some(term=>term.index<=m.index&&m.index<term.index+term.original.length))continue;
    if(domain.some(term=>term.index<=m.index&&term.index+term.original.length>=m.index+m[0].length))continue;
    const name=domain.find(term=>term.index===m.index&&term.original===m[1])?.value??m[1];
    const suffix=m[2]?(/[\u3400-\u9fff]$/.test(name)?'基团':' 基团'):'';
    spans.push({index:m.index,original:m[0],value:name+suffix});
  }
  return spans;
}
const figureRef=/(?:\b(?:fig(?:ure)?s?)\.?\s*|图\s*)(S?\d+[a-z]?(?:\s*[-–]\s*(?:S?\d+)?[a-z])?)(?![a-z\d])/gi;
const concentration=/(?:\d+(?:\.\d+)?|\.\d+)\s*(?:(?:[fpnumµμk]?g|[fpnumµμ]?mol)\s*\/\s*(?:[mdµμu]?L)|[fpnumµμ]?M)(?![a-zA-Z])/g;
const matches=(s,re,key)=>Array.from(s.matchAll(re),key).sort().join('|');
const figures=s=>matches(s,figureRef,m=>m[1].toLowerCase().replace(/\s/g,'').replace(/–/g,'-'));
const concentrations=s=>matches(s.replace(/毫克/g,'mg').replace(/微克/g,'μg').replace(/纳克/g,'ng')
  .replace(/毫升/g,'mL').replace(/微升/g,'μL').replace(/升/g,'L'),concentration,m=>m[0].replace(/\s/g,'').replace(/[µu]/g,'μ'));
const readableProse=s=>s.replace(/\bstructural moieties\b/gi,'structural units');
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
// Caption noun phrases bind a modality, two subjects and an optional treatment contrast.
function microscopyCaption(sentence){
  const match=sentence.match(/^(?:Representative\s+)?(scanning electron microscopy|transmission electron microscopy|fluorescence microscopy|confocal microscopy)(?:\s*\(([A-Z]{2,6})\))?\s+(?:images?|micrographs?) of (?:the )?wild[- ]type ([A-Z][a-z]*\.?\s+[a-z][a-z-]+) and (?:the )?corresponding ([A-Za-z][\w.-]*(?:\s+and\s+[A-Za-z][\w.-]*)?) mutant strains?(?: (with or without|with|without) ([\w-]+) treatment)?[.]?$/i);
  if(!match)return null;
  const [,method,abbr,species,variants,condition,drug]=match;
  const name={'scanning electron microscopy':'扫描电子显微镜','transmission electron microscopy':'透射电子显微镜','fluorescence microscopy':'荧光显微镜','confocal microscopy':'共聚焦显微镜'}[method.toLowerCase()];
  const exposure=!condition?'':condition.toLowerCase()==='with or without'?'，比较经 '+drug+' 处理和未经该药处理两种条件':condition.toLowerCase()==='without'?'，样本未经 '+drug+' 处理':'，样本经 '+drug+' 处理';
  return '这组'+name+(abbr?'（'+abbr+'）':'')+'图像展示了野生型 '+species+' 及相应的 '+variants.replace(/\s+and\s+/i,' 和 ')+' 突变株'+exposure+'。';
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
  return normalizeSelection(text).replace(/\bFigs\.\s*(?=\d)/gi,'Figures ').replace(/\bFig\.\s*(?=\d)/gi,'Figure ').split(/(?<!\b[A-Z])(?<!\bFig)(?<=[.!?])\s+(?=[A-Z]|n\s*=)/).reduce((out,s)=>{
    if(out.length&&/(?:\b[A-Z]|\bFig|\bet al)\.$/.test(out.at(-1)))out[out.length-1]+=' '+s;else out.push(s);return out;
  },[]);
}
// These caption constructions bind the population to its specimen, or a readout
// to its assay and comparison. Identifiers are copied from the source sentence.
function quantitativeCaption(sentence){
  const repeats=sentence.match(/^n\s*=\s*(\d+)\s+independent (experiments|replicates)\.?$/i);
  if(repeats)return '独立'+(repeats[2].toLowerCase()==='experiments'?'实验':'重复')+'次数（n）为 '+repeats[1]+'。';
  const samples=sentence.match(/^(?:Quantification|Measurement) of ([\w.-]+ (?:mRNA|DNA|RNA|protein)) (?:from|in) (skin swabs|skin biopsies|tissue samples) from (?:healthy (?:human subjects|participants|controls|volunteers)) (?:or|and) (non[- ]?lesional|lesional) and (non[- ]?lesional|lesional) skin from (.+?) patients\s*\(n\s*=\s*(\d+(?:\s*[-–]\s*\d+)?) per group\)\.?$/i);
  if(samples){
    const [,target,material,first,second,patients,count]=samples;
    const sample={'skin swabs':'皮肤拭子','skin biopsies':'皮肤活检标本','tissue samples':'组织标本'}[material.toLowerCase()];
    const site=s=>/^non/i.test(s)?'非皮损皮肤':'皮损皮肤';
    return '定量测定'+sample+'中的 '+target.replace(/ protein$/i,' 蛋白')+'。样本分别来自健康受试者的皮肤、'+patients+' 患者的'+site(first)+'和'+site(second)+'（每组 n = '+count.replace(/\s*[-–]\s*/,'–')+'）。';
  }
  const assay=sentence.match(/^(?:Quantification|Measurement) of (.+?) (mRNA|protein) levels by ([\w-]+) in ([A-Za-z][\w.-]*) cells (infected with|exposed to) ([A-Za-z][\w.-]*(?:\s+[\w.-]+)?)\s*\((\d+(?:\.\d+)?)\s+(hpi|h)\) (with or without|without|with) ([A-Za-z][\w.-]*) treatment\s*\((\d+(?:\.\d+)?)\s*([μµu]M|nM|mM|[μµu]g\/mL)\)\.?$/i);
  if(assay){
    const [,names,measure,method,cells,exposure,agent,time,unit,contrast,compound,amount,concentration]=assay;
    const genes=names.split(/,\s*(?:and\s+)?|\s+and\s+/i);
    if(!genes.every(v=>/^[A-Za-z0-9][\w.-]*$/.test(v)))return null;
    const value=amount+' '+concentration.replace(/^[µu]/,'μ'),drug=value+' '+compound;
    const groups=contrast.toLowerCase()==='with or without'?'比较经 '+drug+' 处理和未经该药处理的两组':contrast.toLowerCase()==='without'?'细胞未经 '+drug+' 处理':'细胞经 '+drug+' 处理';
    const subject=exactNames.get(agent)||agent;
    const readout=measure.toLowerCase()==='protein'?'蛋白':measure;
    return '采用 '+method+' 定量测定 '+cells+' 细胞中 '+genes.join('、')+' 的 '+readout+' 水平。细胞'+(exposure.toLowerCase()==='infected with'?'感染':'接触')+subject+'后 '+time+' h'+(unit.toLowerCase()==='hpi'?'（hpi）':'')+'进行测定，'+groups+'。';
  }
  return null;
}
// Keep definitions and hypotheses grammatical when several scientific terms in
// the same clause would otherwise be translated as disconnected fragments.
function clinicalStatement(sentence){
  const terms=new Map([...terminology.map(([key,value])=>[key.toLowerCase(),value]),
    ['skin disease','皮肤病'],['skin disorder','皮肤疾病'],['contagious skin infection','传染性皮肤感染'],
    ['skin damage','皮肤损伤'],['tissue damage','组织损伤'],['inflammation','炎症'],['pain','疼痛'],
    ['itch','瘙痒'],['sensory neurons','感觉神经元'],['specific microbes','特定微生物'],
    ['mechanical stimuli','机械刺激'],['heat','热刺激'],['itchy, eczematous lesions','伴瘙痒的湿疹样皮损']]);
  const lookup=s=>terms.get(s.toLowerCase());
  const body=sentence.replace(/\s+\d+(?:[–,-]\d+)*\s*\.$/,'.');
  const definition=body.match(/^(.+?)(?: \(([A-Z][\w-]*)\))? is an? (.+?) characterized by (.+?)\.$/i);
  if(definition){
    const [,name,abbr,type,feature]=definition;
    if([name,type,feature].every(lookup))return lookup(name)+(abbr?'（'+abbr+'）':'')+'是一种'+lookup(type)+'，其特征是'+lookup(feature)+'。';
  }
  const cause=body.match(/^(.+?) is (?:also )?a leading cause of (.+?), an? (.+?) characterized by (.+?)\.$/i);
  if(cause&&cause.slice(1).every(lookup)){
    const [,agent,condition,type,symptom]=cause.map((s,i)=>i?lookup(s):s);
    return agent+'是引起'+condition+'的主要原因之一。'+condition+'是一种'+type+'，典型表现为'+symptom+'。';
  }
  const hypothesis=body.match(/^We hypothesi[sz]ed that (.+?) (?:may\s*be|might be|could be) activated (?:following|after) exposure to (.+?), resulting in (.+?) that (?:drives|causes) (.+?)\.$/i);
  if(hypothesis&&hypothesis.slice(1).every(lookup)){
    const [,cells,stimulus,response,outcome]=hypothesis.map((s,i)=>i?lookup(s):s);
    return '作者推测，接触'+stimulus+'可能激活'+cells+'，由此引发的'+response+'会进一步造成'+outcome+'。';
  }
  return null;
}
// Parenthesized panel positions describe different variables. Translate each association
// separately so a missing qualifier cannot silently transfer a variable to the other panel.
function comparisonCaption(body){
  const panels=body.match(/^(.+?)\s+as a function of\s+(.+?)\s+\((left|right)\)\s+and\s+(.+?)\s+\((left|right)\)[.]?$/i);
  if(!panels||panels[3].toLowerCase()===panels[5].toLowerCase())return null;
  const metric=panels[1].match(/^Comparison of (?:the )?([\w.-]+) and ([\w.-]+)\s+(top[- ](\d+)\s+(error rates?|accurac(?:y|ies)))(?:\s*\((single|multi)[- ]crop testing\))?\s+on (?:the )?([\w.-]+)\s+(validation|test|training)\s+(?:data\s*set|set)$/i);
  if(!metric)return null;
  function variable(value){
    if(/^(?:learned|trainable|model) parameters$|^(?:the )?number of (?:learned |trainable |model )?parameters$/i.test(value))return '模型参数量';
    if(/^FLOPs(?: during test[- ]time| at inference)?$/i.test(value))return (/\b(?:test|inference)\b/i.test(value)?'推理时的':'')+'浮点运算次数（FLOPs）';
    if(/^(?:training )?epochs?$/i.test(value))return '训练轮次';
    return null;
  }
  const first=variable(panels[2]),second=variable(panels[4]);
  if(!first||!second)return null;
  const dataset={validation:'验证集',test:'测试集',training:'训练集'}[metric[8].toLowerCase()];
  const crop=metric[6]?'（'+(metric[6].toLowerCase()==='single'?'单':'多')+'裁剪测试）':'';
  const side=s=>s.toLowerCase()==='left'?'左图':'右图';
  return '比较 '+metric[1]+' 和 '+metric[2]+' 在 '+metric[7]+' '+dataset+'上的 Top-'+metric[4]+(/^error/i.test(metric[5])?' 错误率':' 准确率')+crop+'。'+side(panels[3])+'横轴为'+first+'，'+side(panels[5])+'横轴为'+second+'。';
}
async function academicAim(s,translate,field){
  const phrase=text=>/^(?:[A-Z][A-Z\d/-]*|pH|t-SNE|kNN)$/.test(text)?text:mapChinese(text,translate,{field});
  const spaced=text=>/^[a-z\d]/i.test(text)?' '+text:text;
  const mechanism=s.match(/^Conformational hijacking of (.+?) ([A-Z][A-Za-z\d-]+) enables (.+?) against\s*([A-Z][a-z.]+ [a-z]+)[.]?$/i);
  if(mechanism)return '通过劫持'+(await phrase(mechanism[1]))+' '+mechanism[2]+' 的构象，实现对'+(await phrase(mechanism[4]))+'的'+(await phrase(mechanism[3]))+'。';
  const regulation=s.match(/^What (.+?) mechanisms govern (.+?) in (.+?)\?$/i);
  if(regulation)return (await phrase(regulation[3]))+'的'+(await phrase(regulation[2]))+'受哪些'+(await phrase(regulation[1]))+'机制调控？';
  const estimate=s.match(/^How do (.+?) and (.+?) compare when estimating (.+?)\?$/i);
  if(estimate)return '在估计'+(await phrase(estimate[3]))+'时，'+(await phrase(estimate[1]))+'与'+(await phrase(estimate[2]))+'的结果有何差异？';
  const crosstalk=s.match(/^This review (?:examines how|synthesi[sz]es current insights into how) (.+?) intersects? with (.+?) such as (.+?) to coordinate (.+?) (?:within|in) (?:the )?(.+?)\.$/i);
  if(crosstalk){
    const [,signal,networks,examples,process,setting]=crosstalk;
    const list=examples.split(/,\s*(?:and\s+)?|\s+and\s+/i);
    if(list.every(name=>/^[A-Za-zΑ-ω0-9][\wΑ-ω./-]*$/u.test(name))){
      return '本综述探讨'+(await phrase(signal))+'如何与 '+list.join('、')+' 等'+(await phrase(networks))+'相互作用，从而协调'+(await phrase(setting))+'中的'+(await phrase(process))+'。';
    }
  }
  const therapy=s.match(/^This review highlights recent (?:progress|advances) in therapeutic strategies targeting (.+?) to (?:mitigate|reduce) (.+?) and promote ([^,;:.]+)\.$/i);
  if(therapy)return '本综述梳理了靶向'+(await phrase(therapy[1]))+'的治疗策略在减轻'+(await phrase(therapy[2]))+'和促进'+(await phrase(therapy[3]))+'方面的最新进展。';
  const compared=s.match(/^We compared (.+?) embeddings and (.+?) embeddings using (.+?) across values of ([A-Za-zα-ωΑ-Ω]+)\.$/i);
  if(compared)return '在不同的 '+compared[4]+' 取值下，用'+(await phrase(compared[3]))+'比较 '+compared[1].replace(/\s*&\s*/g,'、')+' 的嵌入结果与 '+compared[2]+' 的嵌入结果。';
  const balance=s.match(/^How does the balance between (.+?) and (.+?) shape (.+?)\?$/i);
  if(balance)return (await phrase(balance[1]))+'与'+(await phrase(balance[2]))+'之间的平衡如何影响'+(await phrase(balance[3]))+'？';
  const target=s.match(/^What evidence supports targeting (.+?) to treat (.+?)\?$/i);
  if(target)return '靶向'+(await phrase(target[1]))+'治疗'+(await phrase(target[2]))+'有哪些依据？';
  const cellular=s.match(/^How does ([A-Za-z][\w-]{1,16}) instruct (.+?) to (?:promote|potentiate) (.+?) after (.+?)\?$/i);
  if(cellular)return cellular[1]+' 如何调控'+(await phrase(cellular[2]))+'，促进'+(await phrase(cellular[4]))+'后的'+(await phrase(cellular[3]))+'？';
  const framework=s.match(/^we (?:provide|present|develop) a (?:unified|unifying) (?:account|framework) (?:of|for) (.+?)\.$/i);
  if(framework)return '用统一框架解释'+spaced(await phrase(framework[1]))+'。';
  const factor=s.match(/^we (?:study|examine|investigate|assess) how changing (.+?) affects (.+?)\.$/i);
  if(factor){
    const forces=factor[1].match(/^(?:the )?(attractive|repulsive) forces between (.+)$/i);
    const variable=forces?(await phrase(forces[2]))+'之间的'+(/^attractive$/i.test(forces[1])?'吸引力':'排斥力'):await phrase(factor[1]);
    const embedding=factor[2].match(/^the spectrum of ([A-Za-z][\w-]{1,20}) embeddings$/i);
    const response=embedding?embedding[1]+' 的一系列嵌入结果':await phrase(factor[2]);
    return '考察'+spaced(response)+'如何随'+spaced(variable)+'变化。';
  }
  const role=s.match(/^we (?:investigated|examined|assessed|evaluated) the role of ([A-Za-z][\w-]{1,16}) in (.+?)\.$/i);
  if(role){
    const recovery=role[2].match(/^(.+?) during the recovery phase (?:post[- ]stroke|after stroke)$/i);
    const setting=recovery?'卒中恢复期'+await phrase(recovery[1]):await phrase(role[2]);
    return '考察 '+role[1]+' 在'+setting+'中的作用。';
  }
}
// Experimental captions frequently list the treatment groups as adjectives before
// the specimen. Keep each group and the measured outcome in their printed order.
function treatmentCaption(sentence,field){
  if(!['medicine','life'].includes(field))return null;
  const stats=sentence.match(/\s*\(n\s*=\s*(\d+)\s*[,;]\s*(\**)[pP]\s*([<>=≤≥])\s*(\d+(?:\.\d+)?)\s*;\s*ns,?\s*not significant\)\.?$/i);
  const body=(stats?sentence.slice(0,stats.index):sentence).replace(/\.$/,'');
  const specimen=body.match(/^(Lung tissue|Liver tissue|Kidney tissue|Plasma|Serum) from (.+?) (mice|rats)(?: in (?:the |a )?([\w-]+)-induced (pneumonia|injury|inflammation) model)?$/i);
  const levels=body.match(/^(?:Concentrations?|Levels?) of ([\w\p{L}.-]+)(?: \(([a-z])\) and ([\w\p{L}.-]+) \(([a-z])\))? in (BALF|plasma|serum) from (.+?) (mice|rats)$/iu);
  const outcome=body.match(/^(Body weight changes|Minute ventilation)(\s*\([^()]+\))? in (.+?)(?: (mice|rats))?( over the course of (?:infection|treatment)| with [\w-]+-induced pneumonia)?$/i);
  if(!specimen&&!levels&&!outcome)return null;
  const groups=specimen?.[2]||levels?.[6]||outcome[3];
  const labels=groups.split(/\s*,\s*(?:and\s+)?|\s+and\s+/i).map(g=>{
    const token=g.replace(/\s+(?:mice|rats)$/i,'');
    if(/^sham$/i.test(token))return '模拟处理组';
    if(/^vehicle(?:-treated)?$/i.test(token))return '溶媒对照组';
    const drug=token.match(/^([A-Za-z][\w.-]*)-treated$/i);
    if(!drug)return null;
    const term=fieldTerms(drug[1],field).find(m=>m.original.length===drug[1].length);
    const name=term?.value||drug[1];
    return name+(/[A-Za-z\d]$/.test(name)?' 组':'组');
  });
  if(labels.length<2||labels.some(s=>!s))return null;
  const material={'lung tissue':'肺组织','liver tissue':'肝组织','kidney tissue':'肾组织',plasma:'血浆',serum:'血清',balf:'支气管肺泡灌洗液（BALF）'};
  const animals=specimen?.[3]||levels?.[7]||outcome?.[4]||(/\bmice\b/i.test(groups)?'mice':/\brats\b/i.test(groups)?'rats':'');
  const what=animals.toLowerCase()==='mice'?'小鼠':animals.toLowerCase()==='rats'?'大鼠':'';
  const list=labels.slice(0,-1).join('、')+'和'+labels.at(-1);
  let result;
  if(specimen){
    const model=specimen[4]?specimen[4]+' 诱导的'+({pneumonia:'肺炎',injury:'损伤',inflammation:'炎症'})[specimen[5].toLowerCase()]+'模型中':'';
    result='图中展示了'+model+list+what+'的'+material[specimen[1].toLowerCase()];
  }else if(levels){
    const measures=levels[3]?levels[1]+'（'+levels[2]+'）和 '+levels[3]+'（'+levels[4]+'）':levels[1];
    result='比较'+list+what+material[levels[5].toLowerCase()]+'中的 '+measures+(/^levels?/i.test(body)?' 水平':' 浓度');
  }else{
    const time=(outcome[5]||'').trim();
    const model=time.match(/^with ([\w-]+)-induced pneumonia$/i);
    const context=model?model[1]+' 诱导的肺炎模型中，':time.endsWith('infection')?'感染期间，':time.endsWith('treatment')?'处理期间，':'';
    result=context+'比较'+list+what+'的'+(/^Body/i.test(outcome[1])?'体重变化':'每分钟通气量')+(outcome[2]?.trim().replace('(','（').replace(')','）')||'');
  }
  if(stats)result+='（n = '+stats[1]+'，'+stats[2]+'P '+stats[3]+' '+stats[4]+'，ns 表示差异无统计学意义）';
  return result+'。';
}
export async function translatePassage(original,from,translate,{field='auto'}={}){
  if(from!=='en')return {text:modelText(await translate(original,from)),warnings:[]};
  field=resolveField(field,original);
  const lines=[],warnings=[],issues=[],candidates=[];
  for(const s of sentences(original)){
    const matched=fieldTerms(s,field);
    if(matched.length===1&&matched[0].original.length===s.length){lines.push(matched[0].value);continue}
    const accepts=value=>value&&(!field.terms||matched.every(m=>value.includes(m.value)));
    const checked=microscopyCaption(s)||quantitativeCaption(s)||clinicalStatement(s)||assay(s)||treatmentCaption(s,field);
    if(accepts(checked)){lines.push(checked);continue}
    const normalized=s.replace(/[‐‑–—]/g,'-').toLowerCase();
    const exact=terminology.find(([en])=>normalized===en.toLowerCase());
    if(exact){lines.push(exact[1]);continue}
    const named=s.match(/^(.+?)\s+\(([A-Z]{2,8})\)\s+(algorithms?|models?|methods?)\.?$/i);
    const stem=named&&terminology.find(([en])=>en.toLowerCase()===named[1].toLowerCase());
    if(stem){lines.push(stem[1]+'（'+named[2]+'）'+(/algorithm/i.test(named[3])?'算法':/model/i.test(named[3])?'模型':'方法'));continue}
    const aim=await academicAim(s,translate,field).catch(error=>{
      if(error.stage==='validation')return null;
      throw error;
    });
    if(accepts(aim)){lines.push(aim);continue}
    const inTitle=normalized.match(/^(.+?) in (.+?)$/);
    if(inTitle){
      const terms=inTitle.slice(1).map(part=>terminology.find(([en])=>en.toLowerCase()===part)?.[1]);
      if(terms.every(Boolean)){lines.push(terms[1]+'中的'+terms[0]);continue}
    }
    const fig=s.match(/^(?:Fig(?:ure)?\.?)\s*([S\d]+[a-z]?)\s*(?:[|.:]\s*)?/i);
    const body=fig?s.slice(fig[0].length):s;
    const parallel=comparisonCaption(body);
    if(parallel){lines.push((fig?'图 '+fig[1]+'　':'')+parallel);continue}
    const keys=[...new Set([...body.matchAll(/\b(?:q(?:RT-)?PCR|mRNA|[A-Z]\d+[\w-]*|[A-Z]{2,8}-[A-Z0-9]+(?:[-–][A-Z0-9]+)*|[A-Z]{2,}\d*|[A-Z][a-z]+[A-Z][A-Za-z\d]*|[Aa]baucin)\b/g)].map(m=>m[0]))];
    const terms=terminology.filter(([en])=>body.toLowerCase().includes(en.toLowerCase())&&
      !matched.some(m=>m.original.toLowerCase().includes(en.toLowerCase())));
    const prepared=readableProse(body).replace(/\bIn cellulo validation\b/gi,'Validation in cells').replace(/\bin cellulo\b/gi,'in cells').replace(/\bmaybe (?=activated\b)/gi,'may be ');
    let result=body?modelText(await translate(prepared,from)):'';
    if(fig)result=result.replace(new RegExp('^(?:图\\s*|Figure\\s+)'+fig[1]+'(?![a-z\\d])\\s*[|.:：]?\\s*','i'),'');
    // Correct unambiguous terminology in the complete translation before trying
    // placeholders. This preserves the verb and its dependent clauses.
    const variants=[
      ['canonical pathways',/(?:佳能|规范)(?:通路|途径)/g,'经典通路'],
      ['cellular communication',/细胞(?:间)?通信/g,'细胞间通讯'],
      ['bone microenvironment',/骨骼微环境/g,'骨微环境'],
      ['limited in vivo validation',/有限的体内验证/g,'体内验证有限'],
      ['context-dependent specificity',/上下文依赖性特异性/g,'情境依赖的特异性'],
      ['inflammatory bone loss',/炎症性骨质流失/g,'炎症性骨丢失']
    ];
    for(const [source,variant,term] of variants)if(terms.some(([en])=>en===source))result=result.replace(variant,term);
    if(/\bintersects? with\b/i.test(body)&&/\bpathways?\b/i.test(body))result=result.replace(/相交(?=[，,。]|以)/g,'发生交叉作用');
    if(/remain(?:s)? (?:insufficiently|poorly|incompletely) characteri[sz]ed[.!]?$/i.test(body))
      result=result.replace(/(?:仍然|仍|还)?不足[。.]?$/,'尚未得到充分研究。');
    if(/\bTimer probe\b/.test(body))result=result.replace(/定时器探针/g,'Timer 探针');
    if(/\bneurorepair\b/i.test(body)&&/\bstroke\b/i.test(body))result=result.replace(/中风/g,'卒中').replace(/指示(?=(?:神经|细胞))/g,'引导');
    if(/\b(?:t-SNE|UMAP|neighbor embeddings?)\b/i.test(body)&&/\bspectrum\b/i.test(body))result=result.replace(/(?:光谱|频谱)/g,'变化谱');
    if(/\blog[- ]posterior\b/i.test(body))result=result.replace(/日志后部|对数后部/g,'对数后验');
    if(/\b(?:imaging|image[- ]based|analysis|processing|data) pipeline\b/i.test(body))result=result.replace(/管道/g,'分析流程');
    // Translators often spell out standard abbreviations. Keep the original token searchable as well.
    const expanded={SEM:'扫描电子显微镜',TEM:'透射电子显微镜',TB:'结核病',DNA:'脱氧核糖核酸',RNA:'核糖核酸',MRI:'磁共振成像',ATP:'三磷酸腺苷',PCR:'聚合酶链式反应'};
    for(const k of keys){
      if(expanded[k]&&!result.includes(k)&&result.includes(expanded[k]))result=result.replace(expanded[k],expanded[k]+'（'+k+'）');
    }
    if(/\bresiduals?\b/i.test(body)&&/\b(?:cosmolog\w*|Hubble|best[- ]fit|distance modul\w*)\b/i.test(body))
      result=result.replace(/残余物|残留物|残余量/g,'残差').replace(/最适合的宇宙学(?!模型)/g,'最佳拟合宇宙学模型');
    if(/\b(?:single|multi)[- ]crop testing\b/i.test(body))
      result=result.replace(/单(?:一)?作物测试/g,'单裁剪测试').replace(/多(?:种)?作物测试/g,'多裁剪测试');
    if(/\bcontributing to the pathogenesis of\b/i.test(body))
      result=result.replace(/(?:促成|导致)了([^。！？]{2,150})的发病机制/g,'参与$1的发病过程');
    if(/\bintegrating\b.+\bwith the processes of\b/i.test(body))
      result=result.replace(/将([^。！？]{2,100}?)与([^。！？]{2,70}?)的过程相结合/g,'将$1与$2联系起来');
    const missingSide=['left','right'].some((side,i)=>new RegExp('\\('+side+'\\)','i').test(body)&&!result.includes(i?'右':'左'));
    const numericTokens=s=>(s.match(/(?:[<>≤≥−-]\s*)?\d+(?:\.\d+)?/g)||[]).map(n=>n.replace(/\s/g,'')).sort().join('|');
    const equalNumbers=numericTokens(body)===numericTokens(result)||numericTokens(comparisonText(body))===numericTokens(comparisonText(result));
    const panelRefs=s=>Array.from(s.matchAll(/\(([a-z])\)|[（(]([a-z])[)）]|(?:图|小图)\s*([a-z])\b/gi),m=>(m[1]||m[2]||m[3]).toLowerCase()).sort().join(',');
    const bounds=symbolicKeys(body);
    const facts=missingSide||!equalNumbers||figures(body)!==figures(result)||concentrations(body)!==concentrations(result)||
      (bounds.length&&(bounds.sort().join('|')!==symbolicKeys(result).sort().join('|')||missingBoundRoles(body,result).length>0))||missingAssignments(body,result).length>0||
      keys.some(k=>!result.includes(k)&&!matched.some(m=>m.original===k&&result.includes(m.value)))||
      panelRefs(body)!==panelRefs(result)||(/\b(?:not|no|without)\b/i.test(body)&&!/[无不未没非]/.test(result));
    const missingTerm=matched.some(m=>!result.includes(m.value))||terms.some(([en,zh])=>!result.toLowerCase().includes(en.toLowerCase())&&!result.includes(zh))||
      compounds(body,fig?fieldTerms(body,field):matched).some(c=>!result.includes(c.value));
    const echoed=body&&body===result&&/[a-z]{2}/i.test(body);
    if(facts||missingTerm||echoed){
      candidates.push({source:s,text:(fig?'图 '+fig[1]+'　':'')+result,reason:facts?'facts':missingTerm?'terms':'target'});
      issues.push(facts?'facts':missingTerm?'terms':'target');
      warnings.push(s);result=body+(terms.length?'\n'+terms.map(([en,zh])=>en+' · '+zh).join('　'):'');
    }
    lines.push((fig?'图 '+fig[1]+'　':'')+result);
  }
  return {text:lines.join('\n\n'),warnings,issues,candidates};
}
// A scientific sentence can lose a number or identifier during translation.
// Retry with protected spans, then run the same factual checks again.
export async function mapChinese(source,translate,{keepLatinNames=false,field='auto',onFragmentRecovery}={}){
  field=resolveField(field,source);
  const han=/[\u3400-\u9fff]/u;
  const names=new Map(terminology.map(([en,zh])=>[en.toLowerCase(),zh]));
  names.set('(left)','（左图）');names.set('(right)','（右图）');
  const escaped=[...names.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[\-\/\\^$*+?.()|[\]{}]/g,'\\$&'));
  const technical=/\((?:left|right)\)|\b[A-Z]\.\s+[a-z]{3,}\b|\b(?:q(?:RT-)?PCR|mRNA|[A-Z]\d+[\w-]*)\b|\([A-Za-z]\)|\b[A-Z][a-z]+[A-Z][\w-]*\b|\b[A-Z]{2,}[\w/-]*\b|(?:[<>≤≥−-]\s*)?\d+(?:[.]\d+)?(?:[%²³])?/g;
  const pattern=escaped.map(v=>v.replace(/[a-z]/gi,c=>'['+c.toUpperCase()+c.toLowerCase()+']')).join('|');
  const anchors=new RegExp(pattern+'|'+technical.source,'g');
  function spans(s){
    const domain=fieldTerms(s,field);
    const identifiers=Array.from(s.matchAll(anchors),m=>{
      const value=names.get(m[0].toLowerCase());
      return {index:m.index,original:m[0],value:value&&value!==m[0].toLowerCase()?value:m[0]};
    });
    const protectedSpans=[...domain,...compounds(s,domain),...symbolicBounds(s),...assignedValues(s),
      ...Array.from(s.matchAll(/(?<![A-Za-z\d])[A-Za-zα-ω][₀-₉]+/giu),m=>({index:m.index,original:m[0],value:m[0]})),
      ...Array.from(s.matchAll(figureRef),m=>({index:m.index,original:m[0],value:'图 '+m[1]})),
      ...Array.from(s.matchAll(concentration),m=>({index:m.index,original:m[0],value:m[0]})),...identifiers];
    const result=[];
    for(const match of protectedSpans.sort((a,b)=>a.index-b.index||b.original.length-a.original.length)){
      const last=result.at(-1);
      if(!last||match.index>=last.index+last.original.length)result.push(match);
    }
    return result;
  }
  async function protectedSentence(s){
    const pieces=[];let end=0,sawProse=false,translatedProse=false;
    async function prose(value){
      if(!/[a-z]{2}/i.test(value))return value;
      sawProse=true;
      const text=modelText(await translate(readableProse(value.trim()),'en'));
      if(han.test(text))translatedProse=true;
      if(!han.test(text)&&/[a-z]{3,}\s+[a-z]{3,}/i.test(text))throw validation('target','Prose has no Chinese translation');
      return text;
    }
    for(const match of spans(s)){
      pieces.push(await prose(s.slice(end,match.index)),match.value);
      end=match.index+match.original.length;
    }
    pieces.push(await prose(s.slice(end)));
    if(sawProse&&!translatedProse)throw validation('target','Only protected labels were localized');
    return pieces.filter(Boolean).join(' ').trim();
  }
  const parts=[];
  for(const s of sentences(source)){
    let result=await translatePassage(s,'en',translate,{field});
    const firstCandidate=result.candidates?.[0];
    if(result.warnings.length||!han.test(result.text)){
      if(translate.withTerms){
        const pieces=[];let end=0;
        for(const match of spans(s)){
          pieces.push(s.slice(end,match.index),match);
          end=match.index+match.original.length;
        }
        pieces.push(s.slice(end));
        const aligned=await translate.withTerms(pieces.map(part=>typeof part==='string'?readableProse(part):part));
        if(aligned&&han.test(aligned))result=await translatePassage(s,'en',async()=>aligned,{field});
      }
      if(result.warnings.length||!han.test(result.text)){
        let localized;
        onFragmentRecovery?.(s);
        try{localized=await protectedSentence(s)}
        catch(cause){
          if(cause.stage!=='validation'||!result.issues?.length)throw cause;
          throw Object.assign(validation(result.issues[0],'Protected translation still failed the source checks'),{cause,candidate:firstCandidate});
        }
        result=await translatePassage(s,'en',async()=>localized,{field});
      }
    }
    if(result.warnings.length||!han.test(result.text))
      throw Object.assign(validation(result.issues?.[0]||'target','Translated passage did not preserve the source evidence'),{candidate:firstCandidate});
    let localized=result.text.trim();
    for(const [name,zh] of terminology){
      if(keepLatinNames||!/^(?:[A-Z][a-z]+|[A-Z]\.) [a-z]+$/.test(name)||localized.includes(zh))continue;
      localized=localized.replaceAll(name,zh);
    }
    if(/\bOMVs\b/.test(s)&&/\b(?:outer membrane vesicles|bacteri\w*|(?:A\.|Acinetobacter) baumannii|(?:E\.|Escherichia) coli)\b/i.test(s)&&!localized.includes('外膜囊泡'))localized=localized.replace(/\bOMVs\b/g,'外膜囊泡（OMVs）');
    parts.push(localized.replace(/(?<=[\u3400-\u9fff]),\s*|\s+,\s*|,\s+(?=[A-Z\u3400-\u9fff])/g,'，')
      .replace(/\s+([，。、；：）])/g,'$1').replace(/([（，、])\s+/g,'$1')
      .replace(/(?<=[\u3400-\u9fff])\s*[-–]\s*(?=[\u3400-\u9fff])/g,'–')
      .replace(/\(\s*(图\s*S?\d+[a-z]?)\s*\)/gi,'（$1）')
      .replace(/(结构单元(?:组成)?)[:：]\s*/g,'$1，分别为 ')
      .replace(/\s+（(?=图\s*S?\d)/g,'（')
      .replace(/\bNF-kB\b/g,'NF-κB').replace(/\bWnt\/b-catenin\b/g,'Wnt/β-catenin'));
  }
  return parts.join(' ');
}

// A successful English passage must display Chinese. Proper names can remain in Latin script.
export async function selectionTranslation(text,from,translate,{field='auto',context='',onFragmentRecovery}={}){
  const original=normalizeSelection(text);
  if(from!=='en'){
    const result=modelText(await translate(original,from));
    if(result===original||!/[\p{Script=Latin}]/u.test(result))throw validation('target','No English translation');
    return {text:result,lang:'en',name:false};
  }
  const exactField=fieldTerms(original,field,context).find(t=>t.original.length===original.length);
  if(exactField)return {text:exactField.value,lang:'zh-CN',name:false};
  const term=terminology.find(([en])=>en.toLowerCase()===original.toLowerCase());
  if(term&&term[0]===term[1])return {text:original,lang:'en',name:true};
  let sem='SEM 可指均值标准误、扫描电子显微镜或结构方程模型。';
  if(/mean\s*(?:±|\+\s*\/\s*-|and)\s*(?:S\.?E\.?M\.?|standard error)|standard error of (?:the )?mean/i.test(context))sem='均值标准误（SEM）';
  else if(/scanning electron microscop|\bSEM (?:images?|micrographs?)\b/i.test(context))sem='扫描电子显微镜（SEM）';
  else if(/structural equation model/i.test(context))sem='结构方程模型（SEM）';
  const abbreviation={SEM:sem,TEM:'透射电子显微镜（TEM）',MIC:'最低抑菌浓度（MIC）'};
  if(abbreviation[original])return {text:abbreviation[original],lang:'zh-CN',name:false};
  const result=await mapChinese(original,translate,{keepLatinNames:true,field,onFragmentRecovery});
  return {text:result,lang:'zh-CN',name:false};
}
