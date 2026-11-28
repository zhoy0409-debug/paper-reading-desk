// Source phrases are matched longest first. Ambiguous words belong to a field.
const treatment=[
  ['vehicle control group','溶媒对照组'],['vehicle controls','溶媒对照'],['vehicle control','溶媒对照'],
  ['vehicle-treated','溶媒处理'],['vehicle group','溶媒对照组'],['vehicle alone','仅用溶媒'],['vehicle','给药载体'],
  ['drug delivery vehicle','药物递送载体'],['sham-operated','假手术'],['sham surgery','假手术'],
  ['sham group','模拟处理组'],['sham','模拟处理'],['placebo','安慰剂'],['negative control','阴性对照'],
  ['positive control','阳性对照'],['meropenem','美罗培南'],['piperacillin','哌拉西林'],
  ['bronchoalveolar lavage fluid','支气管肺泡灌洗液'],['lung tissue','肺组织'],['body weight','体重'],
  ['minute ventilation','每分钟通气量'],['standard error of the mean','均值标准误']
];
const transport=[
  ['vehicle control system','车辆控制系统'],['vehicle control','车辆控制'],['vehicle speed','车速'],
  ['electric vehicle','电动汽车'],['motor vehicle','机动车'],['vehicle emissions','车辆排放'],['vehicle','车辆']
];
const catalog={
  medicine:{zh:'医学与药学',en:'Medicine & pharmacology',signal:/\b(?:patients?|pharmaco\w+|clinical|therap(?:y|eutic)|pneumonia|antibiotics?|stroke|placebo|vehicle-treated|drug|mice|mouse)\b/gi,
    terms:[...treatment,['stroke','卒中'],['hazard ratio','风险比'],['confidence interval','置信区间'],['adverse event','不良事件'],['randomized trial','随机试验']]},
  life:{zh:'生命科学',en:'Life sciences',signal:/\b(?:genes?|proteins?|cellular|genom\w+|transcript\w+|phenotype|neurons?|organisms?|ecolog\w+|species)\b/gi,
    terms:[...treatment,['cell culture','细胞培养'],['culture medium','培养基'],['wild type','野生型'],['gene expression','基因表达'],['knockdown','敲低'],['knockout','敲除'],['biological replicate','生物学重复']]},
  chemistry:{zh:'化学与材料',en:'Chemistry & materials',signal:/\b(?:absorbance|spectrophotomet\w*|catalys\w+|reagents?|solvent|stoichiometr\w+|chromatograph\w+|polymers?|synthesis|adsor(?:ption|bent)|hydrogels?|aqueous solution|reaction yield|crystal structure|materials science)\b/gi,
    terms:[...treatment.filter(([term])=>term==='negative control'||term==='positive control'),['absorbance','吸光度'],['reaction yield','反应收率'],['isolated yield','分离收率'],['yield','收率'],['precipitation','沉淀'],['adsorption','吸附'],['adsorption capacity','吸附容量'],['methylene blue','亚甲蓝'],['hydrogel','水凝胶'],['mobile phase','流动相'],['stationary phase','固定相'],['retention time','保留时间'],['thin-layer chromatography','薄层色谱'],['working electrode','工作电极'],['activation energy','活化能'],['charge carrier','载流子']]},
  computing:{zh:'计算机与数据科学',en:'Computing & data science',signal:/\b(?:algorithms?|datasets?|neural networks?|embedding[s]?|classifier|machine learning|training data|computational complexity|t-SNE|UMAP)\b/gi,
    terms:[['training set','训练集'],['validation set','验证集'],['test set','测试集'],['attention mechanism','注意力机制'],['loss function','损失函数'],['precision','精确率'],['recall','召回率'],['regularization','正则化'],['kernel function','核函数']]},
  engineering:{zh:'工程与交通',en:'Engineering & transport',signal:/\b(?:vehicles?|traffic|actuators?|roadway|torque|mechanical engineering|tensile|strain gauge|control systems?)\b/gi,
    terms:[...transport,['yield strength','屈服强度'],['tensile stress','拉应力'],['shear stress','剪应力'],['strain gauge','应变计'],['feedback loop','反馈回路'],['fatigue life','疲劳寿命']]},
  physics:{zh:'物理与天文',en:'Physics & astronomy',signal:/\b(?:quantum|photons?|cosmolog\w+|galax\w+|redshift|gravitational|astronom\w+|wavefunction)\b/gi,
    terms:[['angular momentum','角动量'],['magnetic field','磁场'],['electric field','电场'],['charge carrier','载流子'],['wave function','波函数'],['event horizon','事件视界'],['power spectrum','功率谱']]},
  earth:{zh:'地球与环境科学',en:'Earth & environmental sciences',signal:/\b(?:geolog\w+|hydrolog\w+|watershed|aquifer|groundwater|precipitation|climate|soil moisture|catchment)\b/gi,
    terms:[['precipitation','降水'],['groundwater','地下水'],['surface runoff','地表径流'],['water table','地下水位'],['soil moisture','土壤含水量'],['carbon sink','碳汇'],['remote sensing','遥感']]},
  social:{zh:'经济与社会科学',en:'Economics & social sciences',signal:/\b(?:economic[s]?|survey respondents?|households?|bond yield|labor market|sociolog\w+|monetary policy|portfolio)\b/gi,
    terms:[['bond yield','债券收益率'],['yield','收益率'],['fixed effects','固定效应'],['instrumental variable','工具变量'],['opportunity cost','机会成本'],['social capital','社会资本'],['sampling frame','抽样框']]},
  math:{zh:'数学与统计',en:'Mathematics & statistics',signal:/\b(?:theorems?|bijection|topolog\w+|eigenvalues?|likelihood function|asymptotic distribution|null hypothesis)\b/gi,
    terms:[['rank','秩'],['matrix rank','矩阵的秩'],['eigenvalue','特征值'],['sample space','样本空间'],['null hypothesis','原假设'],['likelihood function','似然函数'],['standard error','标准误']]},
  agriculture:{zh:'农业与食品',en:'Agriculture & food science',signal:/\b(?:agronom\w+|cultivars?|crop yield|grain yield|germination|harvest index|irrigation|food processing)\b/gi,
    terms:[['grain yield','籽粒产量'],['crop yield','作物产量'],['yield','产量'],['harvest index','收获指数'],['shelf life','货架期'],['germination rate','发芽率']]},
  humanities:{zh:'人文与法律',en:'Humanities & law',signal:/\b(?:linguistics?|textual criticism|jurisprudence|case law|legal precedent|contract law|philolog\w+|corpus linguistics)\b/gi,
    terms:[['case law','判例法'],['burden of proof','举证责任'],['contractual consideration','合同对价'],['contract law','合同法'],['corpus linguistics','语料库语言学'],['textual criticism','文本校勘']]}
};
// Narrow profiles inherit the vocabulary of their parent. The list contains
// project-authored phrase pairs, not text copied from a third-party dictionary.
for(const [id,parent,zh,en,signal,terms] of [
  ['molecular','life','分子生物学','Molecular biology',/\b(?:gene expression|transcription factors?|messenger RNA)\b/gi,[['transcription factor','转录因子']]],
  ['microbiology','life','微生物学','Microbiology',/\b(?:microbial communities|microbiology|microbiome|antimicrobial resistance)\b/gi,[['microbial community','微生物群落'],['antimicrobial resistance','抗微生物药物耐药性']]],
  ['pharmacology','medicine','药理学','Pharmacology',/\b(?:dose.response|pharmacokinetic\w*|pharmacodynamic\w*)\b/gi,[['half-life','半衰期'],['clearance','清除率']]],
  ['clinical','medicine','临床医学','Clinical medicine',/\b(?:clinical trials?|clinical outcome|randomi[sz]ed controlled trial)\b/gi,[['primary endpoint','主要终点']]],
  ['epidemiology','medicine','流行病学','Epidemiology',/\b(?:person.years|incidence rate|prevalence ratio|cohort stud\w*)\b/gi,[['incidence rate','发病率'],['prevalence ratio','患病率比']]],
  ['biostatistics','math','生物统计学','Biostatistics',/\b(?:standard error of the mean|survival analysis|censoring|odds ratio)\b/gi,[['odds ratio','比值比'],['confidence interval','置信区间']]],
  ['bioinformatics','computing','生物信息学','Bioinformatics',/\b(?:bioinformatics|sequence alignment|single.cell transcriptom\w*|read counts?|spike-ins?)\b/gi,[['sequence alignment','序列比对'],['read depth','测序深度'],['read counts','读段计数'],['fold change','变化倍数'],['spike-ins','外源添加物']]],
  ['organic','chemistry','有机化学','Organic chemistry',/\b(?:organic chemistry|enantiomer\w*|stereochem\w*|functional group)\b/gi,[['functional group','官能团'],['enantiomer','对映异构体']]],
  ['materials','engineering','材料科学','Materials science',/\b(?:microstructure|grain boundaries|materials science|crystallite size)\b/gi,[['grain boundary','晶界'],['microstructure','微观结构']]]
])catalog[id]={zh,en,signal,parent,terms:[...catalog[parent].terms,...terms]};
export const fields=[['auto','自动识别','Automatic'],...Object.entries(catalog).map(([k,f])=>[k,f.zh,f.en]),['general','通用','General'],['custom','我的词库','My glossary']];
// Keep a snapshot so an in-flight translation always uses its original dictionary.
export function customGlossary(text){
  const terms=new Map();
  for(const [index,line] of text.split(/\r?\n/).entries()){
    if(!line.trim())continue;
    const match=line.trim().match(/^(.+?)(?:\s+=\s+|\t+|\s*[=＝]\s*)([^=＝\t]+)$/);
    if(!match||!/[a-z]/i.test(match[1])||!/[\u3400-\u9fff]/u.test(match[2]))throw new RangeError(String(index+1));
    terms.set(match[1].trim().toLowerCase(),match[2].trim());
  }
  return {id:'custom',key:JSON.stringify([...terms]),terms};
}
export function resolveField(choice,text=''){
  if(choice?.id==='custom'||choice==='custom'||choice==='general'||Object.hasOwn(catalog,choice))return choice;
  let best='general',score=0;
  for(const [id,field] of Object.entries(catalog)){
    const hits=new Set(Array.from(text.matchAll(field.signal),m=>m[0].toLowerCase())).size;
    if(hits>score||(hits&&hits===score&&field.parent===best)){best=id;score=hits}
  }
  return best;
}
const compiled=new Map(),customMatchers=new WeakMap();
const normalizedKey=s=>s.toLowerCase().replace(/[-‐‑–\s]+/g,' ');
function matcher(field){
  const custom=field?.id==='custom',cache=custom?customMatchers:compiled;
  if(cache.has(field))return cache.get(field);
  const terms=new Map(custom?field.terms:catalog[field]?.terms);
  // Explicit transport phrases retain their meaning even in a medical paper
  // studying traffic injuries or air pollution.
  for(const [key,value] of transport)if(key!=='vehicle'&&key!=='vehicle control'&&!terms.has(key))terms.set(key,value);
  const lookup=new Map([...terms].map(([k,v])=>[normalizedKey(k),v]));
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ /g,'[-‐‑–\\s]+');
  const patterns=[...lookup.keys()].sort((a,b)=>b.length-a.length).map(escape);
  const result={terms:lookup,pattern:new RegExp('(?<![A-Za-z0-9])(?:'+patterns.join('|')+')(?![A-Za-z0-9])','giu')};
  cache.set(field,result);
  return result;
}
const senses=[
  ['phantom',/\b(?:scanned|scanners?|scatterers?|imaged|B[- ]scan|simulated and experimental images|tissue[- ]mimicking)\b/i,'体模'],
  ['SEM',/scanning electron|electron micrographs?/i,'扫描电子显微镜（SEM）'],
  ['SEM',/standard error of (?:the )?mean|mean\s*(?:±|\+\/-)\s*SEM/i,'均值标准误（SEM）'],
  ['SEM',/structural equation model|latent variables?/i,'结构方程模型（SEM）'],
  ['expression',/gene expression|mRNA|transcription level/i,'基因表达'],
  ['expression',/mathematical expression|algebraic|evaluate the expression/i,'表达式'],
  ['resistance',/electric(?:al)? resistance|ohm|voltage|circuit/i,'电阻'],
  ['resistance',/drag coefficient|air resistance|fluid resistance/i,'阻力'],
  ['resistance',/drug resistance|antibiotic|antimicrobial resistance/i,'耐药性'],
  ['vehicle control',/drug|dose|placebo|solvent|pharmaco/i,'溶媒对照'],
  ['vehicle control',/traffic|steering|automotive|roadway/i,'车辆控制']
];
export function fieldTerms(text,choice='auto',context=''){
  const scope=context?text+' '+context:text;
  const field=resolveField(choice,scope),{terms,pattern}=matcher(field);
  const base=Array.from(text.matchAll(pattern),m=>{
    return {index:m.index,original:m[0],value:terms.get(normalizedKey(m[0]))};
  });
  const matches=[];
  for(const m of text.matchAll(/\b(?:SEM|expression|resistance|vehicle control|phantom)\b/gi)){
    if(/^phantom$/i.test(m[0])&&/^\s+(?:limb|pain|sensation|load|power|stock|income)\b/i.test(text.slice(m.index+m[0].length)))continue;
    const options=senses.filter(([key,cue])=>m[0].toLowerCase()===key.toLowerCase()&&cue.test(scope));
    if(options.length!==1)continue;
    const entry=base.find(t=>m.index<t.index+t.original.length&&t.index<m.index+m[0].length);
    if(entry&&(field?.id==='custom'||entry.original.length>m[0].length))continue;
    if(entry)entry.value=options[0][2];
    else matches.push({index:m.index,original:m[0],value:options[0][2]});
  }
  return base.concat(matches).sort((a,b)=>a.index-b.index);
}

// Use only short forms whose expansion is printed in the current document.
// An exact personal definition has precedence; guessed expansions never enter this list.
export function paperDefinedTerms(source,field,evidence=''){
  const found=[];
  for(const line of evidence.split('\n')){
    const pair=line.match(/^([A-Z][A-Z\d-]{1,12}s?) = ([A-Za-z][A-Za-z -]{2,100})$/);
    if(!pair||!source.match(/\b[A-Z][A-Z\d-]{1,12}s?\b/g)?.includes(pair[1]))continue;
    const [,short,full]=pair;
    const custom=field?.terms?.get(short.toLowerCase());
    const inField=[full,full.replace(/s$/i,'')].flatMap(name=>fieldTerms(name,field,full)
      .filter(term=>term.original.length===name.length).map(term=>term.value));
    const common=new Set();
    for(const {terms} of Object.values(catalog)){
      for(const [name,value] of terms)if(name===full.toLowerCase()||name===full.toLowerCase().replace(/s$/,''))common.add(value);
    }
    const value=custom||inField[0]||(common.size===1?[...common][0]:'');
    if(value)found.push({original:short,value,paperDefinition:full});
  }
  return found;
}
