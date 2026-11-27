const popup = document.createElement('section');
popup.className = 'local-translation';
popup.hidden = true;
popup.setAttribute('aria-label', '所选文字的操作 / Selection actions');

const actions = document.createElement('div');
actions.className = 'selection-actions';
function action(kind, label, accessibleLabel) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'selection-' + kind;
  const icon = document.createElement('span');
  icon.className = 'selection-icon';
  icon.setAttribute('aria-hidden', 'true');
  const title = document.createElement('span');
  title.textContent = label;
  button.append(icon);
  if (label) button.append(title);
  button.setAttribute('aria-label', accessibleLabel);
  button.title = accessibleLabel;
  actions.append(button);
  return button;
}
const run = action('translate', '译为中文', '译为中文 / Translate to Chinese');
const precision=action('precision','科研精译','科研精译 / Scientific translation');
precision.firstElementChild.remove();PaperUI.set(precision.lastElementChild,'科研精译','Refine');
const online = action('online', '百度翻译', '用百度翻译打开选段 / Open selection in Baidu Translate');
online.firstElementChild.remove();
PaperUI.set(online.lastElementChild,'百度翻译','Baidu Translate');
const listen = action('speak', '听英文', '听英文 / Listen in English');
PaperUI.set(listen.lastElementChild,'听英文','Listen');
const ask = action('ask', '问 AI', '就所选文字提问 / Ask AI');
const copy=action('copy','复制译文','复制译文 / Copy translation');
copy.firstElementChild.remove();PaperUI.set(copy.lastElementChild,'复制译文','Copy');
copy.hidden=true;
const close = action('close', '', '关闭 / Close translation toolbar');
const output = document.createElement('p');
output.setAttribute('role', 'status');
const original = document.createElement('details');
const summary = document.createElement('summary');
const quote = document.createElement('blockquote');
const notice = document.createElement('small');
summary.textContent = '对照所选原文';
original.append(summary, quote);
original.hidden = notice.hidden = true;
const definition = document.createElement('div');
definition.className = 'rq-term-definition'; definition.hidden = true;
function detail(zh,en){
  const d=document.createElement('details');
  d.append(PaperUI.set(document.createElement('summary'),zh,en));return d;
}
function button(zh,en,click){
  const b=PaperUI.set(document.createElement('button'),zh,en);b.type='button';b.onclick=click;return b;
}
const reviews=detail('逐句核对','Review sentences'),terms=detail('术语对照','Terminology'),
  diagnostics=detail('引擎与其他操作','Engine and other actions');
const reviewList=document.createElement('div'),termList=document.createElement('div'),
  engineInfo=document.createElement('small'),precisionPane=document.createElement('div');
precisionPane.hidden=reviews.hidden=terms.hidden=true;
precisionPane.className='selection-precision-pane';
reviews.className='selection-review';terms.className='selection-terms';
reviews.append(reviewList);terms.append(termList);
diagnostics.append(engineInfo,online,ask,button('清除模型文件缓存','Clear cached model files',async()=>{
  try{await PaperLanguageText.clearModelCache();PaperUI.set(engineInfo,'模型文件缓存已清除。','Cached model files cleared.')}
  catch{PaperUI.set(engineInfo,'浏览器无法清除模型缓存。','This browser could not clear its model cache.')}
}));
const cancel=button('取消翻译','Cancel',()=>{active?.cancel();paint()});cancel.hidden=true;
cancel.className='selection-cancel';
const reverse=button('本机回译核对（首次约 52 MiB）','Compare back-translation (52 MiB on first use)',async()=>{
  const s=active;if(!s||s.busy)return;
  try{const done=s.compareBack();paint();await done}
  catch(e){if(s===active&&e.name!=='AbortError'){notice.hidden=false;notice.textContent=failedMessage(e);PaperLanguageText.report(e,'local back-translation')}}
});
diagnostics.insertBefore(reverse,online);reverse.hidden=true;
popup.append(actions, definition, precisionPane, output, notice,cancel,reviews,terms,original,diagnostics);
document.body.append(popup);

