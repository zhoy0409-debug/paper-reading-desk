/* The literature behind the figure in view, with the sentence that cites it. */
(() => {
  'use strict';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
  const ui=(tag,cls,zh,en)=>PaperUI.set(el(tag,cls),zh,en);
  const t=(zh,en)=>window.ReaderLanguage?.current==='en'?en:zh;
  const button=(cls,zh,en,fn)=>{const b=ui('button',cls,zh,en);b.type='button';b.addEventListener('click',fn);return b};
  const source=n=>{n.lang='en';n.dataset.sourceText='';return n};
  const WHERE={caption:['图注','Caption'],mention:['提到本图的句子','Sentence about this figure'],aim:['实验目的','Purpose'],near:['讨论本图的段落','Paragraph about this figure']};
  const ORDER={caption:0,mention:1,aim:2,near:3};

  function short(e){
    const people=(e.authors||'').split(/,\s*(?=\p{Lu}\p{Ll})|\s+and\s+|\s+&\s+/u).filter(Boolean);
    const family=s=>{const x=s.trim().replace(/^and\s+/,'');return /,/.test(x)?x.split(',')[0]:x.split(/\s+/).at(-1)};
    const who=people.length>2?family(people[0])+' et al.':people.length===2?family(people[0])+' & '+family(people[1]):family(people[0]||e.text.slice(0,24));
    return who+' '+([...e.years].at(-1)||'');
  }
  async function abstract(e,look,box,foot){
    look.disabled=true;PaperUI.set(look,'正在查…','Looking…');
    const out=el('div','ct-abstract');out.setAttribute('role','status');
    const again=()=>{PaperUI.set(look,'再查一次','Try again');look.disabled=false};
    try{
      const r=await ReaderAccess.search(e.title||e.text.slice(0,118));
      const words=s=>new Set(String(s).toLowerCase().match(/[a-z]{4,}/g)||[]),want=words(e.title||e.text);
      const score=x=>{const w=words(x.title);return [...w].filter(v=>want.has(v)).length/Math.max(1,w.size,want.size)};
      const hit=(r.literature||[]).map(x=>({x,n:score(x)})).sort((a,b)=>b.n-a.n)[0];
      if(hit&&hit.n>=.6){
        if(hit.x.abstract)out.append(source(el('p','',hit.x.abstract)));
        else out.append(ui('small','','公开库收录了这篇，但没有摘要','Found, without an abstract in the public record'));
        if(/^https:\/\//.test(hit.x.url)){
          const a=ui('a','ct-link','打开文献','Open record');a.href=hit.x.url;a.target='_blank';a.rel='noopener noreferrer';out.append(a);
        }
        look.remove();
      }else{out.append(ui('small','','公开库里没有找到题名一致的文献','No record with a matching title'));again()}
    }catch{out.append(ui('small','','暂时连不上公开文献库','The public literature service is unavailable'));again()}
    box.querySelector('.ct-abstract')?.remove();foot.before(out);
  }
  function card(group,open){
    const e=group.entry,box=el('article','ct-card'),top=el('header');
    top.append(el('b','',e.number?'['+e.number+'] '+short(e):short(e)));
    box.append(top,source(el('h5','',e.title||e.text)));
    if(e.title&&e.venue)box.append(source(el('p','ct-venue',e.venue)));
    for(const u of group.uses.slice(0,2)){
      const use=el('div','ct-use'),name=WHERE[u.where],page=u.page?' · p.'+u.page:'';
      use.append(ui('small','',name[0]+page,name[1]+page));
      const q=source(el('p','ct-quote',u.quote));
      if(u.page){q.tabIndex=0;q.setAttribute('role','button');q.title=t('在原文中看','Show in PDF');q.addEventListener('click',()=>open(u.page,u.quote));q.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();open(u.page,u.quote)}})}
      use.append(q);box.append(use);
    }
    const foot=el('footer');
    const look=button('ct-link','查摘要','Find abstract',()=>abstract(e,look,box,foot));
    look.title=t('会把题名发送到公开文献库查询','Sends the title to a public literature service');
    const a=e.url?ui('a','ct-link','原文链接','Open paper'):ui('a','ct-link','学术搜索','Search Scholar');
    a.href=e.url||'https://scholar.google.com/scholar?q='+encodeURIComponent((e.title||e.text).slice(0,180));a.target='_blank';a.rel='noopener noreferrer';
    foot.append(look,a);
    if(e.page)foot.append(button('ct-link','文献表 p.'+e.page,'Reference list p.'+e.page,()=>open(e.page,e.text.slice(0,60))));
    box.append(foot);
    return box;
  }

  function mount({notes,paper,open}){
    const book=paper.citations;
    const panel=el('section','ct-panel');panel.hidden=true;
    const title=el('h4'),list=el('div','ct-list');panel.append(title,list);notes.append(panel);
    const pop=el('div','ct-pop');pop.hidden=true;document.body.append(pop);
    let groups=[],timer=0,owner=null,queued=0;
    function hide(){clearTimeout(timer);pop.hidden=true;owner?.setAttribute('aria-expanded','false');owner=null}
    function soon(){clearTimeout(timer);timer=setTimeout(hide,260)}
    function jump(page,quote){hide();open(page,quote)}
    function show(node,entries){
      clearTimeout(timer);if(owner===node&&!pop.hidden)return;
      owner?.setAttribute('aria-expanded','false');owner=node;node.setAttribute('aria-expanded','true');
      pop.replaceChildren(...entries.map(entry=>card({entry,uses:[]},jump)));pop.hidden=false;
      const r=node.getBoundingClientRect(),w=pop.offsetWidth,h=pop.offsetHeight;
      pop.style.left=Math.min(Math.max(12,r.left+r.width/2-w/2),innerWidth-w-12)+'px';
      pop.style.top=(r.bottom+h+12<innerHeight?r.bottom+8:Math.max(12,r.top-h-8))+'px';
    }
    pop.addEventListener('pointerenter',()=>clearTimeout(timer));pop.addEventListener('pointerleave',soon);
    pop.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();const o=owner;hide();o?.focus()}});

    // Citations inside quoted source text become live where they stand.
    const QUOTES='.frw-more p,blockquote,.rq-full-caption p,.rq-source-preview span,.ct-quote';
    function link(){
      if(!book?.entries.length)return;
      for(const host of notes.querySelectorAll(QUOTES)){
        if(host.dataset.cited===host.textContent&&(host.dataset.citedCount==='0'||host.querySelector('.ct-cite')))continue;
        host.dataset.cited=host.textContent;let count=0;
        const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT),nodes=[];
        while(walker.nextNode())nodes.push(walker.currentNode);
        for(const node of nodes){
          if(node.parentElement.closest('button,a,summary,.ct-cite'))continue;
          const spans=[];
          for(const h of book.find(node.data)){
            const same=spans.find(s=>s.index===h.index);
            if(same)same.entries.push(h.entry);else spans.push({index:h.index,length:h.length,entries:[h.entry]});
          }
          if(!spans.length)continue;
          const parts=[];let at=0;
          for(const s of spans){
            if(s.index<at)continue;
            parts.push(document.createTextNode(node.data.slice(at,s.index)));
            const b=el('span','ct-cite',node.data.slice(s.index,s.index+s.length));
            b.tabIndex=0;b.setAttribute('role','button');b.setAttribute('aria-expanded','false');
            b.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')show(b,s.entries)});
            b.addEventListener('pointerleave',soon);b.addEventListener('focus',()=>show(b,s.entries));
            b.addEventListener('click',e=>{e.stopPropagation();show(b,s.entries)});
            b.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();hide()}});
            parts.push(b);at=s.index+s.length;count++;
          }
          parts.push(document.createTextNode(node.data.slice(at)));node.replaceWith(...parts);
        }
        host.dataset.citedCount=String(count);
      }
    }
    const m=new MutationObserver(()=>{cancelAnimationFrame(queued);queued=requestAnimationFrame(link)});
    m.observe(notes,{childList:true,subtree:true});
    const outside=e=>{if(!pop.hidden&&!pop.contains(e.target)&&e.target!==owner)hide()};
    document.addEventListener('pointerdown',outside);notes.addEventListener('scroll',hide,{passive:true});
    function draw(){
      list.replaceChildren();panel.hidden=!groups.length;
      if(!groups.length)return;
      const rank=g=>Math.min(...g.uses.map(u=>ORDER[u.where]));
      const sorted=[...groups].sort((a,b)=>rank(a)-rank(b));
      PaperUI.set(title,'这张图连着的文献 · '+sorted.length,'Literature behind this figure · '+sorted.length);
      for(const g of sorted.slice(0,3))list.append(card(g,jump));
      if(sorted.length>3){
        const n=sorted.length-3;
        const more=button('ct-more','再看 '+n+' 篇','Show '+n+' more',()=>{more.remove();for(const g of sorted.slice(3))list.append(card(g,jump))});
        list.append(more);
      }
    }
    return {
      select(f){hide();groups=book&&f?.raw?book.forFigure(f.raw):[];draw();link()},
      destroy(){m.disconnect();cancelAnimationFrame(queued);hide();pop.remove();document.removeEventListener('pointerdown',outside);notes.removeEventListener('scroll',hide)}
    };
  }
  window.ReadingLiterature=Object.freeze({mount});
})();
