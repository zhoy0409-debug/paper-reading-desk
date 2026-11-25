(() => {
'use strict';

const instances = new WeakSet();
const MAX_FILES = 12, MAX_TEXT = 150000, MAX_RECORDS = 1600, PAGE = 14;
let sequence = 0;
const roles = {main:'主文', supplement:'补充材料', related:'参考文献／知识资料', unset:'未指定角色'};
const taxonomy = [
 ['question','科学问题／研究目的',/^(?:objective(?:s)?|aim(?:s)?|research question(?:s)?|purpose|研究目的|科学问题|研究目标|研究假设|目的)$/iu],
 ['abstract','摘要',/^(?:abstract|summary|摘要)$/iu],
 ['intro','引言／背景',/^(?:introduction|background|引言|背景|研究背景|前言)$/iu],
 ['methods','方法',/^(?:(?:materials?\s+(?:and|&)\s+)?methods?|methodology|experimental(?:\s+(?:section|procedures?))?|statistical analysis|study design|(?:materials?\s+(?:and|&)\s+methods?)|材料(?:与|和)方法|研究设计|统计分析|实验方法|方法学|方法)$/iu],
 ['results','结果',/^(?:results?|findings|research findings|研究结果|结果)$/iu],
 ['discussion','讨论／局限',/^(?:discussion|limitations?|strengths and limitations|讨论|局限(?:性)?)$/iu],
 ['combined','结果与讨论',/^(?:results?\s+(?:and|&)\s+discussion|结果(?:与|和|及)讨论)$/iu],
 ['conclusion','结论',/^(?:conclusion(?:s)?|结语|结论)$/iu],
 ['references','参考文献',/^(?:references|literature cited|bibliography|references and notes|参考文献|引用文献)$/iu],
 ['captions','图表图注',/^(?:(?:figure|table)\s+(?:captions|legends)|figures and tables|图注|图表说明|图例说明|表注|附图说明)$/iu],
 ['other','其他原文',/^(?:acknowledg[ea]ments?|author contributions?|funding|competing interests|conflict(?:s)? of interest|data availability|supporting information|supplementary information|致谢|利益冲突|数据可用性|作者贡献|补充材料)$/iu]
];
const sectionNames = Object.fromEntries(taxonomy.map(([key,name])=>[key,name]));
const normal = value => String(value ?? '').replace(/\r\n?/g,'\n').trim();
const inline = value => normal(value).replace(/\s+/g,' ');
const bounded = (value,n) => value.length>n ? value.slice(0,n)+'…' : value;
const listOf = value => Array.isArray(value) ? value : [];
const capRe = /^(?:(?:supplementary\s+|extended data\s+)?(fig(?:ure)?s?\.?|tables?)\s*([sS]?\s*\d{1,3}[a-z]?)|((?:补充)?[图表])\s*([sS]?\s*\d{1,3}[a-z]?))(?=\s*[.:：|｜]|\s+[—–-]\s)/iu;
const mentionRe = /(?:(\bsupplementary\s+|\bextended data\s+)?\b(fig(?:ure)?s?\.?|tables?)\s*([sS]?\s*\d{1,3}[a-z]?)(?![\w])|((?:补充)?[图表])\s*([sS]?\s*\d{1,3}[a-z]?)(?![\da-z]))/giu;
function figureKey(type,id,prefix=''){
 const kind=/table|表/i.test(type) ? 'T' : 'F';
 let tag=id.replace(/\s+/g,'').toUpperCase();
 if (/extended/i.test(prefix)) tag='ED'+tag;
 if (/supplementary|补充/i.test(prefix+type) && !tag.startsWith('S')) tag='S'+tag;
 return kind+':'+tag;
}
const figureLabel = key => (key.startsWith('T:')?'表 ':'图 ')+key.slice(2);
function captionKey(str){
 const match=str.match(capRe);
 if(!match)return '';
 return figureKey(match[1]||match[3],match[2]||match[4],match[0]);
}
function figureMentions(str){
 const out=new Set();
 for (const m of str.matchAll(mentionRe)) { out.add(figureKey(m[2]||m[4],m[3]||m[5],m[1])); if(out.size>=18)break; }
 return Array.from(out);
}
function detectHeading(str, heading){
 const text=inline(str).replace(/^#{1,6}\s+/,'').replace(/^\d+(?:\.\d+)*[.)、]?\s+/,'');
 if(!text||text.length>160)return null;
 const delim=text.match(/^([^:：]{1,55})\s*[:：]\s*(.*)$/u);
 const plain=delim ? delim[1].trim() : text.replace(/[.。:：]$/,'').trim();
 for(const [key,label,regex] of taxonomy)if(regex.test(plain))return {key,label:plain,tail:delim?.[2]||''};
 if(heading&&text.length<95&&!/[。！？?!]/u.test(text)) return {label:text,tail:''};
 return null;
}
const doiRe = /\b10\.\d{4,9}\/[a-z0-9._;()/:+-]+/ig;
function sourceDOIs(text){
 const found=new Map();
 for(const item of text.matchAll(doiRe)){
  let value=item[0].replace(/[.,;:]+$/,'');
  while(value.endsWith(')')&&(value.match(/\)/g)||[]).length>(value.match(/\(/g)||[]).length)value=value.slice(0,-1);
  if(/^10\.\d{4,9}\/[a-z0-9._;()/:+-]+$/i.test(value))found.set(value.toLowerCase(),value);
  if(found.size>=8)break;
 }
 return Array.from(found.values());
}
function citationNumbers(text){
 const found=new Set();
 for(const m of text.matchAll(/[\[［【]([0-9][0-9\s,，;；–—-]{0,100})[\]］】]/g)){
  for(const token of m[1].split(/[,，;；]/)){
   const ends=token.trim().match(/^(\d{1,4})(?:\s*[–—-]\s*(\d{1,4}))?$/);
   if(!ends)continue;
   const first=Number(ends[1]),last=Number(ends[2]||ends[1]);
   if(first>0&&last>=first&&last-first<=30)for(let i=first;i<=last&&found.size<30;i++)found.add(i);
  }
  if(found.size>=30)break;
 }
 return Array.from(found);
}
function refNumber(text){
 const m=text.match(/^(?:[\[［【](\d{1,4})[\]］】]\s*|(\d{1,4})[.)、]\s+)(?=\S)/);
 return m ? Number(m[1]||m[2]) : 0;
}
function extract(readResult){
 const rows=[], sections=[], captions=new Map(), references=new Map();
 const makeSection=(key,title)=>{const group={key,title,rows:[]};sections.push(group);return group;};
 let current, currentRef, total=0, cap=false;
 const add=(text,location,isHeading,page)=>{
  if(!text)return;
  if(rows.length>=MAX_RECORDS||total+text.length>MAX_TEXT){cap=true;return;}
  total+=text.length;
  const original=text;
  const fig=captionKey(text);
  if(!fig){
   const h=detectHeading(text,isHeading);
   if(h&&h.key){
    current=makeSection(h.key,h.label);currentRef=null;
    if(!h.tail){const row={text,location,page,heading:true};current.rows.push(row);rows.push(row);return;}
    text=h.tail;
   }else if(h&&!h.key){
    const base=current?.key;
    current=makeSection(base||'unclassified',h.label);currentRef=null;
    const row={text,location,page,heading:true};current.rows.push(row);rows.push(row);return;
   }
  }
  if(!current)current=makeSection('unclassified','其他原文／结构未识别');
  if(fig&&current.key==='references') current=makeSection('captions','图表图注');
  const row={text:original,location,page,fig};
  if(current.key==='references'){
   const number=refNumber(text);
   if(number){
    currentRef={number,rows:[row]};row.ref=number;
    if(!references.has(number))references.set(number,[]);
    references.get(number).push(currentRef);
   }else if(currentRef&&currentRef.rows.length<10)currentRef.rows.push(row);
  }else{
   row.cites=citationNumbers(text);
   row.mentions=figureMentions(text).filter(x=>x!==fig);
  }
  if(fig){if(!captions.has(fig))captions.set(fig,[]);captions.get(fig).push(row);}
  current.rows.push(row);rows.push(row);
 };
 for(const r of listOf(readResult?.records)){
  const val=normal(r?.text);
  if(!val)continue;
  const anchor=inline(r.location || (Number.isFinite(r.page)?'第 '+r.page+' 页':'原文记录 '+(rows.length+1)));
  const chunks=val.split(/\n+/).map(normal).filter(Boolean);
  const page=Number.isSafeInteger(r.page)&&r.page>0?r.page:null;
  for(let j=0;j<chunks.length;j++)add(chunks[j],anchor+(chunks.length>1?' · 文字段 '+(j+1):''),!!r.heading&&j===0,page);
  if(cap)break;
 }
 return {rows,sections,captions,references,cap};
}
function pastedRecords(text){
 return normal(text).split('\n').map((x,i)=>({location:'粘贴原文 · 第 '+(i+1)+' 行',text:x})).filter(x=>normal(x.text));
}

function mount(container){
 if(!container || instances.has(container))return;
 instances.add(container);
 const doc=container.ownerDocument||window.document;
 const make=(tag,txt,cls)=>{const e=doc.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e;};
 const add=(parent,tag,txt,cls)=>{const e=make(tag,txt,cls);parent.append(e);return e;};
 const addUI=(parent,tag,text,cls)=>PaperUI.set(add(parent,tag,undefined,cls),text);
 const action=(parent,txt,fn,cls='light')=>{const e=addUI(parent,'button',txt,cls);e.type='button';e.addEventListener('click',fn);return e;};
 const id='paper-literature-'+(++sequence);
 const mountBox=add(container,'div',undefined,'uploadShell pl-reader');
 const style=add(mountBox,'style');
 style.textContent=`
.pl-reader section,.pl-reader article,.pl-reader blockquote{min-width:0;overflow-wrap:anywhere}
.pl-reader .pl-overview{display:grid;gap:8px;margin-top:12px}
.pl-reader .pl-source{padding:9px 11px;border:1px solid var(--line,#dbddec);border-radius:11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pl-reader .pl-open{flex:1 1 220px;text-align:left;min-width:0;overflow-wrap:anywhere}
.pl-reader label.pl-role{font-size:13px;display:inline-flex;gap:5px;align-items:center}
.pl-reader select,.pl-reader .pl-q{font:inherit;color:inherit;border:1px solid #b4b8c2;border-radius:8px;background:#fff;padding:5px 8px}
.pl-reader details>summary{cursor:pointer}
.pl-reader .pl-nav,.pl-reader .pl-links{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
.pl-reader .pl-heading{margin-top:12px}
.pl-reader .pl-anchor{font-size:.88em;font-weight:650;color:#1f2f63}
.pl-reader blockquote{margin:4px 0 0;padding:7px 10px;border-inline-start:3px solid #c7cad1;background:#f8f8f9;white-space:pre-wrap}
.pl-reader .pl-excerpt{margin-top:11px}
.pl-reader .pl-context{max-height:420px;overflow:auto}
.pl-reader .pl-nav button,.pl-reader .pl-open{max-width:100%}
.pl-reader button[aria-pressed=true]{background:#e8e9eb;border-color:#2a408a}
.pl-reader .pl-q{width:100%;max-width:620px}
.pl-reader .pl-gap{margin-top:9px}
.pl-reader [tabindex="-1"]:focus-visible{outline:2px solid #2a418d;outline-offset:4px}
.pl-reader .pl-pickers{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:8px;margin:11px 0}
.pl-reader label.pl-drop{display:flex;position:relative;flex-direction:column;align-items:flex-start;gap:3px;margin:0;background:white;color:var(--ink,#242a3f);border:1px dashed #a2a8b5;border-radius:11px;padding:10px 12px;min-height:76px}
.pl-reader .pl-drop:hover,.pl-reader .pl-drop.pl-drag{background:#eaebed;border-color:#2a418d}
.pl-reader .pl-drop small{font-weight:400}
.pl-reader .pl-reader-top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.pl-reader .pl-reader-top p{font-size:.88em;color:var(--muted,#565c71)}
.pl-reader .pl-doc-issue{margin-top:5px;font-size:.85em;color:var(--muted,#565c71)}
.pl-reader .pl-source-jump{margin-top:17px}
.pl-reader .pl-example{margin:10px 0 0}
.pl-reader .pl-source-list{margin-top:6px}
body:has(.pl-figure-host) main{max-width:1520px;padding-inline:clamp(12px,3vw,46px)}
body:has(.pl-figure-host) #literaturePane{max-width:1430px}
.pl-reader.uploadShell:has(.pl-figure-host){max-width:1380px}
@container (min-width:1000px) {
 .pl-figure-host .frw-main{display:grid;grid-template-columns:minmax(0,1.72fr) minmax(242px,.95fr);align-items:start;gap:0 18px}
 .pl-figure-host .frw-figure-head{grid-column:1/-1}
 .pl-figure-host .frw-visual{grid-column:1;grid-row:2/span 3}
 .pl-figure-host .frw-notes{grid-column:2;grid-row:2;margin:0;padding:0;border-top:0}
 .pl-figure-host .frw-more{grid-column:2;grid-row:3;margin-top:14px}
 .pl-figure-host .frw-announcement{grid-column:2;grid-row:4}
}
.pl-reader .pl-figure-target{padding:0;border:0;background:transparent}
.pl-reader .pl-figure-target .pl-reader-top{margin:0 0 10px}
.pl-reader .pl-figure-loading{display:grid;align-content:center;gap:10px;min-height:230px;padding:24px;border:1px solid #d1d3d8;border-radius:12px;background:#f9f9f9;color:#2b2e34}
.pl-reader .pl-figure-loading h3{font-size:1.25em}
.pl-reader .pl-primary-picker{margin-bottom:8px}
.pl-reader label.pl-drop-main{min-height:68px;border:1px solid #273d86;background:#e9eaed;justify-content:center;padding:11px 14px;color:#192753}
.pl-reader .pl-drop-main strong{font-size:17px}
.pl-reader .pl-primary-picker input:focus-visible,.pl-reader .pl-drop:focus-within{outline:3px solid #2a418d;outline-offset:3px}
.pl-reader .pl-feedback{border:1px solid #d3d6db;border-radius:12px;background:#f9f9fa;padding:10px 12px;margin-bottom:10px;overflow-wrap:anywhere}
.pl-reader .pl-feedback[data-state=warn]{background:#fff8e9;border-color:#efd8a9;color:#713d0a}
.pl-reader .pl-feedback[data-state=ready]{border-color:#bdc1c9}
.pl-reader .pl-progress{font-weight:650;line-height:1.48;font-size:15px}
.pl-reader .pl-feedback-hint{font-size:14px;margin-top:5px}
.pl-reader .pl-feedback progress{display:block;width:min(190px,100%);height:6px;accent-color:#273d86;margin-top:8px}
.pl-reader .pl-go{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:8px}
.pl-reader .pl-go select{min-width:0;max-width:100%}
.pl-reader .pl-go button{min-height:42px}
.pl-reader .pl-go button:disabled{opacity:.52;cursor:not-allowed}
.pl-reader .pl-fallback{margin-top:8px}
.pl-reader .pl-support{margin-top:12px}
.pl-reader .pl-target{scroll-margin-top:16px}
@media(max-width:600px){.pl-reader .pl-source{align-items:flex-start}.pl-reader .pl-open{width:100%}}
 `;
 const intake=add(mountBox,'section',undefined,'card uploadZone');
 const intakeTitle=addUI(intake,'h2','读一篇论文');
 const titleRow=add(intake,'div',undefined,'reader-title-row');
 titleRow.append(intakeTitle,ReaderHints.create('可拖入 PDF、DOCX 或 TXT。文件在此浏览器读取。扫描件可按页查看，也可粘贴图注。','Drop a PDF, DOCX or TXT file. Files open in this browser. For scans, view a page or paste a caption.','文件格式与打开方式','File formats and opening options'));
 const primaryPicker=add(intake,'div',undefined,'pl-pickers pl-primary-picker');
 const support=add(intake,'details',undefined,'entryDetails pl-support');
 const supportSummary=addUI(support,'summary','选填：补充材料、参考文献和知识资料');
 const optionalPickers=add(support,'div',undefined,'pl-pickers');
 let primaryInput,primaryTitle;
 for(const [role,title,note] of [
  ['main','打开 PDF 论文','先选一篇论文（PDF、DOCX 或 TXT），支持拖入'],
  ['supplement','补充材料 · 选填','可同时添加多份'],
  ['related','参考文献／知识资料 · 选填','可同时添加多份']
 ]){
  const label=add(role==='main'?primaryPicker:optionalPickers,'label',undefined,'pick pl-drop'+(role==='main'?' pl-drop-main':''));label.htmlFor=id+'-'+role;
  const strong=addUI(label,'strong',title); if(role==='main'){primaryTitle=strong;add(label,'small','PDF · DOCX · TXT');}
  const input=add(label,'input');input.id=id+'-'+role;input.type='file';input.multiple=role!=='main';
  input.accept='.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
  input.setAttribute('aria-describedby',id+'-formats '+id+'-progress');
  if(role==='main')primaryInput=input;
  const take=list=>{const selected=Array.from(list||[]);enqueue(role==='main'?selected.slice(0,1):selected,role);};
  input.addEventListener('change',()=>{take(input.files);input.value='';});
  label.addEventListener('dragover',event=>{event.preventDefault();label.classList.add('pl-drag');});
  label.addEventListener('dragleave',()=>label.classList.remove('pl-drag'));
  label.addEventListener('drop',event=>{event.preventDefault();label.classList.remove('pl-drag');take(event.dataTransfer?.files);});
 }
 const feedback=add(intake,'div',undefined,'pl-feedback');
 const status=addUI(feedback,'p','选好主文后，会在这里显示读取进度。','pl-progress');status.id=id+'-progress';status.setAttribute('role','status');status.setAttribute('aria-atomic','true');
 const progress=add(feedback,'progress');progress.hidden=true;progress.setAttribute('aria-label','正在本地读取');
 const feedbackHint=add(feedback,'p',undefined,'pl-feedback-hint muted');feedbackHint.hidden=true;
 const goControls=add(feedback,'div',undefined,'pl-go');goControls.hidden=true;
 const choice=add(goControls,'select');choice.setAttribute('aria-label','从已读材料中选一份作为主文');choice.hidden=true;
 const go=action(goControls,'查看阅读结果',()=>openReadable(),'primary');go.setAttribute('aria-controls',id+'-results');
 choice.addEventListener('change',()=>{go.disabled=!choice.value;});
 const pasteShortcut=action(feedback,'改用粘贴原文',()=>{paste.open=true;textarea.focus();},'light pl-fallback');pasteShortcut.hidden=true;
 const openUnparsed=action(feedback,'先看原始 PDF 页',()=>{
  const file=items.find(d=>d.problem&&d.pdfFile);
  if(file)openLocalPaper(file,1);
 },'light pl-fallback');openUnparsed.hidden=true;
 const formats=addUI(intake,'p','支持有文字层的 PDF、DOCX、TXT。扫描 PDF 目前不做 OCR；可粘贴正文或图注。','muted fileHint');formats.id=id+'-formats'; formats.hidden=true;
 const paste=add(intake,'details',undefined,'entryDetails');
 const pasteSummary=addUI(paste,'summary','没有可读文件？粘贴原文');
 const labelText=addUI(paste,'label','粘贴正文、图注或参考文献');labelText.htmlFor=id+'-paste';
 const textarea=add(paste,'textarea');textarea.id=id+'-paste';textarea.rows=5;textarea.maxLength=MAX_TEXT;textarea.autocomplete='off';
 const pasteActions=add(paste,'div',undefined,'lineActions');
 const pasteRole=add(pasteActions,'select');pasteRole.setAttribute('aria-label','粘贴原文的材料角色');
 for(const role of ['main','supplement','related']){const opt=add(pasteRole,'option',roles[role]);opt.value=role;}
 pasteRole.value='main';
 action(pasteActions,'加入这份原文',()=>{
  const value=normal(textarea.value);
  if(!value){notice('还没有原文。请先粘贴你要读的一段。','warn');return;}
  if(items.length>=MAX_FILES){notice('已达到 '+MAX_FILES+' 份上限。请先移除一份不需要的材料。','warn');return;}
  const name='粘贴原文 '+(++pasted);
  const {change}=pushItem(name,{records:pastedRecords(value)},'',pasteRole.value);
  textarea.value='';notice('已加入「'+name+'」。'+change,'ready');
 },'primary');
 intake.append(support);
 const exampleButton=action(intake,'先看脑图示例',()=>showExample(),'light pl-example');
 exampleButton.hidden=true;
 const opening=add(intake,'div',undefined,'folio-opening');
 const uploadColumn=add(opening,'div',undefined,'folio-intake');
 uploadColumn.append(titleRow,primaryPicker,formats,paste,support);
 const plate=add(opening,'figure',undefined,'folio-example');
 const watch=add(plate,'button',undefined,'folio-watch');watch.type='button';
 const cover=add(watch,'img');cover.width=1360;cover.height=660;cover.alt='';
 const locale=()=>window.ReaderLanguage?.current==='en'?'en':'zh';
 function localizeTour(){
   const en=locale()==='en';
   cover.src='./media/tour/cover-'+locale()+'.webp';
   watch.setAttribute('aria-label',en?'Watch three reading workflows':'观看三种文献精读用法');
 }
 localizeTour();
 doc.addEventListener('reader-language-change',localizeTour);
 watch.addEventListener('click',()=>{
   const en=locale()==='en';
   const dialog=add(mountBox,'dialog',undefined,'folio-tour');
   dialog.setAttribute('aria-label',en?'Reading tour':'读图演示');
   const bar=add(dialog,'div',undefined,'folio-tour-bar');
   add(bar,'strong',en?'Reading tour':'读图演示');
   const close=add(bar,'button',en?'Close':'关闭');close.type='button';
   const frame=add(dialog,'iframe');frame.title=en?'Reading tour':'读图演示';
   frame.src='./media/tour/index.html?lang='+locale()+'&embed=1';
   frame.allow='autoplay; fullscreen';frame.allowFullscreen=true;
   close.addEventListener('click',()=>dialog.close());
   dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
   dialog.addEventListener('close',()=>{dialog.remove();watch.focus();},{once:true});
   dialog.showModal();close.focus();
 });
 const plateInfo=add(plate,'figcaption');
 add(plateInfo,'small','Böhm, Berens & Kobak · Fig. 6 · PDF p.10');
 const sampleTitle=add(plateInfo,'cite','Attraction–Repulsion Spectrum in Neighbor Embeddings');sampleTitle.lang='en';
 let linkedSample=null;
 const sampleRequested=new URLSearchParams(location.search).get('sample')==='figure-8a';
 const tryPaper=action(plateInfo,'公开论文试读',async()=>{
  tryPaper.disabled=true;
  try{
   const response=await fetch('./media/2007.08902.pdf');
   if(!response.ok)throw Error();
   const blob=await response.blob();
   const sample=new File([blob],'2007.08902.pdf',{type:'application/pdf',lastModified:0});
   if(sampleRequested)linkedSample=sample;
   enqueue([sample],'main');
  }catch{notice('文件读取失败，请选择本地主文。','warn')}
  finally{tryPaper.disabled=false}
 },'folio-open');
 intake.append(feedback);
 const overview=add(mountBox,'details',undefined,'card recognition');overview.hidden=true;
 const overviewSummary=addUI(overview,'summary','本次阅读材料 · 管理文件和角色');
 const overviewText=add(overview,'p',undefined,'muted');
 const files=add(overview,'div',undefined,'pl-overview');
 const question=add(overview,'details',undefined,'entryDetails');
 addUI(question,'summary','记录我想先弄懂的问题（选填）');
 const qLabel=addUI(question,'label','我的阅读问题');qLabel.htmlFor=id+'-question';
 const qField=add(question,'input',undefined,'pl-q');qField.id=id+'-question';qField.type='text';qField.maxLength=230;qField.autocomplete='off';
 qField.placeholder='例如，这张图在比较什么？';
 const reader=add(mountBox,'section',undefined,'card personalTree pl-target');reader.id=id+'-results';reader.hidden=true;reader.setAttribute('aria-label','论文原文目录与依据');
 // Once a paper is open, the intake collapses into one bar with short labels.
 const barLabels=[
  [()=>primaryTitle,'打开 PDF 论文',['换一篇论文','Open another paper']],
  [()=>pasteSummary,'没有可读文件？粘贴原文',['粘贴原文','Paste text']],
  [()=>supportSummary,'选填：补充材料、参考文献和知识资料',['补充材料','Add materials']],
  [()=>overviewSummary,'本次阅读材料 · 管理文件和角色',['本次阅读材料','Files in this reading']]
 ];
 let barState=null;
 function syncLoaded(){
  const on=!reader.hidden&&!exampleMode&&!!currentMain();
  if(on===barState)return;
  barState=on;
  mountBox.classList.toggle('pl-loaded',on);
  for(const [node,full,[short,english]] of barLabels){const el=node();if(el)on?PaperUI.set(el,short,english):PaperUI.set(el,full);}
 }
 if(typeof MutationObserver==='function')new MutationObserver(syncLoaded).observe(reader,{attributes:true,attributeFilter:['hidden']});
 const items=[], crossContexts=[];
 let serial=0,pasted=0,activeDoc=null,activeSection=-1,loaded=PAGE,pending=0,queue=Promise.resolve();
 let readMode='map',mapHandle=null,figureHandle=null,viewKey=0,exampleMode=false;
 let missingId='';
 const shelf=window.PaperShelf.mount(mountBox,(file,hash)=>{
  missingId='';
  const match=items.find(d=>d.hash===hash);
  if(match){makeMain(match);mapMode(match)}else enqueue([file],'main');
 },hash=>{
  missingId=hash;
  notice('这份原 PDF 的缓存不可用。请重新选择同一份 PDF，原有笔记和裁切位置仍按文件指纹保留。','warn');
  const leave=action(feedback,'先读另一篇',()=>{missingId='';history.replaceState(null,'',location.pathname);leave.remove();primaryInput.focus()});
 });
 function openSourcePage(item,page){
  if(!item.figureSession)return openLocalPaper(item,page);
  const modal=add(mountBox,'dialog',undefined,'pd-source');
  const head=add(modal,'header'),label=add(head,'strong');
  const previous=action(head,'上一页',()=>show(current-1)),next=action(head,'下一页',()=>show(current+1));
  action(head,'用 PDF 查看器打开',()=>openLocalPaper(item,current));
  action(head,'返回读图',()=>modal.close());
  const image=add(modal,'img'),status=add(modal,'p');let url='',version=0,current=page;
  modal.addEventListener('close',()=>{version++;if(url)URL.revokeObjectURL(url);modal.remove()},{once:true});
  async function show(n){
   const token=++version;current=n;previous.disabled=n<=1;next.disabled=n>=item.figureSession.totalPages;
   PaperUI.set(label,'原 PDF · 第 '+n+' / '+item.figureSession.totalPages+' 页','Original PDF · page '+n+' of '+item.figureSession.totalPages);
   image.hidden=true;PaperUI.set(status,'正在读取原页…');
   try{const pic=await item.figureSession.renderPage(n);if(version!==token)return;
    if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(pic.blob);image.alt=label.textContent;image.src=url;image.hidden=false;status.textContent='';
   }catch{if(version===token)PaperUI.set(status,'原页渲染失败，可用 PDF 查看器打开。')}
  }
  modal.showModal();show(page);
 }
 function clearMap(){
  viewKey++;
  if(mapHandle?.destroy)mapHandle.destroy();mapHandle=null;
  if(figureHandle?.destroy)figureHandle.destroy();figureHandle=null;
  reader.classList.remove('pl-figure-target');
 }
 function startFigureScan(item){
  if(!item?.pdfFile||!window.PaperFigureExtractor?.scan||item.figureJob)return;
  const abort=typeof AbortController!=='undefined'?new AbortController():null;
  item.figureAbort=abort;
  item.figureJob=Promise.resolve().then(()=>window.PaperFigureExtractor.scan(item.pdfFile,{maxPages:42,signal:abort?.signal})).then(session=>{
   if(!items.includes(item)){session.destroy();return {problem:'已移除这份文献。'};}
   item.figureSession=session;
   return {session};
  },error=>({problem:bounded(normal(error?.message)||'没有可靠定位到图件。',150)}));
 }
 function openLocalPaper(item,page){
  if(!item?.pdfFile||!window.URL?.createObjectURL||typeof window.open!=='function')return;
  if(!item.pdfUrl)item.pdfUrl=window.URL.createObjectURL(item.pdfFile.type==='application/pdf'?item.pdfFile:item.pdfFile.slice(0,item.pdfFile.size,'application/pdf'));
  const n=Number.isInteger(page)&&page>0?page:1;
  window.open(item.pdfUrl+'#page='+n,'_blank','noopener,noreferrer');
 }
 function figureContents(item){
  if(!item?.pdfFile||!window.PaperFigureExtractor?.scan||!window.PaperFigureContext?.modelFor||!window.FigureReadingWorkbench?.mount)return false;
  startFigureScan(item);if(!item.figureJob)return false;
  const activeView=viewKey;
  reader.classList.add('pl-figure-target');
  const header=add(reader,'div',undefined,'pl-reader-top');
  const label=addUI(header,'p','文献精读 · 原图工作台');
  label.tabIndex=-1;label.setAttribute('data-pl-focus','');
  const navs=add(header,'div',undefined,'lineActions');
  action(navs,'查看脉络概览',()=>{readMode='graph';select(item,-1);});
  action(navs,'查看原文索引',()=>sourceMode(item));
  const host=add(reader,'div',undefined,'pl-figure-host');
  const progress=add(host,'div',undefined,'pl-figure-loading');
  addUI(progress,'h3','正在定位论文原图');
  addUI(progress,'p','从主文里找图注和原页。附件可以稍后再加。','muted');
  const activity=add(progress,'progress');activity.setAttribute('aria-label','正在定位原图');
  item.figureJob.then(async result=>{
   if(activeView!==viewKey||!items.includes(item))return;
   const session=result.session;
   const paper=window.PaperFigureContext.modelFor(item,session?.figures||[]);
   if(!paper.curated&&session?.documentTitle)paper.title=session.documentTitle;
   let exactPaper=false;
   if(paper.curated&&typeof session?.renderRegion==='function'&&window.crypto?.subtle){
    try{
     const bytes=await window.crypto.subtle.digest('SHA-256',await item.pdfFile.arrayBuffer());
     exactPaper=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')==='505ce6a6c551053fe56c9fccf3bb943611ea5a90c87a4eb7add40389d6b6cbc6';
    }catch{}
   }
   if(activeView!==viewKey||!items.includes(item))return;
   if(exactPaper){
    const table=paper.figures.find(f=>f.matchKey==='F:1'&&f.page===2);
    if(table){
     // Page-space rectangles checked against the printed rules of this PDF edition.
     table.verifiedRegion={x:119/600,y:475/797,width:368/600,height:215/797};
     const areas={a:[0,0,368,130],b:[0,133,195,82],c:[201,133,167,82]};
     for(const p of table.panels){
      const v=areas[p.id];
      if(v)p.region={x:v[0]/368,y:v[1]/215,width:v[2]/368,height:v[3]/215};
     }
     table.checkedIsolateTable=true;
    }
    const animalFigure=paper.figures.find(f=>f.matchKey==='F:2'&&f.page===4&&f.captionPage===5);
    for(const p of animalFigure?.panels||[]){
     if(p.region&&p.markerBox)p.checkedGuide=CheckedPanelGuides.forPanel(p.id);
    }
    const checked=paper.figures.find(f=>f.matchKey==='F:3'&&f.page===5);
    const panel=checked?.panels?.find(p=>p.id==='a');
    if(checked&&panel){
     checked.verifiedRegion={x:95/976,y:334/1297,width:798/976,height:594/1297};
     panel.region={x:0,y:0,width:1,height:310/594};
     panel.boundary='此区域对应出版社这一版 PDF 的 3A；结构快照不提供时间先后。';
    }
   }
   const rawPage=n=>({id:'page-only-'+n,label:'原页',title:'PDF 第 '+n+' 页',page:n,summary:'原页手动定位。请按实际图内标签框选需要的区域。',panels:[],references:[],pageOnly:true});
   if(session&&!paper.figures.length)paper.figures=[rawPage(1)];
   host.replaceChildren();
   if(!session||!paper.figures.length){
    const empty=add(host,'div',undefined,'pl-figure-loading');
    addUI(empty,'h3','没有定位到可确认的图件');
    add(empty,'p',result.problem||'请用原文索引核对。有些图只有图像，没有可识别的图注。','muted');
    action(empty,'打开原始 PDF',()=>openLocalPaper(item,1),'primary');
    action(empty,'查看原文索引',()=>sourceMode(item));
    return;
   }
   window.PaperReadingEvidence.enrich(item,paper,session);
   paper.rows=item.model.rows;
   paper.citations=window.PaperCitations?.build(paper.rows);
   paper.sections=window.PaperOutline?.sections(paper.rows,paper.figures.filter(f=>!f.pageOnly))||[];
   item.hash ||= await PaperShelf.fingerprint(item.pdfFile);
   if(activeView!==viewKey)return;
   const stored=PaperShelf.state(item.hash),dest=PaperShelf.target();
   for(const f of paper.figures){
    if(!f.openHistogram||f.panels.some(p=>p.region)||f.verifiedRegion)continue;
    // Existing manual grids keep their page basis, correction keys and source links.
    const basis=f.pageBox||{x:0,y:0,width:1,height:1};
    const legacy=stored.figures?.[f.id]?.gridLayouts?.[JSON.stringify([f.page,'',basis])];
    if(!legacy){
      if(f.openHistogram.partial){f.openPage=true;f.pageBox=null;f.mode='page'}
      else{f.verifiedRegion=f.pageBox=f.openHistogram.box;f.mode='crop'}
    }
   }
   const initial={...stored.spot};
   const linked=linkedSample===item.pdfFile && paper.figures.find(f=>f.matchKey==='F:8' && f.panels.some(p=>p.id==='a'));
   if(linked){Object.assign(initial,{figure:linked.id,panel:'a',zoom:0,pageMode:false});linkedSample=null}

   if(dest?.id===item.hash&&dest.figure){initial.figure=dest.figure;initial.panel=dest.panel||''}
   PaperPanelDesk.restorePageBindings(paper,stored,initial,dest?.id===item.hash?dest:null);
   const addPage=n=>{const page=rawPage(n);
    if(!paper.figures.some(f=>f.id===page.id)){paper.figures.push(page);figureHandle?.setModel(paper)}
    return page.id;
   };
   const pageIDs=new Set([initial.figure,...Object.keys(stored.figures||{})]);
   for(const pageID of pageIDs){const hit=/^page-only-(\d+)$/.exec(pageID);if(hit&&Number(hit[1])<=session.totalPages)addPage(Number(hit[1]))}
   const rawNav=add(navs,'details');addUI(rawNav,'summary','按页手动定位');
   const pagePick=add(rawNav,'input');pagePick.type='number';pagePick.min='1';pagePick.max=String(session.totalPages);pagePick.value=String(initial.page||1);pagePick.setAttribute('aria-label','原 PDF 页码');
   action(rawNav,'读取这一页',()=>{const n=Number(pagePick.value);if(Number.isInteger(n)&&n>=1&&n<=session.totalPages)figureHandle?.selectFigure(addPage(n));else pagePick.reportValidity()});
   if(session.warnings?.length)add(rawNav,'p',session.warnings.join(' '),'muted');
   try{await PaperShelf.remember(item.hash,item.pdfFile)}catch{
    addUI(header,'p','此浏览器未能缓存 PDF。重新打开时需重新选择同一文件。','muted');
   }
   if(activeView!==viewKey)return;
   if(dest?.id===item.hash)history.replaceState(null,'',location.pathname);
   figureHandle=window.FigureReadingWorkbench.mount(host,{
    lookupTerm: PaperSourceNotes.lookupFor(item.model.sections),
    lookupSupplement(query){
     const found=[];
     for(const doc of items.filter(d=>d.role==='supplement'&&d.pdfFile&&!d.problem)){
      const pages=new Map();
      for(const r of doc.model.rows){if(r.page)pages.set(r.page,(pages.get(r.page)||'')+' '+r.text)}
      for(const [page,value] of pages)if(query.every(re=>re.test(value)))found.push({page,open:()=>openLocalPaper(doc,page)});
     }
     return found.length===1?found[0]:null;
    },
    model:paper,lesson:paper.lesson,desk:{paper,session,file:item.pdfFile,id:item.hash,state:stored,initial},
    renderFigure:async(figure,forcePage)=>{
     const image=forcePage||figure.pageOnly||figure.openPage?await session.renderPage(figure.page):
       figure.verifiedRegion?await session.renderRegion(figure.page,figure.verifiedRegion):await session.render(figure.id);
     return {...image,mode:image.mode==='crop'?'figure':'page',sourceLabel:'PDF 第 '+image.page+' 页'+(figure.verifiedRegion&&image.mode==='crop'?(figure.openHistogram?' · 按原图刻度定位 / Located by axis ticks':' · 已核对该版本版面'):'')};
    },
    onOpenSource:({figure,page,source})=>openSourcePage(item,page||source?.page||figure?.page)
   });
   if(linked)host.querySelector('.frw-visual')?.scrollIntoView({block:'start'});
  }).catch(()=>{
   if(activeView!==viewKey)return;
   host.replaceChildren();
   const empty=add(host,'div',undefined,'pl-figure-loading');
   addUI(empty,'h3','原图工作台暂时无法加载');
   action(empty,'打开原始 PDF',()=>openLocalPaper(item,1),'primary');
   action(empty,'查看原文索引',()=>sourceMode(item));
  });
  return true;
 }
 function showExample(){exampleMode=true;render();reader.scrollIntoView?.({block:'start'});}
 function leaveExample(){exampleMode=false;render();primaryInput.focus();}
 function sourceMode(item,index=-1){readMode='source';select(item,index);}
 function mapMode(item){readMode='map';select(item,-1);}
 const priority=['question','results','combined','discussion','conclusion','methods','abstract','intro','references'];
 const explanations={
  question:'回到作者写明的研究问题或目的。',results:'看看作者比较了什么、观测到了什么，图注和结论分开看。',combined:'在同一段落里分开看作者报告的结果和对结果的解释。',discussion:'这里是作者对结果的解释，适合对照原始证据。',conclusion:'读作者怎样收束发现，再回结果核对支撑范围。',methods:'先弄清比较对象、读数和研究设计，再理解结果。',abstract:'先扫一眼论文概述，再展开实际定位到的正文。',intro:'找到研究背景和作者在回答的争议。',references:'查看原文的来源条目。引用条目不等于这篇已读。'
 };
 function autoMap(item){
  const mm=item.model;
  function figureTopic(key){
   const figure=item.figureSession?.figures.find(f=>f.matchKey===key);
   return figure?.title||figureLabel(key);
  }
  const front=mm.rows.filter(r=>!r.page||r.page===1).slice(0,22);
  const knownId=front.flatMap(r=>sourceDOIs(r.text)).find(doi=>window.PaperReadingEditions?.get(doi));
  if(knownId)return {model:window.PaperReadingEditions.get(knownId),curated:true};
  const branches=priority.filter(key=>mm.sections.some(sec=>sec.key===key)).slice(0,5).map(key=>{
   const sectionIndex=mm.sections.findIndex(sec=>sec.key===key);
   const section=mm.sections[sectionIndex];
   const first=section.rows.find(r=>!r.heading)||section.rows[0];
   const tokens=[...new Set(section.rows.flatMap(r=>r.mentions||[]))].filter(fig=>mm.captions.has(fig)).slice(0,3);
   const children=tokens.map(fig=>{
    const r=mm.captions.get(fig)[0];
    return {id:key+'-'+fig,title:figureTopic(fig),summary:'这里定位到原文提及的图注，点原文核对。',source:{label:figureLabel(fig),location:r.location,figure:fig}};
   });
   return {id:key,title:sectionNames[key],category:'原文定位',summary:explanations[key],children,
    source:{label:'查看'+sectionNames[key],location:first?.location||section.title,sectionIndex}};
  });
  if(branches.length<5&&mm.captions.size){
   const captions=Array.from(mm.captions.entries()).slice(0,5);
   branches.push({id:'caption-index',title:'图表怎么读',category:'图注定位',summary:'从能定位到的图注开始，不把图注当成已经读过原图。',
    children:captions.map(([fig,records])=>({id:'cap-'+fig,title:figureTopic(fig),summary:'查看可定位的图注。',source:{label:figureLabel(fig),location:records[0].location,figure:fig}}))});
  }
  if(!branches.length)branches.push({id:'source-only',title:'从可读原文开始',category:'原文定位',summary:'标题还未可靠识别。可以点开已有文字，不猜测论文在证明什么。',source:{label:'显示原文',location:mm.rows[0]?.location||'',sectionIndex:-1}});
  const explicit=mm.sections.find(sec=>sec.key==='question');
  const question=explicit?.rows.find(row=>!row.heading&&/[？?]$/.test(row.text.trim())&&inline(row.text).length<112);
  return {model:{title:'本地文献导览',root:{title:question?inline(question.text):item.figureSession?.documentTitle||'从哪里读懂这篇论文？',summary:'先点一个分支。节点连到本地识别到的段落或图注，不把目录当成论点。'},branches},curated:false};
 }
 function graphContents(item,isExample=false){
  const data=isExample?{model:window.PaperReadingEditions?.example,curated:true}:autoMap(item);
  if(!data.model||typeof window.PaperMindMap?.mount!=='function')return false;
  const header=add(reader,'div',undefined,'pl-reader-top');
  const title=add(header,'p',isExample?'导读示例 · 基于公开主文整理':data.curated?'经整理的文章导读 · 原文随节点核对':'你的原文导览 · 本地生成');
  title.tabIndex=-1;title.setAttribute('data-pl-focus','');
  if(isExample)action(header,'返回放入自己的文献',leaveExample);
  else {
   if(item?.pdfFile&&window.FigureReadingWorkbench?.mount)action(header,'返回原图工作台',()=>mapMode(item));
   action(header,'查看原文索引',()=>sourceMode(item));
  }
  const graph=add(reader,'div',undefined,'pl-map-host');
  const linked=add(reader,'div',undefined,'pl-source-jump');linked.hidden=true;
  const openSource=(node,source)=>{
   if(isExample||!item) return;
   linked.replaceChildren();
   linked.hidden=false;
   const heading=addUI(linked,'h3','核对原文：'+bounded(node?.title||source?.label||'依据',95));
   heading.tabIndex=-1;
   const index=Number.isInteger(source?.sectionIndex)?source.sectionIndex:-1;
   const records=source?.figure?(item.model.captions.get(source.figure)||[]):(item.model.sections[index]?.rows||item.model.rows);
   if(!records.length)addUI(linked,'p','本地文件没有定位到这条图注。请使用节点里的原文链接。','muted');
   for(const rec of records.slice(0,3)){const panel=raw(linked,item,rec);showDOIs(panel,sourceDOIs(rec.text));contextLinks(panel,item,rec);}
   if(records.length)action(linked,'打开完整原文索引',()=>sourceMode(item,source?.figure?-2:index));
   action(linked,'收起原文',()=>{linked.hidden=true;title.focus({preventScroll:true});});
   try{heading.focus({preventScroll:true});linked.scrollIntoView?.({block:'nearest'});}catch{}
  };
  mapHandle=window.PaperMindMap.mount(graph,data.model,{onSource:isExample?undefined:openSource});
  return true;
 }
 const revoke = item=>{
  if(item?.pdfUrl){window.URL.revokeObjectURL(item.pdfUrl);item.pdfUrl='';}
  item?.figureAbort?.abort();item?.figureSession?.destroy?.();
 };
 window.addEventListener('pagehide',event=>{if(!event.persisted)for(const item of items)revoke(item);});
 function currentMain(){return items.find(d=>d.role==='main'&&!d.problem);}
 function auxiliaries(){return items.filter(d=>!d.problem&&d.model.rows.length);}
 function notice(message,state='ready',role='',english){
  const hasMain=!!currentMain();
  const optionalIssue=hasMain&&state==='warn'&&(role==='supplement'||role==='related');
  const info=optionalIssue?'主文可继续阅读。 其他材料的状态在「本次阅读材料」里。':message;
  PaperUI.set(status,info,optionalIssue?'The main paper is ready. Check attachments in the file list.':english||PaperUI.english(info)||(state==='loading'?'Reading on this device…':undefined));
  feedback.dataset.state=optionalIssue?'ready':state;progress.hidden=state!=='loading';
  pasteShortcut.hidden=state!=='warn'||optionalIssue;
 }
 function updateFeedback(){
  const main=currentMain(), available=main?[]:auxiliaries(), previous=choice.value;
  openUnparsed.hidden=!!main||!items.some(d=>d.problem&&d.pdfFile);
  goControls.hidden=!main&&!available.length;choice.hidden=available.length<2;go.disabled=false;
  feedbackHint.hidden=!main&&!available.length;
  if(main){
   PaperUI.set(go,'查看阅读结果');
   PaperUI.set(feedbackHint,'主文「'+bounded(main.name,95)+'」已就绪 · '+main.model.rows.length+' 段可定位原文。','Ready · '+main.model.rows.length+' source passages');
  }else if(available.length){
   const unique=available.length===1;
   feedbackHint.textContent=unique?'已读到「'+bounded(available[0].name,100)+'」，但它还不是主文。若这是你想读的论文，可直接设为主文，不用再传。':'已经有 '+available.length+' 份可读材料，还没有主文。可以选一份设为主文，不用再传。';
   PaperUI.set(go,'设为主文并查看','Set as main paper');
   if(!unique){
    choice.replaceChildren();
    const first=add(choice,'option','选择一份已读材料');first.value='';
    for(const item of available){const o=add(choice,'option',bounded(item.name,100)+' · '+roles[item.role]);o.value=String(item.id);}
    choice.value=available.some(item=>String(item.id)===previous)?previous:'';
    go.disabled=!choice.value;
   }
  }
 }
 function openReadable(){
  let item=currentMain();
  if(!item){
   const available=auxiliaries();
   item=available.length===1?available[0]:available.find(d=>String(d.id)===choice.value);
   if(!item)return;
   const changed=makeMain(item);notice('已设为主文：「'+bounded(item.name,100)+'」。'+changed);
  }
  if(activeDoc!==item.id){activeDoc=item.id;activeSection=-1;loaded=PAGE;}
  readMode='map';
  render();
  const focus=reader.querySelector('[data-pl-focus]');
  focus?.focus({preventScroll:true});reader.scrollIntoView?.({block:'start'});
 }
 function makeMain(item){
  const previous=currentMain();
  if(previous===item)return '';
  if(previous)previous.role='related';
  item.role='main';activeDoc=item.id;activeSection=-1;loaded=PAGE;readMode='map';startFigureScan(item);
  return previous?'已把原主文「'+previous.name+'」移到参考文献／知识资料；角色仍可修改。':'';
 }
 function pushItem(name,result,key,role,problem='',pdfFile=null){
  const model=extract(result||{});
  const item={id:++serial,name,key,model,problem,pdfFile,pdfUrl:'',role:role==='main'?'unset':role,
   warnings:listOf(result?.warnings).map(x=>typeof x==='string'?x:x?.message).filter(Boolean).slice(0,8)};
  if(!problem&&!model.rows.length&&!pdfFile)item.problem='没有读到可用的文字，可能没有文字层。可选有文字层的 PDF、DOCX，或粘贴一段原文。';
  items.push(item);
  const isMain=role==='main'&&!item.problem;
  const change=isMain?makeMain(item):'';
  render(isMain);
  return {item,change};
 }
 function enqueue(selected,role){
  if(!selected.length)return;
  const stem=bounded(inline(selected[0].name)||'未命名文件',110);
  pending++;
  notice(pending>1?'已排队：'+stem+'。当前读取完成后会继续。':'正在本地读取：'+stem+(selected.length>1?' 等 '+selected.length+' 份材料':'')+'。','loading');
  async function work(){
   let success=0,limited=0,changes=[],failed=[],duplicates=[];
   try{
    for(const file of selected){
     const name=bounded(inline(file.name)||'未命名文件',180);
     if(role==='main'&&missingId){
      if(await PaperShelf.fingerprint(file)!==missingId){failed.push([name,'文件指纹与待恢复论文不符。请选择原 PDF，或刷新后开始另一篇。']);continue}
      missingId='';
     }
     const key=JSON.stringify([file.name,file.size,file.lastModified]);
     const duplicate=items.find(d=>d.key===key);
     if(duplicate){
      if(role==='main'&&!duplicate.problem){
       const already=duplicate.role==='main';
       if(!already){const note=makeMain(duplicate);if(note)changes.push(note);render();}
       changes.unshift(already?'「'+bounded(name,100)+'」已经是可读主文，无需重新上传。':'已把清单里的「'+bounded(name,100)+'」设为主文，无需重新上传。');
      }else if(duplicate.problem)failed.push([name,duplicate.problem]);
      else duplicates.push(name);
      continue;
     }
     if(items.length>=MAX_FILES){limited++;continue;}
     notice('正在本地读取：'+bounded(name,130)+'。','loading');
     try{
      if(!/.(pdf|docx|txt)$/i.test(file.name))throw Error('格式暂不支持。请选择 PDF、DOCX 或 TXT，或粘贴原文。');
      let result;
      if(/.txt$/i.test(file.name)){
       if(file.size>600000)throw Error('TXT 过长。请选取所需片段，或复制要精读的部分。');
       result={records:pastedRecords(await file.text())};
      }else{
       const parser=window.PaperStoryDocuments;
       if(!parser?.read)throw Error('文件读取器未能加载。可先粘贴原文。');
       result=await parser.read(file,{maxRecords:MAX_RECORDS,maxChars:MAX_TEXT});
      }
      const beforeMain=currentMain();
      const {item,change}=pushItem(name,result,key,role,'',/.pdf$/i.test(file.name)?file:null);
      if(!beforeMain&&role==='main'&&!item.problem&&item.pdfFile&&window.PaperFigureExtractor?.scan&&window.FigureReadingWorkbench?.mount){
       window.requestAnimationFrame?.(()=>{
        if(currentMain()===item&&!reader.hidden&&!reader.closest?.('[role=tabpanel][hidden]')){
         reader.scrollIntoView?.({block:'start'});
         reader.querySelector('[data-pl-focus]')?.focus({preventScroll:true});
        }
       });
      }
      if(change)changes.push(change);
      if(item.problem)failed.push([name,item.problem]);else success++;
     }catch(error){
      const reason=bounded(normal(error?.message)||'文件暂时无法读取，请换一份文件或粘贴原文。',280);
      pushItem(name,{},key,role,reason,/\.pdf$/i.test(file.name)?file:null);failed.push([name,reason]);
     }
    }
   }finally{pending--;}
   const summary=[];
   if(success)summary.push('已读取 '+success+' 份。');
   if(changes.length)summary.push(...changes);
   if(failed.length){
    for(const [name,why] of failed.slice(0,2))summary.push('未读到「'+bounded(name,90)+'」：'+why);
    if(failed.length>2)summary.push('另有 '+(failed.length-2)+' 份未读到原文，可在材料清单查看。');
    if(currentMain())summary.push('已有主文仍可读；这次失败不影响现有结果。');
   }
   if(duplicates.length)summary.push('已在清单、没有重复添加：'+duplicates.slice(0,3).map(x=>'「'+bounded(x,65)+'」').join('、')+(duplicates.length>3?' 等 '+duplicates.length+' 份':'')+'。');
   if(limited)summary.push(limited+' 份未添加：本次上限是 '+MAX_FILES+' 份，移除不需要的材料后可再加。');
   if(pending)summary.push('其余材料仍在排队。');
   const report=[success ? 'Read '+success+' file(s).' : '',failed.length ? failed.length+' file(s) could not be read.' : '', duplicates.length?'Duplicate files skipped.':'', limited?'File limit reached.':'',failed.some(([,reason])=>reason.includes('文件指纹'))?'Choose the original PDF to match its fingerprint.':''].filter(Boolean).join(' ');
   if(role==='supplement'&&success)figureHandle?.refreshSupplement();
   notice(summary.join(' ')||'已检查选择的材料。',failed.length||limited?'warn':'ready',role,report||'File list updated.');
  }
  queue=queue.then(work).catch(()=>{
   notice('这一批材料未能完整处理。已读材料仍保留；可重新选择未读文件，或粘贴原文。','warn',role);
  });
 }
 function select(item,index=-1){
  activeDoc=item.id;activeSection=index;loaded=PAGE;
  render();
  const focus=reader.querySelector('[data-pl-focus]');
  if(focus)focus.focus();
 }
 function remove(item){
  const i=items.indexOf(item);items.splice(i,1);revoke(item);
  const wasActive=activeDoc===item.id;
  if(wasActive){activeDoc=(currentMain()||items[i]||items[i-1])?.id??null;activeSection=-1;loaded=PAGE;}
  notice('已移除 '+item.name+'。');render(wasActive||item.role==='main');if(item.role==='supplement')figureHandle?.refreshSupplement();
  (files.querySelector('button')||primaryInput).focus();
 }
 function showDOIs(parent,values){
  if(!values.length)return;
  const links=add(parent,'div',undefined,'pl-links');
  for(const doi of values){
   const a=add(links,'a','原文 DOI：'+doi);
   a.href='https://doi.org/'+doi.split('/').map(encodeURIComponent).join('/');
   a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';
  }
  addUI(parent,'small','链接来自原文中的 DOI；未在后台联网核验。','muted');
 }
 function raw(parent,item,record){
  const panel=add(parent,'article',undefined,'pl-excerpt');
  const anchor=add(panel,'div',item.name+' · '+record.location,'pl-anchor');
  if(item.pdfFile&&record.page&&window.URL?.createObjectURL){
   try{
    if(!item.pdfUrl)item.pdfUrl=window.URL.createObjectURL(item.pdfFile.type==='application/pdf'?item.pdfFile:item.pdfFile.slice(0,item.pdfFile.size,'application/pdf'));
    anchor.append(doc.createTextNode(' · '));
    const link=PaperUI.set(add(anchor,'a'),'打开 PDF 第 '+record.page+' 页','Open PDF · p.'+record.page);
    link.href=item.pdfUrl+'#page='+record.page;link.target='_blank';link.rel='noopener noreferrer';
    link.title='在支持 PDF 预览的浏览器中打开本地原文；部分手机不能定位到指定页。';
   }catch{/* the adjacent excerpt and source location remain available */}
  }
  add(panel,'blockquote',record.text);
  return panel;
 }
 function disclosure(parent,title,item,records){
  const details=add(parent,'details',undefined,'pl-gap');
  add(details,'summary',title);
  details.addEventListener('toggle',()=>{
   if(!details.open||details.getAttribute('data-pl-read'))return;
   details.setAttribute('data-pl-read','true');
   const context=add(details,'div',undefined,'pl-context');
   for(const row of records)raw(context,item,row);
   showDOIs(context,[...new Set(records.flatMap(row=>sourceDOIs(row.text)))].slice(0,8));
  });
 }
 function refreshCross(context){
  const {target,item,token}=context;
  const candidates=items.filter(d=>d.id!==item.id&&d.role==='supplement').flatMap(d=>(d.model.captions.get(token)||[]).map(cap=>({d,cap})));
  const signature=candidates.length===1?String(candidates[0].d.id)+':'+candidates[0].cap.location:String(candidates.length);
  if(context.signature===signature)return;
  context.signature=signature;
  target.replaceChildren();
  if(candidates.length===1)disclosure(target,figureLabel(token)+' · 补充材料中编号一致，归属待核对',candidates[0].d,[candidates[0].cap]);
  else add(target,'p',figureLabel(token)+(candidates.length?'：有多个同号补充图注，未自动对应。':'：未找到可唯一对应的图注。'),'muted pl-gap');
 }
 function contextLinks(parent,item,row){
  for(const token of row.mentions||[]){
   const same=item.model.captions.get(token)||[];
   if(same.length===1)disclosure(parent,figureLabel(token)+' · 同一文件的图表图注',item,same);
   else if(same.length>1)add(parent,'p',figureLabel(token)+'：同一文件内有重号，未自动对应。','muted pl-gap');
   else if(token.includes(':S')&&item.role==='main'){
    const context={target:add(parent,'div'),item,token,signature:null};
    crossContexts.push(context);refreshCross(context);
   }else add(parent,'p',figureLabel(token)+'：未找到可唯一对应的图注。','muted pl-gap');
  }
  const unmatched=[];
  for(const number of row.cites||[]){
   const hits=item.model.references.get(number)||[];
   if(hits.length===1)disclosure(parent,'引用 ['+number+'] · 同一文件的参考文献',item,hits[0].rows);
   else unmatched.push('['+number+']');
  }
  if(unmatched.length)addUI(parent,'p','未能唯一匹配本文件的编号引用：'+unmatched.join('、')+'。','muted pl-gap');
 }
 function render(refreshReader=true){
  if(typeof queueMicrotask==='function')queueMicrotask(()=>syncLoaded());
  intake.hidden=exampleMode;
  overview.hidden=exampleMode||!items.length;
  if(exampleMode){
   clearMap();crossContexts.length=0;reader.replaceChildren();reader.hidden=false;
   if(!graphContents(null,true)){addUI(reader,'p','导读示例暂未载入，请稍后重试。','muted');action(reader,'返回放入自己的文献',leaveExample);}
   return;
  }
  updateFeedback();
  files.replaceChildren();
  if(!items.length){clearMap();crossContexts.length=0;reader.replaceChildren();reader.hidden=true;return;}
  const main=currentMain();
  const count=items.filter(x=>!x.problem).length;
  overviewText.textContent=items.length+' 份材料 · '+count+' 份可读。'+(main?'主文：'+main.name+'。':'请选择一篇可读取的主文开始。补充材料与参考资料可先保留。')+'角色可以修改，不代表系统确认了证据归属。';
  for(const item of items){
   const row=add(files,'div',undefined,'pl-source');
   const open=action(row,item.name+(item.problem?' · '+item.problem:' · '+item.model.rows.length+' 段原文'),()=>{
    if(!main&&!item.problem){notice('这份材料已经可读。请先把想读的论文设为主文，可用上传框下的按钮。');go.focus();return;}
    if(item.problem)sourceMode(item);else mapMode(item);
   },'dataNode pl-open');
   open.setAttribute('aria-pressed',String(activeDoc===item.id));
   const chooser=addUI(row,'label','角色','pl-role');
   const dropdown=add(chooser,'select');
   dropdown.setAttribute('aria-label',item.name+' 的材料角色');
   for(const [value,txt] of Object.entries(roles)){const opt=add(dropdown,'option',txt);opt.value=value;}
   dropdown.value=item.role;
   dropdown.addEventListener('change',()=>{
    const next=dropdown.value;
    if(next==='main'&&item.problem){dropdown.value=item.role;notice('这份文件没有可读原文，未设为主文。可粘贴原文。','warn');return;}
    if(next==='main')notice('已将「'+item.name+'」设为主文。'+makeMain(item));
    else{item.role=next;notice('已更新「'+item.name+'」的角色。');}
    render();
    const available=files.querySelectorAll('select');if(available[items.indexOf(item)])available[items.indexOf(item)].focus();
   });
   const del=action(row,'移除',()=>remove(item));del.setAttribute('aria-label','移除 '+item.name);
  }
  if(!refreshReader){for(const context of crossContexts)refreshCross(context);return;}
  clearMap();crossContexts.length=0;
  reader.replaceChildren();
  const selected=items.find(d=>d.id===activeDoc);
  reader.hidden=!selected||(!main&&!selected.problem);
  if(reader.hidden)return;
  if(!selected.problem&&readMode==='map'&&figureContents(selected))return;
  if(!selected.problem&&(readMode==='map'||readMode==='graph')&&graphContents(selected))return;
  const rawTop=add(reader,'div',undefined,'pl-reader-top');
  if(!selected.problem&&window.PaperMindMap?.mount)action(rawTop,selected.pdfFile&&window.FigureReadingWorkbench?.mount?'返回原图工作台':'返回脑图',()=>mapMode(selected));
  const title=add(reader,'h3',selected.name);title.tabIndex=-1;title.setAttribute('data-pl-focus','');
  add(reader,'p',roles[selected.role]+' · 只查看这份原文。相关论文与主论文各自保留来源；不把它们混为作者的证据。','muted');
  if(selected.problem)add(reader,'p',selected.problem,'state warn pl-gap');
  if(selected.warnings.length){
   const warnings=add(reader,'details',undefined,'entryDetails');addUI(warnings,'summary','阅读范围与限制');
   for(const w of selected.warnings)add(warnings,'p',bounded(w,420),'muted');
  }
  if(selected.model.cap)addUI(reader,'p','内容超过本轮阅读范围；只索引部分文字。可粘贴未读章节另行查看。','muted pl-gap');
  if(!selected.model.rows.length)return;
  const groupCount=selected.model.sections.filter(x=>x.key!=='unclassified').length;
  if(!groupCount)addUI(reader,'p','没识别到可靠的段落标题。可按原始顺序阅读，但不推断问题、方法或结论。','muted pl-gap');
  else if(!selected.model.sections.some(x=>x.key==='question'))addUI(reader,'p','没有找到明确标注的研究目的段。可从摘要或引言核对，不代拟原文没有说的科学问题。','muted pl-gap');
  addUI(reader,'p','按原文标题、图表编号与方括号引用定位。PDF 页序或段落边界可能不完整；原文未标识的关系不会补写。','muted pl-gap');
  const nav=add(reader,'nav',undefined,'pl-nav');nav.setAttribute('aria-label','原文段落目录');
  const overviewButton=action(nav,'按原文顺序',()=>select(selected,-1));overviewButton.setAttribute('aria-pressed',String(activeSection===-1));
  if(selected.model.captions.size){const captionButton=action(nav,'所有已识别图表图注',()=>select(selected,-2));captionButton.setAttribute('aria-pressed',String(activeSection===-2));}
  selected.model.sections.forEach((section,i)=>{
   const caption=sectionNames[section.key]||'原文';
   const shown=section.title===caption?caption:caption+' · '+bounded(section.title,44);
   const b=action(nav,shown,()=>select(selected,i));PaperUI.set(b,shown,PaperUI.english(caption));b.setAttribute('aria-pressed',String(activeSection===i));
  });
  const section=selected.model.sections[activeSection];
  const list=activeSection===-2?Array.from(selected.model.captions.values()).flat():section?.rows||selected.model.rows;
  add(reader,'h4',activeSection===-2?'所有已识别图表图注':section?.title||'按原文顺序（可点目录跳读）','pl-heading');
  for(const record of list.slice(0,loaded)){
   const panel=raw(reader,selected,record);
   showDOIs(panel,sourceDOIs(record.text));
   contextLinks(panel,selected,record);
  }
  if(list.length>loaded)action(reader,'继续显示原文（还有 '+(list.length-loaded)+' 段）',()=>{
   const previous=loaded;loaded+=PAGE;render();
   const children=reader.querySelectorAll('.pl-excerpt');
   if(children[previous]){children[previous].tabIndex=-1;children[previous].focus();}
  });
 }
 try{if(window.PaperReadingEditions?.example&&new URLSearchParams(window.location?.search||'').get('demo')==='reading')showExample();
 else if(sampleRequested && !PaperShelf.target())tryPaper.click();
 else shelf.restore().catch(()=>notice('本地缓存不可用，请选择 PDF。','warn'));
 window.addEventListener('hashchange',()=>{if(PaperShelf.target())shelf.restore()});
 }catch{}
}
window.PaperLiterature = Object.freeze({mount});
})();
