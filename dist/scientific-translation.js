// Translate supported scientific constructions from their captured subjects and modifiers.
// Keep the source visible for every passage; opaque identifiers must survive machine translation.
export function normalizeSelection(text){
  return text.replace(/\u00ad/g,'').replace(/(\b[A-Z]{2,8}-)\s+(?=[A-Z0-9])/g,'$1')
    .replace(/\b([A-Z][A-Z\d]*\d)\s*\/\s*(?=[A-Z][A-Z\d]*\d\b)/g,'$1/')
    .replace(/\b(vul)-\s+(gatus)\b|\b(experi)-\s+(ments?)\b/gi,(_,a,b,c,d)=>(a||c)+(b||d))
    .replace(/-\s+(?=producing\b|resistant\b|susceptible\b)/gi,'-').replace(/\s+/g,' ').trim();
}
const terminology=[
  ['attraction-repulsion spectrum','吸引力与排斥力谱'],['neighbor embeddings','邻域嵌入'],['neighbor embedding','邻域嵌入'],
  ['attractive forces','吸引力'],['repulsive forces','排斥力'],['attraction and repulsion','吸引力与排斥力'],
  ['exaggeration parameter','夸大系数'],['kNN graph neighbors','kNN 图上的近邻点'],
  ['t-distributed stochastic neighbor embedding','t 分布随机邻域嵌入'],['immune adaptation','免疫适应'],
  ['neural stem and progenitor cells','神经干细胞和祖细胞'],['neurorepair','神经修复'],
  ['attraction','吸引力'],['repulsion','排斥力'],['stroke','卒中'],
  ['distance correlations','距离相关性'],
  ['chemokine signaling networks','趋化因子信号网络'],['skeletal disorders','骨骼疾病'],
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
async function academicAim(s,translate){
  const phrase=text=>/^(?:[A-Z][A-Z\d/-]*|pH|t-SNE|kNN)$/.test(text)?text:mapChinese(text,translate);
  const spaced=text=>/^[a-z\d]/i.test(text)?' '+text:text;
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
export async function translatePassage(original,from,translate){
  if(from!=='en')return {text:await translate(original,from),warnings:[]};
  const lines=[],warnings=[];
  for(const s of sentences(original)){
    const checked=microscopyCaption(s)||quantitativeCaption(s)||clinicalStatement(s)||assay(s);
    if(checked){lines.push(checked);continue}
    const normalized=s.replace(/[‐‑–—]/g,'-').toLowerCase();
    const exact=terminology.find(([en])=>normalized===en.toLowerCase());
    if(exact){lines.push(exact[1]);continue}
    const named=s.match(/^(.+?)\s+\(([A-Z]{2,8})\)\s+(algorithms?|models?|methods?)\.?$/i);
    const stem=named&&terminology.find(([en])=>en.toLowerCase()===named[1].toLowerCase());
    if(stem){lines.push(stem[1]+'（'+named[2]+'）'+(/algorithm/i.test(named[3])?'算法':/model/i.test(named[3])?'模型':'方法'));continue}
    const aim=await academicAim(s,translate).catch(()=>null);
    if(aim){lines.push(aim);continue}
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
    const terms=terminology.filter(([en])=>body.toLowerCase().includes(en.toLowerCase()));
    const prepared=body.replace(/\bIn cellulo validation\b/gi,'Validation in cells').replace(/\bin cellulo\b/gi,'in cells').replace(/\bmaybe (?=activated\b)/gi,'may be ');
    let result=body?await translate(prepared,from):'';
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
    const numbers=body.match(/(?:[<>≤≥−-]\s*)?\d+(?:\.\d+)?/g)||[];
    const resultNumbers=result.match(/(?:[<>≤≥−-]\s*)?\d+(?:\.\d+)?/g)||[];
    const equalNumbers=numbers.map(n=>n.replace(/\s/g,'')).sort().join('|')===resultNumbers.map(n=>n.replace(/\s/g,'')).sort().join('|');
    const panelRefs=s=>Array.from(s.matchAll(/\(([a-z])\)|[（(]([a-z])[)）]|(?:图|小图)\s*([a-z])\b/gi),m=>(m[1]||m[2]||m[3]).toLowerCase()).sort().join(',');
    if(missingSide||!equalNumbers||keys.some(k=>!result.includes(k))||terms.some(([en,zh])=>!result.toLowerCase().includes(en.toLowerCase())&&!result.includes(zh))||
      panelRefs(body)!==panelRefs(result)||(/\b(?:not|no|without)\b/i.test(body)&&!/[无不未没非]/.test(result))){
      warnings.push(s);result=body+(terms.length?'\n'+terms.map(([en,zh])=>en+' · '+zh).join('　'):'');
    }
    lines.push((fig?'图 '+fig[1]+'　':'')+result);
  }
  return {text:lines.join('\n\n'),warnings};
}
// A scientific sentence can lose a number or identifier during translation.
// Retry with protected spans, then run the same factual checks again.
export async function mapChinese(source,translate,{keepLatinNames=false}={}){
  const han=/[\u3400-\u9fff]/u;
  const names=new Map(terminology.map(([en,zh])=>[en.toLowerCase(),zh]));
  names.set('(left)','（左图）');names.set('(right)','（右图）');
  const escaped=[...names.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[\-\/\\^$*+?.()|[\]{}]/g,'\\$&'));
  const technical=/\((?:left|right)\)|\b[A-Z]\.\s+[a-z]{3,}\b|\b(?:q(?:RT-)?PCR|mRNA|[A-Z]\d+[\w-]*)\b|\([A-Za-z]\)|\b[A-Z][a-z]+[A-Z][\w-]*\b|\b[A-Z]{2,}[\w/-]*\b|(?:[<>≤≥−-]\s*)?\d+(?:[.]\d+)?(?:[%²³])?/g;
  const pattern=escaped.map(v=>v.replace(/[a-z]/gi,c=>'['+c.toUpperCase()+c.toLowerCase()+']')).join('|');
  const anchors=new RegExp(pattern+'|'+technical.source,'g');
  async function protectedSentence(s){
    const pieces=[];let end=0;
    async function prose(value){
      if(!/[a-z]{2}/i.test(value))return value;
      const text=(await translate(value.trim(),'en')).trim();
      if(!han.test(text)&&/[a-z]{3,}\s+[a-z]{3,}/i.test(text))throw Error('Untranslated passage');
      return text;
    }
    for(const match of s.matchAll(anchors)){
      pieces.push(await prose(s.slice(end,match.index)),names.get(match[0].toLowerCase())||match[0]);
      end=match.index+match[0].length;
    }
    pieces.push(await prose(s.slice(end)));
    return pieces.filter(Boolean).join(' ').trim();
  }
  const parts=[];
  for(const s of sentences(source)){
    let result=await translatePassage(s,'en',translate);
    if(result.warnings.length||!han.test(result.text)){
      if(translate.withTerms){
        const pieces=[];let end=0;
        for(const match of s.matchAll(anchors)){
          pieces.push(s.slice(end,match.index),{original:match[0],value:names.get(match[0].toLowerCase())||match[0]});
          end=match.index+match[0].length;
        }
        pieces.push(s.slice(end));
        const aligned=await translate.withTerms(pieces);
        if(aligned&&han.test(aligned))result=await translatePassage(s,'en',async()=>aligned);
      }
      if(result.warnings.length||!han.test(result.text)){
        const localized=await protectedSentence(s);
        result=await translatePassage(s,'en',async()=>localized);
      }
    }
    if(result.warnings.length||!han.test(result.text))throw Error('Translation needs another reading');
    let localized=result.text.trim();
    for(const [name,zh] of terminology){
      if(keepLatinNames||!/^(?:[A-Z][a-z]+|[A-Z]\.) [a-z]+$/.test(name)||localized.includes(zh))continue;
      localized=localized.replaceAll(name,zh);
    }
    if(/\bOMVs\b/.test(s)&&/\b(?:outer membrane vesicles|bacteri\w*|(?:A\.|Acinetobacter) baumannii|(?:E\.|Escherichia) coli)\b/i.test(s)&&!localized.includes('外膜囊泡'))localized=localized.replace(/\bOMVs\b/g,'外膜囊泡（OMVs）');
    parts.push(localized.replace(/(?<=[\u3400-\u9fff]),\s*|\s+,\s*|,\s+(?=[A-Z\u3400-\u9fff])/g,'，')
      .replace(/\s+([，。、；：）])/g,'$1').replace(/([（，、])\s+/g,'$1')
      .replace(/(?<=[\u3400-\u9fff])\s*[-–]\s*(?=[\u3400-\u9fff])/g,'–')
      .replace(/\bNF-kB\b/g,'NF-κB').replace(/\bWnt\/b-catenin\b/g,'Wnt/β-catenin'));
  }
  return parts.join(' ');
}

// A successful English passage must display Chinese. Proper names can remain in Latin script.
export async function selectionTranslation(text,from,translate){
  const original=normalizeSelection(text);
  if(from!=='en'){
    const result=String(await translate(original,from)).trim();
    if(!result||result===original||!/[\p{Script=Latin}]/u.test(result))throw Error('No English translation');
    return {text:result,lang:'en',name:false};
  }
  const term=terminology.find(([en])=>en.toLowerCase()===original.toLowerCase());
  if(term&&term[0]===term[1])return {text:term[1],lang:'en',name:true};
  const abbreviation={SEM:'扫描电子显微镜（SEM）',TEM:'透射电子显微镜（TEM）',MIC:'最低抑菌浓度（MIC）'};
  if(abbreviation[original])return {text:abbreviation[original],lang:'zh-CN',name:false};
  const result=await mapChinese(original,translate,{keepLatinNames:true});
  return {text:result,lang:'zh-CN',name:false};
}
