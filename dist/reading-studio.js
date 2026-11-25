/* Reading studio: one screen, one task. A top bar that always says where Back leads,
   a figure rail, a stage and an inspector. Existing controls are moved, not rebuilt. */
(() => {
  'use strict';
  const el=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n};
  const ui=(tag,cls,zh,en)=>PaperUI.set(el(tag,cls),zh,en);
  const button=(cls,zh,en,fn)=>{const b=ui('button',cls,zh,en);b.type='button';b.addEventListener('click',fn);return b};
  const t=(zh,en)=>window.ReaderLanguage?.current==='en'?en:zh;
  let shell=null,bench=null;

  /* ---------- Shell: top bar and drawer, created once ---------- */
  function start(root){
    const box=root.querySelector('.pl-reader'),top=document.querySelector('header.top');
    if(!box||!top)return;
    const reader=box.querySelector(':scope>section.pl-target');
    const brand=top.querySelector('h1'),languages=top.querySelector('.reader-languages');
    const back=el('button','st-back');back.type='button';
    const crumbs=el('nav','st-crumbs');crumbs.setAttribute('aria-label','当前位置 / Location');
    const views=el('div','st-views');views.setAttribute('role','group');views.setAttribute('aria-label','视图 / View');
    for(const [key,zh,en] of [['read','读图','Figures'],['map','脑图','Map'],['story','讲稿','Slides']]){
      const b=button('',zh,en,()=>bench?.show(key));b.dataset.view=key;views.append(b);
    }
    const right=el('div','st-right');
    const basket=el('button','st-basket');basket.type='button';basket.setAttribute('aria-expanded','false');
    const basketName=ui('span','','汇报','Slides'),basketCount=el('b');basket.append(basketName,basketCount);
    const menu=button('st-menu','论文与工具','Paper & tools',()=>drawer.classList.contains('st-open')?closeDrawer():openDrawer());
    const help=button('st-help','怎么用','How to use',()=>helpMenu.hidden?openHelp():closeHelp());help.setAttribute('aria-haspopup','menu');
    const helpMenu=el('div','st-helpmenu');helpMenu.hidden=true;
    const item=(zh,en,fn)=>helpMenu.append(button('',zh,en,()=>{closeHelp();fn()}));
    item('一步步教我','Show me step by step',()=>ReadingGuide.tour(loaded?'read':'home'));
    item('快捷键','Keyboard shortcuts',()=>{const k=document.querySelector('.lens-key');k?k.click():ReadingGuide.tour('home')});
    item('看演示视频','Watch the tour video',()=>document.querySelector('.folio-watch')?.click());
    function openHelp(){
      helpMenu.children[1].hidden=!bench?.alive();helpMenu.children[2].hidden=!!loaded;
      helpMenu.hidden=false;const r=help.getBoundingClientRect();helpMenu.style.right=Math.max(8,innerWidth-r.right)+'px';
      help.setAttribute('aria-expanded','true');helpMenu.querySelector('button').focus({preventScroll:true});
    }
    function closeHelp(){helpMenu.hidden=true;help.setAttribute('aria-expanded','false')}
    document.addEventListener('pointerdown',e=>{if(!helpMenu.hidden&&!helpMenu.contains(e.target)&&!help.contains(e.target))closeHelp()});
    helpMenu.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeHelp();help.focus()}
      const list=[...helpMenu.children].filter(b=>!b.hidden),at=list.indexOf(document.activeElement);
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();list[(at+(e.key==='ArrowDown'?1:-1)+list.length)%list.length].focus()}
    });
    document.body.append(helpMenu);
    right.append(basket,menu,help,languages);
    top.append(back,crumbs,views,right);

    const drawer=el('aside','st-drawer');drawer.setAttribute('aria-label','论文与工具 / Paper and tools');drawer.tabIndex=-1;drawer.inert=true;
    const head=el('header');head.append(ui('h2','','论文与工具','Paper & tools'),button('st-close','关闭','Close',()=>closeDrawer()));
    const tools=el('div','st-tools'),files=el('div','st-files');
    drawer.append(head,tools,files);
    const veil=el('div','st-veil');veil.hidden=true;veil.addEventListener('click',()=>closeDrawer());
    box.append(veil,drawer);
    function openDrawer(){drawer.inert=false;drawer.classList.add('st-open');veil.hidden=false;drawer.focus({preventScroll:true})}
    function closeDrawer(refocus=true){drawer.inert=true;drawer.classList.remove('st-open');veil.hidden=true;if(refocus)menu.focus({preventScroll:true})}

    // The intake belongs to the start page; with a paper open it lives in the drawer.
    const intake=[...box.children].filter(n=>n.matches('.uploadZone,.recognition,.ps-library'));
    const homes=intake.map(n=>{const c=document.createComment('');n.before(c);return c});
    let loaded=null;
    function sync(){
      const on=box.classList.contains('pl-loaded');
      if(on!==loaded){
        loaded=on;ReadingGuide.context(on);document.documentElement.classList.toggle('st-loaded',on);
        if(on)files.append(...intake);else{intake.forEach((n,i)=>homes[i].after(n));closeDrawer(false);steps=0}
      }
      draw();
    }
    new MutationObserver(sync).observe(box,{attributes:true,attributeFilter:['class']});
    new MutationObserver(()=>queueMicrotask(sync)).observe(reader,{childList:true});
    // A file chosen from the drawer opens a new paper.
    drawer.addEventListener('change',e=>{if(e.target.matches('input[type=file][id$="-main"]'))closeDrawer(false)});

    /* Where am I, and where does Back go? */
    const returnButton=()=>[...reader.querySelectorAll('button')].find(b=>/返回原图工作台|Return to figures/.test(b.textContent));
    function place(){
      if(!loaded)return [];
      const list=[{label:t('书架','Library'),go:home}];
      if(!bench?.alive()){list.push({label:t('读图','Figures'),go:()=>returnButton()?.click(),skip:!returnButton()},{label:t('原文','Source text')});return list.filter(x=>!x.skip)}
      const s=bench.state();
      list.push({label:s.title,go:()=>bench.whole(),paper:true});
      if(s.view!=='read'){list.push({label:s.view==='map'?t('脑图','Map'):t('讲稿','Slides')});if(s.page)list.push({label:t('PDF 原页','PDF page')});return list}
      list.push({label:s.figure,go:()=>bench.whole()});
      if(s.panel)list.push({label:t('小图 ','Panel ')+s.panel,go:()=>bench.closePage()});
      if(s.page)list.push({label:t('PDF 原页','PDF page')});
      return list;
    }
    const depth=()=>{const p=place();return p.length?p.length-(bench?.alive()&&bench.state().view==='read'?2:1):0};
    function home(){try{sessionStorage.removeItem('paper-tree.v9.active')}catch{}location.href=location.pathname}
    // One step towards the library.
    function up(){
      if(drawer.classList.contains('st-open'))return closeDrawer();
      if(!loaded)return;
      if(!bench?.alive()){const b=returnButton();return b?b.click():home()}
      const s=bench.state();
      if(s.page)return bench.closePage();
      if(s.view!=='read')return bench.show('read');
      if(s.panel)return bench.whole();
      home();
    }
    let steps=0,ignore=0,drawn='',settling=0;
    // Browser Back follows the same path as the Back button. Wait until a switch of view has settled,
    // then keep one history entry per level.
    function syncHistory(){
      const now=depth();
      while(steps<now)history.pushState({studio:++steps},'');
      if(steps>now&&loaded){
        const extra=steps-now;steps=now;ignore=1;history.go(-extra);
        setTimeout(()=>{ignore=0},400);
      }
    }
    function goBack(){
      if(drawer.classList.contains('st-open')||!steps)return up();
      const before=drawn;history.back();
      setTimeout(()=>{if(drawn===before&&loaded)up()},260);
    }
    function draw(){
      const p=place();
      clearTimeout(settling);settling=setTimeout(syncHistory,160);
      const key=JSON.stringify([p.map(x=>x.label),bench?.alive()&&bench.state().view,window.ReaderLanguage?.current]);
      if(key===drawn)return;drawn=key;
      back.hidden=p.length<2;
      const target=p.length<2?null:bench?.alive()&&bench.state().view!=='read'&&!bench.state().page?t('读图','figures'):p.length===3&&p[1].paper?p[0].label:p.at(-2).label;
      back.textContent=target?'← '+t('返回','Back to ')+target:'';
      crumbs.replaceChildren();
      p.forEach((x,i)=>{
        const last=i===p.length-1,n=el(last||!x.go?'span':'button',x.paper?'st-paper':'');
        n.textContent=x.label;if(last)n.setAttribute('aria-current','page');else if(x.go){n.type='button';n.addEventListener('click',x.go)}
        if(x.paper)n.title=x.label;
        crumbs.append(n);
      });
      views.hidden=!bench?.alive();basket.hidden=!bench?.alive();
      ReadingGuide.dismiss();
      if(bench?.alive()){const s=bench.state();requestAnimationFrame(()=>ReadingGuide.notice(s.view!=='read'?s.view:s.page?'page':s.panel?'panel':''))}
      for(const b of views.children)b.setAttribute('aria-pressed',String(bench?.alive()&&bench.state().view===b.dataset.view));
    }
    back.addEventListener('click',goBack);
    window.addEventListener('popstate',()=>{if(ignore){ignore=0;return}if(steps>0){steps--;up()}});
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape'||e.defaultPrevented||document.querySelector('dialog[open]')||e.target.closest?.('input,textarea,select'))return;
      if(drawer.classList.contains('st-open')||bench?.alive()&&(bench.state().view!=='read'||bench.state().page)){e.preventDefault();up()}
    });
    document.addEventListener('reader-language-change',()=>queueMicrotask(draw));
    shell={draw,tools,drawer,closeDrawer,basket,basketCount,views};
    basket.addEventListener('click',()=>bench?.toggleBasket());
    ReadingGuide.slide(views,'[aria-pressed=true]');
    sync();
    startPage(root);
    if(!PaperShelf.target()&&!sessionStorage.getItem('paper-tree.v9.active')&&!new URLSearchParams(location.search).has('sample'))ReadingGuide.auto('home');
  }

  function startPage(root){
    const intake=root.querySelector('.folio-intake'),plate=root.querySelector('.folio-example'),open=root.querySelector('.folio-open');
    if(!intake||!plate)return;
    intake.querySelector('h2')&&PaperUI.set(intake.querySelector('h2'),'从图读懂一篇论文','Read a paper through its figures');
    const lead=ui('p','st-lead','打开一篇 PDF，逐图看懂、核对原文，再整理成组会讲稿。文件只在本机读取。','Open a PDF, work through its figures, check them against the text and build your journal-club script. Files stay on this device.');
    intake.querySelector('.reader-title-row')?.after(lead);
    const picker=intake.querySelector('.pl-primary-picker');
    const row=el('div','st-start');picker.before(row);row.append(picker);
    if(open){open.classList.add('st-sample');row.append(open)}
    const watch=plate.querySelector('.folio-watch');
    const preview=el('img','st-preview');preview.src='./media/embedding-plate.webp';preview.alt='';
    plate.prepend(preview);
    if(watch){
      const play=button('st-watch','看演示','Watch the tour',()=>watch.click());
      row.append(play);
    }
    // Real steps of the workflow, in order.
    const steps=el('ol','st-steps');
    for(const [path,zh,en,zhText,enText] of [
      ['M6 3h8l4 4v14H6zM14 3v4h4M12 18v-6m-3 3 3-3 3 3','打开论文','Open a paper','按图号找到原图和对应图注。','Find numbered figures and their captions.'],
      ['M4 5h16v12H4zM8 13l3-4 3 3 2-2 2 3M9 21h6','看图解','Read the explanation','选一张图，点「看图解」。想读坐标或图例，可选「点读标注」。','Choose a figure and select Read explanation. Open Figure labels to explore its axes and legend.'],
      ['M5 4h14v10H9l-4 4zM9 8h6M9 11h4','整理讲稿','Build your script','每张图写一句，自动成为幻灯片讲解。','One line per figure becomes your speaking note.']]){
      const li=el('li');
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
      const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',path);svg.append(p);
      li.append(svg,ui('h3','',zh,en),ui('p','',zhText,enText));steps.append(li);
    }
    intake.closest('.folio-opening').after(steps);
    // The sample figure leans slightly towards the pointer.
    if(matchMedia('(hover:hover) and (prefers-reduced-motion:no-preference)').matches){
      plate.addEventListener('pointermove',e=>{const r=plate.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;preview.style.transform='perspective(900px) rotateY('+(x*7).toFixed(2)+'deg) rotateX('+(-y*7).toFixed(2)+'deg)'});
      plate.addEventListener('pointerleave',()=>{preview.style.transform=''});
    }
  }

  /* ---------- Bench: the three-part reading screen ---------- */
  function mount(ctx){
    const {workbench,visual,notes,title,figIndex,headingText,tabs,tools,steps,compare,wholeFigure,lens,model,desk:panelDesk,state,paper,save,select,render,source}=ctx;
    workbench.classList.add('st');
    let view='read',alive=true;
    const q=s=>workbench.querySelector(s);
    const bar=q('.compare-bar');
    bar.prepend(headingText);
    const dock=el('div','st-dock');dock.append(tabs,tools);visual.append(dock);
    const [prev,next]=[...steps.querySelectorAll('button')].filter(b=>b.classList.contains('frw-inline')&&!b.classList.contains('frw-map-back'));
    prev?.classList.add('st-prev');next?.classList.add('st-next');
    if(prev)visual.append(prev,next);
    const fold=el('button','st-fold');fold.type='button';
    function drawFold(){const w=workbench.classList.contains('st-wide');fold.textContent=w?'‹':'›';fold.setAttribute('aria-label',w?'展开解读 / Show explanation':'收起解读 / Hide explanation');fold.setAttribute('aria-expanded',String(!w))}
    fold.addEventListener('click',()=>{workbench.classList.toggle('st-wide');drawFold()});drawFold();visual.append(fold);
    const readTab=notes.querySelector('.rq-tabs [data-view="read"]');
    if(readTab){
      const openReading=button('st-explain','看图解','Read explanation',()=>{
        ReadingGuide.context(true);
        if(visual.classList.contains('source-shown')||visual.classList.contains('source-folded'))compare.showFigure();
        workbench.classList.remove('st-wide');drawFold();
        if(workbench.classList.contains('lens-blind'))lens.revealCaption();
        readTab.click();
        readTab.focus({preventScroll:true});
        if(matchMedia('(max-width:1000px)').matches)notes.scrollIntoView({block:'start',behavior:'instant'});
        else notes.scrollTop=0;
      });
      openReading.setAttribute('aria-controls',notes.id);
      bar.querySelector('.frw-button').before(openReading);
      const backToImage=button('st-back-to-image','回到图','Back to figure',()=>{
        openReading.focus({preventScroll:true});
        openReading.scrollIntoView({block:'start',inline:'nearest',behavior:'instant'});
      });
      readTab.parentNode.append(backToImage);
    }
    for(const [b,zh,en] of [[tools.children[0],'缩小','Zoom out'],[tools.children[2],'放大','Zoom in'],[tools.children[3],'全屏看图','Full screen']])if(b)b.dataset.tip=t(zh,en);
    const undo=[ReadingGuide.slide(tabs,'[aria-pressed=true]'),ReadingGuide.slide(notes.querySelector('.rq-tabs'),'[aria-pressed=true]')];
    const track=q('.lens-track');if(track)undo.push(ReadingGuide.peek(track,id=>lens?.describe(id)||{label:'',title:''}));
    const literature=ReadingLiterature.mount({notes,paper,open:source});
    const thread=track?ReadingThread.mount({workbench,track,tabs,model,paper}):null;
    const figureById=new Map(model.figures.map(f=>[f.id,f]));
    const map=ReadingMap.mount({workbench,model,paper,state,save,select,source,thumb:id=>lens.thumb(figureById.get(id)),
      openPanel(id,letter){if(id)select(id);[...tabs.querySelectorAll('.frw-panel-tab')].find(b=>b.textContent.trim()===letter)?.click()}});
    const deck=ReadingDeck.mount({workbench,model,paper,state,save,render,desk:panelDesk,changed:()=>drawBasket()});
    let followed='';
    function follow(){
      const id=track?.querySelector('.lens-cell[aria-current=true]')?.dataset.figure;
      if(!id||id===followed)return;followed=id;literature.select(figureById.get(id));map.mark(id);
    }
    if(track){const m=new MutationObserver(follow);m.observe(track,{subtree:true,attributes:true,attributeFilter:['aria-current']});undo.push(()=>m.disconnect())}
    follow();
    undo.push(()=>literature.destroy(),()=>thread?.destroy(),()=>map.destroy(),()=>deck.destroy());
    const story=el('section','st-story');story.hidden=true;workbench.append(story);

    // Inspector: reading first, everything occasional in one disclosure at the end.
    const desk=notes.querySelector('.pd-desk');
    if(desk){
      const more=el('details','st-more');more.append(ui('summary','','裁切、笔记与英文跟读','Crop, notes and English practice'));
      const english=notes.querySelector('.ep-panel-button');
      const extras=[desk.querySelector(':scope>.pd-open-preview'),desk.querySelector(':scope>.pd-report'),...desk.querySelectorAll(':scope>details:not(.pd-report)'),desk.querySelector(':scope>button:not(.pd-open-preview)')].filter(Boolean);
      more.append(...(english?[english]:[]),...extras);
      const status=desk.querySelector(':scope>.pd-status');
      notes.append(more);void status;
    }
    const card=notes.querySelector('.lens-card'),look=q('.lens-switch');
    if(card&&look){const row=el('div','st-card-head');card.prepend(row);row.append(card.querySelector('.lens-ask'),look)}

    // Occasional navigation goes to the drawer.
    const occasional=ctx.host?.parentElement?.querySelector('.pl-reader-top .lineActions');
    shell?.tools.replaceChildren();
    if(occasional)shell?.tools.append(occasional);
    const keys=q('.lens-key');if(keys&&shell){PaperUI.set(keys,'快捷键','Keyboard shortcuts');keys.classList.add('light');shell.tools.append(keys)}
    const leave=e=>{if(e.target.closest('button'))shell.closeDrawer(false)};
    shell?.tools.addEventListener('click',leave);

    const count=q('.basket-count');
    q('.basket-export')?.before(button('basket-story','编辑讲稿','Edit deck',()=>show('story')));
    function drawBasket(){
      if(!shell||!count)return;
      const n=Number(count.textContent)||0,old=shell.basketCount.textContent;
      const real=q('.slide-basket').hidden?0:n;
      shell.basketCount.textContent=real||'';shell.views.querySelector('[data-view=story]').lastElementChild?.matches('b')||shell.views.querySelector('[data-view=story]').append(document.createElement('b'));shell.views.querySelector('[data-view=story] b').textContent=real||'';shell.basket.disabled=!real;
      if(!real)basketOpen(false);
      if(real>Number(old||0))shell.views.querySelector('[data-view=story]').animate?.([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:320});
    }
    function basketOpen(on){workbench.classList.toggle('st-basket-open',on);shell?.basket.setAttribute('aria-expanded',String(on))}
    const watchers=[];
    const observe=(node,options,fn)=>{if(!node)return;const m=new MutationObserver(fn);m.observe(node,options);watchers.push(m)};
    observe(q('.slide-basket'),{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true,characterData:true},drawBasket);
    const redraw=()=>queueMicrotask(()=>shell?.draw());
    observe(visual,{attributes:true,attributeFilter:['class']},redraw);
    observe(tabs,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-pressed']},redraw);
    observe(title,{childList:true,subtree:true,characterData:true},redraw);
    observe(figIndex,{childList:true,subtree:true,characterData:true},redraw);

    function show(next){
      if(!alive)return;
      view=next;workbench.dataset.view=next;basketOpen(false);
      story.hidden=next!=='story';
      if(next==='story')deck.show(story);else deck.hide();
      if(next==='map')requestAnimationFrame(()=>map.show());
      shell?.draw();
    }
    workbench.dataset.view='read';
    const onView=e=>show(e.detail);
    workbench.addEventListener('studio-talk',()=>deck.talk());
    workbench.addEventListener('studio-view',onView);
    const panelName=()=>{
      const on=[...tabs.querySelectorAll('.frw-panel-tab')].findIndex(b=>b.getAttribute('aria-pressed')==='true');
      return tabs.hidden||on<1?'':tabs.querySelectorAll('.frw-panel-tab')[on].textContent.trim();
    };
    bench={
      alive:()=>alive&&workbench.isConnected,
      state:()=>({view,title:(model.curated&&ReaderLanguage.current==='en'?model.questionEnglish:'')||title.textContent.trim()||t('论文','Paper'),
        figure:figIndex.textContent.replace(/^Fig(?:ure)?\.?\s*/i,t('图 ','Figure ')),
        panel:panelName(),page:visual.classList.contains('source-shown')}),
      show,
      whole(){show('read');compare?.showFigure();wholeFigure()},
      closePage(){compare?.showFigure()},
      toggleBasket(){show('story')}
    };
    const mine=bench;
    drawBasket();shell?.draw();ReadingGuide.auto('read');
    return {
      show,
      destroy(){
        alive=false;for(const m of watchers)m.disconnect();for(const f of undo)f();
        shell?.tools.removeEventListener('click',leave);shell?.tools.replaceChildren();
        if(bench===mine)bench=null;
        queueMicrotask(()=>shell?.draw());
      }
    };
  }
  window.ReadingStudio=Object.freeze({start,mount});
})();