let selected = '', source = '', request = 0, timer;
let active,readingAnchor,locationLabel='',progressBytes=new Map();
let activeRange, frame, settle;
// A gloss is keyed to the verified expansion, since the same initials can mean different things.
const glosses = new Map([
  ['bronchoalveolar lavage fluid',['支气管肺泡灌洗液。从小气道和肺泡区域回收的液体，可用于检测其中的细胞或可溶性成分。','Fluid recovered from the small airways and air sacs during lavage.']],
  ['stochastic neighbor embedding',['随机邻居嵌入。一种降维方法，目标是让原数据中相近的点在低维图上也靠近。','A method for representing high-dimensional data while keeping similar observations close together.']],
  ['confidence interval',['置信区间。看上下限之间有多宽，可以了解估计值的精度。','The width between the lower and upper limits indicates the precision of the estimate.']],
  ['minimum inhibitory concentration',['最低抑菌浓度。在规定试验条件下，能抑制可见生长的最低药物浓度。','The lowest drug concentration that prevents visible growth under the test conditions.']]
]);
function showDefinition(anchor, value) {
  definition.replaceChildren(); definition.hidden = true;
  if (!anchor || value.length > 15) return;
  anchor.dispatchEvent(new CustomEvent('reader-find-definition', {bubbles:true,detail:{
    term:value,receive(entries,locate) {
      if (!entries.length) return;
      const label = PaperUI.set(document.createElement('small'),'本文全称','Expansion in this paper');
      definition.append(label);
      for (const entry of entries) {
        const row = document.createElement('div'), full = document.createElement('span');
        full.dataset.sourceText = ''; full.textContent = entry.full;
        const link = document.createElement('button'); link.type = 'button';
        PaperUI.set(link,'第 '+entry.page+' 页','p.'+entry.page);
        link.onclick = () => {
          const origin = anchor.closest('.rq-source-note')?.querySelector('summary') || anchor;
          if (!origin.matches('a,button,input,summary,[tabindex]')) origin.tabIndex=-1;
          hide(); locate(entry.page,entry.text,null,origin);
        };
        row.append(full, link); definition.append(row);
        const gloss = glosses.get(entry.full.toLowerCase().replace(/concentrations$/, 'concentration'));
        if (gloss) {
          const explanation = document.createElement('p'); explanation.className = 'rq-term-gloss';
          PaperUI.set(explanation, ...gloss); definition.append(explanation);
        }
      }
      definition.hidden = false;
    }
  }}));
}
function translateLabel(label, english) {
  PaperUI.set(run.lastElementChild,label,english);
  run.setAttribute('aria-label', label + ' / ' + english);
  run.title = label + ' / ' + english;
}
function hide() {
  clearTimeout(timer);
  clearTimeout(settle);
  cancelAnimationFrame(frame);
  popup.hidden = true;
  invalidate();
  selected = ''; definition.replaceChildren(); definition.hidden = true;
  activeRange = null;
  request++;
  output.textContent = '';
  notice.hidden = original.hidden = true;
  original.open = false;
}
function invalidate(){
  const previous=active;active=null;previous?.cancel();progressBytes.clear();
  precision.disabled=false;
  reverse.hidden=true;
  precisionPane.replaceChildren();precisionPane.hidden=reviews.hidden=terms.hidden=copy.hidden=cancel.hidden=true;
  reviews.open=terms.open=diagnostics.open=false;
  reviewList.replaceChildren();termList.replaceChildren();engineInfo.textContent='';readingAnchor=null;
}
listen.onclick = () => {
  const sourceNode=activeRange?.startContainer;
  const anchor=sourceNode?.nodeType===1 ? sourceNode : sourceNode?.parentElement;
  const options={text:selected, sentence:EnglishPractice.selectionSentence(anchor,selected),origin:anchor};
  if(anchor?.closest('.frw,.ea-explorer'))document.dispatchEvent(new CustomEvent('reader-practice-context',{detail:options}));
  hide();getSelection()?.removeAllRanges();EnglishPractice.open(options);
};
online.onclick = () => {
  if (!selected) return;
  const url = new URL('https://fanyi.baidu.com/mtpe-individual/multimodal');
  url.searchParams.set('lang',source==='en'?'en2zh':'zh2en');
  url.searchParams.set('query',selected);
  if (url.href.length <= 7000) {
    window.open(url.href,'_blank','noopener,noreferrer');
    return;
  }
  const copied = navigator.clipboard?.writeText(selected);
  window.open(url.origin,'_blank','noopener,noreferrer');
  Promise.resolve(copied).then(()=>{
    if(copied)PaperUI.set(output,'选段已复制，可粘贴到百度翻译。','Selection copied. Paste it into Baidu Translate.');
    else PaperUI.set(output,'请复制所选段落，粘贴到百度翻译。','Copy the selection and paste it into Baidu Translate.');
  },()=>PaperUI.set(output,'请复制所选段落，粘贴到百度翻译。','Copy the selection and paste it into Baidu Translate.'));
};
ask.onclick = () => {
  const text = selected;
  hide();
  document.dispatchEvent(new CustomEvent('reader-ask-selection', {detail:{text}}));
};

