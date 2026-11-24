(function (global) {
  'use strict';

  let instance = 0;
  const css = `
.frw{--frw-bg:#f7f4ee;--frw-paper:#fffefa;--frw-ink:#242734;--frw-muted:#575969;--frw-rule:#dedad1;--frw-accent:#51457c;--frw-accent-soft:#eee9f5;--frw-amber:#7d4b27;--frw-amber-soft:#f7eddf;box-sizing:border-box;width:100%;max-width:1270px;margin:0 auto;color:var(--frw-ink);background:var(--frw-bg);border:1px solid var(--frw-rule);border-radius:21px;overflow:hidden;font:15px/1.54 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;container-type:inline-size}
.frw *{box-sizing:border-box}.frw [hidden]{display:none!important}.frw h2,.frw h3,.frw p,.frw ol,.frw ul,.frw figure{margin:0}.frw h2,.frw h3,.frw p,.frw li,.frw figcaption{overflow-wrap:anywhere}.frw button,.frw summary,.frw a{touch-action:manipulation}.frw button{color:inherit;font:inherit;cursor:pointer}.frw button:disabled{cursor:default}.frw button:focus-visible,.frw summary:focus-visible,.frw a:focus-visible,.frw [tabindex]:focus-visible{outline:2px solid #795db5;outline-offset:3px}.frw a{color:var(--frw-accent)}
.frw-head{padding:22px clamp(18px,4cqi,39px) 19px;background:linear-gradient(120deg,#f8f4ea,#f9f6f2 54%,#efebf4);border-bottom:1px solid var(--frw-rule)}.frw-issue{display:flex;align-items:center;gap:10px;color:#554771;font-weight:700;font-size:11px;letter-spacing:.12em;text-transform:uppercase}.frw-issue:before{content:"";width:19px;height:2px;background:#8b73ad}.frw-head h2{font-size:clamp(22px,3.4cqi,36px);line-height:1.14;letter-spacing:-.026em;max-width:30ch;margin:9px 0 2px;font-weight:740}.frw-head p{font-size:14px;color:#4c485d;max-width:70ch;margin-top:8px}.frw-body{display:grid;grid-template-columns:minmax(176px,220px) minmax(0,1fr);min-width:0}
.frw-rail{background:#f3f0e9;border-right:1px solid var(--frw-rule);min-width:0;padding:18px 13px 22px 15px}.frw-rail-title{font-size:11px;letter-spacing:.13em;color:var(--frw-muted);font-weight:760;margin:0 4px 13px}.frw-tree-root{width:fit-content;max-width:100%;border:1px solid #d9cee6;border-radius:6px;background:#f9f5fd;padding:4px 8px;color:var(--frw-accent);font-size:13px;font-weight:750;position:relative;margin:0 0 7px 3px}.frw-tree-root:after{content:"";position:absolute;top:100%;left:10px;height:8px;border-left:1px solid #c4b6d1}.frw-rail-groups{margin:0 0 0 13px;border-left:1px solid #c4b6d1;padding:0 0 0 11px}.frw-group+.frw-group{margin-top:13px}.frw-group h3{font-size:12px;line-height:1.4;font-weight:720;color:#666075;padding:1px 3px 5px;position:relative}.frw-group h3:before{content:"";position:absolute;top:10px;left:-12px;width:8px;border-top:1px solid #c4b6d1}.frw-figure-links{list-style:none;padding:0;display:grid;gap:4px}.frw-figure-links li{min-width:0}.frw-figure-link{display:grid;gap:2px;position:relative;width:100%;text-align:left;border:1px solid transparent;border-radius:7px;background:transparent;min-height:42px;padding:6px 7px;color:var(--frw-ink);font-size:13px!important;line-height:1.32}.frw-figure-link:before{content:"";position:absolute;width:8px;left:-12px;top:50%;border-top:1px solid #c4b6d1}.frw-figure-link strong{font-size:12px;color:var(--frw-accent);font-weight:740}.frw-figure-link span{overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.frw-figure-link:hover{background:#f9f6fc}.frw-figure-link[aria-current=true]{background:#fdfaff;border-color:#d3c3e5;box-shadow:inset 2px 0 0 #836ba4}.frw-figure-link[aria-current=true]:before{border-top-color:#846cad}
.frw-main{min-width:0;background:var(--frw-paper);padding:clamp(14px,3cqi,29px)}.frw-figure-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px;margin-bottom:12px}.frw-index{font-size:11px;letter-spacing:.12em;color:var(--frw-accent);font-weight:780;margin-bottom:4px}.frw-figure-head h3{font-size:clamp(21px,3.1cqi,32px);line-height:1.16;letter-spacing:-.022em;font-weight:730}.frw-meta{font-size:12px;color:var(--frw-muted);margin-top:4px!important}.frw-button{min-height:38px;padding:6px 10px;border:1px solid #d8d2de;border-radius:8px;background:#fffefa;white-space:nowrap;font-weight:660!important;font-size:13px!important}.frw-button:hover{background:var(--frw-accent-soft)}.frw-button:disabled{opacity:.45}.frw-primary{color:#fff!important;background:#584881;border-color:#584881}.frw-primary:hover{background:#443467}.frw-icon{min-width:38px;padding-inline:8px}.frw-fit{font-variant-numeric:tabular-nums}
.frw-visual{border:1px solid #ded9e4;border-radius:13px;overflow:hidden;background:#fff;margin:0}.frw-controls{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-bottom:1px solid #e8e3ed;padding:7px 9px;background:#faf8fb}.frw-mode{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:#594b76;font-weight:740}.frw-mode:before{content:"";width:7px;height:7px;background:#927bab;border-radius:50%}.frw-toolbar{display:flex;gap:5px;flex-wrap:wrap}.frw-toolbar .frw-button{min-height:32px}.frw-viewport{min-height:244px;max-height:590px;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;position:relative;padding:14px}.frw-viewport.frw-zoomed{display:block;cursor:grab;touch-action:pan-x pan-y}.frw-viewport.frw-panning{cursor:grabbing}.frw-plate{position:relative;width:min(100%,var(--frw-fit-width,900px));flex:none;flex-shrink:0}.frw-plate img{display:block;width:100%;height:auto;background:white;user-select:none;max-width:none;max-height:none}.frw-target{position:absolute;border:2px solid #7a57b8;border-radius:4px;box-shadow:0 0 0 1px #fff9;pointer-events:none;z-index:1}.frw-target:before{content:attr(data-panel);display:block;width:max-content;position:absolute;bottom:100%;left:-2px;background:#5d408c;color:white;font:750 12px/1.15 system-ui;padding:4px 6px;border-radius:4px 4px 0 0;white-space:nowrap}.frw-target.frw-target-top:before{top:0;bottom:auto;border-radius:0 0 4px 0}.frw-placeholder{text-align:left;color:var(--frw-muted);width:min(100%,390px);padding:22px 15px}.frw-placeholder b{display:block;color:var(--frw-ink);font-size:16px;margin-bottom:4px}.frw-placeholder button{margin-top:12px}.frw-caption{padding:7px 10px;border-top:1px solid #eeeaf1;color:#565361;font-size:11px;min-height:32px}.frw-caption:empty{display:none}
.frw-notes{border-top:1px solid var(--frw-rule);margin-top:15px;padding-top:12px}.frw-notes-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:9px}.frw-notes-top h3{font-size:16px;line-height:1.28}.frw-panel-tabs{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.frw-panel-tab{min-width:37px;min-height:35px;border:1px solid #dcd5e6;background:#fffefa;border-radius:7px;color:var(--frw-accent)!important;font-weight:710!important;font-size:13px!important;padding:3px 8px}.frw-panel-tab[aria-pressed=true]{background:#5e4b87;border-color:#5e4b87;color:#fff!important}.frw-panel-tab:not([aria-pressed=true]):hover{background:var(--frw-accent-soft)}.frw-explain{display:grid;gap:6px;padding:10px 12px;background:#faf8fb;border-left:3px solid #9e86be;border-radius:0 8px 8px 0}.frw-explain strong{font-size:14px;color:#4e3e6b}.frw-explain p{font-size:14px;max-width:64ch;white-space:pre-line}.frw-explain .frw-inline{align-self:start;justify-self:start;border:0;background:transparent;color:var(--frw-accent);text-decoration:underline;text-underline-offset:2px;padding:2px 0;font-size:12px}.frw-boundary{margin-top:8px!important;font-size:12px;color:var(--frw-amber);background:var(--frw-amber-soft);border-radius:6px;padding:6px 8px}.frw-boundary b{margin-right:5px}
.frw-more{margin-top:13px;border-top:1px solid var(--frw-rule)}.frw-more details{padding:6px 0;border-bottom:1px solid var(--frw-rule)}.frw-more summary{display:flex;align-items:center;gap:9px;min-height:35px;font-size:13px;font-weight:680;color:#504264;cursor:pointer;list-style:none}.frw-more summary::-webkit-details-marker{display:none}.frw-more summary:before{content:"+";display:grid;place-items:center;width:18px;height:18px;border-radius:4px;background:#f2edf8;color:#674d8a;font-size:15px}.frw-more details[open] summary:before{content:"−"}.frw-detail-copy{max-width:72ch;padding:2px 1px 7px 25px;font-size:13px;color:var(--frw-muted);white-space:pre-line}.frw-references{list-style:none;padding:2px 0 7px 25px;display:grid;gap:7px}.frw-references li{font-size:13px}.frw-references p{font-size:12px;color:var(--frw-muted);margin-top:2px!important}.frw-references button{min-height:32px;background:none;border:0;padding:0;text-decoration:underline;text-underline-offset:2px;color:var(--frw-accent)}.frw-lesson video{display:block;width:min(100%,445px);aspect-ratio:1;border-radius:9px;background:#f4f1f6;margin:4px 0 8px 25px;max-width:calc(100% - 25px)}.frw-announcement{margin-top:7px!important;font-size:12px;color:var(--frw-amber)}.frw-announcement:empty{display:none}
.frw-ref-actions{display:flex;align-items:center;gap:6px 14px;flex-wrap:wrap;color:var(--frw-accent);font-size:12px}.frw-ref-actions a,.frw-ref-actions button{text-decoration:underline;text-underline-offset:2px}.frw-ref-actions a{display:inline-flex;align-items:center;min-height:32px}
.frw-modal{width:min(95vw,1250px);max-width:none;max-height:94vh;padding:13px;margin:auto;border:1px solid #cfc4dc;border-radius:13px;background:#fffefa;color:var(--frw-ink);overflow:auto;position:fixed;inset:0;z-index:4000}.frw-modal::backdrop{background:#221930b8}.frw-modal-head{display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;align-items:start;padding-bottom:9px}.frw-modal-head strong{font-size:14px}.frw-modal-controls{display:flex;gap:5px;flex-wrap:wrap}.frw-modal .frw-viewport{max-height:calc(94vh - 88px);min-height:125px;border:1px solid #e3dbe9;border-radius:9px}.frw-modal .frw-plate{--frw-fit-width:1100px}.frw-empty{color:var(--frw-muted);padding:28px;font-size:15px}
@container(max-width:700px){.frw-body{grid-template-columns:1fr}.frw-rail{border-right:0;border-bottom:1px solid var(--frw-rule);padding:9px 12px 11px}.frw-rail-title{margin:0 0 4px;font-size:10px}.frw-tree-root{display:none}.frw-rail-groups{margin:0;border:0;padding:2px 0;display:flex;gap:9px;overflow-x:auto;scrollbar-width:thin;overscroll-behavior-inline:contain}.frw-group{flex:none}.frw-group+.frw-group{margin-top:0}.frw-group h3{font-size:10px;padding:0 2px 4px}.frw-group h3:before,.frw-figure-link:before{display:none}.frw-figure-links{display:flex;gap:4px}.frw-figure-link{max-width:128px;min-height:44px;background:#f9f6f0;border-color:#e4ded4;padding:4px 6px}.frw-figure-link span{-webkit-line-clamp:1;font-size:12px}.frw-viewport{min-height:180px;padding:7px}.frw-main{padding:13px}.frw-head{padding:15px 15px 14px}.frw-head h2{font-size:clamp(20px,5.5cqi,29px)}}
@container(max-width:365px){.frw-figure-head{grid-template-columns:1fr}.frw-figure-head>.frw-button{justify-self:start}.frw-mode{font-size:11px}.frw-toolbar .frw-button{font-size:12px!important;padding-inline:6px}.frw-notes-top{gap:7px}}
 .frw.has-ea .frw-body{display:block}
.frw.has-ea .frw-rail{display:none}
@container(min-width:870px){
 .frw.has-ea .frw-main{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,1fr);grid-template-rows:auto auto auto 1fr;grid-template-areas:"heading heading" "visual notes" "visual more" "visual status";column-gap:22px;align-items:start}
 .frw.has-ea .frw-figure-head{grid-area:heading}
 .frw.has-ea .frw-visual{grid-area:visual}
 .frw.has-ea .frw-notes{grid-area:notes;border-top:0;margin:0;padding:0}
 .frw.has-ea .frw-more{grid-area:more}
 .frw.has-ea .frw-announcement{grid-area:status}
}
@media(prefers-reduced-motion:reduce){.frw *{scroll-behavior:auto!important}}
`;

  function string(v, max = 5000) {
    return (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '').trim().slice(0, max);
  }
  function array(v) { return Array.isArray(v) ? v : []; }
  function pageNumber(v) {
    const n = Number(v);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  function region(v) {
    if (!v || v.verified === false) return null;
    const { x, y, width, height } = v;
    return [x, y, width, height].every(x => typeof x === 'number' && Number.isFinite(x)) &&
      x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1.00001 && y + height <= 1.00001 ? {x, y, width, height} : null;
  }
  function normalize(model) {
    model = model || {};
    const ids = new Set();
    const figures = array(model.figures).filter(x=>x && typeof x === 'object').slice(0, 60).map((f, i) => {
      const id = string(f.id, 100) || 'f-' + i;
      if (ids.has(id)) return null;
      ids.add(id);
      const panelIds = new Set();
      return { raw: f, id, label: string(f.label, 55) || `图 ${i + 1}`, title: string(f.title, 150),
        branchTitle:string(f.branchTitle,420),summary: string(f.summary, 480), caption: string(f.caption, 6000), page: pageNumber(f.page ?? f.source?.page),
        group: string(f.group, 40), boundary: string(f.boundary, 320), source: f.source,
        references: array(f.references).filter(Boolean).slice(0,12),
        panels: array(f.panels).filter(x=>x && typeof x === 'object').slice(0, 20).map((p, j) => {
          const label = string(p.label, 24) || String.fromCharCode(65 + j);
          const id = string(p.id, 80) || label;
          if (panelIds.has(id)) return null;
          panelIds.add(id);
          return { raw: p, id, label, title: string(p.title, 120), text: string(p.text, 420),
            boundary: string(p.boundary, 300), source: p.source, page: pageNumber(p.page ?? p.source?.page), region: region(p.region) };
        }).filter(Boolean)
      };
    }).filter(Boolean);
    const ordered=global.EvidenceAtlas?.inPaperOrder?.(figures)||figures,labels=new Map();
    const groups = [];
    for (const g of array(model.groups)) {
      if (!g) continue;
      for(const id of array(g.figureIds))if(!labels.has(id))labels.set(id,string(g.label,50)||'图证据');
    }
    for (const f of ordered) {
      const label=labels.get(f.id)||f.group||'关键图';
      if(groups.at(-1)?.label!==label)groups.push({label,figures:[]});
      groups.at(-1).figures.push(f);
    }
    return { title: string(model.title, 200) || '用图读论文', takeaway: string(model.takeaway, 250),
      sourceLabel: string(model.sourceLabel, 125), rootKind:model.rootKind,rootLabel: string(model.rootLabel, 420) || model.title || '论文主线',
      question: string(model.question, 120), questionEnglish:string(model.questionEnglish,180), curated:Boolean(model.curated), figures: ordered, groups };
  }

  function href(v, doc, kind) {
    const val = string(v, 1600);
    if (!val) return '';
    try {
      const u = new URL(val, doc.baseURI);
      if (kind === 'media') {
        const base = new URL(doc.baseURI);
        return ((u.protocol === base.protocol && u.origin === base.origin && ['https:','http:','file:'].includes(u.protocol)) || u.protocol === 'blob:') ? u.href : '';
      }
      return ['https:','http:'].includes(u.protocol) ? u.href : '';
    } catch (_) { return ''; }
  }

  async function validRaster(blob) {
    if (!(blob instanceof global.Blob) || blob.size < 12 || blob.size > 48 * 1024 * 1024) return false;
    const xs = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const has = (offset, tests) => tests.every((val, i)=>xs[offset+i]===val);
    return has(0, [137,80,78,71,13,10,26,10]) || has(0, [255,216,255]) ||
      (has(0,[82,73,70,70]) && has(8,[87,69,66,80]));
  }

  function mount(container, options) {
    if (!container?.ownerDocument || typeof container.append !== 'function') throw new TypeError('FigureReadingWorkbench.mount requires a DOM element');
    options = options || {};
    const doc = container.ownerDocument, id = 'frw-' + (++instance);
    const el = (tag, label, cls) => {
      const node = doc.createElement(tag);
      if (cls) node.className = cls;
      if (label) node.textContent = label;
      return node;
    };
    const ui = (tag, label, cls) => PaperUI.set(el(tag, '', cls), label);
    const btn = (title, handler, cls = 'frw-button', aria) => {
      const node = ui('button', title, cls);
      node.type = 'button';
      if (aria) {
        const second=PaperUI.english(aria)||(aria.startsWith('小图 ')?'Panel '+aria.slice(3).split('：')[0]:'');
        node.setAttribute('aria-label',second?aria+' / '+second:aria);
      }
      node.addEventListener('click', handler);
      return node;
    };
    const workbench = el('section', '', 'frw');
    const style = el('style', css);
    const header = el('header', '', 'frw-head');
    header.append(el('div', '论文精读 / Figure reading', 'frw-issue'));
    const title = el('h2');
    title.id = id + '-title'; workbench.setAttribute('aria-labelledby', title.id);
    const takeaway = el('p'); header.append(title, takeaway);
    const body = el('div', '', 'frw-body');
    const rail = el('nav', '', 'frw-rail'); rail.setAttribute('aria-label', '论文证据路径');
    const treeRoot = el('div', '', 'frw-tree-root');
    const groups = el('div', '', 'frw-rail-groups');
    rail.append(el('div', '证据路径', 'frw-rail-title'), treeRoot, groups);
    const main = el('section', '', 'frw-main');
    const heading = el('header', '', 'frw-figure-head');
    const headingText = el('div');
    const figIndex = el('div', '', 'frw-index');
    const figTitle = el('h3'); figTitle.id = id + '-fig-title'; figTitle.tabIndex = -1;
    main.setAttribute('aria-labelledby', figTitle.id);
    const figMeta = el('p', '', 'frw-meta');
    headingText.append(figIndex, figTitle, figMeta);
    const sourceButton = btn('打开原文', () => openSource());
    const steps=el('nav','','frw-steps');steps.setAttribute('aria-label','按原文顺读 / Follow figure order');
    const step=direction=>{const next=model.figures[model.figures.indexOf(active)+direction];if(next)selectFigure(next.id)};
    const previousFig=btn('',()=>step(-1),'frw-inline'),nextFig=btn('',()=>step(1),'frw-inline');
    steps.append(previousFig,nextFig,sourceButton);heading.append(headingText,steps);
    const visual = el('figure', '', 'frw-visual');
    const controls = el('div', '', 'frw-controls');
    const modeLabel = el('span', '', 'frw-mode');
    const tools = el('div', '', 'frw-toolbar');
    tools.setAttribute('role', 'group'); tools.setAttribute('aria-label', '原图缩放');
    const minus = btn('−', () => changeScale(-1), 'frw-button frw-icon', '缩小原图');
    const fit = btn('适合窗口', () => changeScale(0), 'frw-button frw-fit', '缩放复位');
    const plus = btn('+', () => changeScale(1), 'frw-button frw-icon', '放大原图');
    const expand = btn('大图', () => openDialog(), 'frw-button', '在大图查看器打开');
    tools.append(minus, fit, plus, expand);
    controls.append(modeLabel, tools);
    const view = el('div', '', 'frw-viewport');
    view.tabIndex = 0; view.setAttribute('role', 'region'); view.setAttribute('aria-label', '原图查看区，可滚动');
    const plate = el('div', '', 'frw-plate');
    const img = el('img'); img.draggable = false; img.decoding = 'async';
    const target = el('div', '', 'frw-target'); target.hidden = true; target.setAttribute('aria-hidden','true');
    plate.append(img, target); plate.hidden = true;
    const placeholder = el('div', '', 'frw-placeholder'); placeholder.setAttribute('role','status');
    const placeholderTitle = el('b'); const placeholderText = el('p');
    const retry = btn('重试加载', () => loadPicture()); retry.hidden = true;
    placeholder.append(placeholderTitle, placeholderText, retry);
    view.append(plate, placeholder);
    const photoCaption = el('figcaption', '', 'frw-caption');
    visual.append(controls, view, photoCaption);
    const notes = el('section', '', 'frw-notes');
    const notesTop = el('div', '', 'frw-notes-top');
    const notesTitle=el('div','','reader-title-row');
    notesTitle.append(ui('h3','这张图怎么看'),ReaderHints.create('选择小图可单独放大。点图中标注看解释，或选中图注文字翻译、追问。','Open a panel for a close-up. Select a figure label for an explanation, or highlight caption text to translate it or ask a question.','读图操作说明','Figure reading help'));notesTop.append(notesTitle);
    const tabs = el('div', '', 'frw-panel-tabs'); tabs.setAttribute('role','group'); tabs.setAttribute('aria-label','原图小图顺序');
    notesTop.append(tabs);
    const explain = el('div', '', 'frw-explain'); explain.setAttribute('aria-live','polite');
    const boundary = el('p', '', 'frw-boundary');
    notes.append(notesTop,explain,boundary);
    const more = el('div', '', 'frw-more');
    const announcement = el('p', '', 'frw-announcement'); announcement.setAttribute('role', 'status');
    main.append(heading, visual, notes, more, announcement);
    const empty = ui('p','还没有可定位的图。可先核对 PDF 原文，再选定要读的图。','frw-empty');
    const modal = el('dialog', '', 'frw-modal');
    const modalHead = el('div', '', 'frw-modal-head');
    const modalTitle = el('strong'); modalTitle.id = id + '-modal-title';
    modal.setAttribute('aria-labelledby', modalTitle.id);
    const modalTools = el('div', '', 'frw-modal-controls');
    const modalMinus = btn('−', () => changeScale(-1, true), 'frw-button frw-icon', '缩小大图');
    const modalFit = btn('适合窗口', () => changeScale(0, true), 'frw-button frw-fit', '大图缩放复位');
    const modalPlus = btn('+', () => changeScale(1, true), 'frw-button frw-icon', '放大大图');
    const close = btn('关闭大图', () => closeDialog(), 'frw-button frw-primary');
    modalTools.append(modalMinus, modalFit, modalPlus, close);
    modalHead.append(modalTitle, modalTools);
    const modalView = el('div', '', 'frw-viewport'); modalView.tabIndex = 0;
    modalView.setAttribute('role','region'); modalView.setAttribute('aria-label','大图查看区，可滚动');
    const modalPlate = el('div', '', 'frw-plate');
    const modalImg = el('img'); modalImg.draggable = false; modalImg.decoding = 'async';
    const modalTarget = el('div', '', 'frw-target'); modalTarget.hidden = true; modalTarget.setAttribute('aria-hidden','true');
    modalPlate.append(modalImg, modalTarget); modalView.append(modalPlate);
    modal.append(modalHead, modalView);
    body.append(rail, main); workbench.append(style, header);
    const atlas = global.EvidenceAtlas?.mount(workbench, {
      restore:()=>options.desk?.state.map,
      remember:value=>{
        if(!options.desk)return;
        options.desk.state.map=value;
        desk?.save();
      },
      onFigure: id => selectFigure(id),
      onPanel: id => readPanel(id),
      onDetail: () => { figTitle.focus({preventScroll:true}); figTitle.scrollIntoView({block:'start'}); }
    });
    if(atlas){
      workbench.classList.add('has-ea');
      const back=btn('',()=>atlas.returnToSelection(),'frw-inline frw-map-back');
      steps.prepend(PaperUI.set(back,'↑ 回到图谱','Back to map'));
    }
    workbench.append(body, empty, modal); container.append(workbench);

    let model = normalize(options.model), active = null, panel = null, disposed = false;
    let currentLesson = options.lesson;
    let generation = 0, viewAsset = null, objectUrl = '', zoom = 0, modalZoom = 0, visiblePicture = false;
    const cache = new Map(), figureButtons = new Map(), panelButtons = new Map();
    const SCALES = [1, 1.38, 2, 2.75];
    const initialSpot=options.desk?.initial||{};
    let pageMode=false,wantedZoom=0;
    const histograms=options.desk&&global.HistogramReader?.create(options.desk.session,options.desk.state,()=>desk.save());
    let histogramFocus=null;
    const plotHits=el('div','','hist-hit-layer');plate.append(plotHits);
    const svg=(name,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n};
    const trace=svg('svg',{class:'curve-trace',viewBox:'0 0 1000 1000',preserveAspectRatio:'none','aria-hidden':'true'});
    plate.append(trace);let hasTrace=false;
    const curveChoices=options.desk?(options.desk.state.curveChoices||={}):{};
    const curvePlots=options.desk?(options.desk.state.curvePlots||={}):{};
    let hitRegions=[];
    const manualHistograms=options.desk&&(options.desk.state.manualHistograms ||= {});
    const compare=options.desk&&global.PaperSourcePane.mount(visual,options.desk.session,n=>openSource({page:n}));
    const desk=options.desk&&global.PaperPanelDesk.mount(options.desk,{
      plate,img,notes,explain,boundary,more,pageMode:()=>pageMode,showFigure:()=>compare?.showFigure(),
      togglePage:()=>{compare?.showFigure();pageMode=!pageMode;cache.delete(active.id);wantedZoom=zoom;loadPicture();rememberSpot()},
      syncPanels:id=>{preparePanels();updateTabs();atlas?.syncPanels();readPanel(id)},
      openPreview:id=>{readPanel(id);visual.scrollIntoView({block:'nearest'});},
      listPanels:()=>{preparePanels();updateTabs();atlas?.syncPanels()}
    });
    const questions=desk&&global.ReadingQuestions?.mount({notes,visual,img,session:options.desk.session,lookupTerm:options.lookupTerm,histograms,desk,selectPanel:readPanel,
      source:inspectPage,resetPanel:()=>{compare?.showFigure();selectPanel(null)}});
    function preparePanels(){
      if(desk&&active)active.panels=desk.panelsFor(active.raw).map(p=>({...p,raw:p}));
    }
    function rememberSpot(){
      if(active&&desk)desk.spot(active.raw,panel?.id,wantedZoom,pageMode);
    }

    function sourceAvailable(f, p) { return typeof options.onOpenSource === 'function' && Boolean(p?.source || p?.page || f?.source || f?.page); }
    workbench.addEventListener('reader-find-definition', event => {
      if (!options.lookupTerm || typeof event.detail?.receive !== 'function') return;
      const page = Number(event.target.closest('[data-page]')?.dataset.page) || active?.page;
      event.detail.receive(options.lookupTerm(event.detail.term,page), inspectPage);
    });
    function inspectPage(page,text,rect,origin){
      if(compare)compare.showPage(page,text,rect,origin);
      else openSource({page});
    }

    function openSource(ref, usePanel) {
      if (!active || typeof options.onOpenSource !== 'function') return;
      const p = usePanel ? panel : null;
      const pPage = pageNumber(ref ? (ref.page ?? ref.source?.page) : (p?.page ?? active.page));
      const src = ref ? ref.source : p?.source || active.source;
      if (!src && !pPage) return;
      announcement.textContent = '';
      try {
        Promise.resolve(options.onOpenSource({figure:active.raw, panel:p?.raw || null, page:pPage, source:src, reference:ref || null})).catch(()=>{
          if (!disposed) announcement.textContent = '没有打开原文。可在原 PDF 查看标注页。';
        });
      } catch (_) { announcement.textContent = '没有打开原文。可在原 PDF 查看标注页。'; }
    }

    function addRail() {
      figureButtons.clear(); groups.replaceChildren(); treeRoot.textContent = model.rootLabel;
      for (const g of model.groups) {
        const group = el('section', '', 'frw-group');
        group.append(el('h3', g.label));
        const list = el('ul', '', 'frw-figure-links');
        for (const f of g.figures) {
          const li = el('li');
          const button = btn('', () => selectFigure(f.id), 'frw-figure-link', f.title ? `${f.label}：${f.title}` : f.label);
          button.title = `${f.label} ${f.title}`.trim();
          button.setAttribute('aria-current', String(f.id === active?.id));
          button.append(el('strong',f.label), el('span',f.title || (f.page ? `原文第 ${f.page} 页` : '打开图证据')));
          figureButtons.set(f.id, button); li.append(button); list.append(li);
        }
        group.append(list); groups.append(group);
      }
    }

    function updateTabs() {
      panelButtons.clear(); tabs.replaceChildren();
      tabs.hidden = !active.panels.length;
      if (tabs.hidden) return;
      for (const p of [null, ...active.panels.filter(p=>!p.raw?.markerParent)]) {
        const key = p?.id || '';
        const button = btn(p?.label || '整图', () => readPanel(p?.id), 'frw-panel-tab', p ? `小图 ${p.label}${p.title ? `：${p.title}` : ''}` : '查看整图说明');
        button.setAttribute('aria-pressed', String(p === panel));
        panelButtons.set(key, button); tabs.append(button);
      }
    }

    function readPanel(panelId) {
      if(!active)return;
      desk?.cancelDrawing();
      compare?.showFigure();
      const reload=Boolean(pageMode && panelId);
      if(reload)pageMode=false;
      selectPanel(panelId);
      if(reload)loadPicture();
    }
    function selectPanel(panelId) {
      if (!active) return;
      panel = active.panels.find(p=>p.id === panelId) || null;
      atlas?.selectPanel(panel?.id);
      for (const [key,b] of panelButtons) b.setAttribute('aria-pressed',String(key === (panel?.raw?.markerParent||panel?.id || '')));
      desk?.select(active.raw,panel?.id||'');
      compare?.select(active,panel,desk.pageRegion()||active.raw.pageBox);
      updateExplanation();renderTarget();rememberSpot();
    }

    function panelOverview(){
      const list=el('ol','','frw-panel-index');
      const printed=active.panels.filter(p=>!p.raw?.markerParent);
      for(const p of printed){
        const g=p.raw?.reading, source=g?.sources.find(s=>s.kind==='小图图注');
        const reported=g?.rows.find(r=>['读到的变化','作者报告的比较'].includes(r.role));
        const description=g?.rows.find(r=>r.role==='原文怎样描述这张图');
        const reading=g?.rows.find(r=>r.role==='怎么读');
        const shared=p.raw?.groupCaption;
        const row=el('li'),jump=btn(p.label,()=>{readPanel(p.id);notesTop.scrollIntoView({block:'nearest'});panelButtons.get(p.id)?.focus({preventScroll:true})},'frw-panel-jump');
        jump.setAttribute('aria-label','阅读小图 '+p.label+' / Read panel '+p.label);
        const body=el('div'),tag=el('small'),copy=el('span');
        const line=g?.rows.find(r=>r.role==='结果说明什么')||reported||reading||description;
        if(line){
          PaperUI.set(tag,line.role,line.en);PaperUI.set(copy,line.zh,line.enText);
        }else if(shared){
          PaperUI.set(tag,'共用图注','Shared caption');copy.textContent=shared.label;
        }else if(source){
          PaperUI.set(tag,'本小图图注','Panel caption');copy.textContent=source.text;
        }else{
          PaperUI.set(tag,'待核对','Check source');PaperUI.set(copy,p.raw?.printedTitle||'请在原页核对这块图的对象与读数。',p.raw?.printedTitle?p.raw.printedTitle:'Check the panel and its readout on the original page.');
        }
        body.append(tag,copy);row.append(jump,body);list.append(row);
      }
      const block=el('details','','frw-panel-outline'),summary=el('summary');
      PaperUI.set(summary,'按小图读这张图（'+printed.length+'）','Read by panel');
      block.append(summary,list);return block;
    }
    function showCurveControls(chart,initial){
      const controls=el('section','','curve-reader'),list=el('div','','curve-keys'),detail=el('div','','curve-detail');
      const summary=el('p','','curve-overview');
      controls.append(PaperUI.set(el('strong'),'沿原图读曲线','Follow a curve'));
      if(chart.k&&chart.ratio)controls.append(PaperUI.set(el('p','','curve-axis-key'),'向右看更小的尺度。纵轴 1 表示与参考功率相等。','Right means smaller scales. A ratio of 1 means equal power.'));
      const mixed=chart.mixed&&!chart.documentRatio&&!chart.ratio?chart.mixed:null;
      if(mixed?.growth)controls.append(PaperUI.set(el('p','','curve-axis-key'),'横轴 a 是宇宙尺度因子，向右越接近今天。a = 0.5 时，两处随宇宙膨胀的地点之间的距离是今天的一半（红移 z = 1）。','The horizontal axis is the scale factor a. Time advances to the right. At a = 0.5, two locations carried by cosmic expansion were half as far apart as today (redshift z = 1).'));
      const equation=el('div','','curve-equation'),evidence=el('details','','curve-evidence');
      controls.append(equation,summary,list,detail);explain.append(controls);
      let plot=initial,index=Math.max(0,chart.entries.findIndex(e=>e.key===curveChoices[active.id])),locate=true;
      let peerIndex=chart.entries.findIndex(e=>e.key===options.desk?.state.curvePeers?.[active.id]);
      const partner=el('select');
      if(mixed&&chart.entries.length>2){
        const label=el('label','','curve-partner');label.append(PaperUI.set(el('span'),'对照曲线','Compare with'),partner);controls.insertBefore(label,detail);
        chart.entries.forEach((entry,i)=>{const option=el('option',entry.name);option.value=String(i);partner.append(option)});
        partner.onchange=()=>{peerIndex=Number(partner.value);if(options.desk)(options.desk.state.curvePeers||={})[active.id]=chart.entries[peerIndex].key;desk?.save();refresh()};
      }
      const toggle=btn('',()=>{locate=!locate;refresh()},'frw-inline');
      controls.append(toggle);
      if(chart.documentRatio){
        const proof=chart.documentRatio;
        evidence.append(PaperUI.set(el('summary'),'核对分母的原文','Check the denominator'));
        for(const [zh,en,quote] of [['图注','Caption',proof.caption],['正文','Article text',proof.body]]){
          const jump=btn('',()=>inspectPage(proof.page,quote),'frw-inline');
          PaperUI.set(jump,zh+' · PDF 第 '+proof.page+' 页',en+' · p.'+proof.page);
          evidence.append(jump,el('blockquote',quote));
        }
        controls.insertBefore(evidence,summary);
      }
      if(mixed?.growth){
        const g=mixed.growth;evidence.append(PaperUI.set(el('summary'),'核对分母与归一化的原文','Check the reference and normalization'));
        for(const [zh,en,source] of [['图注 · 下格分母','Caption · denominator',g.caption],['正文 · 今天的共同终点','Article · matched endpoint',g.body]]){
          if(!source)continue;
          const jump=btn('',()=>inspectPage(source.page,source.text),'frw-inline');
          evidence.append(PaperUI.set(jump,zh+' · p.'+source.page,en),el('blockquote',source.text));
        }
        evidence.append(PaperUI.set(el('small'),g.body?'分母名称见纵轴和图注。引用本图的正文核实了 a = 1 时相同的线性幅度。':'分母名称见纵轴和图注。归一化的正文依据仍待定位。',g.body?'The axis and caption name the denominator. The paragraph citing this figure confirms the shared linear amplitude today.':'The axis and caption name the denominator. The supporting passage for normalization still needs verification.'));
        controls.insertBefore(evidence,summary);
      }
      const buttons=[];
      if(!active.raw.layerStack&&chart.plots.length>1){
        const tabs=el('div','','marker-choices');controls.insertBefore(tabs,equation);
        const pick=p=>{plot=p;curvePlots[active.id]=p.id;desk?.save();compare?.showFigure();refresh()};
        for(const [i,p] of chart.plots.entries()){
          const b=btn('',()=>pick(p),'frw-inline');
          if(p.model)PaperUI.set(b,(i?'下格':'上格')+' · '+p.model,i?'Lower':'Upper');
          else if(mixed)PaperUI.set(b,(i?'下格':'上格')+' · '+p.ordinate.label,i?'Lower':'Upper');
          else if(p.cell)PaperUI.set(b,'第 '+p.cell.row+' 行 · '+p.cell.col+' 列','Row '+p.cell.row+' · col '+p.cell.col);
          else PaperUI.set(b,'第 '+(i+1)+' 格','Plot '+(i+1));b.dataset.plot=p.id;tabs.append(b);
        }
        if(!hitRegions.length&&!active.panels.length){
          hitRegions=chart.plots.map((p,i)=>({rect:p.frame,curveId:p.id,name:'第 '+(i+1)+' 格 · Plot '+(i+1),action:()=>pick(p)}));
          plotHits.replaceChildren(...hitRegions.map(r=>{const b=el('button');b.type='button';b.onclick=r.action;b.setAttribute('aria-label',r.name);return b}));
        }
      }
      for(const [i,e] of chart.entries.entries()){
        const b=btn('',()=>{index=i;locate=true;curveChoices[active.id]=e.key;desk?.save();compare?.showFigure();refresh()},'curve-key');
        const sample=svg('svg',{viewBox:'0 0 44 12',width:'44',height:'12','aria-hidden':'true'});
        sample.append(svg('path',{d:'M1 6H43',fill:'none',stroke:e.color,'stroke-width':'2.5','stroke-dasharray':e.dash.length?e.dash.join(' '):'none'}));
        b.append(sample,el('span',e.name));
        b.append(PaperUI.set(el('small'),e.cn[0]+e.line[0],e.cn[1]+' '+e.line[1]));
        list.append(b);buttons.push(b);
      }
      detail.setAttribute('aria-live','polite');
      function refresh(){
        const e=chart.entries[index],s=plot.series[index],f=plot.frame;
        equation.replaceChildren();equation.hidden=!chart.documentRatio&&!plot.axisReference&&!mixed;
        if(mixed){
          const row=MixedAxes.explanation(chart,plot,e);
          equation.append(el('strong',row.formula,'curve-fraction'),PaperUI.set(el('p'),row.zh,row.en));
          if(mixed.growth&&/^w\s*=\s*[−-]?\d/.test(e.name))equation.append(PaperUI.set(el('small'),'w 表示暗能量压强与能量密度之比。这里每条标有固定 w 的线代表一种模型。','The parameter w is dark-energy pressure divided by energy density. Each constant-w line represents one model.'));
        }else if(chart.documentRatio){
          const r=chart.documentRatio,q=plot.ratioAxis.quantity;
          const term=(model)=>{const n=el('span',q);n.append(el('sub',model),'(k)');return n};
          const fraction=el('strong','','curve-fraction');fraction.append(term(plot.model),' / ',term(r.denominator));
          equation.append(fraction,PaperUI.set(el('p'),(r.z?'在红移 z = '+r.z+'，':'')+'用本格模型预测的功率除以 '+r.denominator+' 在相同 k 和相同参数下的参考功率。1 表示两者相等，1.04 表示模型高估约 4%。',
            (r.z?'At redshift z = '+r.z+', divide':'Divide')+' the model power by the '+r.denominator+' reference at the same k and parameter settings. One means agreement. A ratio of 1.04 is a 4% overprediction.'));
          if(r.cosmologies)equation.append(PaperUI.set(el('small'),(q==='Δ²'?'Δ² 描述这个尺度上物质密度起伏的强弱。':'')+'颜色区分宇宙学参数组。切换上下格时保留所选颜色，改变的是预测方法。k 的单位为 h Mpc⁻¹。',(q==='Δ²'?'Δ² measures the strength of density fluctuations on this scale. ':'')+'Colours identify cosmologies. Switching rows keeps the selected cosmology and changes the prediction method. k is in h Mpc⁻¹.'));
        }else if(plot.axisReference){
          equation.append(PaperUI.set(el('b'),'图内纵轴 · '+plot.condition,'Printed y-axis'),PaperUI.set(el('p'),
            '按轴标题，本格功率除以 '+plot.axisReference+' 条件下同一 k 的功率。1 表示两种条件的功率相同。分母的完整实验或模拟设置仍需核对正文。',
            'The axis divides power in this frame by power at '+plot.axisReference+' at the same k. One means equal power. The full reference conditions still need confirmation in the article.'));
        }
        const overview=chart.documentRatio?(plot.author&&[plot.author.zh,plot.author.en]):CurveReading.overview(chart,plot);
        if(overview)PaperUI.set(summary,...overview);summary.hidden=!overview;
        buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
        for(const b of controls.querySelectorAll('[data-plot]'))b.setAttribute('aria-pressed',String(b.dataset.plot===plot.id));
        detail.replaceChildren(PaperUI.set(el('b'),(plot.condition?plot.condition+' · ':'')+(e.full||e.name)+(e.simulation?' 模拟':''),e.simulation?'Simulation':''));
        const bands=CurveReading.describe(chart,plot,index);
        if(peerIndex<0||peerIndex===index)peerIndex=index===0?1:0;
        let gap;
        if(mixed){
          for(const opt of partner.options)opt.disabled=Number(opt.value)===index;
          partner.value=String(peerIndex);
          gap=MixedAxes.separation(chart,plot,index,peerIndex);
          const block=el('div','','curve-same curve-gap');
          block.append(PaperUI.set(el('b'),'两条线在哪里分开','Where the two curves separate'));
          if(gap?.peak){
            block.append(PaperUI.set(el('p'),gap.zh,gap.en));
            if(mixed.growth&&plot===chart.plots[1])block.append(PaperUI.set(el('p'),'早期参考增长因子也很小，上格很小的绝对差，除以这个参考值后就可能变得明显。今天两条比值都回到 1。','Early on, the reference growth factor is small. A small absolute gap can therefore look large after division. Both ratios return to one today.'));
            block.append(PaperUI.set(el('small'),'括线连接同一横坐标的两条曲线。所给区间按可见线宽估读，精确峰位及重合处的差值待核对。','The bracket joins both curves at the same horizontal position. The interval reflects the width of the printed strokes. The exact peak and differences at overlaps remain unresolved.'));
          }else block.append(PaperUI.set(el('p','','curve-caution'),'线迹、刻度或曲线间距不足以确定最大差别。请对照原图。','The traces, ticks or separation do not resolve a largest gap. Check the original.'));
          detail.append(block);
        }else if(bands.length){
          const dl=el('dl');for(const v of bands)dl.append(el('dt',v.label),PaperUI.set(el('dd'),v.zh,v.en));
          if(chart.documentRatio){const ranges=el('details');ranges.append(PaperUI.set(el('summary'),'按 k 区间查看估读','Read by k interval'),dl);detail.append(ranges)}
          else detail.append(dl);
          const comparison=CurveRatio.sameColor(chart,index);
          if(comparison){
            const block=el('div','','curve-same');block.append(PaperUI.set(el('b'),comparison.name+' · 同色对照','Same colour across rows'));
            for(const r of comparison.rows)block.append(PaperUI.set(el('p'),r.where+' '+r.model+' · '+r.zh,r.enWhere+' · '+r.en));
            detail.insertBefore(block,detail.querySelector('details'));
            detail.append(PaperUI.set(el('small'),'空心圈标出本格在标注刻度范围内估读的最大偏离。线宽以内的差值和精确单点值待核对。','The ring marks the largest sampled departure within the labelled ticks. Exact values and differences smaller than a line width remain unresolved.'));
          }else{
            const text=CurveReading.contrast(chart,index);if(text)detail.append(PaperUI.set(el('p','','curve-compare'),...text));
            if(!active.raw.layerStack&&chart.denominator)detail.append(PaperUI.set(el('p'),'纵轴的分母为 '+chart.denominator+'，比值 1 表示与该参考的功率相等。','The denominator is '+chart.denominator+'. A ratio of one means equal power at that scale.'));
          }
        }else if(s.unresolved)detail.append(PaperUI.set(el('p','','curve-caution'),'图例可读，这一格中未找到唯一匹配的连续线迹。请对照原图核对路径和读数。','The legend is readable, but a unique continuous stroke could not be matched in this cell. Check the original for the path and its values.'));
        else detail.append(PaperUI.set(el('p'),'已按印刷图例定位线型。纵轴数值及各区段的偏离量待核对。','The trace matches the printed legend. Its numerical scale and departures by interval are unverified.'));
        const peer=plot.overlaps.find(pair=>pair.includes(index));
        if(peer){
          const other=chart.entries[peer.find(i=>i!==index)].name;
          detail.append(PaperUI.set(el('p','','curve-caution'),'大部分可见线段与 '+other+' 重合，图上难以分辨细小差值。','Most of the visible trace overlaps '+other+'. Small differences cannot be resolved here.'));
        }else{
          const span=plot.sharedSpans.find(s=>s.a===index||s.b===index);
          if(span){const other=chart.entries[span.a===index?span.b:span.a].name;
            detail.append(PaperUI.set(el('p','','curve-caution'),'在 '+(chart.k?'k ':'')+'≈ '+span.from+'–'+span.to+'，这条线与 '+other+' 靠得太近，差值待核对。','The traces are too close to distinguish from '+other+' over approximately '+span.from+'–'+span.to+'.'))}
        }
        const values=s.ys.filter(y=>y!=null);
        if(values.length&&s.ys.at(-1)==null&&values.at(-1)<.08)detail.append(PaperUI.set(el('p','','curve-caution'),'右侧曲线越过上边框，框外高度无法读出。','The curve leaves through the upper edge. Its height beyond the frame is unreadable.'));
        trace.replaceChildren();let d='',startStroke=true;
        s.ys.forEach((y,j)=>{if(y==null){startStroke=true;return}
          d+=(startStroke?'M':'L')+((f.x+f.width*j/(s.ys.length-1))*1000).toFixed(2)+' '+((f.y+f.height*y)*1000).toFixed(2);startStroke=false});
        // A translucent halo locates the selected source stroke without covering its dash pattern.
        trace.append(svg('path',{d,fill:'none',stroke:e.color,'stroke-opacity':'.26','stroke-width':'7','vector-effect':'non-scaling-stroke','stroke-linejoin':'round'}));
        if(gap?.peak){
          const p=gap.mark,x=1000*(f.x+f.width*p.x),y1=1000*(f.y+f.height*p.one),y2=1000*(f.y+f.height*p.two);
          trace.prepend(svg('rect',{x:1000*(f.x+f.width*gap.band[0]),y:1000*f.y,width:1000*f.width*(gap.band[1]-gap.band[0]),height:1000*f.height,fill:'#c29b49','fill-opacity':'.10'}));
          trace.append(svg('path',{class:'curve-gap-mark',d:'M'+(x-6)+' '+y1+'h12M'+x+' '+y1+'V'+y2+'M'+(x-6)+' '+y2+'h12',fill:'none',stroke:'#263633','stroke-width':'1.5','vector-effect':'non-scaling-stroke'}));
        }
        if(chart.documentRatio&&s.peak)trace.append(svg('circle',{cx:1000*(f.x+s.peak.x*f.width),cy:1000*(f.y+s.peak.position*f.height),r:'9',fill:'none',stroke:e.color,'stroke-width':'2','vector-effect':'non-scaling-stroke'}));
        PaperUI.set(toggle,locate?'隐藏描线':'显示描线',locate?'Hide trace':'Show trace');
        toggle.hidden=!!s.unresolved;toggle.setAttribute('aria-pressed',String(locate&&!s.unresolved));hasTrace=locate&&!s.unresolved;renderTarget();
      }
      refresh();return controls;
    }
    function showCaptionRows(rows){
      const section=el('section','','curve-reader'),tabs=el('div','','marker-choices'),text=el('div','','curve-equation');
      const buttons=[],sides=['upper','lower'];let rowControls;
      section.append(PaperUI.set(el('strong'),'对照原图读上下格','Read the original by row'),tabs,text);
      const select=side=>{curvePlots[active.id]=side;desk?.save();compare?.showFigure();render(side)};
      function render(side){
        rowControls?.remove();hasTrace=false;trace.replaceChildren();
        const passage=rows.passages[side],lower=side==='lower';
        buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(sides[i]===side)));
        const growth=/growth factor/i.test(passage);
        let zh=lower?'下格显示的量见本格图注。':'上格显示的量见本格图注。',en='The caption describes the quantity plotted in this row.';
        if(growth&&!lower){zh='上格比较各模型的线性增长因子，也就是小的密度起伏随宇宙演化的幅度。';en='The upper row compares linear growth factors, which track the amplitude of small density fluctuations.'}
        const model=passage.match(/(?:compared to|relative to|with respect to)\s+(ΛCDM|LCDM)\b/i);
        if(growth&&lower&&/\bratio\b/i.test(passage)&&model){zh='下格用各模型在同一时刻的增长因子除以 ΛCDM 的增长因子。比值 1 表示两者相等。';en='In the lower row, divide each model’s growth factor by the ΛCDM growth factor at the same epoch. One means equality.'}
        text.replaceChildren(PaperUI.set(el('p'),zh,en),el('blockquote',passage));
        if(rows.residual){
          text.replaceChildren();
          for(const [label,title,chinese,english] of ResidualReading.guide(rows.residual,lower)){
            text.append(PaperUI.set(el('strong'),label,title),PaperUI.set(el('p'),chinese,english));
          }
          const proof=el('details','','curve-evidence');
          proof.append(PaperUI.set(el('summary'),'核对原文与公式','Verify against the paper'),el('blockquote',passage));
          const r=rows.residual;
          if(!lower&&r.individual)proof.append(el('p','图注释义：上格的每个点表示一颗超新星的距离模数。'));
          if(lower&&r.reference&&r.scatter)proof.append(el('p','图注释义：下格展示相对于'+r.reference.replace(/^best[- ]fit(?:ting|ted)? cosmology$/i,'最佳拟合宇宙学模型')+'的残差。距离模数采用 '+r.scatter+' 亮度散布模型计算。'));
          if(lower&&rows.residual.body){
            const src=rows.residual.body,jump=btn('',()=>inspectPage(src.page,src.anchor||src.text),'frw-inline');
            proof.append(PaperUI.set(jump,'正文公式 · p.'+src.page,'Article equation'),el('blockquote',src.text));
            proof.append(el('p',src.sign===1?'公式释义：在相同红移分箱内，用测得的距离模数减去宇宙学模型预测的距离模数。':'公式释义：用模型预测的距离模数减去测得的距离模数。'));
          }
          text.append(proof);
        }
        const source=btn('',()=>inspectPage(active.raw.captionPage||active.page,passage),'frw-inline');
        text.append(PaperUI.set(source,'核对本格图注','Locate this caption'));
        if(rows.traceRow===sides.indexOf(side)){
          const chart=active.raw.curveChart;rowControls=showCurveControls(chart,chart.plots[0]);
        }else if(rows.residual)text.append(PaperUI.set(el('small','','curve-caution'),
          rows.frames?'点密集或误差棒重叠处，逐点数值待核对。':'这两段按图注对应上下格。图框边界待核对，请在原页对照。',
          rows.frames?'Individual readings remain unresolved where points or error bars overlap.':'These descriptions follow the caption. Frame bounds are unverified; compare with the original page.'));
        else text.append(PaperUI.set(el('p','','curve-caution'),
          rows.frames?'上下格已定位。单条曲线与图例的对应及数值仍待核对。':'已定位图注，两格图框与单条曲线仍需对照原页核对。',
          rows.frames?'Both frames are located. Individual curve identities and values still need verification.':'The caption is located. Verify both frames and individual curves on the original page.'));
        renderTarget();
      }
      sides.forEach((side,i)=>{const b=btn('',()=>select(side),'frw-inline');buttons.push(b);tabs.append(PaperUI.set(b,i?'下格':'上格',i?'Lower':'Upper'))});
      if(rows.frames){
        hitRegions=rows.frames.map((rect,i)=>({rect,curveId:sides[i],name:i?'下格 Lower':'上格 Upper',action:()=>select(sides[i])}));
        plotHits.replaceChildren(...hitRegions.map(r=>{const b=el('button');b.type='button';b.onclick=r.action;b.setAttribute('aria-label',r.name);return b}));
      }
      explain.append(section);
      render(sides.includes(curvePlots[active.id])?curvePlots[active.id]:'upper');
    }
    function updateExplanation() {
      explain.replaceChildren(); boundary.replaceChildren();
      hasTrace=false;trace.replaceChildren();trace.style.display='none';
      histograms?.reset();histogramFocus=null;hitRegions=[];plotHits.replaceChildren();
      const manual=histograms&&panel?.id.startsWith('manual-')&&desk.pageRegion();
      if(panel?.raw?.gridKey){
        const saved=panel.raw;
        const back=btn('',()=>{
          (options.desk.state.gridSpots ||= {})[active.id]=saved.gridKey;
          if(active.raw.openHistogram){
            (options.desk.state.histogramLayoutMode ||= {})[active.id]=saved.gridKind==='open'?'auto':'manual';
            if(saved.gridKind==='open')(options.desk.state.plotComparisons ||= {})[active.id]=['',saved.gridKey];
          }
          desk.save();selectPanel(saved.gridParent||null);
        },'frw-inline');
        PaperUI.set(back,'回到组图中读','Locate in grid');explain.append(back);
      }
      const manualKey=manual?JSON.stringify([active.id,panel.id,manual]):'';
      const markerPlots=active.panels.filter(p=>p.raw?.layerPosition||p.raw?.markerParent&&(!panel||p.id===panel.id||p.raw.markerParent===(panel.raw?.markerParent||panel.id)));
      const figureBox=active.raw.pageBox,customBox=active.raw.verifiedRegion;
      const sameBox=(a,b)=>a&&b&&['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.0001);
      const originalPlate=!customBox||sameBox(figureBox,customBox);
      if(markerPlots.length&&originalPlate){
        const controls=el('div','','marker-choices');
        const choose=p=>readPanel(p.id);
        const entries=markerPlots.map(p=>{
          const button=btn('',()=>choose(p),'frw-inline');
          const pos=p.raw.layerPosition||(p.raw.markerPosition==='top'?['上图','Upper plot']:['下图','Lower plot']);
          const name=p.raw.layerPosition?(p.id.length===1?' · '+p.label:''):' · '+p.title;
          PaperUI.set(button,pos[0]+name,pos[1]);
          button.setAttribute('aria-pressed',String(p.id===panel?.id));controls.append(button);
          return {rect:p.region,id:p.id,name:button.textContent,action:()=>choose(p)};
        });
        explain.append(controls);hitRegions=entries;
        plotHits.replaceChildren(...entries.map(r=>{const b=el('button');b.type='button';b.title=r.name;b.setAttribute('aria-label',r.name);b.onclick=r.action;return b}));
        if(panel?.raw?.markerAxes){
          const r=panel.region,b=figureBox,expected={x:b.x+r.x*b.width,y:b.y+r.y*b.height,width:r.width*b.width,height:r.height*b.height};
          if(!sameBox(expected,desk.pageRegion()))explain.append(PaperUI.set(el('small'),'当前预览采用你校正的边界。下面的轴标记定位到原图印刷位置。','Your adjusted crop is shown. Axis highlights refer to their printed positions on the original figure.'));
          const nav=el('div','','marker-choices marker-axes');
          const names={circles:'圆点',squares:'方块',triangles:'三角形',diamonds:'菱形'};
          const axes=panel.raw.markerAxes;
          const actions=panel.raw.markerMap.map(m=>[m.side,names[m.shape]+' · '+(m.side==='left'?'左轴':'右轴'),m.shape+' · '+m.side+' axis']);
          for(const [key,zh,en] of [...actions,['x','看下排横轴','Locate bottom x-axis']]){
            const b=btn('',()=>{compare?.showFigure();histogramFocus={rect:axes[key],figureSpace:true,label:zh};renderTarget();
              for(const child of nav.children)child.setAttribute('aria-pressed',String(child===b));},'frw-inline');
            PaperUI.set(b,zh,en);b.setAttribute('aria-pressed','false');nav.append(b);
          }
          explain.append(nav);
        }
      }else if(markerPlots.length){
        explain.append(PaperUI.set(el('small'),'整图边界已手调。请在原页核对各行和坐标轴的位置。','The full-figure bounds have been adjusted. Check row and axis positions on the source page.'));
      }
      const markerNotes=panel?.raw?.markReading||(!panel&&active.raw.markReading);
      const chart=active.raw.curveChart,curvePlot=panel?chart?.plots.find(g=>g.id===panel.id):!active.raw.layerStack&&(chart?.plots.find(g=>g.id===curvePlots[active.id])||chart?.plots[0]);
      if(active.raw.singleHubble&&!panel&&originalPlate){
        const view=HubbleReading.mount(explain,active.raw.singleHubble,{open:inspectPage,mark:p=>{
          trace.replaceChildren();hasTrace=!!p;
          if(p){
            const x=p.x*1000,y=p.y*1000,m=p.model*1000;
            trace.append(svg('path',{d:'M'+x+' '+y+'V'+m+'m-5 0h10',stroke:'#263633','stroke-width':2,fill:'none','vector-effect':'non-scaling-stroke'}),
              svg('circle',{cx:x,cy:y,r:6,stroke:'#116878',fill:'none','stroke-width':2,'vector-effect':'non-scaling-stroke'}));
          }
          renderTarget();
        }});
        hitRegions=[{rect:view.rect}];const hit=el('button');hit.type='button';
        hit.setAttribute('aria-label','在原图比较观测点和拟合线 · Compare a point with the fit');
        hit.onclick=e=>{if(!e.detail){view.example();return}const r=hit.getBoundingClientRect();view.choose((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height)};
        hit.className='hubble-point-hit';plotHits.replaceChildren(hit);
      }
      if(chart&&curvePlot&&originalPlate&&!active.raw.captionRows&&!active.raw.singleHubble)showCurveControls(chart,curvePlot);
      if(active.raw.captionRows&&!panel&&originalPlate)showCaptionRows(active.raw.captionRows);
      if(!chart&&!active.raw.singleHubble&&!active.raw.captionRows&&!panel&&!markerPlots.length&&/\b(?:curves?|solid lines?|dashed lines?|power spectra|power spectrum)\b/i.test(active.caption)){
        explain.append(PaperUI.set(el('p','','curve-caution'),'曲线对应关系待核对。请对照原图图例和图注确认每条线的名称。','Curve identities remain unverified. Check the line samples and names in the printed legend and caption.'));
      }
      if(markerNotes){
        for(const r of markerNotes)explain.append(PaperUI.set(el('p'),r.zh,r.enText));
        explain.append(PaperUI.set(el('small'),'符号和读轴依据来自图注。单点数值待核对。','Symbol assignments come from the caption. Individual values remain unverified.'));
      }
      if(!manual){
        const assignments=DualAxis.explicitSides(active.caption).filter(a=>!panel||a.panel===panel.label.toUpperCase());
        for(const a of assignments){
          const label=a.side==='left'?'左轴':'右轴',scope=a.panel?' · '+a.panel:'';
          const what=DualAxis.describe(a.what);
          const line=PaperUI.set(el('p'),label+scope+'　'+what,a.side+' axis · '+a.what);
          line.className='dual-caption';explain.append(line);
        }
        if(assignments.length)explain.append(PaperUI.set(el('small'),'图注给出了读轴方法。曲线上单点的数值待对照原图。','Axis assignments come from the caption. Individual curve values remain unverified.'));
        else if(!markerPlots.length&&!markerNotes&&!active.raw.openHistogram&&/\b(?:right|left)(?:[- ]hand)?\s+(?:y[- ]?)?axis\b/i.test(panel?panel.raw?.text||'':active.caption)){
          const note=PaperUI.set(el('p'),'图注提到了左右轴，图形与两根轴的对应关系待核对。','The caption mentions an axis assignment. Check which marks belong to each scale on the source page.');
          note.className='dual-unresolved';
          const page=active.raw.captionPage||active.page,source=btn('',()=>inspectPage(page,active.caption),'frw-inline');
          PaperUI.set(source,'看原图注 · p.'+page,'Inspect source caption');explain.append(note,source);
        }
      }
      const scope=manual?(manualHistograms[manualKey]?{caption:'',peers:[],index:-1,page:active.page,manual:true}:null):
        histograms&&(!panel&&active.raw.openHistogram?{caption:active.caption,peers:[],page:active.raw.captionPage||active.page}:global.HistogramEvidence.scope(active.raw,panel?.raw));
      if(manual&&!scope){
        const read=btn('',()=>{manualHistograms[manualKey]=true;desk.save();updateExplanation()},'frw-inline');
        PaperUI.set(read,'这是直方图，读取选区坐标轴','Read this selection as a histogram');explain.append(read);
      }
      if(scope){
        const f=active.raw,p=panel?.raw,box=p?desk.pageRegion():f.pageBox;
        const parent=box||{x:0,y:0,width:1,height:1},layoutId=JSON.stringify([f.page,p?.id||'',parent]);
        if(scope.peers?.length){
          const switcher=el('div','','hist-conditions');
          switcher.setAttribute('role','group');switcher.setAttribute('aria-label','比较条件 / Compare conditions');
          for(const part of [...f.panels].sort((a,b)=>a.region.x-b.region.x)){
            const b=btn(part.label+' · '+(part.printedTitle||part.title||part.label),()=>{readPanel(part.id);explain.querySelector('.hist-conditions [aria-pressed=true]')?.focus({preventScroll:true})},'frw-inline');
            b.setAttribute('aria-pressed',String(part.id===p.id));switcher.append(b);
          }
          explain.append(switcher);
        }
        explain.append(PaperUI.set(el('strong'),(p?'小图 '+p.label:f.label)+' · '+(p?.printedTitle||(scope.uncertain?'定位待核对':'直方图')),scope.uncertain?'Check plot location':'Histogram'));
        const original=p?.region&&f.pageBox?{x:f.pageBox.x+p.region.x*f.pageBox.width,y:f.pageBox.y+p.region.y*f.pageBox.height,
          width:p.region.width*f.pageBox.width,height:p.region.height*f.pageBox.height}:null;
        if(!manual&&original&&box&&Object.keys(original).some(k=>Math.abs(original[k]-box[k])>.01)){
          explain.append(PaperUI.set(el('p'),'选区边界已调整，请对照原页确认图注对应的直方图。','The crop was edited. Check the panel assignment on the original.'));
          explain.append(btn('PDF p.'+f.page,()=>inspectPage(f.page),'frw-inline'));boundary.hidden=true;return;
        }
        histograms.show(explain,f,p,scope,box,(rect,label,clicked,peer,selectedRect)=>{
          if(clicked)compare?.showFigure();
          histogramFocus={rect,label,peer,selectedRect};renderTarget();
        },regions=>{
          hitRegions=regions;plotHits.replaceChildren(...regions.map(r=>{
            const b=el('button');b.type='button';b.setAttribute('aria-label','定位'+r.name+' / Focus plot');b.title=b.getAttribute('aria-label');b.onclick=r.action;return b;
          }));
        },{source:inspectPage,queued:id=>desk.gridQueued(id),add:(id,label,crop,shared,group,sentence,kind)=>desk.queueGrid(id,label,parent,crop,shared,group,sentence,kind),
          legends:group=>desk.gridLegends(group,parent),drawLegend:group=>desk.drawGridLegend(group),
          layout:()=>desk.gridLayout(layoutId,parent),drawLayout:(rows,cols)=>desk.drawLayout(layoutId,parent,rows,cols)});
        const jump=btn('',()=>inspectPage(scope.page,scope.caption),'frw-inline');
        PaperUI.set(jump,(manual?'查看选区原页':'对照图注')+' · p.'+scope.page,manual?'View source page':'Compare caption');explain.append(jump);
        if(!p&&scope.uncertain&&active.panels.length)explain.append(panelOverview());
        boundary.hidden=true;return;
      }
      if(!hitRegions.length&&desk&&!active.raw.captionRows&&!chart&&!markerPlots.length){
        // Match the actual crop on the displayed plate, including the reader's saved corrections.
        const areas=active.panels.filter(p=>/^(?:[a-z]|left|right)$/i.test(p.id)).map(p=>({
          id:p.id, rect:region(desk.figurePanelRegion(active.raw,p.id)), label:p.label
        })).filter(p=>p.rect);
        hitRegions=areas;
        plotHits.replaceChildren(...areas.map(p=>{
          const button=el('button');button.type='button';button.dataset.printedPanel=p.id;
          button.setAttribute('aria-label','阅读原图 '+p.label+' / Read printed panel '+p.label);
          button.onclick=()=>{
            const focused=doc.activeElement===button;
            readPanel(p.id);
            if(focused)plotHits.querySelector('[data-printed-panel="'+p.id+'"]')?.focus({preventScroll:true});
          };
          return button;
        }));
      }
      if (panel) {
        const panelHeading=PaperUI.set(el('strong'),'小图 '+panel.label,'Panel '+panel.label);
        const title=panel.raw?.reading?.title;
        if(title)panelHeading.append(' · ',PaperUI.set(el('span'),title[0],title[1]));
        else if(panel.title && panel.title!=='分图 '+panel.label && panel.title!=='图注原文' && !panel.raw?.reading?.sources.some(s=>s.kind==='小图图注'))panelHeading.append(' · '+panel.title);
        explain.append(panelHeading);
        const guide=panel.raw?.reading;
        if(guide){
          const section=el('div','','panel-reading'),dl=el('dl');
          for(const line of guide.rows){
            dl.append(PaperUI.set(el('dt'),line.role,line.en));
            const dd=PaperUI.set(el('dd'),line.zh,line.enText);
            dl.append(dd);
            if(line.zh&&!/[\u3400-\u9fff]/u.test(line.zh))PaperLanguageText.bind(dd,line.zh);
          }
          section.append(dl);
          if(guide.kind==='checked'||guide.kind==='axis'){
            const link=btn('',()=>inspectPage(active.page),'frw-inline');
            PaperUI.set(link,'看原图位置 · p.'+active.page,'Locate panel');section.append(link);
            if(guide.axis)section.append(PaperUI.set(el('small'),'原图纵轴：'+guide.axis,'Printed y-axis: '+guide.axis));
          }
          const nearest=guide.sources.find(s=>s.kind==='小图图注')||guide.sources.find(s=>s.kind==='提及本小图的正文')||guide.sources.find(s=>s.kind.startsWith('组内共用'))||guide.sources.find(s=>s.kind==='整图图注');
          if(nearest?.page){const jump=btn('',()=>inspectPage(nearest.page,nearest.text),'frw-inline');
            PaperUI.set(jump,'对照出处 · p.'+nearest.page,'Compare source');section.append(jump)}
          const joint=guide.sources.find(s=>s.en.startsWith('Joint panel reference'));
          if(joint?.page){const jump=btn('',()=>inspectPage(joint.page,joint.text),'frw-inline');
            PaperUI.set(jump,'看合引正文 · p.'+joint.page,'Open shared citation');section.append(jump)}
          if(guide.sources.length){
            const sources=el('details','','panel-sources');
            sources.append(PaperUI.set(el('summary'),'核对这段讲解的原文','Check source passages'));
            for(const s of guide.sources){
              sources.append(PaperUI.set(el('b'),s.kind,s.en),el('blockquote',s.text));
              if(s.page)sources.append(btn('PDF p.'+s.page,()=>inspectPage(s.page,s.text),'frw-inline'));
            }
            section.append(sources);
          }
          explain.append(section);
        }
        if(!guide || (options.model.curated&&panel.text&&!guide.kind))explain.append(ui('p',panel.text||'这块没有单独核实的解释。可回原图对照该标签，不把整图图注当作这块的结论。'));
        if (!guide?.kind && sourceAvailable(active, panel)) {
          const markerPage = panel.page || active.page;
          explain.append(btn(markerPage ? `核对原文第 ${markerPage} 页` : '核对原文', () => markerPage?inspectPage(markerPage):openSource(null,true), 'frw-inline'));
        }
      } else {
        if(active.branchTitle){
          explain.append(ui('strong','作者表述'),PaperLanguageText.bind(el('p'),active.branchTitle));
          if(active.raw.findingPage)explain.append(btn('正文 p.'+active.raw.findingPage,()=>inspectPage(active.raw.findingPage,active.branchTitle),'frw-inline'));
        }
        explain.append(ui('strong', active.raw.editorGuide?'整图阅读':'原文数据 · 图注'));
        const lead=active.caption.replace(/^(?:(?:extended data|supplementary)\s+)?(?:fig(?:ure)?\.?|图)\s*[a-z]*\d+\s*[.|:：]?\s*/i,'').split(/(?<=\.)\s+(?=[A-Z])|(?<=。)/u)[0];
        const overview=el('p',active.raw.editorGuide?active.summary:lead||active.summary);
        explain.append(overview);if(!active.raw.editorGuide)PaperLanguageText.bind(overview,overview.textContent);
        if(active.panels.length)explain.append(panelOverview());
      }
      const restriction = panel?.raw?.reading?.kind==='checked'?'':panel?.boundary || active.boundary;
      const readouts=active.raw.readouts;
      if(!panel?.raw?.reading?.kind && readouts && (readouts.measurement||readouts.comparison)){
        const extracts=el('div');
        for(const [title,value] of [['图中观测或测量',readouts.measurement],['比较对象或条件',readouts.comparison]]){
          if(value){extracts.append(ui('b',title),el('p',value))}
        }
        explain.append(groupDetails('核对比较与测量 · 整图图注',extracts));
      }
      if(!panel&&active.raw.evidenceStep){
        const refs={'F:2':[/Effects of abaucin on the gut microbiota/i,/Shannon/i],'F:5':[/Map resolution/i,/3\.38/,/3\.2/]};
        const key=active.raw.matchKey;
        const targets={
          'F:3':[['2','宽腔和窄腔结构的数据质量','Data quality for the two conformations'],['3','复合物组成与拓扑','Complex architecture and topology'],['5','两种腔体与相关转运体的比较','Cavity and transporter comparisons']],
          'F:5':[['8','含底物复合物的结构数据','Structural data for the cargo-bound complex'],['9','LolCDE 与 LolDF 的结构比较 · 选择性解释','Structural comparison underlying the proposed selectivity'],['10','作者提出的转运模型','Authors’ proposed transport cycle']]
        };
        const links=el('div');
        for(const [number,zh,en] of targets[key]||[]){
          const locator=options.lookupSupplement?.([new RegExp('Supplementary\\s+(?:Figure|Fig\\.?)\\s*'+number+'\\s*[|.:]','i'),/abaucin|LolDF/i]);
          if(!locator)continue;
          const jump=btn('',locator.open,'frw-inline');links.append(PaperUI.set(jump,'Fig. S'+number+' · '+zh+' · p.'+locator.page,en));
        }
        if(links.childElementCount){const disclosure=el('details','','supp-source-links');disclosure.append(PaperUI.set(el('summary'),'展开补充证据','Explore supplementary evidence'),links);explain.append(disclosure)}
        const ref=refs[key]&&options.lookupSupplement?.(refs[key]);
        if(ref){
          const box=el('div','','panel-reading');const note=key==='F:2'?
            ['补充 Fig. S1d、e 分别比较小鼠粪便样本的菌群组成与 Shannon 多样性。','Supplementary Fig. S1d,e compares community composition and Shannon diversity in mouse fecal samples.']:
            ['分辨率有一处出入。含脂蛋白的复合物在主文第 6、10 页记为 3.34 Å，补充表 S1 记为 3.38 Å。','For the lipoprotein-bound complex, main-text pages 6 and 10 report 3.34 Å. Supplementary Table S1 reports 3.38 Å.'];
          box.append(PaperUI.set(el('p'),...note));const jump=btn('',ref.open,'frw-inline');box.append(PaperUI.set(jump,'打开补充材料 · p.'+ref.page,'Open supplement'));explain.append(box);
        }
      }
      boundary.hidden = !restriction;
      if (restriction) boundary.append(panel&&!panel.boundary?PaperUI.set(el('b'),'整图证据边界','Figure-level scope'):ui('b','证据边界'), PaperUI.set(el('span'),restriction));
    }

    function groupDetails(title, content, cls) {
      const d = el('details', '', cls); d.append(ui('summary', title), content); return d;
    }
    function fillMore() {
      // Preserve this area during panel switches; switching figures releases the previous video element.
      more.replaceChildren();
      if (active.caption){
        const cap=el('div');cap.append(el('p',active.caption,'frw-detail-copy'));
        if(active.raw.captionPartial)cap.append(PaperUI.set(el('small'),'图注末尾可能有续文，可对照原页。','The caption may continue on the source page.'));
        const page=active.raw.captionPage||active.page;
        cap.append(btn('PDF p.'+page,()=>inspectPage(page,active.caption),'frw-inline'));
        more.append(groupDetails('看原文图注',cap));
      }
      if(active.raw.authorPassages?.length){
        const group=el('div');
        for(const p of active.raw.authorPassages){group.append(el('p',p.text),btn('正文 p.'+p.page,()=>inspectPage(p.page,p.text),'frw-inline'))}
        more.append(groupDetails('作者解释 · 提及本图的正文',group));
      }
      for(const extension of [false,true]){
        const refs=active.references.filter(r=>String(r.label).startsWith('延伸阅读')===extension);
        if(!refs.length)continue;
        const ul = el('ul','', 'frw-references');
        for (const ref of refs) {
          const li = el('li');
          const display = string(ref.label,110) || '相关出处';
          const text = string(ref.text,320);
          const url = href(ref.url, doc, 'reference');
          const inPaper = typeof options.onOpenSource === 'function' && Boolean(ref.source || pageNumber(ref.page));
          if (url && inPaper) {
            li.append(el('strong',display));
            if (text) li.append(el('p',text));
            const actions = el('div','','frw-ref-actions');
            const urlAction = el('a','文献链接'); urlAction.href=url; urlAction.target='_blank'; urlAction.rel='noopener noreferrer';
            urlAction.setAttribute('aria-label',`${display}：打开文献链接`);
            actions.append(urlAction, btn('本文参考条目', () => ref.page?inspectPage(ref.page,ref.text):openSource(ref), 'frw-reference-action', `${display}：定位本文参考条目`));
            li.append(actions); ul.append(li); continue;
          }
          if (url) {
            const a = el('a',display); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.append(a);
          } else if (inPaper) {
            li.append(btn(display, () => ref.page?inspectPage(ref.page,ref.text):openSource(ref), 'frw-reference-action'));
          } else li.append(el('strong',display));
          if (text) li.append(el('p',text)); ul.append(li);
        }
        more.append(groupDetails(extension?'延伸阅读':'原文引用', ul));
      }
      const lesson = currentLesson;
      if (lesson && array(lesson.figureIds).some(id=>string(id,100)===active.id)) {
        const src = href(lesson.src, doc, 'media');
        if (src) {
          const video = el('video'); video.controls = true; video.preload = 'none'; video.playsInline = true;
          video.setAttribute('aria-label', string(lesson.title, 90) || '方法小课 · 字幕版');
          const box = el('div');
          box.append(el('p', '独立方法示意，与论文原图分开。', 'frw-detail-copy'), video);
          const part = groupDetails(`30 秒方法小课 · ${string(lesson.title, 62) || '字幕版'}`, box, 'frw-lesson');
          part.addEventListener('toggle', () => {
            if (part.open && !video.hasAttribute('src')) {
              const poster = href(lesson.poster, doc, 'media');
              if (poster) video.poster = poster;
              video.src = src;
            } else if (!part.open) { video.pause(); }
          });
          more.append(part);
        }
      }
      more.hidden = !more.childElementCount;
    }

    function highlight(node, allowed) {
      let coords = panel && (desk?desk.region():panel.region);
      if(histogramFocus){
        const base=(!histogramFocus.figureSpace&&coords)||(viewAsset?.mode==='figure'?null:active.raw.pageBox)||{x:0,y:0,width:1,height:1};
        const r=histogramFocus.rect;
        if(base)coords={x:base.x+r.x*base.width,y:base.y+r.y*base.height,width:r.width*base.width,height:r.height*base.height};
      }
      node.hidden = !(coords && allowed);
      if (node.hidden) return;
      node.style.left = coords.x * 100 + '%'; node.style.top = coords.y * 100 + '%';
      node.style.width = coords.width * 100 + '%'; node.style.height = coords.height * 100 + '%';
      node.dataset.panel = histogramFocus?.label||panel?.label||'';
      node.classList.toggle('hist-location',!!histogramFocus);
      node.classList.toggle('frw-target-top', coords.y < .06);
    }
    function renderTarget() {
      questions?.render(active,panel,visiblePicture&&!pageMode&&!hasTrace&&!histogramFocus,viewAsset?.mode,objectUrl);
      trace.style.display=hasTrace&&visiblePicture&&viewAsset?.mode==='figure'?'block':'none';
      const allowed = visiblePicture && (viewAsset?.mode === 'figure'||!!histogramFocus);
      plotHits.hidden=!allowed;
      if(allowed&&hitRegions.length){
        const b=(!hitRegions[0]?.id&&desk?.region())||(viewAsset?.mode==='figure'?null:active.raw.pageBox)||{x:0,y:0,width:1,height:1};
        for(const [i,r] of hitRegions.entries()){
          const c=r.rect,n=plotHits.children[i];
          Object.assign(n.style,{left:100*(b.x+c.x*b.width)+'%',top:100*(b.y+c.y*b.height)+'%',width:100*c.width*b.width+'%',height:100*c.height*b.height+'%'});
          n.setAttribute('aria-pressed',String(r.curveId?r.curveId===(curvePlots[active.id]||(active.raw.captionRows?'upper':active.raw.curveChart?.plots[0]?.id)):r.id?r.id===panel?.id:(histogramFocus?.selectedRect||histogramFocus?.rect)===r.plotRect));
          n.classList.toggle('hist-peer',!!histogramFocus?.peer&&histogramFocus.peer===r.plotRect);
        }
      }
      highlight(target, allowed); highlight(modalTarget, (desk?visiblePicture:allowed) && modal.open);
      if(desk&&!histogramFocus)target.hidden=true;
      if (!visiblePicture) return;
      const src = viewAsset.sourceLabel || (viewAsset.mode === 'figure' ? '已定位的原文图像' : '原文整页预览，包含周边内容');
      const compare = panel ? (allowed && panel.region ? `已标出小图 ${panel.label}。` : `未独立框定小图 ${panel.label}；请看原图标签。`) : '';
      PaperUI.set(photoCaption,[src, desk?'':compare].filter(Boolean).join(' · '),active.page?'Source PDF · p.'+active.page:undefined);
    }

    function setZoom(inModal = false) {
      const level = inModal ? modalZoom : zoom;
      const viewport = inModal ? modalView : view;
      const sheet = inModal ? modalPlate : plate;
      const m = inModal ? modalMinus : minus, p = inModal ? modalPlus : plus, f = inModal ? modalFit : fit;
      viewport.classList.toggle('frw-zoomed', level > 0);
      const scale = SCALES[level];
      sheet.style.width = level > 0 ? `min(${Math.round(scale * 100)}%, calc(var(--frw-fit-width,900px) * ${scale}))` : '';
      m.disabled = !visiblePicture || level === 0;
      p.disabled = !visiblePicture || level === SCALES.length-1;
      f.disabled = !visiblePicture || level === 0;
      PaperUI.set(f,level > 0 ? `${Math.round(SCALES[level]*100)}% · 复位` : '适合窗口',level>0?'Reset':'Fit');
      if (level === 0) { viewport.scrollTop = 0; viewport.scrollLeft = 0; }
    }
    function changeScale(delta, inModal = false) {
      if (!visiblePicture) return;
      const v = inModal ? modalZoom : zoom;
      const n = delta ? Math.min(SCALES.length-1, Math.max(0,v+delta)) : 0;
      if (inModal) modalZoom = n; else zoom = n;
      setZoom(inModal);if(!inModal){wantedZoom=zoom;renderTarget();rememberSpot()}
    }
    function openDialog() {
      if (!visiblePicture || !objectUrl || modal.open) return;
      modalTitle.textContent = `${active.label} · ${viewAsset.mode==='figure' ? '原图' : '原文整页'}`;
      modalImg.src = objectUrl; modalImg.alt = img.alt;
      modalZoom = 0; setZoom(true);
      const ratio = img.naturalWidth / img.naturalHeight;
      if (Number.isFinite(ratio) && ratio > 0) {
        modalPlate.style.setProperty('--frw-fit-width', `${Math.round(Math.min(1320, 680 * ratio))}px`);
      }
      if (typeof modal.showModal === 'function') modal.showModal();
      else { modal.setAttribute('open',''); modal.setAttribute('aria-modal','true'); }
      renderTarget(); close.focus();
    }
    function resetModal(restoreFocus = true) {
      modalImg.removeAttribute('src'); modalTarget.hidden = true;
      if (restoreFocus && !disposed && !expand.disabled) expand.focus();
    }
    function closeDialog(restoreFocus = true) {
      if (!modal.open) return;
      if (typeof modal.close === 'function') {
        if (!restoreFocus) suppressCloseFocus = true;
        modal.close();
      } else { modal.removeAttribute('open'); resetModal(restoreFocus); }
    }
    let suppressCloseFocus = false;
    modal.addEventListener('close', () => { resetModal(!suppressCloseFocus); suppressCloseFocus = false; });
    modal.addEventListener('keydown', e=>{
      if (e.key === 'Escape' && typeof modal.showModal !== 'function') {e.preventDefault(); closeDialog();}
    });
    modal.addEventListener('click', e=>{ if(e.target===modal) {
      const r=modal.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) closeDialog();
    }});
    function drag(viewport) {
      let dragState;
      viewport.addEventListener('pointerdown', ev=>{
        if(ev.button!==0 || desk?.isDrawing() || ev.pointerType==='touch' || !viewport.classList.contains('frw-zoomed')) return;
        dragState={ id:ev.pointerId,x:ev.clientX,y:ev.clientY,left:viewport.scrollLeft,top:viewport.scrollTop };
        // Keep clicks on panels intact. Start capturing only once this is a drag.
      });
      viewport.addEventListener('pointermove',ev=>{ if(dragState?.id===ev.pointerId) {
        if(!ev.buttons){dragState=null;return}
        if(!viewport.classList.contains('frw-panning')){
          if(Math.hypot(ev.clientX-dragState.x,ev.clientY-dragState.y)<5)return;
          viewport.setPointerCapture?.(ev.pointerId);viewport.classList.add('frw-panning');
        }
        viewport.scrollLeft=dragState.left+dragState.x-ev.clientX; viewport.scrollTop=dragState.top+dragState.y-ev.clientY;
      }});
      for(const name of ['pointerup','pointercancel','lostpointercapture']) viewport.addEventListener(name,()=>{ dragState=null; viewport.classList.remove('frw-panning'); });
    }
    drag(view); drag(modalView);

    function resetPicture() {
      visiblePicture = false; viewAsset = null;
      questions?.render(active,panel,false,null,'');
      desk?.reset();
      closeDialog(false); modalImg.removeAttribute('src');
      img.onload = null; img.onerror = null; img.removeAttribute('src');
      if (objectUrl) { global.URL.revokeObjectURL(objectUrl); objectUrl = ''; }
      plate.hidden = true; placeholder.hidden = false; target.hidden = true;
      expand.disabled = true; zoom = 0; setZoom(); photoCaption.textContent = '';
    }
    function failPicture(message, allowRetry) {
      resetPicture(); PaperUI.set(modeLabel,'原图未载入');
      PaperUI.set(placeholderTitle,'这里没有可核实的图像');
      placeholderText.textContent = message || '可打开原文找图。这里不绘制占位图假装论文原图。';
      retry.hidden = !allowRetry;
    }
    async function loadPicture() {
      if (!active) return;
      const token = ++generation;
      const current = active;
      resetPicture();
      if (typeof options.renderFigure !== 'function') { failPicture('',false); return; }
      retry.hidden = true; PaperUI.set(modeLabel,'正在读取原文图像');
      PaperUI.set(placeholderTitle,'正在准备原文预览');
      PaperUI.set(placeholderText,'读取完成后，图像会出现在这里。');
      const stale = () => disposed || token !== generation;
      try {
        const cacheKey=current.id+':'+pageMode;
        let pic = cache.get(cacheKey);
        if (!pic) {
          const out = await options.renderFigure(current.raw,pageMode);
          if (stale()) return;
          if (!out || out.mode === 'unavailable') { failPicture(string(out?.reason,180), false); return; }
          const blob = out instanceof global.Blob ? out : out.blob;
          if (!(await validRaster(blob))) {
            if (!stale()) failPicture('没有收到可安全显示的原文图像。请直接打开原文核对。', false);
            return;
          }
          if (stale()) return;
          pic = { blob, mode:out.mode === 'figure' ? 'figure' : 'page', sourceLabel:string(out.sourceLabel,150) };
          if (cache.size >= 3) cache.delete(cache.keys().next().value);
          cache.set(cacheKey, pic);
        }
        if (stale()) return;
        viewAsset = pic; objectUrl = global.URL.createObjectURL(pic.blob);
        img.alt = `${current.label} · ${pic.mode === 'figure' ? '原文图像' : '原文整页'}`;
        img.onload = () => {
          if (stale()) return;
          const ratio = img.naturalWidth / img.naturalHeight;
          if (!Number.isFinite(ratio) || ratio <= 0) { cache.delete(current.id); failPicture('这份图像没有可显示的尺寸。', true); return; }
          plate.style.setProperty('--frw-fit-width', `${Math.max(1, Math.round(Math.min(1070, img.naturalWidth, 548 * ratio)))}px`);
          plate.style.setProperty('--figure-aspect',String(ratio));
          visiblePicture = true; plate.hidden = false; placeholder.hidden = true;
          if(pic.mode==='page'&&!pageMode&&!current.raw.pageOnly&&current.raw.caption){
            PaperUI.set(modeLabel,'图注所在页 · 图像待定位','Caption page · figure unlocated');
          }else PaperUI.set(modeLabel,pic.mode === 'figure' ? '原文图像' : '原文整页');
          expand.disabled = false;zoom=wantedZoom;setZoom();desk?.image(pic.mode);renderTarget();
        };
        img.onerror = () => { if (!stale()) { cache.delete(current.id); failPicture('浏览器没有打开这张原图，可重试或直接核对 PDF。', true); } };
        img.src = objectUrl;
      } catch (_) { if (!stale()) failPicture('图像提取没有完成。可重试或先读原文。', true); }
    }

    function selectFigure(idToFind, force = false) {
      if (disposed) return false;
      const f = model.figures.find(item=>item.id===string(idToFind,100));
      if (!f) return false;
      if (!force && f===active) return true;
      delete figTitle.dataset.sourceText; active = f; panel = null;pageMode=false;wantedZoom=0;preparePanels();atlas?.select(f.id);
      const index=model.figures.indexOf(f),before=model.figures[index-1],after=model.figures[index+1];
      previousFig.disabled=!before;nextFig.disabled=!after;
      PaperUI.set(previousFig,'← '+(before?.label||'上一图'),'← '+(before?.label||'Previous'));
      PaperUI.set(nextFig,(after?.label||'下一图')+' →',(after?.label||'Next')+' →');
      for (const [k,b] of figureButtons) b.setAttribute('aria-current',String(k===f.id));
      figIndex.textContent = f.label;
      const detailedTitle=f.raw.title||f.title;
      figTitle.textContent = detailedTitle?.endsWith('…') && f.caption
        ? (global.PaperFigureContext?.captionTitle(f.caption,f.label)||detailedTitle) : detailedTitle || f.label;
      PaperLanguageText.clear(figTitle);
      if(f.raw.evidenceStep) { PaperUI.set(figTitle,figTitle.textContent,f.raw.evidenceStep[0]);figTitle.removeAttribute('lang'); }
      else { figTitle.lang=/[㐀-鿿]/u.test(figTitle.textContent)?'zh-CN':'en';PaperLanguageText.bind(figTitle,figTitle.textContent); }
      figMeta.textContent = [model.sourceLabel, f.page ? `PDF 第 ${f.page} 页` : ''].filter(Boolean).join(' · ');
      if(f.raw.captionPage&&f.raw.captionPage!==f.page){
        PaperUI.set(figMeta,'图像第 '+f.page+' 页 · 图注第 '+f.raw.captionPage+' 页','Figure p.'+f.page+' · Caption p.'+f.raw.captionPage);
      }else if(f.page)PaperUI.set(figMeta,figMeta.textContent,'Source PDF · p.'+f.page);
      figMeta.hidden = !figMeta.textContent;
      sourceButton.hidden = !sourceAvailable(f, null);
      PaperUI.set(sourceButton,f.page ? `打开原文 p.${f.page}` : '打开原文',f.page?'Open PDF · p.'+f.page:undefined);
      announcement.textContent = '';
      updateTabs();selectPanel(null);fillMore();loadPicture();
      return true;
    }
    groups.addEventListener('keydown', e=>{
      const keys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'];
      if (!keys.includes(e.key) || !e.target.closest('.frw-figure-link')) return;
      const figures = model.figures, pos = figures.findIndex(f=>f===active);
      const next = e.key==='Home' ? 0 : e.key==='End' ? figures.length-1 :
        Math.max(0,Math.min(figures.length-1,pos + (['ArrowUp','ArrowLeft'].includes(e.key) ? -1 : 1)));
      if (next<0 || !figures[next]) return;
      e.preventDefault(); selectFigure(figures[next].id); figureButtons.get(figures[next].id)?.focus();
    });
    tabs.addEventListener('keydown', e=>{
      const keys = ['ArrowLeft','ArrowRight','Home','End'];
      if (!keys.includes(e.key) || !e.target.closest('.frw-panel-tab')) return;
      const ids = [...panelButtons.keys()];
      if (!ids.length) return;
      const i = ids.indexOf(panel?.raw?.markerParent || panel?.id || '');
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length-1 : (i + (e.key==='ArrowLeft'?-1:1) + ids.length) % ids.length;
      e.preventDefault(); readPanel(ids[n]); panelButtons.get(ids[n])?.focus();
    });
    function setModel(next, evidenceOptions) {
      if (disposed) return;
      const previousId=active?.id;
      // A clip is attached to this article instance, not to generic figure numbers on later articles.
      currentLesson = evidenceOptions?.lesson ?? next?.lesson ?? (next === options.model ? options.lesson : null);
      generation++; cache.clear(); model = normalize(next); active=null;
      PaperLanguageText.bind(title,model.title); if(model.takeaway)PaperLanguageText.bind(takeaway,model.takeaway);else{PaperLanguageText.clear(takeaway);takeaway.textContent=''}
      takeaway.hidden = !model.takeaway;
      empty.hidden=Boolean(model.figures.length); body.hidden=!empty.hidden;
      addRail(); atlas?.setModel(model);
      if (model.figures.length) {
        const desired=previousId||initialSpot.figure;
        selectFigure(model.figures.some(f=>f.id===desired)?desired:(atlas?.first()||model.figures[0].id),true);
        if(active.id===initialSpot.figure){
          wantedZoom=Math.max(0,Math.min(3,Number(initialSpot.zoom)||0));
          if(initialSpot.pageMode){pageMode=true;loadPicture()}
          selectPanel(initialSpot.panel);rememberSpot();
        }
      }
      else resetPicture();
    }
    setModel(options.model);
    return {
      setModel,
      selectFigure,
      refreshSupplement(){if(active&&!panel)updateExplanation()},
      destroy() {
        if (disposed) return;
        disposed = true; generation++; cache.clear(); questions?.destroy(); histograms?.destroy();compare?.destroy();resetPicture(); atlas?.destroy(); workbench.remove();
      }
    };
  }

  const api = { mount };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.FigureReadingWorkbench = api;
})(globalThis);
