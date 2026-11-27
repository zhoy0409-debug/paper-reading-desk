import {selectionTranslation} from './scientific-translation.js?rev=reader-0415d';

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
const online = action('online', '百度翻译', '用百度翻译打开选段 / Open selection in Baidu Translate');
online.firstElementChild.remove();
PaperUI.set(online.lastElementChild,'百度翻译','Baidu Translate');
const listen = action('speak', '听英文', '听英文 / Listen in English');
PaperUI.set(listen.lastElementChild,'听英文','Listen');
const ask = action('ask', '问 AI', '就所选文字提问 / Ask AI');
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
popup.append(actions, definition, output, notice, original);
document.body.append(popup);

let selected = '', source = '', request = 0, ignore = false, timer;
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
  selected = ''; definition.replaceChildren(); definition.hidden = true;
  activeRange = null;
  ignore = false;
  request++;
  output.textContent = '';
  notice.hidden = original.hidden = true;
  original.open = false;
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
function update() {
  const selection = getSelection(), node = selection?.anchorNode;
  if (ignore || popup.contains(node)) return;
  if (selection?.isCollapsed && popup.contains(document.activeElement)) return;
  const value = selection?.toString().trim();
  if (!value || !selection.rangeCount || !/[a-z\p{Script=Han}]/iu.test(value)) {hide(); return}
  const anchor = node?.nodeType === 1 ? node : node?.parentElement;
  if(anchor?.closest('.english-practice') || document.querySelector('.english-practice[open]')){hide();return;}
  listen.hidden=!/[a-z]/i.test(value) || /\p{Script=Han}/u.test(value) || value.length>900;
  const parent = anchor?.closest('dialog[open]') || document.body;
  if (popup.parentNode !== parent) parent.append(popup);
  activeRange = selection.getRangeAt(0).cloneRange();
  if (value !== selected) {
    request++;
    output.textContent = '';
    run.disabled = false;
    original.hidden = notice.hidden = true;
    original.open = false;
  }
  const allowed = anchor?.closest('.frw,.ea-explorer') && !anchor.closest('input,textarea,[contenteditable=true],.pd-report,.rq-ask');
  ask.hidden = !allowed || !document.querySelector('.rq-ask');
  showDefinition(anchor, value);
  selected = value;
  source = /\p{Script=Han}/u.test(value) ? 'zh' : 'en';
  if (!run.disabled) translateLabel(source === 'en' ? '译为中文' : '译为英文', source === 'en' ? 'Translate to Chinese' : 'Translate to English');
  popup.hidden = false;
  place();
  clearTimeout(settle);
  settle = setTimeout(schedulePlace, 350);
}

async function translate(){
  if(!selected||run.disabled)return;
  const id=++request,text=selected,from=source;
  if(text.length>8000){PaperUI.set(output,'每次最多选择 8000 个字符。','Select up to 8,000 characters at a time.');return}
  ignore=true;delete output.dataset.sourceText;run.disabled=true;PaperUI.set(output,'正在本机翻译…','Translating on this device…');
  try{
    const result=await selectionTranslation(text,from,PaperLanguageText.translate);
    if(request!==id)return;
    output.textContent=result.text;output.lang=result.lang;output.dataset.sourceText='';
    quote.textContent=text;original.hidden=false;notice.hidden=!result.name;
    if(result.name)PaperUI.set(notice,'这个名称在中文文献中保留原拼写。','The name keeps its original spelling in Chinese.');
    translateLabel(result.name?'保留原名':'已翻译',result.name?'Original name':'Translated');
    schedulePlace();
  }catch{
    if(request!==id)return;
    run.disabled=false;ignore=false;
    translateLabel('重试翻译','Retry translation');
    PaperUI.set(output,'未能生成可核对的译文，请重试。','Could not verify the translation. Please retry.');
    quote.textContent=text;original.hidden=false;notice.hidden=true;schedulePlace();
  }
}

// Pointer activation keeps the native range; keyboard activation uses real buttons.
popup.addEventListener('pointerdown', e => { if (e.target.closest('button')) e.preventDefault() });
run.onclick = translate;
close.onclick = hide;
document.addEventListener('selectionchange', () => { clearTimeout(timer); timer = setTimeout(update, 100) });
document.addEventListener('pointerdown', e => { if (!popup.hidden && !popup.contains(e.target)) hide() }, true);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !popup.hidden) {
    e.preventDefault();
    e.stopPropagation();
    hide();
  } else if (e.shiftKey && e.key.startsWith('Arrow')) ignore = false;
}, true);
new ResizeObserver(schedulePlace).observe(popup);
window.addEventListener('resize', schedulePlace);
document.addEventListener('scroll', e => { if (!popup.contains(e.target)) schedulePlace() }, true);
window.visualViewport?.addEventListener('resize', schedulePlace);
window.visualViewport?.addEventListener('scroll', schedulePlace);
window.addEventListener('pagehide', hide);
