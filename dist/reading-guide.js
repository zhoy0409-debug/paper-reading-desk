/* Guided tour, one-time hints and the small movements that show what is selected. */
(() => {
  'use strict';
  const DONE='reading-desk.guide.v1';
  const el=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n};
  const t=(zh,en)=>window.ReaderLanguage?.current==='en'?en:zh;
  const seen=()=>{try{return JSON.parse(localStorage.getItem(DONE))||{}}catch{return {}}};
  const remember=k=>{try{localStorage.setItem(DONE,JSON.stringify({...seen(),[k]:1}))}catch{}};
  const shown=n=>n&&n.getClientRects().length&&n.getBoundingClientRect().width>4;
  const find=s=>[...document.querySelectorAll(s)].find(shown);
  let running=null,bubble=null;

  const HOME=()=>[
    ['.st-start .pl-drop-main',t('从这里打开论文','Open a paper here'),t('选一篇 PDF，或把文件拖到窗口任意位置。文件只在本机读取。','Choose a PDF or drop one anywhere in the window. It stays on this device.')],
    ['.st-sample',t('没有论文？先试读','No paper at hand?'),t('用一篇公开论文把功能走一遍。','Try everything with an open-access paper.')],
    ['.lens-recent',t('接着上次读','Pick up where you left off'),t('读过的论文会留在这里，连同进度。','Papers you opened stay here with your progress.')],
    ['.st-help',t('随时可以重看','Replay any time'),t('「怎么用」里有引导、快捷键和演示视频。','How to use has this tour, the shortcuts and a video.')]
  ];
  const READ=()=>[
    ['.st .lens-track',t('论文的脉络在这里','The paper’s argument'),t('按论文顺序排好每张图在说什么。点一张，右边的图跟着换，它的小图自动展开。','What each figure says, in order. Choose one and the figure follows, with its panels open.')],
    ['.st-dock',t('放大某个小图','Zoom into a panel'),t('点字母，只看这一格；点「整图」回来。图里的文字和坐标也能点开解释。','Choose a letter to see one panel, or Full figure to return. Labels in the image can be clicked too.')],
    ['.st .rq-tabs',t('在这里看解读','Read the explanation'),t('「读图」讲这张图，「读图基础」补背景，「划词追问」可以提问。','The figure explained, the basics behind it, and a place to ask.')],
    ['.st .lens-card',t('说一句，试试自己懂没懂','Say it in one line'),t('打开「盲读」会先盖住图注，写完再对照。写下的话会进讲稿。','Look first covers the caption until you have written your line. Lines become your script.')],
    ['.st-views',t('三个视图','Three views'),t('读图看细节；脑图梳理全文，图就在旁边；讲稿直接做成幻灯片。','Figures for detail, the map with the figure beside it, and slides for your talk.')],
    ['.st-back',t('不知道怎么回去？点这里','Lost? Go back here'),t('按钮上写着会回到哪里。按 Esc 或浏览器后退也一样。','The button names where it leads. Esc and browser Back work too.')],
    ['.st-menu',t('其他都收在这里','Everything else lives here'),t('换论文、补充材料、原文索引和按页定位。','Change paper, add materials, open the source index.')]
  ];

  function place(box,r,gap=14){
    const w=box.offsetWidth,h=box.offsetHeight,W=innerWidth,H=innerHeight,pad=12;
    const spots=[[r.left+r.width/2-w/2,r.bottom+gap],[r.right+gap,r.top+r.height/2-h/2],[r.left-w-gap,r.top+r.height/2-h/2],[r.left+r.width/2-w/2,r.top-h-gap]];
    const ok=([x,y])=>x>=-w&&y>=pad&&y+h<=H-pad&&(x>=r.right||x+w<=r.left||y>=r.bottom||y+h<=r.top)&&Math.min(Math.max(x,pad),W-w-pad)+w>0;
    const clamp=([x,y])=>[Math.min(Math.max(x,pad),W-w-pad),Math.min(Math.max(y,pad),H-h-pad)];
    const clear=([x,y])=>x>=r.right||x+w<=r.left||y>=r.bottom||y+h<=r.top;
    const pick=spots.filter(ok).map(clamp).find(clear)||clamp([r.left+r.width/2-w/2,r.top+r.height/2-h/2]);
    box.style.left=pick[0]+'px';box.style.top=pick[1]+'px';
  }

  function tour(kind){
    if(running||document.querySelector('dialog[open]'))return;
    dismiss();
    const list=(kind==='home'?HOME():READ()).filter(s=>find(s[0]));
    if(!list.length)return;
    const layer=el('div','gd-layer'),hole=el('div','gd-hole'),card=el('div','gd-card');
    card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
    const title=el('h3'),text=el('p'),dots=el('div','gd-dots'),foot=el('div','gd-foot');
    title.id='gd-title';card.setAttribute('aria-labelledby',title.id);text.setAttribute('aria-live','polite');
    const skip=el('button','gd-skip'),prev=el('button'),next=el('button','gd-next');
    for(const b of [skip,prev,next])b.type='button';
    foot.append(skip,dots,prev,next);card.append(title,text,foot);layer.append(hole,card);
    list.forEach(()=>dots.append(el('i')));
    const back=document.activeElement;let i=0;
    function draw(){
      const [sel,head,body]=list[i],node=find(sel);
      if(!node){i<list.length-1?(i++,draw()):end();return}
      node.scrollIntoView({block:'nearest',inline:'nearest'});
      const r=node.getBoundingClientRect(),p=6;
      const b={left:Math.max(4,r.left-p),top:Math.max(4,r.top-p),right:Math.min(innerWidth-4,r.right+p),bottom:Math.min(innerHeight-4,r.bottom+p)};
      Object.assign(hole.style,{left:b.left+'px',top:b.top+'px',width:b.right-b.left+'px',height:b.bottom-b.top+'px'});
      title.textContent=head;text.textContent=body;
      skip.textContent=t('跳过','Skip');prev.textContent=t('上一步','Back');next.textContent=i===list.length-1?t('开始用','Start'):t('下一步','Next');
      prev.hidden=i===0;skip.hidden=i===list.length-1;
      [...dots.children].forEach((d,n)=>d.classList.toggle('on',n===i));
      place(card,{left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:b.right-b.left,height:b.bottom-b.top});
    }
    function end(){
      if(!running)return;
      remember(kind);running=null;layer.classList.add('gd-out');
      removeEventListener('resize',draw);document.removeEventListener('keydown',key,true);
      setTimeout(()=>layer.remove(),180);
      if(back?.isConnected&&back!==document.body)back.focus({preventScroll:true});
    }
    function key(e){
      if(e.key==='Tab'){
        const f=[skip,prev,next].filter(b=>!b.hidden),at=f.indexOf(document.activeElement);
        e.preventDefault();f[(at+(e.shiftKey?-1:1)+f.length)%f.length].focus();
      }else if(e.key==='Escape')end();
      else if(e.key==='ArrowRight')i<list.length-1?(i++,draw()):end();
      else if(e.key==='ArrowLeft'){if(i){i--;draw()}}
      else{if(!['Enter',' '].includes(e.key))e.stopPropagation();return}
      e.preventDefault();e.stopPropagation();
    }
    next.onclick=()=>i<list.length-1?(i++,draw()):end();
    prev.onclick=()=>{if(i){i--;draw()}};
    skip.onclick=end;
    running={end,kind};
    document.body.append(layer);draw();next.focus({preventScroll:true});
    addEventListener('resize',draw);document.addEventListener('keydown',key,true);
  }

  // One line, once, the first time a reader goes one level deeper.
  function notice(kind){
    if(running||!kind||seen()['hint-'+kind]||!seen().read)return;
    const target=find('.st-back');if(!target)return;
    remember('hint-'+kind);dismiss();
    bubble=el('div','gd-hint');bubble.setAttribute('role','status');
    bubble.textContent={panel:t('看完点这里，回到整张图','Done? Return to the full figure here'),page:t('点这里，从原页回到图','Return from the page to the figure here'),
      map:t('点这里，回到读图','Back to the figures from here'),story:t('点这里，回到读图','Back to the figures from here')}[kind]||'';
    document.body.append(bubble);place(bubble,target.getBoundingClientRect(),10);
    target.classList.add('gd-pulse');
    bubble._t=setTimeout(dismiss,5200);
    bubble.onclick=dismiss;
  }
  function dismiss(){
    if(!bubble)return;
    clearTimeout(bubble._t);bubble.remove();bubble=null;
    document.querySelector('.gd-pulse')?.classList.remove('gd-pulse');
  }
  let pendingTour=0;
  function context(loaded){
    clearTimeout(pendingTour);
    if(running && (running.kind==='home')===loaded)running.end();
  }
  function auto(kind){
    clearTimeout(pendingTour);
    if(seen()[kind])return;
    pendingTour=setTimeout(()=>{
      if(window.getSelection()?.isCollapsed===false||document.querySelector('.local-translation:not([hidden]),.rq-callout:not([hidden])'))return;
      if((kind==='read')===!!document.querySelector('.pl-reader.pl-loaded')&&!seen()[kind])tour(kind);
    },kind==='read'?1400:700);
  }

  /* A selection that slides: the container draws one marker and moves it to the pressed child. */
  function slide(container,selector,axis='x'){
    if(!container)return ()=>{};
    container.classList.add('gd-slide');
    const update=()=>{
      const on=container.querySelector(selector);
      if(!on||!on.offsetWidth){container.style.setProperty('--on','0');return}
      const s=container.style;
      s.setProperty('--x',on.offsetLeft+'px');s.setProperty('--y',on.offsetTop+'px');
      s.setProperty('--w',on.offsetWidth+'px');s.setProperty('--h',on.offsetHeight+'px');s.setProperty('--on','1');
    };
    const m=new MutationObserver(()=>requestAnimationFrame(update));
    m.observe(container,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-pressed','aria-current','hidden']});
    const r=new ResizeObserver(update);r.observe(container);update();
    return ()=>{m.disconnect();r.disconnect()};
  }

  /* Hovering a thumbnail shows a larger look at that figure. */
  function peek(track,describe){
    const card=el('div','gd-peek');card.hidden=true;card.setAttribute('aria-hidden','true');
    const img=el('img'),name=el('b'),text=el('span');card.append(img,name,text);document.body.append(card);
    let timer,on=null;
    const hide=()=>{clearTimeout(timer);on=null;card.hidden=true};
    const show=cell=>{
      if(track.closest('.frw:not(.th-slim)'))return;
      const src=cell.querySelector('img:not([hidden])')?.src;
      if(!src||!matchMedia('(hover:hover) and (min-width:1001px)').matches)return;
      const d=describe(cell.dataset.figure);
      img.src=src;name.textContent=d.label;text.textContent=d.title;card.hidden=false;
      const r=cell.getBoundingClientRect();
      card.style.left=r.right+18+'px';
      card.style.top=Math.min(Math.max(r.top-10,68),innerHeight-card.offsetHeight-16)+'px';
    };
    track.addEventListener('pointerover',e=>{
      const cell=e.target.closest('.lens-cell');if(!cell||cell===on)return;
      const quick=!card.hidden;on=cell;clearTimeout(timer);
      if(cell.getAttribute('aria-current')==='true'){card.hidden=true;return}
      timer=setTimeout(()=>on===cell&&show(cell),quick?40:320);
    });
    track.addEventListener('pointerleave',hide);track.addEventListener('click',hide);track.addEventListener('scroll',hide,{passive:true});addEventListener('resize',hide);
    return ()=>{hide();removeEventListener('resize',hide);card.remove()};
  }
  window.ReadingGuide=Object.freeze({tour,auto,context,notice,dismiss,slide,peek,active:()=>!!running});
})();
