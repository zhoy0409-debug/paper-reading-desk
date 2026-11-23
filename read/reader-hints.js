(() => {
  'use strict';
  const flyout = document.createElement('div');
  flyout.id = 'reader-help-text'; flyout.className = 'reader-tip'; flyout.setAttribute('role','tooltip'); flyout.hidden = true;
  document.body.append(flyout);
  let active, timer, pinned = false;
  const messages = new WeakMap();
  function position() {
    if (!active?.isConnected || !active.getClientRects().length) return dismiss();
    const r = active.getBoundingClientRect(), box = flyout.getBoundingClientRect();
    const x = Math.max(8, Math.min(r.left + r.width / 2 - box.width / 2, innerWidth - box.width - 8));
    const y = r.bottom + 8 + box.height <= innerHeight ? r.bottom + 8 : Math.max(8,r.top - box.height - 8);
    flyout.style.left = x + 'px'; flyout.style.top = y + 'px';
  }
  function dismiss() {
    clearTimeout(timer);
    if (active) active.removeAttribute('aria-describedby');
    flyout.hidden = true; active = null; pinned = false;
  }
  function show(button) {
    if (!button.isConnected) return;
    if (active !== button) dismiss();
    active = button;
    const host=button.closest('dialog[open]')||document.body;
    if(flyout.parentElement!==host)host.append(flyout);
    flyout.textContent = ReaderLanguage.choose(...messages.get(button));
    flyout.hidden = false; button.setAttribute('aria-describedby',flyout.id); position();
  }
  function soon(button) {
    clearTimeout(timer); timer = setTimeout(()=>show(button),260);
  }
  function leave() {
    clearTimeout(timer); if (!pinned) timer = setTimeout(dismiss,100);
  }
  function create(zh,en,labelZh='操作说明',labelEn='Help') {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'reader-help'; b.textContent = '?';
    b.setAttribute('aria-label',labelZh+' / '+labelEn); messages.set(b,[zh,en]);
    b.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')soon(b)});
    b.addEventListener('pointerleave',leave);
    b.addEventListener('focus',()=>show(b)); b.addEventListener('blur',dismiss);
    let touch=false;
    b.addEventListener('pointerdown',e=>{touch=e.pointerType==='touch'||e.pointerType==='pen'});
    b.addEventListener('click',e=>{if(active===b&&pinned){dismiss();return}show(b);pinned=touch||e.detail===0;touch=false});
    return b;
  }
  flyout.addEventListener('pointerenter',()=>clearTimeout(timer)); flyout.addEventListener('pointerleave',leave);
  document.addEventListener('pointerdown',e=>{if(active&&e.target!==active&&!flyout.contains(e.target))dismiss()},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){dismiss();e.stopPropagation()}},true);
  document.addEventListener('reader-language-change',dismiss);
  window.addEventListener('scroll',()=>{if(active)position()},{capture:true,passive:true});
  window.addEventListener('resize',()=>{if(active)position()});
  function headingHelp(selector, zh, en) {
    const title = document.querySelector(selector);
    if (!title) return;
    const row = document.createElement('div'); row.className = 'reader-title-row';
    title.before(row); row.append(title,create(zh,en));
  }
  headingHelp('#sourceHeading','可多选或拖入文件。支持 Word、PDF、图片、文本与表格，最多 12 份，共 80 MB。','Select multiple files or drop them here. Word documents, PDFs, images, text and tables are supported, up to 12 files and 80 MB in total.');
  headingHelp('#optionalDemo .evidence h2','勾选已有证据可查看各条论证路线如何变化。本例采用虚构数据。','Select the available evidence to see how each route changes in this fictional example.');
  window.ReaderHints = {create};
})();
