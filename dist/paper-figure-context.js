(() => {
'use strict';
const exchange='https://www.nature.com/articles/s41467-026-75428-4';
const methods='https://pdb101.rcsb.org/learn/guide-to-understanding-pdb-data/methods-for-determining-structure';
const known={
  '1':{title:'哪些受测菌株的生长受到了抑制？',summary:'对 6 株鲍曼不动杆菌临床分离株，abaucin 的最低抑菌浓度（MIC）为 1–16 μg/mL。对受测的其他耐药病原菌和三种肠道共生菌，MIC 均高于 128 μg/mL。',group:'体外比较',
    panels:{a:{title:'鲍曼不动杆菌临床分离株',text:'每行是一株鲍曼不动杆菌。右侧两列分别给出 abaucin 和氨苄西林对该株的最低抑菌浓度。'},b:{title:'另外两种耐药病原菌',text:'对受测的产超广谱 β-内酰胺酶大肠杆菌和耐碳青霉烯肺炎克雷伯菌，abaucin 的 MIC 均高于 128 μg/mL。'},c:{title:'三种肠道共生菌',text:'图 C 的三种拟杆菌都是肠道共生菌，abaucin 对它们的 MIC 均高于 128 μg/mL。'}}},
  '2':{title:'在小鼠肺炎模型中，肺损伤和细菌负荷怎样变化？',summary:'正文报告了动物模型中的效应，为临床前证据增加了一层。组织、负担与生理结局是不同读数，不等于人体疗效。',boundary:'动物结果不会单独验证临床疗效或长期安全性。',group:'临床前证据',
    panels:{b:{title:'组织像展示的是观察到的病理差异',text:'代表图用于直观看形态，定量结论要去对应评分和样本数据核对。'},c:{title:'损伤评分与代表图分开读',text:'它是一个按规则量化的结局，不是把原图简单重新着色。'}}},
  '3':{title:'药物在宽腔与窄腔构象中分别位于哪里？',summary:'作者展示了两种结合状态。它们支持对形态和相对位置的描述，但状态差异并不能单独证明运动轨迹或某一步功能真的停止。',boundary:'结构快照不是运动录像；还要对照独立的功能读数。',group:'结构与功能',
    knowledge:[{label:'PDB-101：结构是怎么被观察到的',text:'延伸阅读：区分实验密度图和拟合的结构模型。',url:methods}],
    panels:{a:{title:'两种状态，不是一帧帧录像',text:'先确认左、右各是什么状态，再比较轮廓和相对位置。它不展示两个状态的时间先后。'}}},
  '4':{title:'结构中看到的结合，在实验中能测到吗？',summary:'作者用生物层干涉法测量药物与转运体的结合，再把结合测量与细胞层面的观察联系起来。',boundary:'结合实验测量亲和力，转运功能由下一组实验检验。',group:'结构与功能'},
  '5':{title:'底物能进入转运体，还能交给 LolA 吗？',summary:'作者把货物结合这一现象与后续交接区分开，用功能证据去核查结构所提示的解释。',boundary:'这是论文在所测条件下支持的机制解释，不是人体治疗证据。',group:'结构与功能'}
};
const evidenceSteps={
  '1':['Which tested isolates show growth inhibition?','先在 A 查受测鲍曼不动杆菌的 MIC，再用 B、C 对照其他病原菌与共生菌。>128 μg/mL 表示测量只给出下限。','Read the MICs for the A. baumannii isolates in A, then compare the tested pathogens and commensals in B and C. Values above 128 μg/mL give a lower bound.'],
  '2':['Do lung injury and bacterial burden change in mice?','体外药敏之后，作者在小鼠中分别观察组织损伤、细菌负荷和呼吸指标。肠道菌群另见补充 Fig. S1d、e，比较对象是感染后的溶媒对照组。','After measuring susceptibility, the authors examine lung injury, bacterial burden and ventilation in mice. Supplementary Fig. S1d,e compares gut community composition and diversity with infected vehicle-treated controls.'],
  '3':['Where does the drug sit in each conformation?','A 对照宽腔和窄腔两种结构，B 给出药物结构式，C、D 分别放大两种构象中的结合位置。','A compares the wide and narrow cavities. B identifies the molecule. C and D zoom in on its binding site in each conformation.'],
  '4':['Can binding be measured independently?','上一图定位结合位置。这一图用生物层干涉法测量结合，把结构观察接到独立的亲和力证据上。','The structural view locates the binding site. Here, biolayer interferometry provides a separate measurement of binding affinity.'],
  '5':['Can the transporter hand its cargo to LolA?','作者再把底物结合、转交给 LolA 和 ATP 水解分开测量。据此提出药物阻碍后续转运的模型，补充 Fig. S10 展示作者的工作模型。','The authors distinguish cargo binding, handoff to LolA and ATP hydrolysis. These measurements support their proposed block in onward transport. Supplementary Fig. S10 illustrates the working model.']
};
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const cut=(s,n)=>clean(s).length>n?clean(s).slice(0,n-1)+'…':clean(s);
const figureNumber=s=>clean(s).match(/(?:(?:Fig(?:ure)?\.?|Table)\s*|[图表]\s*)?((?:ED|S)?\d{1,3}[a-z]?)\s*$/i)?.[1]?.toUpperCase()||'';
const captionTitle=(caption,label)=>{
 const tail=clean(caption).replace(/^(?:extended data |supplementary )?(?:Fig(?:ure)?\.?|Table|[图表])\s*(?:[Ss]\s*)?\d{1,3}[a-z]?\s*[|.:：–—-]?\s*/i,'');
 if(!tail)return label;
 const stop=tail.match(/[.。](?=\s|$)/);
 const first=stop&&stop.index>18?tail.slice(0,stop.index):tail;
 return (first===tail?tail:tail.slice(0,stop.index+1))||label;
};
const doiValue=s=>clean(s).match(/\b10\.\d{4,9}\/[a-z0-9._;()/:+-]+/i)?.[0]?.replace(/[.;:,]+$/,'').replace(/\)+$/,'');
function safeDoi(value){return value?'https://doi.org/'+value.split('/').map(encodeURIComponent).join('/') : undefined;}
function arxivID(text,allowCoRR=false){
 const pattern=allowCoRR?/(?:\barXiv\s*:\s*|\bCoRR\s*,?\s*abs\s*\/\s*)(\d{2})(0[1-9]|1[0-2])\.(\d{4,5})(v[1-9]\d*)?\b/gi:
  /\barXiv\s*:\s*(\d{2})(0[1-9]|1[0-2])\.(\d{4,5})(v[1-9]\d*)?\b/gi;
 for(const hit of text.matchAll(pattern))if(Number(hit[3])>0)return hit[1]+hit[2]+'.'+hit[3]+(hit[4]||'');
}
function explicitReferenceURL(text){
 const doi=doiValue(text);
 if(doi)return safeDoi(doi);
 const a=arxivID(clean(text),true);
 return a?'https://arxiv.org/abs/'+a:undefined;
}
function sideCaption(caption,position){
 if(!/^(?:left|right)$/.test(position))return '';
 caption=clean(caption);
 const tokens=Array.from(caption.matchAll(/[(（]\s*(left|right|左侧|右侧|左|右)\s*[)）]/giu));
 const keys={left:'left',right:'right','左侧':'left','右侧':'right','左':'left','右':'right'};
 const match=tokens.findIndex(x=>keys[x[1].toLowerCase()]===position);
 if(match<0)return '';
 const here=tokens[match];
 // A trailing marker names the preceding quantity, e.g. "size (left) and cost (right)."
 const last=tokens.at(-1);
 if(tokens.length===2 && /^\s*(?:[.!?。！？]|$)/u.test(caption.slice(last.index+last[0].length))){
  const fragment=caption.slice(match?tokens[match-1].index+tokens[match-1][0].length:0,here.index);
  if(match)return clean(fragment.replace(/^[\s,;，；]*(?:(?:and|or|versus)\s+|和|与|以及)?/i,''));
  return clean(fragment.replace(/^(?:(?:fig(?:ure)?\.?|图)\s*\w+\s*[.:|：]?\s*)/i,'').split(/\bas a function of\s+|\bplotted against\s+|作为横轴的|横轴为/i).at(-1));
 }
 return clean(caption.slice(here.index+here[0].length,tokens[match+1]?.index??caption.length));
}
function linkedSection(rows,phrase){
 if(!phrase)return null;
 const a=clean(phrase).toLowerCase(), hits=[];
 for(let i=0;i<rows.length;i++){
  const hit=clean(rows[i].text).match(/^(\d+(?:\.\d+){1,5})\s+(.{10,83})$/u);
  if(!hit)continue;
  const t=clean(hit[2]).toLowerCase();
  if(a===t||a.startsWith(t+' ')||a.startsWith(t+'.')||a.startsWith(t+'。'))hits.push({i,title:hit[2],numeral:hit[1],row:rows[i]});
 }
 if(hits.length!==1)return null;
 const match=hits[0];
 const refs=new Set();
 for(let i=match.i+1;i<Math.min(rows.length,match.i+28);i++){
  if(/^\d+(?:\.\d+){1,5}\s+[^0-9]{5,80}$/u.test(clean(rows[i].text)))break;
  for(const c of rows[i].cites||[])refs.add(c);
 }
 return {...match,refs:[...refs]};
}
function isReview(rows){
 const cover=rows.some(r=>r.page===1&&/article (?:starts|begins) on (?:the )?(?:next|following) page/i.test(r.text));
 const frontRows=rows.filter(r=>r.page===(cover?2:1)||!r.page).slice(0,180);
 const title=frontRows.slice(0,14).map(r=>clean(r.text)).join('\n').split(/\babstract\b|摘要/i)[0];
 if(/(?:^|[:：–—-])\s*(?:an?\s+)?(?:systematic|scoping|narrative|integrative|literature)\s+review\b/im.test(title))return true;
 return frontRows.some(r=>/^(?:(?:article\s+)?type\s*[:：]?\s*)?(?:(?:narrative|systematic|scoping|mini|literature)[ -]?)?review(?: article)?(?:\s+open access)?$|^(?:文献综述|系统综述|综述)$/i.test(clean(r.text)))||
  /\b(?:in this review[, ]+we\b|this (?:systematic |scoping |narrative )?review (?:summari[sz]es|examines|discusses|explores|synthesi[sz]es|focuses|covers|provides|gives|aims)\b|this survey (?:gives|provides|presents) (?:an? |a comprehensive )?overview of\b)|本综述(?:总结|探讨|介绍|梳理|旨在)/i.test(frontRows.map(r=>r.text).join(' '));
}
function modelFor(item,found){
 const m=item?.model||{}, rows=Array.isArray(m.rows)?m.rows:[];
 const animalCohorts=window.ModelReading?.paperContext(m)||[],genre=isReview(rows);
 const front=rows.filter(r=>!r.page||r.page===1).slice(0,28).map(r=>clean(r.text)).join(' ');
 const curated=/\b10\.1038\/s41467-026-75428-4\b/i.test(front)&&/conformational\s+hijacking/i.test(front)&&/loldf/i.test(front);
 const groups=new Map();
 const records=[];
 for(const f of (Array.isArray(found)?found:[]).slice(0,55)){
  if(!f||!Number.isInteger(f.page)||f.page<1)continue;
  const n=figureNumber(f.label||f.id);
  const typ=/\btable\b|表/i.test(String(f.label))?'T':'F';
  const token=f.matchKey||typ+':'+n;
  const precise=curated&&typ==='F'?known[n]:null;
  const captionPage=f.captionPage||f.page;
  const trace=(rows.find(r=>r.fig===token&&Number(r.page)===captionPage)||
    {text:f.caption,location:'PDF 第 '+captionPage+' 页 · '+f.label+' 图注',page:captionPage});
  const mentions=rows.filter(r=>r.page&&Array.isArray(r.mentions)&&r.mentions.includes(token)&&!r.fig).slice(0,8);
  const explicitRefs=new Set(mentions.flatMap(r=>r.cites||[]));
  const refs=[];
  function addReference(refNumber,refLabel){
   const hit=m.references?.get?.(refNumber)||[];
   const first=hit.length===1?hit[0].rows?.[0]:null;
   const original=hit.length===1?hit[0].rows?.map(r=>r.text).join(' '):'';
   refs.push({label:refLabel+' ['+refNumber+']',text:first?cut(original,280):'正文提到这个编号，参考文献表里尚未定位到唯一条目。',
      page:first?.page,source:first?.location,url:first?explicitReferenceURL(original):undefined});
  }
  for(const refNumber of [...explicitRefs].slice(0,7))addReference(refNumber,'正文引用');
  const knowledge=precise?.knowledge?.map(ref=>({...ref,label:'延伸阅读 · '+ref.label}))||[];
  const panelLabels=new Map();
  const caption=clean(f.caption||trace.text);
  for(const panel of Array.isArray(f.panels)?f.panels:[]){
   const id=String(panel.position||panel.label||panel.id||'').trim().toLowerCase();
   if(/^(?:[a-z]|left|right)$/.test(id)||f.layerStack?.rows.some(r=>r.id===id))panelLabels.set(id,panel);
  }
  for(const [id] of Object.entries(precise?.panels||{})){if(!panelLabels.has(id))panelLabels.set(id,{});}
  // A panel interpretation does not imply a crop. Only a region the extractor actually returned is eligible.
  const panels=[...panelLabels.entries()].slice(0,15).map(([id,observed])=>{
   const explanation=precise?.panels?.[id];
   const panelLabel=id==='left'?'左图':id==='right'?'右图':id.toUpperCase();
   const captionPart=observed.axis&&observed.curveLabels?undefined:sideCaption(caption,id);
   const section=linkedSection(rows,captionPart);
   for(const n of section?.refs||[]){if(refs.length<9&&!explicitRefs.has(n)){explicitRefs.add(n);addReference(n,'关联正文段落中的引用');}}
   const region=observed.region||observed.bbox;
   const title=explanation?.title||(section?.title&&cut(section.title,100))||(observed.title?cut(observed.title,100):'分图 '+panelLabel);
   const citation=section?{label:'正文 §'+section.numeral,location:section.row.location,page:section.row.page}:
     {label:'图注 · '+panelLabel,location:trace.location,page:captionPage};
   return {id,label:panelLabel,title,text:explanation?.text||cut(observed.text||captionPart,330)||'找到分图标签，未自动解读其结果。',
     source:citation,page:citation.page,locator:observed.id,partialTicks:observed.partialTicks,markerBox:observed.markerBox,titleAnchor:observed.titleAnchor,printedTitle:observed.title||'',captionPart,axis:observed.axis,curveLabels:observed.curveLabels,
     boundary:region?undefined:'未确认分图边界；请在原图里核对标签。',region,mic:observed.mic};
  });
  const page=Number(f.page), group=precise?.group||(/^[SE]/.test(n)?'补充或扩展图':'原文图件');
  const label=String(f.label||'图件');
  const suffix=n&&/^\d+$/.test(n)?'#Fig'+n:'';
  const mainLink=precise?exchange+suffix:undefined;
  const splitHeading=panels.length===2&&panels.every(p=>/^(?:left|right)$/.test(p.id)&&!p.title.startsWith('分图 '))?
    panels.map(p=>p.title).join(' / '):'';
  const figure={...f,review:genre,animalCohorts,id:f.id,label,editorGuide:Boolean(precise),evidenceStep:precise?evidenceSteps[n]:null,title:precise?.title||splitHeading||captionTitle(caption,label),caption, page, panels,
    summary:precise?.summary||'已从你上传的 PDF 定位到这张图及图注。请沿原图核对实际比较对象。',
    boundary:precise ? precise.boundary : '这一步定位原图和原文，不自动把图注解释成科学结论。',
    references:[...refs,...knowledge],source:{label:'PDF 图注',location:trace.location,page:captionPage,href:mainLink}};
  if(!groups.has(group))groups.set(group,[]);
  groups.get(group).push(figure.id);
  records.push(figure);
 }
 return {title:curated?'Abaucin 的选择性作用：从比较到证据链':cut(item?.name||'论文图件',130),
  question:curated?'为什么 Abaucin 对受测目标菌表现出选择性？':undefined,
  questionEnglish:curated?'Why are the tested A. baumannii isolates more susceptible to abaucin?':undefined,
  takeaway:curated?'依原文顺序读：受测菌株的药敏比较 → 动物模型 → 复合物结构 → 结合实验 → 脂蛋白转运。':undefined,
  sourceLabel:curated?'此篇有经核对的导读 · 原图取自你的 PDF':'你的 PDF · 图注与原图定位',
  figures:records,groups:[...groups.entries()].map(([label,figureIds])=>({label,figureIds})),
  curated,lesson:curated&&records.some(x=>figureNumber(x.label)==='3')?{
   title:'结构图不是录像',src:'./media/structure-explainer.mp4',poster:'./media/structure-explainer-poster.jpg',
   figureIds:records.filter(x=>figureNumber(x.label)==='3').map(x=>x.id)}:undefined};
}
window.PaperFigureContext=Object.freeze({modelFor,arxivID,captionTitle,isReview});
})();
