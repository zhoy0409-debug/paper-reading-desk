/* The paper's line of argument beside the figure: the question, then one node per figure in paper order.
   The node in view opens by itself and lists what the caption says about each panel. */
(() => {
  'use strict';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
  const t=(zh,en)=>window.ReaderLanguage?.current==='en'?en:zh;
  function mount({workbench,track,tabs,model,paper}){
    const byId=new Map(model.figures.map(f=>[f.id,f]));
    const head=el('div','th-head'),claim=el('p'),fold=el('button','th-fold');
    const label=PaperUI.set(el('small'),'这篇论文','This paper');
    PaperLanguageText.bind(claim,paper.title||'');
    claim.tabIndex=0;claim.setAttribute('role','button');
    const open=()=>head.classList.toggle('th-open');
    claim.addEventListener('click',open);
    claim.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
    fold.type='button';
    function drawFold(){
      const slim=workbench.classList.contains('th-slim');
      fold.textContent=slim?'»':'«';fold.title=slim?t('展开脉络','Show the outline'):t('只看缩略图','Thumbnails only');
      fold.setAttribute('aria-label',fold.title);
    }
    fold.addEventListener('click',()=>{workbench.classList.toggle('th-slim');drawFold()});drawFold();
    head.append(label,claim,fold);track.before(head);

    const heads=new Map((paper.sections||[]).filter(s=>s.title&&s.figures.length).map(s=>[s.figures[0],s.title]));
    function decorate(){
      for(const cell of track.querySelectorAll('.lens-cell')){
        if(cell.querySelector('.th-text'))continue;
        const f=byId.get(cell.dataset.figure);if(!f)continue;
        const text=el('span','th-text'),line=el('span','th-claim');
        text.append(cell.querySelector('.lens-name'),line);cell.append(text);
        if(f.raw?.evidenceStep)PaperUI.set(line,f.title,f.raw.evidenceStep[0]);
        else PaperLanguageText.bind(line,PaperOutline.title(f.raw?.caption,f.label)||f.title||f.label);
        const section=heads.get(f.raw);
        if(section){const h=el('h4','th-section');PaperLanguageText.bind(h,section);cell.parentElement.prepend(h)}
      }
    }
    const leaf=el('div','th-leaf');let shown='';
    function panels(f){
      const said=PaperOutline.panelText(f.raw?.caption),box=el('div','th-panels');
      const list=f.panels.filter(p=>!p.raw?.markerParent&&/^[A-Za-z]$/.test(p.label));
      if(!list.length)return null;
      const texts=list.map(p=>p.raw?.reading?.kind==='checked'&&p.raw.reading.title||said.get(p.label.toLowerCase())?.text||'');
      box.classList.toggle('th-letters',!texts.some(Boolean));
      list.forEach((p,i)=>{
        const b=el('button','th-panel');b.type='button';b.dataset.panel=p.label;b.append(el('b','',p.label));
        if(texts[i]){
          const s=el('span');
          if(Array.isArray(texts[i]))PaperUI.set(s,texts[i][0],texts[i][1]);else PaperLanguageText.bind(s,texts[i]);
          b.append(s);
        }
        b.addEventListener('click',()=>[...tabs.querySelectorAll('.frw-panel-tab')].find(x=>x.textContent.trim()===p.label)?.click());
        box.append(b);
      });
      return box;
    }
    function sync(){
      const cell=track.querySelector('.lens-cell[aria-current=true]'),f=byId.get(cell?.dataset.figure);if(!f)return;
      const signature=f.id+'/'+f.panels.length;
      if(shown!==signature||leaf.parentElement!==cell.parentElement){
        shown=signature;const list=panels(f);
        leaf.replaceChildren(...(list?[list]:[]));leaf.hidden=!list;cell.parentElement.append(leaf);
      }
      const on=[...tabs.querySelectorAll('.frw-panel-tab')].slice(1).find(b=>b.getAttribute('aria-pressed')==='true')?.textContent.trim();
      for(const b of leaf.querySelectorAll('.th-panel'))b.setAttribute('aria-pressed',String(b.dataset.panel===on));
    }
    let queued=0;
    const later=()=>{cancelAnimationFrame(queued);queued=requestAnimationFrame(()=>{decorate();sync()})};
    decorate();sync();
    const m=new MutationObserver(later);
    m.observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed','hidden']});
    m.observe(track,{subtree:true,attributes:true,attributeFilter:['aria-current']});
    document.addEventListener('reader-language-change',drawFold);
    return {destroy(){m.disconnect();cancelAnimationFrame(queued);document.removeEventListener('reader-language-change',drawFold)}};
  }
  window.ReadingThread=Object.freeze({mount});
})();
