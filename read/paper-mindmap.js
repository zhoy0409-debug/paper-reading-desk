(() => {
'use strict';

const controls = new WeakMap();
const PALETTE = [
 ['#6d4cb0','#f5efff','#49317d'], ['#28786f','#eef9f6','#135c54'],
 ['#9b6930','#fff7ea','#704714'], ['#4277a8','#eef6fe','#245482'],
 ['#a45580','#fdf0f7','#793858'], ['#53764e','#f1f7ee','#3e5d37']
];
const CSS = `
.paper-map{--pm-ink:#28233a;--pm-muted:#615b72;--pm-border:#e8e0ee;--pm-plum:#6c4cb0;font:inherit;color:var(--pm-ink);container-type:inline-size;line-height:1.48}
.paper-map .pm-retry{display:none}.paper-map:has([data-translation-retry]) .pm-retry{display:inline-block}
.paper-map,.paper-map *{box-sizing:border-box}
.paper-map :is(h2,h3,h4,p){margin:0}
.paper-map button,.paper-map a{font-family:inherit}
.paper-map button:focus-visible,.paper-map a:focus-visible,.paper-map [tabindex="-1"]:focus-visible{outline:3px solid #7451b5;outline-offset:3px}
.paper-map .pm-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 13px;justify-content:space-between;margin:0 0 10px}
.paper-map .pm-head h2{font-size:clamp(21px,3vw,27px);line-height:1.2;overflow-wrap:anywhere}
.paper-map .pm-orientation{font-size:14px;color:var(--pm-muted);margin-top:4px}
.paper-map .pm-switch{background:white;border:1px solid var(--pm-border);border-radius:9px;color:#53388a;padding:7px 11px;cursor:pointer;font-size:14px;text-decoration:none}
.paper-map .pm-switch:hover{background:#f5effd}
.paper-map .pm-layout{display:grid;grid-template-columns:minmax(0,1.28fr) minmax(255px,.72fr);gap:13px}
.paper-map .pm-graph{position:relative;isolation:isolate;border:1px solid #eae1f0;border-radius:20px;overflow:hidden;background:radial-gradient(ellipse at center,#eee2fa 0%,#f9f2fc 30%,transparent 64%),linear-gradient(135deg,#fffaff,#f7f5fb);padding:12px;display:grid;grid-template-columns:minmax(0,1fr) minmax(100px,.9fr) minmax(0,1fr);min-height:300px;gap:10px;min-width:0;align-items:stretch}
.paper-map .pm-graph::before{content:"";position:absolute;inset:0;background-image:radial-gradient(#8768aa3b .7px,transparent .7px);background-size:14px 14px;z-index:-2;pointer-events:none;mask-image:radial-gradient(ellipse,#000,transparent 91%)}
.paper-map .pm-svg{position:absolute;inset:0;width:100%;height:100%;z-index:-1;overflow:visible;pointer-events:none}
.paper-map .pm-svg path{fill:none;stroke:var(--edge);stroke-opacity:.57;stroke-width:2.05;vector-effect:non-scaling-stroke;stroke-linecap:round;transition:stroke-width .2s,stroke-opacity .2s}
.paper-map .pm-svg path.pm-line-active{stroke-opacity:1;stroke-width:3}
.paper-map .pm-svg circle{fill:var(--edge);opacity:.77}
.paper-map .pm-side{display:flex;flex-direction:column;justify-content:space-around;gap:7px;align-items:stretch;min-width:0}
.paper-map .pm-side-center{justify-content:center}
.paper-map .pm-node{position:relative;display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-width:0;width:100%;min-height:56px;border:1px solid color-mix(in srgb,var(--pm-node) 26%,white);border-radius:13px;padding:8px 9px;background:white;color:var(--pm-node-ink);box-shadow:0 2px 11px #3f226b0a;font-size:14px;cursor:pointer;overflow-wrap:anywhere;transition:background .16s,border-color .16s,transform .16s}
.paper-map .pm-node:hover{background:var(--pm-node-pale);border-color:var(--pm-node);transform:translateY(-1px)}
.paper-map .pm-node[aria-pressed=true],.paper-map .pm-crumb[aria-current=true]{background:var(--pm-node-pale);border-color:var(--pm-node);box-shadow:0 0 0 1px color-mix(in srgb,var(--pm-node) 24%,transparent)}
.paper-map .pm-node-title{font-weight:680;line-height:1.32}
.paper-map .pm-badge{display:inline-flex;align-items:center;color:var(--pm-node-ink);font-size:12px;line-height:1.2;margin-bottom:4px}
.paper-map .pm-badge::before{content:"";display:inline-block;width:6px;height:6px;margin-right:5px;border-radius:50%;background:var(--pm-node)}
.paper-map .pm-root{background:#604094;border-color:#604094;color:white!important;box-shadow:0 6px 19px #6143962b;min-height:96px;justify-content:center;align-items:center;text-align:center;z-index:1;padding:10px}
.paper-map .pm-root .pm-badge{color:#f6eaff}
.paper-map .pm-root .pm-badge::before{background:#ede0ff}
.paper-map .pm-root:hover,.paper-map .pm-root[aria-pressed=true]{background:#573781;border-color:#573781;box-shadow:0 0 0 2px #fff,0 0 0 4px #885dbb72}
.paper-map .pm-drawer{min-width:0;border:1px solid #eae1f0;border-radius:19px;background:#fff;padding:15px;align-self:start;scroll-margin-top:14px;overflow-wrap:anywhere}
.paper-map .pm-drawer h3{font-size:21px;line-height:1.26;margin-top:4px}
.paper-map .pm-drawer .pm-badge{font-size:13px}
.paper-map .pm-summary{margin-top:9px;color:#3a324f;font-size:15px}
.paper-map .pm-drawer :is(details,figure,.pm-section){margin:12px 0 0}
.paper-map .pm-drawer summary{cursor:pointer;font-weight:650;color:#554082}
.paper-map .pm-children{display:grid;gap:6px;margin-top:7px;margin-inline-start:4px;padding-inline-start:11px;border-inline-start:2px solid var(--pm-node)}
.paper-map .pm-children .pm-node{min-height:42px;justify-content:center}
.paper-map .pm-children .pm-label{font-size:13px;color:var(--pm-muted)}
.paper-map .pm-crumbs{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin:0 0 10px}
.paper-map .pm-crumb{border:1px solid #e2d8ed;background:#fff;color:#584184;border-radius:8px;padding:5px 7px;font-size:13px;cursor:pointer}
.paper-map .pm-section h4{font-size:14px;margin-bottom:4px;color:#544074}
.paper-map .pm-source-line{border-left:2px solid #ad98c8;padding:5px 8px;background:#faf7fc;color:#554967;font-size:14px}
.paper-map .pm-source-line+.pm-source-line{margin-top:5px}
.paper-map .pm-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}
.paper-map .pm-excerpt{font-size:14px;color:var(--pm-muted);border-left:2px solid #d8c9ec;padding-left:9px;margin:6px 0 0}
.paper-map .pm-excerpt p{margin-top:5px;white-space:pre-wrap}
.paper-map figure{display:block}
.paper-map figure img{display:block;max-width:100%;max-height:295px;margin:5px auto 0;border:1px solid var(--pm-border);border-radius:9px;background:#ffffff}
.paper-map figure figcaption,.paper-map .pm-caption{font-size:13px;color:var(--pm-muted);margin-top:5px}
.paper-map .pm-flow{list-style:none;margin:7px 0 0;padding:0;display:grid;gap:5px}
.paper-map .pm-flow li{position:relative;background:var(--pm-node-pale);color:var(--pm-node-ink);border:1px solid color-mix(in srgb,var(--pm-node) 20%,white);border-radius:9px;padding:6px 9px;font-size:14px}
.paper-map .pm-flow li:not(:last-child)::after{content:"";position:absolute;bottom:-6px;left:14px;height:6px;border-left:1px solid var(--pm-node)}
.paper-map video{display:block;width:100%;max-height:245px;margin-top:6px;background:#241a3a;border-radius:9px}
.paper-map .pm-scenes{background:var(--pm-node-pale);border:1px solid color-mix(in srgb,var(--pm-node) 20%,white);border-radius:11px;position:relative;margin-top:6px;padding:9px 10px;color:var(--pm-node-ink)}
.paper-map .pm-scenes p{min-height:2.6em;font-size:14px;margin-top:5px}
.paper-map .pm-scenes progress{display:block;width:100%;accent-color:var(--pm-node);height:8px;margin:6px 0}
.paper-map .pm-empty{padding:10px 0;color:var(--pm-muted);font-size:14px}
.paper-map .pm-graph-more{margin-top:7px}
@container (max-width:770px){
 .paper-map .pm-layout{grid-template-columns:minmax(0,1fr)}
 .paper-map .pm-graph{min-height:280px}
}
@container (max-width:510px){
 .paper-map .pm-graph{grid-template-columns:minmax(0,1fr) minmax(0,1fr);min-height:0;gap:7px}
 .paper-map .pm-side{justify-content:start}
 .paper-map .pm-side-center{grid-column:1/-1;grid-row:1}
 .paper-map .pm-root{min-height:58px;max-width:none}
 .paper-map .pm-svg{display:none}
 .paper-map .pm-graph{padding:9px}
 .paper-map .pm-node:not(.pm-root){border-inline-start:3px solid var(--pm-node)}
}
@media(max-width:600px){
 .paper-map .pm-layout{grid-template-columns:minmax(0,1fr)}
 .paper-map .pm-drawer{padding:12px}
}
@media(prefers-reduced-motion:reduce){.paper-map *, .paper-map *::before{transition:none!important;animation:none!important}}
`;
const asText = (v,n=1200) => (typeof v === 'string' ? v.trim() : '').slice(0,n);
const arr = v => Array.isArray(v) ? v : [];
const localURL = (value,b) => {
 const s=asText(value,1500); if(!s)return '';
 try{
  const u=new URL(s,b);
  if(u.protocol==='blob:')return u.origin===new URL(b).origin?u.href:'';
  const base=new URL(b);
  if(u.origin!==base.origin||!['https:','http:','file:'].includes(u.protocol))return '';
  if(u.protocol==='file:'&&(/^(?:[a-z]+:|\/\/)/i.test(s)||s.includes('..')))return '';
  return u.href;
 }catch{return '';}
};
const safeHref = (value,b) => {
 const s=asText(value,1500);if(!s)return '';
 try{const u=new URL(s,b);return ['https:','http:'].includes(u.protocol)||u.protocol==='file:'&&localURL(s,b)?u.href:'';}catch{return '';}
};
function modelOf(data){
 const m=data&&typeof data==='object'?data:{};
 const root=typeof m.root==='string'?{title:m.root}:m.root&&typeof m.root==='object'?m.root:{};
 const branches=[];
 for(const original of arr(m.branches)){
  if(!original||!asText(original.title,180))continue;
  const ix=branches.length,key=asText(original.id,90)||String(ix);
  const branch={original,key,ix,title:asText(original.title,180),children:[]};
  for(const item of arr(original.children)){
   if(!item||!asText(item.title,180))continue;
   branch.children.push({original:item,title:asText(item.title,180),key:asText(item.id,90)||String(branch.children.length)});
  }
  branches.push(branch);
 }
 return {title:asText(m.title,160)||'论文脉络地图', rootTitle:asText(root.title,215)||'这篇论文想回答什么？',root,branches};
}
function applyPalette(el,ix){
 const p=PALETTE[((ix%PALETTE.length)+PALETTE.length)%PALETTE.length];
 el.style.setProperty('--pm-node',p[0]);el.style.setProperty('--pm-node-pale',p[1]);el.style.setProperty('--pm-node-ink',p[2]);return p;
}
function showDiagram(parent,diagram,make,doc){
 if(!diagram||typeof diagram!=='object')return;
 const src=localURL(diagram.src,doc.baseURI), steps=arr(diagram.steps).map(x=>asText(typeof x==='string'?x:x?.title,180)).filter(Boolean);
 if(!src&&!steps.length)return;
 const fig=make('figure');
 const heading=asText(diagram.title,100);if(heading)fig.append(make('h4',heading));
 if(src){const img=make('img');img.src=src;img.loading='lazy';img.alt=asText(diagram.alt,220)||heading||'本节点图解';fig.append(img);}
 if(steps.length){
  const list=make('ol',undefined,'pm-flow');
  for(const step of steps)list.append(make('li',step));
  fig.append(list);
 }
 const caption=asText(diagram.caption,500);if(caption)fig.append(make('figcaption',caption));
 parent.append(fig);
}
function mount(container,rawModel,options={}){
 if(!container||typeof container.append!=='function')return null;
 const previous=controls.get(container);if(previous){previous.update(rawModel,options);return previous;}
 const doc=container.ownerDocument||window.document, base=doc.baseURI;
 const make=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const label=(el,text)=>text&&/[A-Za-z]/.test(text)&&!/[\u3400-\u9fff]/u.test(text)?PaperLanguageText.bind(el,text):PaperUI.set(el,text);
 const ui=(tag,text,cls)=>label(make(tag,undefined,cls),text);
 const button=(text,fn,cls='pm-switch')=>{const b=ui('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
 const wrapper=make('section',undefined,'paper-map');
 const style=make('style',CSS);
 const header=make('div',undefined,'pm-head'), titles=make('div'), heading=make('h2'), hint=make('p','先看核心问题，点一条枝再展开图解和出处。','pm-orientation');
 titles.append(heading,hint);header.append(titles);
 const retry=make('button','重新加载中文导读','pm-retry');retry.type='button';retry.onclick=()=>PaperLanguageText.retry();header.append(retry);
 const body=make('div',undefined,'pm-layout'), plot=make('div'), drawer=make('aside',undefined,'pm-drawer');drawer.tabIndex=-1;drawer.setAttribute('aria-label','所选节点说明');
 body.append(plot,drawer);wrapper.append(style,header,body);container.append(wrapper);

 let m=modelOf(rawModel), hooks=options, branch=-1, child=-1, openAll=false, timer=null, media=null, disposed=false;
 let graphButtons=[], graphPaths=[], nodeRoot=null;
 const stopMedia=()=>{if(timer!==null){clearInterval(timer);timer=null;}if(media){media.pause();media=null;}};
 const announce=(text)=>PaperUI.set(hint,text);
 function mark(){
  nodeRoot?.setAttribute('aria-pressed',String(branch<0));
  for(const [i,b] of graphButtons)b.setAttribute('aria-pressed',String(i===branch));
  for(const [i,p] of graphPaths)p.classList.toggle('pm-line-active',i===branch);
 }
 function select(b,c=-1,focus=false){
  branch=b;child=c;mark();drawDetail();
  if(focus){drawer.focus({preventScroll:true});drawer.scrollIntoView?.({block:'nearest'});}
 }
 function node(label,title,fn,ix,root=false){
  const b=button('',fn,'pm-node'+(root?' pm-root':''));
  applyPalette(b,ix);
  if(label)b.append(ui('span',label,'pm-badge'));
  b.append(ui('span',title,'pm-node-title'));
  return b;
 }
 function drawGraph(){
  label(heading,m.title);
  graphButtons=[];graphPaths=[];
  const visible=m.branches.slice(0,openAll?m.branches.length:8);
  const graph=make('div',undefined,'pm-graph'), left=make('div',undefined,'pm-side'), center=make('div',undefined,'pm-side pm-side-center'), right=make('div',undefined,'pm-side');
  const ns='http://www.w3.org/2000/svg', svg=doc.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 1000 400');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.classList.add('pm-svg');
  nodeRoot=node('核心问题',m.rootTitle,()=>select(-1,-1,true),0,true);
  center.append(nodeRoot);
  const sides=[left,right], sizes=[Math.ceil(visible.length/2),Math.floor(visible.length/2)];
  visible.forEach((b,i)=>{
   const side=i%2, sideIndex=Math.floor(i/2), cy=(sideIndex+.5)*400/Math.max(1,sizes[side]), target=side?720:280;
   const p=doc.createElementNS(ns,'path'), dot=doc.createElementNS(ns,'circle');
   p.setAttribute('d',`M500 200 C${side?598:402} 200 ${side?620:380} ${cy} ${target} ${cy}`);
   p.style.setProperty('--edge',PALETTE[i%PALETTE.length][0]);
   dot.setAttribute('cx',String(target));dot.setAttribute('cy',String(cy));dot.setAttribute('r','4');
   dot.style.setProperty('--edge',PALETTE[i%PALETTE.length][0]);svg.append(p,dot);
   const title=asText(b.original.category,35);
   const action=node(title,b.title,()=>select(i,-1,true),i);graphButtons.push([i,action]);graphPaths.push([i,p]);sides[side].append(action);
  });
  graph.append(svg,left,center,right);
  const more=m.branches.length>8?button(openAll?'收起额外分支':'展开其余 '+(m.branches.length-8)+' 个分支',()=>{
   openAll=!openAll;if(!openAll&&branch>=8){branch=-1;child=-1;}drawGraph();drawDetail();
   plot.querySelector('.pm-graph-more')?.focus();
  },'pm-switch pm-graph-more'):null;
  plot.replaceChildren(graph,...(more?[more]:[]));mark();
  announce(m.branches.length?'先看核心问题；点分支查看图解、子节点和出处。':'当前没有可展示的内容分支。');
 }
 function sources(parent,original){
  const raw=Array.isArray(original.source)?original.source:original.source?[original.source]:[];
  const good=raw.filter(x=>asText(typeof x==='string'?x:x?.location||x?.label,300));
  const href=safeHref(original.href,base);
  if(!good.length&&!href)return;
  const section=make('section',undefined,'pm-section');
  section.append(ui('h4','回到出处'));
  for(const source of good){
   const label=asText(typeof source==='string'?source:source.label,200);
   const loc=asText(typeof source==='string'?'':source.location,350);
   const excerpt=asText(typeof source==='string'?'':source.excerpt,2800);
   const panel=make('div',undefined,'pm-source-line');panel.append(make('p',[label,loc].filter(Boolean).join(' · ')));
   if(typeof hooks.onSource==='function'){
    const actions=make('div',undefined,'pm-actions');
    actions.append(button('查看原文位置',()=>hooks.onSource(original,source)));
    panel.append(actions);
   }
   if(excerpt){
    const detail=make('details',undefined,'pm-excerpt');
    detail.append(ui('summary','展开原文摘录'),make('p',excerpt));panel.append(detail);
   }
   section.append(panel);
  }
  if(href){
   const line=make('div',undefined,'pm-actions'), link=make('a',asText(original.linkLabel,100)||'打开来源链接','pm-switch');
   link.href=href;link.target='_blank';link.rel='noopener noreferrer';link.referrerPolicy='no-referrer';line.append(link);section.append(line);
  }
  parent.append(section);
 }
 function showVideo(parent,v){
  if(!v||typeof v!=='object')return;
  const src=localURL(v.src,base), frames=arr(v.frames).map(x=>({title:asText(typeof x==='string'?x:x?.title,120),text:asText(x?.text,360)})).filter(f=>f.title||f.text).slice(0,12);
  if(!src&&!frames.length)return;
  const details=make('details',undefined,'pm-section');
  const d=Number(v.duration),duration=Number.isFinite(d)?Math.min(90,Math.max(10,Math.round(d))):30;
  const caption=asText(v.caption,500),transcript=asText(v.transcript,3000), title=asText(v.title,160);
  details.append(make('summary',title||(src?'播放方法视频':duration+' 秒方法图解')));
  const zone=make('div');
  details.append(zone);
  if(caption)details.append(make('p',caption,'pm-caption'));
  if(transcript){const notes=make('details',undefined,'pm-section');notes.append(make('summary','阅读逐字说明'),make('p',transcript,'pm-excerpt'));details.append(notes);}
  let built=false;
  details.addEventListener('toggle',()=>{
   if(!details.open){stopMedia();return;}
   if(built){const current=zone.querySelector('video');if(current)media=current;return;}
   built=true;
   if(src){
    const movie=make('video');movie.controls=true;movie.preload='none';movie.playsInline=true;movie.src=src;
    const poster=localURL(v.poster,base);if(poster)movie.poster=poster;
    movie.setAttribute('aria-label',title||'方法视频');media=movie;zone.append(movie);
    movie.addEventListener('error',()=>zone.append(make('p','浏览器未能播放这段视频。可阅读下方说明（如有）。','pm-caption')));
    return;
   }
   const pane=make('div',undefined,'pm-scenes'), stage=make('strong'), lines=make('p'), progress=make('progress'), section=make('div',undefined,'pm-actions');
   progress.max=duration;progress.value=0;progress.setAttribute('aria-label','方法图解进度');
   pane.append(stage,lines,progress,section);
   let tick=0, active=false;
   const play=button('播放图解',()=>{
    if(active){pause();return;}if(tick>=duration)tick=0;active=true;paint();play.textContent='暂停';
    timer=setInterval(()=>{tick=Math.min(duration,tick+.25);paint();if(tick>=duration)pause();},250);
   });
   function pause(){if(timer!==null){clearInterval(timer);timer=null;}active=false;play.textContent=tick>=duration?'重播图解':'播放图解';}
   function paint(){
    const frame=frames[Math.min(frames.length-1,Math.floor(tick/duration*frames.length))];
    stage.textContent=frame.title;lines.textContent=frame.text;progress.value=tick;
   }
   const prev=button('上一步',()=>{pause();tick=Math.max(0,(Math.ceil(tick/duration*frames.length)-1)*duration/frames.length);paint();});
   const next=button('下一步',()=>{pause();tick=Math.min(duration,(Math.floor(tick/duration*frames.length)+1)*duration/frames.length);paint();});
   section.append(play,prev,next);zone.append(make('p','网页分镜图解 · 不是原论文视频','pm-caption'),pane);
   details.addEventListener('toggle',()=>{if(!details.open)pause();});paint();
  });
  parent.append(details);
 }
 function drawDetail(){
  stopMedia();
  const b=m.branches[branch], c=b?.children[child], original=c?.original||b?.original||m.root;
  const title=c?.title||b?.title||m.rootTitle;
  drawer.replaceChildren();
  applyPalette(drawer,b?.ix??0);
  if(b){
   const crumbs=make('nav',undefined,'pm-crumbs');crumbs.setAttribute('aria-label','节点路径');
   crumbs.append(button('核心问题',()=>select(-1,-1,true),'pm-crumb'));
   if(c)crumbs.append(button(b.title,()=>select(branch,-1,true),'pm-crumb'));
   drawer.append(crumbs);
  }
  const category=asText(original.category,45)||(c?'子节点':b?'证据分支':'阅读起点');
  drawer.append(ui('span',category,'pm-badge'),ui('h3',title));
  const summary=asText(original.summary,1300);if(summary)drawer.append(ui('p',summary,'pm-summary'));
  showDiagram(drawer,original.diagram,make,doc);
  if(b&&!c&&b.children.length){
   const children=make('section',undefined,'pm-section');
   children.append(ui('h4','展开这条分支'));
   const nodes=make('div',undefined,'pm-children');
   b.children.forEach((item,i)=>nodes.append(node('',item.title,()=>select(branch,i,true),b.ix)));
   children.append(nodes);drawer.append(children);
  }
  showVideo(drawer,original.video);
  sources(drawer,original);
  if(!b&&m.branches.length){
   const help=ui('p','点一条分支，看作者给出的证据或你要核对的边界。','pm-empty');drawer.append(help);
  }
 }
 const api={
  update(data,newOptions){
   if(disposed)return;
   const b=m.branches[branch],c=b?.children[child];
   m=modelOf(data);if(newOptions)hooks=newOptions;
   branch=b?m.branches.findIndex(x=>x.key===b.key):-1;
   child=c&&branch>=0?m.branches[branch].children.findIndex(x=>x.key===c.key):-1;
   if(branch>=8)openAll=true;
   drawGraph();drawDetail();
  },
  destroy(){if(disposed)return;disposed=true;stopMedia();wrapper.remove();controls.delete(container);}
 };
 controls.set(container,api);drawGraph();drawDetail();return api;
}
window.PaperMindMap=Object.freeze({mount});
})();
