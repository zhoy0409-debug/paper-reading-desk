/* Localize interface text in place so the current figure, form values and PDF stay intact. */
(() => {
  'use strict';
  const key = 'paper-reader-language';
  const requested=new URLSearchParams(location.search).get('lang');
  let language=/^zh/i.test(navigator.language)?'zh':'en';
  try {const saved=localStorage.getItem(key);if(['zh','en'].includes(saved))language=saved;} catch {}
  if(['en','zh'].includes(requested))language=requested;
  const texts = new WeakMap(), attributes = new WeakMap();
  const dictionary = new Map(Object.entries(window.ReaderEnglish || {}));
  const ignored = 'script,style,textarea,pre,blockquote,cite,svg,canvas,.textLayer,[contenteditable=true],[data-source-text],[data-language-switch]';
  const managedAttrs = ['aria-label','aria-description','placeholder','title','alt'];
  function translation(text) {
    if (!text) return;
    const exact = dictionary.get(text) || PaperUI.english(text);
    if (exact) return exact;
    for (const [pattern, formatter] of patterns) {
      const match = text.match(pattern);
      if (match) return formatter(...match);
    }
  }
  const patterns = [
    [/^([A-Z]) · (确认身份|交代样品质量|展示实测性能|展示功能差异|考察跨批复现|建立功能现象|提出候选解释|区分竞争解释)$/, (_,letter,s) => letter+' · '+translation(s)],
    [/^(.+?) ／ (已勾选|待补证据)$/, (_,s,state) => (translation(s)||s)+' · '+translation(state)],
    [/^缺少：(.+?)。这个缺口限制的是当前主线的结论，不等于整篇稿件一定不能做。$/, (_,s) => 'Missing: '+s.split('、').map(t=>translation(t)||t).join(', ')+'. This limits the current claim.'],
    [/^(.+?) 当前实际缺少：(.+?)。后面的结果不能替代这些证据。$/, (_,a,b) => (translation(a)||a)+' Missing: '+b.split('、').map(t=>translation(t)||t).join(', ')+'.'],
    [/^可转向「(.+?)」：(.+)$/, (_,a,b) => (translation(a)||a)+': '+(translation(b)||b)],
    [/^原路线收束：(.+)$/, (_,s) => 'Original route: '+(translation(s)||s)],
    [/^建议检索词：(.+)$/, (_,s) => 'Suggested: '+s],
    [/^核对随问题使用的原文（(\d+) 段）$/, (_,n) => 'Source passages (' + n + ')'],
    [/^查看检索文献（(\d+)）$/, (_,n) => 'Literature results (' + n + ')'],
    [/^(.*?)（待配置）$/, (_,s) => (translation(s) || s) + ' (setup required)'],
    [/^(.*?) · 受测临床分离株$/, (_,s) => s + ' · Clinical isolate tested'],
    [/^小图 ([A-Za-z0-9]+)$/, (_,s) => 'Panel ' + s],
    [/^(整图图注|所点表格行|研究目的原句|引文所在句|提及本图的正文|小图图注|参考文献(?: \[\d+\])?) · p\.(\d+)$/, (_,s,n) => (translation(s) || 'Reference') + ' · p.' + n],
    [/^参考文献 \[(\d+)\]$/, (_,n) => 'Reference [' + n + ']'],
    [/^PDF 第 (\d+) 页$/, (_,n) => 'PDF p.' + n]
  ];
  function choose(zh,en) { return language === 'en' && en ? en : zh; }
  function bind(textNode, zh, en) {
    if (!en || !textNode) return;
    const record = {zh, en, shown:choose(zh,en)};
    texts.set(textNode,record);
    if (textNode.data !== record.shown) textNode.data = record.shown;
  }
  function write(element, zh, en) {
    const value = String(zh ?? '');
    const node = document.createTextNode(value);
    element.replaceChildren(node);
    bind(node,value,en || translation(value));
    return element;
  }
  function bilingual(value) {
    if (!value || !/[\u3400-\u9fff]/.test(value)) return;
    const m = value.match(/^(.+?)\s+\/\s+([^\u3400-\u9fff]+)$/);
    return m && [m[1],m[2]];
  }
  function refreshText(node) {
    const record = texts.get(node);
    if (record && node.data === record.shown) {
      record.shown = choose(record.zh,record.en);
      if (node.data !== record.shown) node.data = record.shown;
    } else {
      if (record) texts.delete(node);
      const val = node.data.trim();
      if (!val || !/[\u3400-\u9fff]/.test(val)) return;
      const en = translation(val);
      const parts = en ? [val,en] : node.parentElement?.matches('button,summary,label,small,option,legend,.frw-issue') && bilingual(val);
      if (parts) bind(node,node.data.replace(val,parts[0]),node.data.replace(val,parts[1]));
    }
  }
  function refreshAttrs(el) {
    for (const attr of managedAttrs) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr);
      const store = attributes.get(el) || {};
      let r = store[attr];
      if (!r || r.shown !== current) {
        const en = translation(current);
        const parts = en ? [current,en] : bilingual(current);
        if (!parts) continue;
        r = store[attr] = {zh:parts[0],en:parts[1]}; attributes.set(el,store);
      }
      r.shown = choose(r.zh,r.en);
      if (r.shown !== current) el.setAttribute(attr,r.shown);
    }
  }
  function visit(node) {
    if (node.nodeType === 3) { refreshText(node); return; }
    if (node.nodeType !== 1) return;
    if (node.matches('textarea')) { refreshAttrs(node); return; }
    if (node.matches(ignored)) return;
    refreshAttrs(node);
    for (const child of Array.from(node.children)) {
      if (!child.matches('.ui-en, .rq-en, .uploadHero h1 > [lang=en],header.top strong > [lang=en]')) continue;
      const zh = child.previousSibling;
      if (zh?.nodeType !== 3 || !zh.data.trim()) continue;
      bind(zh,zh.data.trim(),child.textContent.trim());
      child.remove();
    }
    for (const child of node.childNodes) visit(child);
  }
  function updateHeader() {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = choose('文献精读','Reading Desk');
    const group = document.querySelector('[data-language-switch]');
    group.setAttribute('aria-label',choose('界面语言','Interface language'));
    for (const button of group.querySelectorAll('button')) button.setAttribute('aria-pressed',String(button.dataset.locale===language));
  }
  function switchTo(next) {
    if (!['zh','en'].includes(next) || next===language) return;
    language = next;
    try { localStorage.setItem(key,next); } catch {}
    updateHeader();
    visit(document.body);
    document.dispatchEvent(new CustomEvent('reader-language-change',{detail:{language}}));
  }
  const header = document.querySelector('[data-language-switch]');
  header.addEventListener('click',e=>{const target=e.target.closest('button[data-locale]');if(target)switchTo(target.dataset.locale)});
  window.ReaderLanguage = {choose,write,get current(){return language}};
  window.PaperUI.set = write;
  updateHeader();
  visit(document.body);
  const observer = new MutationObserver(changes=>{
    for (const change of changes) {
      const parent = change.target.nodeType===1 ? change.target : change.target.parentElement;
      if (!parent?.isConnected || (parent.closest(ignored) && !(change.type==='attributes' && parent.matches('textarea')))) continue;
      if (change.type==='attributes') refreshAttrs(parent);
      else if (change.type==='characterData') refreshText(change.target);
      else if (Array.from(change.addedNodes).some(n=>n.nodeType===1 && n.matches('.ui-en,.rq-en'))) visit(parent);
      else for (const n of change.addedNodes) if (n.isConnected) visit(n);
    }
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:managedAttrs});
})();
