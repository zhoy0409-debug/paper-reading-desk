(() => {
  'use strict';

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
  const fold = s => s.normalize('NFKC').replace(/[‐‑‒–−]/g, '-');
  const termPattern = /^(?=[A-Za-z0-9-]{2,15}$)(?=.*[A-Z].*[A-Z])[A-Za-z][A-Za-z0-9-]*$/;

  // Align a printed short form backwards within the words directly before its parentheses.
  function longForm(before, short) {
    const tail = before.match(/[A-Za-z0-9α-ωΑ-Ω'’\-/ ]+$/u)?.[0]?.trimEnd();
    if (!tail) return '';
    const letters = short.replace(/-/g, '').toLowerCase();
    const limit = Math.min(letters.length + 5, 2 * letters.length);
    const phrase = tail.split(/\s+/).slice(-limit).join(' ');
    if (!phrase || phrase.length <= letters.length || !/[\s/-]/.test(phrase)) return '';
    let pos = phrase.length - 1;
    const lower = phrase.toLowerCase();
    for (let i = letters.length - 1; i >= 0; i--) {
      while (pos >= 0 && (lower[pos] !== letters[i] || (i === 0 && pos > 0 && /[a-z0-9]/i.test(lower[pos - 1])))) pos--;
      if (pos < 0) return '';
      if (i === letters.length - 1 && /[\s/]/.test(phrase.slice(pos + 1))) return '';
      if (i === 0) {
        const full = phrase.slice(pos);
        return /[\s/-]/.test(full) && full.length > short.length + 2 ? full : '';
      }
      pos--;
    }
    return '';
  }

  function lookupFor(sections) {
    let definitions;
    function collect() {
      definitions = new Map();
      for (const section of sections || []) {
        if (section.key === 'references') continue;
        let page, passage = '';
        function index() {
          const text = fold(clean(passage));
          for (const found of text.matchAll(/\(([A-Za-z][A-Za-z0-9-]{1,14})\)/g)) {
            const term = found[1];
            if (!termPattern.test(term)) continue;
            const before = text.slice(Math.max(0, found.index - 190), found.index);
            const full = longForm(before, term);
            if (!full) continue;
            const list = definitions.get(term) || [];
            if (!list.some(d => d.full === full && d.page === page)) {
              list.push({term, full, page, text:full + ' (' + term + ')'});
              definitions.set(term, list);
            }
          }
        }
        for (const row of section.rows || []) {
          if (row.page !== page || row.heading) { index(); passage = ''; }
          page = row.page;
          if (Number.isInteger(page) && page > 0 && row.text) passage += ' ' + row.text;
        }
        index();
      }
    }
    return (value, page) => {
      const term = fold(clean(value));
      if (!termPattern.test(term)) return [];
      if (!definitions) collect();
      const order = d => Number.isInteger(page) ? Math.abs(d.page-page) : d.page;
      const sorted = [...(definitions.get(term) || [])].sort((a,b) => order(a)-order(b) || a.page-b.page);
      const seen = new Set();
      return sorted.filter(d => {
        const key = d.full.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
  }

  function figurePassages(f, panel) {
    if (!f) return [];
    const captionPage = f.raw?.captionPage || f.page;
    const rows = [];
    function add(zh,en,text,page) {
      if (!Number.isInteger(page) || page < 1 || !clean(text)) return;
      if (!rows.some(r => r.page === page && clean(r.text) === clean(text))) rows.push({zh,en,text,page});
    }
    const panelSources = panel?.raw?.reading?.sources || [];
    if (panel) {
      const localPage=f.raw?.captionPanelPages?.[panel.raw.id]||captionPage;
      for (const s of panelSources) {
        if (/小图图注|组内共用图注/.test(s.kind)) add(s.kind,s.en,s.text,s.page);
      }
      const g = panel.raw?.groupCaption;
      if (g) add('共用图注 · '+g.label,'Shared caption · '+g.label,g.text,localPage);
      if (!rows.length) {
        const local = window.ModelReading.panelPassage(f.caption,panel.raw);
        if (local?.local) add('小图图注','Panel caption',local.text,localPage);
      }
    }
    if (!rows.length) add('整图图注','Figure caption',f.caption,captionPage);
    for (const s of panelSources) {
      if (s.kind.startsWith('组内共用正文')) add(s.kind,s.en,s.text,s.page);
      else if (s.kind === '提及本小图的正文') add('相关正文','Related text',s.text,s.page);
    }
    for (const s of f.raw?.authorPassages || []) if(!panel||!f.raw.matchKey||PaperLiterature.inFigureScope(s.text,f.raw.matchKey,panel.raw.id))
      add(s.shared?'共同引用多张图的正文':'提及整图的正文',s.shared?'Text citing several figures':'Text referring to the figure',s.text,s.page);
    return rows;
  }

  function card(items, zh, en, openSource) {
    const root = document.createElement('details');
    root.className = 'rq-source-note';
    const summary = PaperUI.set(document.createElement('summary'), zh, en);
    root.append(summary);
    let built = false;
    root.addEventListener('toggle', () => {
      if (!root.open || built) return;
      built = true;
      const body = document.createElement('div'), meta = document.createElement('div'), label = document.createElement('span');
      const quote = document.createElement('blockquote'), footer = document.createElement('div');
      body.className = 'rq-quote-body'; meta.className = 'rq-quote-meta'; footer.className = 'rq-quote-actions';
      quote.dataset.sourceText = '';
      let i = 0;
      const button = (zh,en,fn) => {
        const b = PaperUI.set(document.createElement('button'),zh,en);
        b.type = 'button'; b.addEventListener('click',fn); return b;
      };
      const prev = button('上一段','Previous passage',()=>show(i-1));
      const next = button('下一段','Next passage',()=>show(i+1));
      const locate = button('在 PDF 中定位','Locate in PDF',()=>openSource(items[i].page,items[i].text,null,locate));
      meta.append(label); footer.append(locate);
      if (items.length > 1) footer.append(prev,next);
      body.append(meta,quote,footer); root.append(body);
      function show(index) {
        i = index;
        const r = items[i], suffix = ' · p.'+r.page + (items.length > 1 ? '　'+(i+1)+' / '+items.length : '');
        PaperUI.set(label,r.zh+suffix,(r.en||'Source')+suffix);
        quote.textContent = r.text; quote.dataset.page = r.page;
        quote.scrollTop = 0; prev.disabled = i===0; next.disabled = i===items.length-1;
      }
      show(0);
    });
    return root;
  }
  window.PaperSourceNotes = {lookupFor,figurePassages,card};
})();
