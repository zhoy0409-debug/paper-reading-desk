(() => {
  'use strict';
  const prefix='paper-tree.v9.', recent='recent', viewKey=prefix+'active';
  let database;
  function db(){
    if(!database)database=new Promise((resolve,reject)=>{
      const req=indexedDB.open(prefix+'files',1);
      req.onupgradeneeded=()=>{for(const key of ['pdf','papers','edges'])req.result.createObjectStore(key)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
    return database;
  }
  async function transaction(stores,mode,run){
    const database=await db();
    return new Promise((resolve,reject)=>{
      const tx=database.transaction(stores,mode);
      let request;
      try{request=run(tx)}catch(e){tx.abort();reject(e);return}
      tx.oncomplete=()=>resolve(request?.result);
      tx.onabort=tx.onerror=()=>reject(tx.error||Error('浏览器存储不可用'));
    });
  }
  const get=(s,k)=>transaction([s],'readonly',tx=>tx.objectStore(s).get(k));
  const all=s=>transaction([s],'readonly',tx=>tx.objectStore(s).getAll());
  async function fingerprint(file){
    const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  }
  function state(id){
    try{return JSON.parse(localStorage.getItem(prefix+id)||'{}')||{}}catch{return {}}
  }
  function persist(id,data){localStorage.setItem(prefix+id,JSON.stringify(data));}
  function target(){
    const query=new URLSearchParams(location.search);
    const p=query.has('paper')?query:new URLSearchParams(location.hash.slice(1));
    return /^[0-9a-f]{64}$/.test(p.get('paper')||'') ? {id:p.get('paper'),figure:p.get('figure'),panel:p.get('panel'),page:Number(p.get('page'))}:null;
  }
  function link(id,figure,panel,page){
    const url=new URL(location.pathname,location.origin);
    url.search=new URLSearchParams({paper:id,figure,panel:panel||'',page:String(page)}).toString();
    return url.href;
  }
  async function fileFor(id){
    const saved=await get('pdf',id); if(saved)return saved;
    const last=await get('pdf',recent); return last?.id===id?last.file:null;
  }
  async function remember(id,file){
    await transaction(['pdf','papers'],'readwrite',tx=>{
      const pdf=tx.objectStore('pdf');
      pdf.put({id,file},recent);
      const saved=tx.objectStore('papers').getKey(id);
      saved.onsuccess=()=>{if(saved.result!==undefined){
        const existing=pdf.getKey(id);
        existing.onsuccess=()=>{if(existing.result===undefined)pdf.put(file,id)};
      }};
    });
    sessionStorage.setItem(viewKey,id);
  }
  async function save(id,file,paper){
    const entry={id,title:paper.title,name:file.name,identifier:paper.identifier,refs:paper.bibliography||''};
    await transaction(['pdf','papers'],'readwrite',tx=>{
      tx.objectStore('pdf').put(file,id); tx.objectStore('papers').put(entry,id);
    });
    window.dispatchEvent(new Event('paper-shelf-change'));
  }
  function citations(a,b){
    if(!b.identifier)return '';
    const value=b.identifier.split(':').slice(1).join(':');
    const escaped=value.replace(/[.*+?^\u0024{}()|[\]\\]/g,'\\$&');
    const re=new RegExp((b.identifier.startsWith('arxiv:')?'(?:arxiv\\s*:\\s*|arxiv\\.org/(?:abs|pdf)/)':'(?:doi\\s*:\\s*|doi\\.org/|\\b)')+escaped+'(?=$|[\\s,;).]|v\\d+\\b)','i');
    const m=re.exec(a.refs);
    return m?cleanSnippet(a.refs,m.index,m[0].length):'';
  }
  const cleanSnippet=(s,i,n)=>s.slice(Math.max(0,i-85),i+n+65);
  const terms=title=>new Set(title.toLowerCase().match(/[a-z]{4,}/g)?.filter(t=>!['with','from','that','this','using','study','analysis','between','based','paper','research','effects','effect'].includes(t)));
  function graphEdges(papers,manual){
    const edges=[...manual];
    for(let i=0;i<papers.length;i++)for(let j=i+1;j<papers.length;j++){
      const a=papers[i],b=papers[j];
      for(const [from,to] of [[a,b],[b,a]]){
        const reason=citations(from,to);
        if(reason)edges.push({from:from.id,to:to.id,type:'原文确有引用',reason:'参考文献表原文：'+reason});
      }
      const tokens=terms(b.title),common=[...terms(a.title)].filter(t=>tokens.has(t));
      if(common.length>=2)edges.push({from:a.id,to:b.id,type:'主题相近',reason:'两篇标题共有词：'+common.join('、')+'。这是一条主题线索。'});
    }
    return edges;
  }
  function mount(container,onOpen,onMissing){
    const root=document.createElement('details');root.className='ps-library';
    const summary=document.createElement('summary');PaperUI.set(summary,'私人跨论文图谱');
    const body=document.createElement('div');root.append(summary,body);container.insertBefore(root,container.querySelector('section'));
    const el=(tag,t)=>{const n=document.createElement(tag);n.textContent=t||'';return n};
    const button=(s,fn)=>{const b=PaperUI.set(el('button'),s);b.type='button';b.onclick=fn;return b};
    let center='',generation=0;
    async function open(id){
      const file=await fileFor(id);
      root.open=false;
      if(file)onOpen(file,id);else onMissing(id);
    }
    async function draw(){
      if(!root.open)return;
      const token=++generation;
      try{
        const [papers,manual]=await Promise.all([all('papers'),all('edges')]);
        if(token!==generation)return;
        body.replaceChildren();if(!papers.length){body.append(PaperUI.set(el('p'),'读图时点「保存到私人图谱」，即可从这里重开原文、笔记与读图位置。'));return}
        const current=papers.find(p=>p.id===center)||papers[0];center=current.id;
        const nav=el('select');nav.setAttribute('aria-label','探索已保存的论文');
        for(const p of papers){const o=el('option',p.title);o.value=p.id;nav.append(o)}nav.value=center;
        nav.onchange=()=>{center=nav.value;draw()};body.append(nav);
        const graph=el('div');graph.className='ps-network';
        const node=button(current.title,()=>open(current.id));node.className='ps-center';graph.append(node);
        const peers=el('div');graph.append(peers);
        const edges=graphEdges(papers,manual).filter(e=>e.from===center||e.to===center);
        for(const e of edges){
          const peer=papers.find(p=>p.id===(e.from===center?e.to:e.from));if(!peer)continue;
          const line=el('div');line.className='ps-edge';
          const reason=el('p',e.reason);reason.hidden=true;
          const label=e.type==='原文确有引用'?(e.from===center?'本文引用 →':'← 对方引用本文'):e.type;
          const edge=button(label,()=>{reason.hidden=!reason.hidden;edge.setAttribute('aria-expanded',String(!reason.hidden))});
          edge.setAttribute('aria-expanded','false');line.append(edge,button(peer.title,()=>{center=peer.id;draw()}),reason);peers.append(line);
        }
        if(!edges.length)peers.append(PaperUI.set(el('p'),'尚无已记录的联系。'));
        const pos=state(center),last=pos.spot||{};
        const resume=button('',()=>open(center));PaperUI.set(resume,'回到读图位置'+(last.page?' · PDF p.'+last.page:''),'Resume reading');body.append(graph,resume);
        const note=pos.notes?.[JSON.stringify([last.figure,last.panel||''])];
        if(note)body.append(el('blockquote',note));
        if(papers.length>1){
          const form=el('details');form.append(PaperUI.set(el('summary'),'记录两篇论文的联系'));
          const kind=el('select');kind.setAttribute('aria-label','联系类型');
          for(const label of ['我确认的联系','主题相近']){const option=el('option',label+' / '+PaperUI.english(label));option.value=label;kind.append(option)};
          const select=el('select');select.setAttribute('aria-label','关联论文');
          for(const p of papers.filter(p=>p!==current)){const o=el('option',p.title);o.value=p.id;select.append(o)}
          const input=el('input');input.placeholder='两篇论文的具体联系 / Why are these papers connected?';input.maxLength=600;
          form.append(select,kind,input,button('保存联系',async()=>{
            if(!input.value.trim()){input.focus();return}
            try{const to=select.value,key=[center,to].sort().join('/')+'/'+kind.value;
              await transaction(['edges'],'readwrite',tx=>tx.objectStore('edges').put({from:center,to,type:kind.value,reason:input.value.trim()},key));draw();
            }catch{body.append(PaperUI.set(el('p'),'联系未能保存，请检查浏览器本地存储。'))}
          }));body.append(form);
        }
      }catch{body.replaceChildren(PaperUI.set(el('p'),'浏览器无法读取这份本地图谱。'))}
    }
    root.ontoggle=()=>{container.classList.toggle('ps-library-open',root.open);PaperUI.set(summary,root.open?'私人跨论文图谱 · 返回篇内阅读':'私人跨论文图谱');draw()};
    window.addEventListener('paper-shelf-change',draw);
    return {open,async restore(){
      const dest=target();const id=dest?.id||sessionStorage.getItem(viewKey);if(id)await open(id);
    }};
  }
  window.PaperShelf={fingerprint,state,persist,link,target,remember,save,mount};
})();
