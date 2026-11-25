/* Light table: a figure strip, look-before-caption reading, a one-line-per-figure story and rehearsal.
   Everything a reader writes stays in the paper's existing local state (state.lens). */
(() => {
  'use strict';
  const RECENT='reading-desk.recent.v1', BLIND='reading-desk.blind';
  const VERDICTS=[['hit','说中了','Got it'],['half','说对一半','Half right'],['miss','没看出来','Missed it']];
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
  const ui=(tag,cls,zh,en)=>PaperUI.set(el(tag,cls),zh,en);
  const button=(cls,zh,en,fn)=>{const b=ui('button',cls,zh,en);b.type='button';b.addEventListener('click',fn);return b};
  const clock=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  // Read-aloud estimate: 4.5 Han characters or 2.3 Latin words per second.
  const seconds=text=>(text.match(/[㐀-鿿]/g)||[]).length/4.5+(text.match(/[A-Za-z0-9][\w.'’-]*/g)||[]).length/2.3;

  async function thumbnail(blob,width){
    const bitmap=await createImageBitmap(blob);
    try{
      const scale=Math.min(1,width/bitmap.width,width/bitmap.height);
      const canvas=el('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ink=canvas.getContext('2d');
      ink.fillStyle='#fff';ink.fillRect(0,0,canvas.width,canvas.height);
      ink.imageSmoothingQuality='high';ink.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/jpeg',.82);
    }finally{bitmap.close()}
  }
  function recall(id,patch,onlyExisting){
    const list=read(RECENT,[]);
    const old=list.find(r=>r.id===id);
    if(!old&&onlyExisting)return;
    write(RECENT,[{...old,...patch,id,at:Date.now()},...list.filter(r=>r.id!==id)].slice(0,8));
  }

  function mount(ctx){
    const {workbench,body,notes,header,state,save,render,select,paper,id}=ctx;
    const store=state.lens||={};
    const entry=f=>store[f.id]||={};
    let figures=[],active=null,blind=read(BLIND,false)===true,fullPage=false,disposed=false,timer=0;
    const thumbs=new Map(),cells=new Map(),asked=new Map(),wanted=new Set();
    const said=f=>(store[f.id]?.say||'').trim();
    const ordered=()=>figures.filter(f=>!f.raw?.pageOnly);

    // Figure strip
    const strip=el('nav','lens-strip');strip.setAttribute('aria-label','图带 / Figure strip');
    const track=el('ol','lens-track');
    const tools=el('div','lens-tools');
    const tally=el('span','lens-tally');
    const blindButton=button('lens-switch','盲读','Look first',()=>setBlind(!blind));
    blindButton.title='先看图，写一句再揭开图注（B） / Look and write before the caption (B)';
    const storyButton=button('lens-tool','故事板','Storyboard',()=>openStory());
    const mapButton=button('lens-tool','图谱 ↓','Map ↓',()=>workbench.querySelector('.ea')?.scrollIntoView({block:'start'}));
    const helpButton=button('lens-key','?','?',()=>openHelp());helpButton.setAttribute('aria-label','快捷键 / Keyboard shortcuts');
    tools.append(tally,blindButton,storyButton,mapButton,helpButton);
    strip.append(track,tools);header.after(strip);
    const atlas=workbench.querySelector('.ea');
    if(atlas)body.after(atlas);

    // One-line reading card
    const card=el('section','lens-card');card.setAttribute('aria-label','我的一句话 / My one line');
    const ask=el('label','lens-ask');
    const box=el('textarea');box.rows=2;box.maxLength=400;box.id='lens-say-'+Math.random().toString(36).slice(2,8);ask.htmlFor=box.id;
    box.placeholder='比较了谁？看哪个读数？变化朝哪边？ / Who is compared, on what readout, in which direction?';
    const actions=el('div','lens-actions');
    const reveal=button('primary','揭开图注','Reveal caption',()=>{if(!active)return;entry(active).open=true;persist();drawCard();answer.focus({preventScroll:true})});
    const hint=el('small');
    const answer=el('div','lens-answer');answer.tabIndex=-1;
    const quote=el('blockquote');quote.dataset.sourceText='';quote.lang='en';
    const verdicts=el('div','lens-verdicts');verdicts.setAttribute('role','group');verdicts.setAttribute('aria-label','和图注对照 / Compare with the caption');
    for(const [key,zh,en] of VERDICTS){
      const b=button('lens-verdict',zh,en,()=>{const e=entry(active);e.verdict=e.verdict===key?'':key;persist();drawCard();mark(active)});
      b.dataset.verdict=key;verdicts.append(b);
    }
    const hide=button('lens-quiet','收起图注','Hide caption',()=>{entry(active).open=false;persist();drawCard();box.focus({preventScroll:true})});
    actions.append(reveal,hint);
    answer.append(ui('h4','','作者图注','Authors’ caption'),quote,verdicts,hide);
    card.append(ask,box,actions,answer);notes.prepend(card);
    box.addEventListener('input',()=>{
      if(!active)return;
      const f=active;entry(f).say=box.value;mark(f);drawTally();
      clearTimeout(timer);timer=setTimeout(persist,250);
    });

    function persist(){
      clearTimeout(timer);timer=0;save();
      recall(id,{total:ordered().length,said:ordered().filter(said).length},true);
    }
    function setBlind(value){blind=value;write(BLIND,blind);drawCard();if(blind&&active&&!entry(active).open)box.focus({preventScroll:true})}
    function drawCard(){
      blindButton.setAttribute('aria-pressed',String(blind));
      if(!active)return;
      const e=store[active.id]||{},caption=(active.raw?.caption||active.caption||'').trim();
      // Without a located caption there is nothing to reveal, so nothing is covered.
      const covered=blind&&!e.open&&!!caption;
      workbench.classList.toggle('lens-blind',covered);
      PaperUI.set(ask,!covered?'用一句话说这张图':fullPage?'先别读图注。这张图在说什么？':'图注已盖住。这张图在说什么？',!covered?'This figure in one line':fullPage?'Skip the caption. What does this figure show?':'The caption is covered. What does this figure show?');
      if(box.value!==(e.say||''))box.value=e.say||'';
      actions.hidden=!!e.open;answer.hidden=!e.open;
      reveal.disabled=!caption;
      if(covered&&fullPage)PaperUI.set(hint,'现在是整页显示，页面上印有图注','The full page is shown, with its printed caption');
      else PaperUI.set(hint,caption?'写完再对照，不写也可以揭开':'这张图没有定位到图注',caption?'Writing first is optional':'No caption was located for this figure');
      quote.textContent=caption;
      for(const b of verdicts.children)b.setAttribute('aria-pressed',String(b.dataset.verdict===e.verdict));
    }
    function drawTally(){
      const all=ordered(),n=all.filter(said).length;
      PaperUI.set(tally,n+' / '+all.length+' 图已写','Written '+n+' / '+all.length);
    }
    function mark(f){
      const cell=cells.get(f.id);if(!cell)return;
      const e=store[f.id]||{},status=e.verdict||(said(f)?'said':e.seen?'seen':'new');
      if(cell.dataset.status===status)return;
      cell.dataset.status=status;
      const words={hit:['说中了','got it'],half:['说对一半','half right'],miss:['没看出来','missed'],said:['已写一句','written'],seen:['看过','seen'],new:['未看','not opened']}[status];
      cell.setAttribute('aria-label',f.label+'，'+words[0]+' / '+f.label+', '+words[1]);
    }
    function build(){
      track.replaceChildren();cells.clear();wanted.clear();observer?.disconnect();
      for(const f of figures){
        const li=el('li'),cell=el('button','lens-cell');cell.type='button';cell.dataset.figure=f.id;
        cell.title=f.page?f.label+' · p.'+f.page:f.label;
        const frame=el('span','lens-frame'),img=el('img');img.alt='';img.hidden=true;
        if(thumbs.has(f.id)){img.src=thumbs.get(f.id);img.hidden=false}
        frame.append(img);
        const name=el('span','lens-name',f.raw?.pageOnly?'p.'+f.page:f.label.replace(/^Fig(?:ure)?\.?\s*/i,'Fig. '));
        cell.append(frame,name);cell.addEventListener('click',()=>select(f.id));
        li.append(cell);track.append(li);cells.set(f.id,cell);mark(f);observer?.observe(cell);
      }
      drawTally();
    }

    // Thumbnails: one at a time, only those scrolled near, after the main image had a head start.
    let busy=false,warm=false;
    const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(list=>{
      for(const item of list){const key=item.target.dataset.figure;item.isIntersecting?wanted.add(key):wanted.delete(key)}
      pump();
    },{root:track,rootMargin:'0px 240px'}):null;
    setTimeout(()=>{warm=true;pump()},900);
    function thumb(f){
      if(!asked.has(f.id)){
        const job=(async()=>{
          const image=await render(f.raw);
          const data=await thumbnail(image.blob,360);
          thumbs.set(f.id,data);
          const img=cells.get(f.id)?.querySelector('img');
          if(img){img.src=data;img.hidden=false}
          return data;
        })();
        asked.set(f.id,job);job.catch(()=>{});
      }
      return asked.get(f.id);
    }
    async function pump(){
      if(busy||!warm||disposed)return;
      const f=figures.find(x=>wanted.has(x.id)&&!asked.has(x.id));
      if(!f)return;
      busy=true;
      try{const data=await thumb(f);if(f===ordered()[0])recall(id,{thumb:data},true)}catch{}
      busy=false;setTimeout(pump,30);
    }

    function dialog(cls,label){
      const d=el('dialog',cls);d.setAttribute('aria-label',label);
      d.addEventListener('close',()=>d.remove());
      d.addEventListener('click',e=>{if(e.target===d)d.close()});
      workbench.append(d);return d;
    }

    // Storyboard
    function markdown(){
      const lines=['# '+(paper.title||''),''];
      for(const f of ordered())lines.push('## '+f.label+(f.page?' (PDF p.'+f.page+')':''),'',said(f)||'—','');
      return lines.join('\n');
    }
    function openStory(){
      persist();
      const d=dialog('lens-story','故事板 / Storyboard');
      const top=el('header'),titles=el('div'),sum=el('p');
      titles.append(ui('h2','','故事板','Storyboard'),sum);
      const controls=el('div','lens-story-actions');
      const message=el('span','lens-message');message.setAttribute('role','status');
      const rehearse=button('primary','开始试讲','Rehearse',()=>{d.close();openRehearsal()});
      const copy=button('light','复制讲稿','Copy script',async()=>{
        try{await navigator.clipboard.writeText(markdown());PaperUI.set(message,'已复制','Copied')}
        catch{PaperUI.set(message,'浏览器没有允许复制，请改用下载','Copy was blocked. Download instead')}
      });
      const down=button('light','下载 Markdown','Download Markdown',()=>{
        const a=el('a');a.href=URL.createObjectURL(new Blob([markdown()],{type:'text/markdown;charset=utf-8'}));
        a.download='reading-story.md';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
      });
      controls.append(message,copy,down,rehearse,button('light','关闭','Close',()=>d.close()));
      top.append(titles,controls);
      const list=el('ol','lens-board');
      const total=()=>{
        const all=ordered(),n=all.filter(said).length,s=all.reduce((t,f)=>t+seconds(said(f)),0);
        PaperUI.set(sum,n+' / '+all.length+' 张图有一句话，连着念约 '+clock(s),n+' of '+all.length+' figures have a line. About '+clock(s)+' read aloud');
      };
      for(const f of ordered()){
        const li=el('li'),open=el('button','lens-plate');open.type='button';open.setAttribute('aria-label','打开 '+f.label+' / Open '+f.label);
        open.addEventListener('click',()=>{d.close();select(f.id)});
        const img=el('img');img.alt='';open.append(img);
        if(thumbs.has(f.id))img.src=thumbs.get(f.id);
        const meta=el('div','lens-board-meta');meta.append(el('b','',f.label),el('span','',f.page?'p.'+f.page:''));
        const verdict=VERDICTS.find(v=>v[0]===store[f.id]?.verdict);
        if(verdict){const tag=ui('i','lens-tag',verdict[1],verdict[2]);tag.dataset.verdict=verdict[0];meta.append(tag)}
        const line=el('textarea');line.rows=3;line.maxLength=400;line.value=store[f.id]?.say||'';
        line.setAttribute('aria-label',f.label+' 的一句话 / One line for '+f.label);line.placeholder='还没写 / Not written yet';
        line.addEventListener('input',()=>{entry(f).say=line.value;mark(f);total();drawTally();clearTimeout(timer);timer=setTimeout(persist,250)});
        li.append(open,meta,line);list.append(li);
      }
      d.addEventListener('close',()=>{persist();drawCard()});
      d.append(top,list);total();d.showModal();
      (async()=>{for(const [i,f] of ordered().entries()){
        if(!d.isConnected)return;
        try{const data=await thumb(f),img=list.children[i]?.querySelector('img');if(img)img.src=data}catch{}
      }})();
    }

    // Rehearsal: the figure alone on a dark table. The line stays covered until asked for.
    function openRehearsal(){
      const all=ordered();if(!all.length)return;
      const d=dialog('lens-rehearse','试讲 / Rehearsal');
      let i=0,shown=false,url='',ticket=0;
      const begun=performance.now();
      const top=el('header'),name=el('b'),count=el('span'),time=el('time','','0:00');
      const stage=el('div','lens-stage'),img=el('img');stage.append(img);
      const foot=el('footer'),line=el('p');line.setAttribute('aria-live','polite');
      const prev=button('','← 上一图','← Previous',()=>go(-1)),next=button('','下一图 →','Next →',()=>go(1));
      const peek=button('lens-peek','看我的一句话','Show my line',()=>{shown=!shown;drawLine()});
      top.append(name,count,time,button('','结束试讲','End',()=>d.close()));
      foot.append(line,prev,peek,next);d.append(top,stage,foot);
      function drawLine(){
        const text=said(all[i]);
        if(!shown)PaperUI.set(line,'对着图，用自己的话讲','Explain the figure in your own words');
        else if(text)line.textContent=text;
        else PaperUI.set(line,'这张图还没写一句话','No line written for this figure');
        line.classList.toggle('lens-shown',shown&&!!text);
        PaperUI.set(peek,shown?'盖住':'看我的一句话',shown?'Cover':'Show my line');
      }
      async function draw(){
        const f=all[i],t=++ticket;shown=false;drawLine();
        name.textContent=f.label;count.textContent=(i+1)+' / '+all.length;
        prev.disabled=i===0;next.disabled=i===all.length-1;
        img.alt=f.label;img.hidden=!thumbs.has(f.id);if(thumbs.has(f.id))img.src=thumbs.get(f.id);
        try{
          const image=await render(f.raw);
          if(t!==ticket||!d.isConnected)return;
          const old=url;url=URL.createObjectURL(image.blob);img.src=url;img.hidden=false;if(old)URL.revokeObjectURL(old);
        }catch{}
      }
      function go(n){if(all[i+n]){i+=n;draw()}}
      d.addEventListener('keydown',e=>{
        if(e.key==='ArrowRight')go(1);else if(e.key==='ArrowLeft')go(-1);
        else if(e.key===' '&&!e.target.closest('button')){shown=!shown;drawLine()}else return;
        e.preventDefault();
      });
      const tick=setInterval(()=>{time.textContent=clock((performance.now()-begun)/1000)},500);
      d.addEventListener('close',()=>{clearInterval(tick);ticket++;if(url)URL.revokeObjectURL(url)});
      stage.tabIndex=-1;draw();d.showModal();stage.focus();
    }

    function openHelp(){
      const d=dialog('lens-help','快捷键 / Keyboard shortcuts'),rows=el('dl');
      for(const [key,zh,en] of [['J / K','下一图 / 上一图','Next / previous figure'],['B','盲读开关','Toggle look first'],['S','故事板','Storyboard'],['R','试讲','Rehearse'],['?','快捷键','This list']]){
        rows.append(el('dt','',key),ui('dd','',zh,en));
      }
      d.append(ui('h2','','快捷键','Keyboard shortcuts'),rows,button('light','关闭','Close',()=>d.close()));d.showModal();
    }
    function step(n){const f=figures[figures.indexOf(active)+n];if(f)select(f.id)}
    function onKey(e){
      if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing||e.defaultPrevented)return;
      if(!workbench.isConnected||!workbench.offsetParent||document.querySelector('dialog[open]'))return;
      if(e.target.closest?.('input,textarea,select,[contenteditable=true]'))return;
      const run={j:()=>step(1),k:()=>step(-1),b:()=>setBlind(!blind),s:openStory,r:openRehearsal,'?':openHelp}[e.key.toLowerCase()];
      if(run){e.preventDefault();run()}
    }
    document.addEventListener('keydown',onKey);
    const flush=()=>{if(timer)persist()};
    window.addEventListener('pagehide',flush);

    return {
      setModel(model){
        figures=globalThis.EvidenceAtlas?.inPaperOrder?.(model.figures)||model.figures;build();
        recall(id,{title:paper.title||'',total:ordered().length,said:ordered().filter(said).length});
      },
      picture(mode){fullPage=mode!=='figure';drawCard()},
      select(f){
        flush();fullPage=false;
        active=figures.find(x=>x.id===f.id)||f;entry(active).seen=true;
        for(const [key,cell] of cells)cell.setAttribute('aria-current',String(key===active.id));
        const cell=cells.get(active.id)?.parentElement;
        if(cell){
          const a=cell.getBoundingClientRect(),b=track.getBoundingClientRect();
          track.scrollBy({left:a.left-b.left-b.width/2+a.width/2,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
        }
        mark(active);drawCard();
      },
      destroy(){flush();disposed=true;observer?.disconnect();document.removeEventListener('keydown',onKey);window.removeEventListener('pagehide',flush)}
    };
  }

  // Start page: recent papers, and a drop target that covers the whole window.
  function startPage(root){
    const shell=root.querySelector('.pl-reader');if(!shell)return;
    const input=root.querySelector('input[type=file][id$="-main"]');
    const hasFiles=e=>[...(e.dataTransfer?.types||[])].includes('Files');
    const veil=el('div','lens-veil');veil.hidden=true;veil.append(ui('strong','','松手，读这篇','Drop to read'));document.body.append(veil);
    let depth=0;
    const clear=()=>{depth=0;veil.hidden=true};
    window.addEventListener('dragenter',e=>{if(hasFiles(e)){depth++;veil.hidden=!!e.target.closest?.('.pick')}});
    window.addEventListener('dragleave',e=>{if(hasFiles(e)&&--depth<=0)clear()});
    window.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
    window.addEventListener('drop',e=>{
      if(!hasFiles(e))return;
      // The labelled pickers (supplements, references) take their own drops first.
      const handled=e.defaultPrevented;clear();e.preventDefault();
      const file=e.dataTransfer.files[0];
      if(handled||!file||!input)return;
      const pack=new DataTransfer();pack.items.add(file);input.files=pack.files;
      input.dispatchEvent(new Event('change',{bubbles:true}));
    });
    const brand=document.querySelector('.top strong');
    if(brand){
      const home=el('button','lens-home');home.type='button';home.setAttribute('aria-label','回到首页 / Start page');home.title='回到首页 / Start page';
      brand.replaceWith(home);home.append(...brand.childNodes);
      home.addEventListener('click',()=>{try{sessionStorage.removeItem('paper-tree.v9.active')}catch{}location.href=location.pathname});
    }
    const list=read(RECENT,[]).filter(r=>/^[0-9a-f]{64}$/.test(r?.id||''));
    if(!list.length)return;
    const recent=el('section','lens-recent'),grid=el('ul');
    recent.append(ui('h2','','接着读','Continue reading'),grid);
    for(const r of list){
      const li=el('li'),open=el('button','lens-paper');open.type='button';
      const cover=el('span','lens-cover');
      if(/^data:image\/jpeg;base64,/.test(r.thumb||'')){const img=el('img');img.alt='';img.src=r.thumb;cover.append(img)}
      const title=el('span','lens-paper-title',r.title||'PDF');title.dataset.sourceText='';title.lang=/[㐀-鿿]/.test(r.title||'')?'zh-CN':'en';
      const meter=el('span','lens-meter'),total=Number(r.total)||0,done=Math.min(total,Number(r.said)||0),parts=Math.min(total,24);
      for(let n=0;n<parts;n++)meter.append(el('i',n<Math.round(done/total*parts)?'on':''));
      open.append(cover,title,meter,ui('small','',done+' / '+total+' 图已写',done+' of '+total+' figures written'));
      open.addEventListener('click',()=>{const hash='#paper='+r.id;if(location.hash===hash)window.dispatchEvent(new Event('hashchange'));else location.hash=hash});
      const drop=el('button','lens-forget','×');drop.type='button';drop.setAttribute('aria-label','从列表移除 / Remove from list');
      drop.title='从列表移除，笔记保留 / Remove from list, notes are kept';
      drop.addEventListener('click',()=>{write(RECENT,read(RECENT,[]).filter(x=>x.id!==r.id));li.remove();if(!grid.children.length)recent.remove()});
      li.append(open,drop);grid.append(li);
    }
    const library=shell.querySelector('.ps-library');
    library?library.before(recent):shell.append(recent);
  }
  globalThis.ReadingLens=Object.freeze({mount,startPage,seconds});
})();