// Sample compact floating widgets at the candidate position, including shadow hosts.
// Do not change the browser's or another extension's UI.
function covered(left, top, width, height) {
  const y = top + Math.min(actions.offsetHeight + 12, height) / 2;
  const seen = new Set();
  for (let x = left + 10; x < left + width; x += 18) {
    for (let item of document.elementsFromPoint(x, y)) {
      if (popup.contains(item) || item.contains(popup)) continue;
      for (; item && !item.contains(popup); item = item.parentElement) {
        if (seen.has(item)) break;
        seen.add(item);
        const css = getComputedStyle(item);
        if (css.position !== 'fixed' && !(css.position === 'absolute' && Number(css.zIndex) > 10)) continue;
        const rect = item.getBoundingClientRect();
        if (rect.width > 0 && rect.width <= 150 && rect.height <= 100) return true;
      }
    }
  }
  return false;
}
function place() {
  if (popup.hidden || !activeRange) return;
  if (!activeRange.startContainer.isConnected) {hide();return}
  const rect = activeRange.getBoundingClientRect();
  const vp = window.visualViewport;
  const left = vp?.offsetLeft || 0, top = vp?.offsetTop || 0;
  const right = left + (vp?.width || innerWidth), bottom = top + (vp?.height || innerHeight);
  if (!rect.height || rect.bottom < top || rect.top > bottom || rect.right < left || rect.left > right) {hide(); return}
  popup.style.setProperty('--selection-width', Math.max(1, right-left-16) + 'px');
  popup.style.setProperty('--selection-height', Math.max(1, bottom-top-16) + 'px');
  const w = popup.offsetWidth, h = popup.offsetHeight, gap = 16;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const x = clamp(rect.left, left + 8, right - w - 8);
  const above = rect.top - gap - h, below = rect.bottom + gap;
  const sides = [above, below];
  if (above < top + 8) sides.reverse();
  const candidates = [];
  for (const y of sides) {
    if (y >= top + 8 && y + h <= bottom - 8) candidates.push([x, y]);
  }
  for (const xx of [rect.right + gap, rect.left - w - gap]) {
    if (xx >= left + 8 && xx + w <= right - 8) candidates.push([xx, clamp(rect.top, top + 8, bottom - h - 8)]);
  }
  if (!candidates.length) candidates.push([x, clamp(sides[0], top + 8, bottom - h - 8)]);
  const [xx, yy] = candidates.find(([cx, cy]) => !covered(cx, cy, w, h)) || candidates[0];
  popup.style.left = Math.round(xx) + 'px';
  popup.style.top = Math.round(yy) + 'px';
}
function schedulePlace() {
  if (popup.hidden) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(place);
}
function selectedText(selection){
  const range=selection.getRangeAt(0);
  const excerpt=node=>(node.nodeType===1?node:node.parentElement)?.closest('.pl-excerpt > blockquote');
  const first=excerpt(range.startContainer),last=excerpt(range.endContainer);
  if(!first||!last||first===last||first.parentElement.parentElement!==last.parentElement.parentElement)
    return selection.toString().trim();
  // The source index displays each PDF line next to its own page link. Only
  // the intersecting source text belongs to a multi-line selection.
  const lines=[];
  for(let item=first.parentElement;item;item=item.nextElementSibling){
    const quote=item.querySelector(':scope > blockquote');
    if(!quote)continue;
    const part=range.cloneRange();
    part.selectNodeContents(quote);
    if(quote===first)part.setStart(range.startContainer,range.startOffset);
    if(quote===last)part.setEnd(range.endContainer,range.endOffset);
    lines.push(part.toString());
    if(quote===last)break;
  }
  return lines.join('\n').trim();
}
function update() {
  const selection = getSelection(), node = selection?.anchorNode;
  if (popup.contains(node)) return;
  if (selection?.isCollapsed && popup.contains(document.activeElement)) return;
  const value = selection?.rangeCount && selectedText(selection);
  if (!value || !/[a-z\p{Script=Han}]/iu.test(value)) {hide(); return}
  const anchor = node?.nodeType === 1 ? node : node?.parentElement;
  if(anchor?.closest('.english-practice') || document.querySelector('.english-practice[open]')){hide();return;}
  listen.hidden=!/[a-z]/i.test(value) || /\p{Script=Han}/u.test(value) || value.length>900;
  const parent = anchor?.closest('dialog[open]') || document.body;
  if (popup.parentNode !== parent) parent.append(popup);
  const range=selection.getRangeAt(0);
  if (value !== selected||activeRange?.startContainer!==range.startContainer||activeRange?.startOffset!==range.startOffset) {
    invalidate();
    request++;
    output.textContent = '';
    output.removeAttribute('lang');
    delete output.dataset.sourceText;
    delete popup.dataset.translationStage;
    delete popup.dataset.translationState;
    run.disabled = false;
    original.hidden = notice.hidden = true;
    original.open = false;
  }
  activeRange=range.cloneRange();readingAnchor=anchor;
  locationLabel=anchor?.closest('.pl-excerpt')?.querySelector('.pl-anchor')?.textContent?.trim()||'';
  PaperUI.set(summary,'对照所选原文'+(locationLabel?' · '+locationLabel:''),'Compare source'+(locationLabel?' · '+locationLabel:''));
  const allowed = anchor?.closest('.frw,.ea-explorer') && !anchor.closest('input,textarea,[contenteditable=true],.pd-report,.rq-ask');
  ask.hidden = !allowed || !document.querySelector('.rq-ask');
  showDefinition(anchor, value);
  selected = value;
  source = /\p{Script=Han}/u.test(value) ? 'zh' : 'en';
  if (!run.disabled && popup.dataset.translationState!=='error') translateLabel(source === 'en' ? '译为中文' : '译为英文', source === 'en' ? 'Translate to Chinese' : 'Translate to English');
  popup.hidden = false;
  place();
  clearTimeout(settle);
  settle = setTimeout(schedulePlace, 350);
}

const failures={
  model:['翻译模型配置不完整或模型加载失败。','The translation model is missing or could not be loaded.'],
  download:['翻译资源下载失败。请检查网络，然后重试此选段。','A translation resource could not be downloaded. Check your connection and retry this selection.'],
  integrity:['翻译资源未通过 SHA-256 校验。请重试此选段。','A translation file could not be verified with SHA-256. Retry this selection.'],
  worker:['翻译 Worker 或 WASM 初始化失败。请重试此选段。','The translation Worker or WASM runtime could not start. Retry this selection.'],
  timeout:['此选段翻译超时，可单独重试。','Translation timed out. Retry this selection.'],
  empty:['翻译引擎没有返回译文，可单独重试。','The translation engine returned no text. Retry this selection.'],
  facts:['译文中的数值、单位、图号或标识符与原文不一致。','A number, unit, figure reference or identifier differs from the selection.'],
  terms:['译文中的专业名称未能与原文对应。','A scientific term could not be matched to the selection.'],
  validation:['译文未通过原文核对，可单独重试。','The translation did not pass the source checks. Retry this selection.'],
  translate:['翻译引擎处理此选段时出错，可单独重试。','The engine could not translate this selection. Retry this selection.']
};
const bilingual=(zh,en)=>window.ReaderLanguage?.current==='en'?en:zh;
const issueText={
  quantity:['数值或单位','quantity or unit'],group:['组别对应','group comparison'],direction:['变化方向','direction'],
  identifier:['标识符','identifier'],statistic:['统计量','statistic'],figure:['图号','figure'],panel:['分图','panel'],
  significance:['统计显著性','significance'],negation:['否定关系','negation'],causality:['因果关系','causality'],
  term:['术语用法','terminology'],'retained-term':['保留英文术语','retained term'],referent:['跨句指代','cross-sentence reference'],
  relation:['比较关系','comparison'],'chemical-name':['化学名称待核对','chemical names to verify'],alignment:['回译中未找到的原文词','words missing in back-translation'],'alignment-unavailable':['回译未完成','back-translation unavailable'],
  'fragmented-prose':['分段恢复后的句意','meaning after fragment recovery'],'source-check':['原文对应','source correspondence']
};
function failedMessage(e){
  const key=e?.stage==='validation'&&['facts','terms'].includes(e.reason)?e.reason:e?.stage;
  return bilingual(...(failures[key]||failures.translate));
}
async function getSession(){
  if(active)return active;
  const id=request,text=selected;
  if(!text||text.length>8000)throw Object.assign(new Error(bilingual('每次最多选择 8000 个字符。','Select up to 8,000 characters.')),{stage:'length'});
  const context=EnglishPractice.selectionSentence(readingAnchor,text)||text;
  const {createTranslationSession}=await PaperLanguageText.session();
  if(id!==request)return;
  if(!active){
    const s=createTranslationSession({source:text,from:source,field:PaperLanguageText.field,context,
      onUpdate:()=>{if(active===s)paint()}});
    active=s;
  }
  return active;
}
function paint(){
  if(!active||popup.hidden)return;
  const us=active.units,n=us.length,ok=us.filter(u=>u.status==='translated').length,
    needs=us.filter(u=>u.status==='review'||u.status==='failed'),busy=active.busy;
  const any=us.some(u=>u.text),allFailed=us.every(u=>u.status==='failed');
  const state=busy?'pending':allFailed?'error':ok===n?'translated':needs.length?'partial':'paused';
  popup.dataset.translationState=state;delete popup.dataset.translationStage;
  run.disabled=busy||ok===n;cancel.hidden=!busy;precision.disabled=busy;
  copy.hidden=!any;copy.disabled=busy;
  quote.textContent=selected;original.hidden=false;
  const name=n===1&&us[0].name;
  reverse.hidden=!active.canCompare;reverse.disabled=busy||us.every(u=>u.backTranslation||!u.text||u.name);
  if(name)popup.dataset.translationState='name';
  if(busy)translateLabel('翻译中','Translating');
  else if(name)translateLabel('保留原名','Original name');
  else if(ok===n)translateLabel('已翻译','Translated');
  else translateLabel(state==='paused'?'继续翻译':'重试未完成',state==='paused'?'Resume':'Retry unfinished');
  if(allFailed){
    popup.dataset.translationStage=us[0].error?.stage||'translate';
    output.textContent=failedMessage(us[0].error);
  }else if(any){
    output.textContent=us.map((u,i)=>{
      if(u.text&&!u.validation?.issues.some(x=>x.severity==='severe'))return u.text;
      if(u.status==='review')return bilingual('〔第 '+(i+1)+' 句待核对〕','[Review sentence '+(i+1)+']');
      if(u.status==='failed')return bilingual('〔第 '+(i+1)+' 句待重试〕','[Retry sentence '+(i+1)+']');
      return '';
    }).filter(Boolean).join(source==='en'?'':' ');
    output.lang=source==='en'?'zh-CN':'en';output.dataset.sourceText='';
  }else output.textContent=busy?bilingual('正在本机翻译…','Translating on this device…'):'';
  if(!any){output.removeAttribute('lang');delete output.dataset.sourceText}
  notice.hidden=false;
  if(name)PaperUI.set(notice,'这个名称保留原拼写。','The name retains its original spelling.');
  else if(ok===n)PaperUI.set(notice,'已完成 '+n+' 句 · 机械核对通过','Completed '+n+' · automated checks passed');
  else PaperUI.set(notice,'已通过机械核对 '+ok+' / '+n+' 句'+(needs.length?' · '+needs.length+' 句需要处理':''),
    ok+' / '+n+' passed automated checks'+(needs.length?' · '+needs.length+' to review':''));
  reviews.hidden=!needs.length;
  if(!busy){
    reviewList.replaceChildren();
    us.forEach((u,i)=>{
      if(!needs.includes(u))return;
      const row=document.createElement('div');row.className='translation-unit';
      const label=document.createElement('strong');label.textContent=bilingual('第 '+(i+1)+' 句','Sentence '+(i+1));
      const raw=document.createElement('div');raw.textContent=u.source;
      const why=document.createElement('small');
      why.textContent=u.error?failedMessage(u.error):(u.validation?.issues||[]).map(v=>bilingual(...(issueText[v.code]||['原文对应','source correspondence']))+(v.detail&&(v.code==='alignment'||!v.detail.includes(' '))?' '+v.detail:'')).join(' · ');
      row.append(label,raw);
      if(u.text){const candidate=document.createElement('div');candidate.textContent=bilingual('待核对译文　','Candidate　')+u.text;row.append(candidate)}
      row.append(why,button('仅重试此句','Retry sentence',()=>translate([u.id])));
      reviewList.append(row);if(u.error)PaperLanguageText.report(u.error,'selection');
    });
  }
  const pairs=new Map(us.flatMap(u=>u.terms.map(t=>[t.original,t.value])));
  terms.hidden=!pairs.size;termList.textContent=[...pairs].map(([a,b])=>a+' · '+b).join('\n');
  engineInfo.textContent=us.map((u,i)=>u.attempts?String(i+1)+' · '+u.engine+' · '+u.attempts+'×'+(u.refineError?' · '+u.refineError:'')+(u.backTranslation?'\n'+u.backTranslation:''):'').filter(Boolean).join('\n');
  schedulePlace();
}
async function translate(ids){
  if(!selected||active?.busy)return;
  const id=request;run.disabled=true;precision.disabled=true;
  quote.textContent=selected;original.hidden=false;
  try{
    const s=await getSession();if(!s||id!==request)return;
    await s.run({ids:Array.isArray(ids)?ids:undefined});
  }catch(e){
    if(id!==request)return;
    PaperLanguageText.report(e,'selection');run.disabled=precision.disabled=false;
    popup.dataset.translationState='error';popup.dataset.translationStage=e.stage||'translate';
    output.textContent=e.stage==='length'?e.message:failedMessage(e);translateLabel('重试翻译','Retry translation');
  }
}
copy.onclick=async()=>{
  if(!active)return;
  try{await navigator.clipboard.writeText(output.textContent);PaperUI.set(notice,'译文已复制。','Translation copied.')}
  catch{PaperUI.set(notice,'请选中译文并复制。','Select the translated text to copy it.')}
};
document.addEventListener('translation-download',({detail:d})=>{
  if(!active?.busy||!/\.(?:bin|spm)$/.test(d.url))return;
  progressBytes.set(d.url,d.bytes);
  const mb=([...progressBytes.values()].reduce((a,b)=>a+b,0)/1048576).toFixed(1);
  notice.hidden=false;PaperUI.set(notice,'正在读取模型文件 · 已接收 '+mb+' MiB','Loading model files · '+mb+' MiB received');
});
precision.onclick=async()=>{
  const id=request;
  if(!precisionPane.hidden){precisionPane.hidden=true;return}
  try{
    const s=await getSession();if(!s||id!==request||s.busy)return;
    const config=await ReaderAccess.options();if(id!==request)return;
    precisionPane.replaceChildren();precisionPane.hidden=false;
    const provider=document.createElement('select');provider.setAttribute('aria-label',bilingual('精译服务','Translation provider'));
    const services={deepseek:'DeepSeek',qwen:'Qwen · 北京',...(ReaderAccess.local&&config.available?.ollama?{ollama:'Ollama · 本机'}:{})};
    for(const [key,label] of Object.entries(services)){const option=document.createElement('option');option.value=key;option.textContent=label;provider.append(option)}
    provider.value=Object.keys(services).find(k=>config.available?.[k])||'deepseek';
    const context=document.createElement('input');context.type='checkbox';
    const contextLabel=document.createElement('label');contextLabel.append(context,document.createTextNode(bilingual('附上当前选段作上下文','Include selected passage as context')));
    const preview=document.createElement('pre'),message=document.createElement('small'),keys=document.createElement('div');
    const send=button('同意发送并精译','Send and refine',async()=>{
      if(id!==request||s.busy)return;
      const payload=shown;send.disabled=true;run.disabled=true;cancel.hidden=false;
      try{await s.refine(payload,ReaderAccess.translate);
        if(id===request)message.textContent=s.units.find(u=>u.refineError)?.refineError||bilingual('已收到精译。','Refinement received.')}
      catch(e){if(id===request&&e.name!=='AbortError'){message.textContent=e.message;PaperLanguageText.report(e,'precision')}}
      finally{if(id===request){paint();refresh()}}
    });
    let shown,availability=config;
    function refresh(){
      shown=s.precisionRequest(provider.value,context.checked);
      const msg=shown.message;
      preview.textContent=[...msg.units.map(u=>u.text),...(msg.context?[msg.context]:[]),...msg.terms.map(p=>p.join(' · '))].join('\n\n');
      send.disabled=!availability.available?.[provider.value]||s.busy;
      for(const opt of provider.options)opt.dataset.needsKey=String(!availability.available?.[opt.value]);
      info.textContent=provider.value==='ollama'?bilingual('发送至本机 Ollama。','Send to local Ollama.'):
        bilingual('以下文字将发送至 '+services[provider.value]+'，使用你的模型额度。','The text below will be sent to '+services[provider.value]+' using your account.');
    }
    const info=document.createElement('small');refresh();
    ReaderAccess.connections(keys,provider,next=>{availability=next;refresh()});
    provider.addEventListener('change',refresh);context.onchange=refresh;
    precisionPane.append(provider,info,contextLabel,preview,keys,send,message);
    schedulePlace();
  }catch(e){if(id===request){notice.hidden=false;notice.textContent=e.message;PaperLanguageText.report(e,'precision')}}
};

// Pointer activation keeps the native range; keyboard activation uses real buttons.
popup.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault() });
run.onclick = translate;
document.addEventListener('paper-field-change',hide);
document.addEventListener('reader-language-change',hide);
document.addEventListener('change',event=>{if(event.target.matches?.('input[type=file]'))hide()},true);
close.onclick = hide;
document.addEventListener('selectionchange', () => { clearTimeout(timer); timer = setTimeout(update, 100) });
document.addEventListener('pointerdown', e => { if (!popup.hidden && !popup.contains(e.target)) hide() }, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !popup.hidden) {
    e.preventDefault();
    e.stopPropagation();
    hide();
  }
}, true);
new ResizeObserver(schedulePlace).observe(popup);
window.addEventListener('resize', schedulePlace);
document.addEventListener('scroll', e => { if (!popup.contains(e.target)) schedulePlace() }, true);
window.visualViewport?.addEventListener('resize', schedulePlace);
window.visualViewport?.addEventListener('scroll', schedulePlace);
window.addEventListener('pagehide', hide);
