(() => {
  const selector='.frw-steps button,.marker-choices button,.pd-add-slide,.primary,.rq-add-slide,.st-back,.st-help,.st-menu,.mm-ai,.mm-fig,.mm-thumb,.th-panel,.dk-add>button,.lens-verdict,.ct-more,.gd-foot button,.pl-drop-main,.frw-panel-tab';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const target=e=>!reduced.matches&&e.target.closest?.(selector);
  // Solve a damped spring for a unit-mass button. Scale is independent of layout.
  const k=260,d=12,omega=Math.sqrt(k-d*d/4);
  const spring=Array.from({length:24},(_,i)=>{
    const t=i*.023;
    return {scale:String(1-.06*Math.exp(-d*t/2)*(Math.cos(omega*t)+d/(2*omega)*Math.sin(omega*t)))};
  });
  spring[spring.length-1]={scale:'1'};
  let down;
  function release(){
    if(!down)return;
    if(down.isConnected&&!reduced.matches)down.animate(spring,{duration:529,easing:'linear'});
    down.removeAttribute('data-reading-down');down=null;
  }
  document.addEventListener('pointerdown',e=>{
    const b=target(e);if(!b||b.disabled||e.button!==0)return;
    release();down=b;b.dataset.readingDown='true';
  });
  window.addEventListener('pointerup',release,true);window.addEventListener('pointercancel',release,true);window.addEventListener('blur',release);
  document.addEventListener('click',e=>{
    const b=target(e);if(!b||b.disabled||!b.isConnected)return;
    if(e.detail===0)b.animate(spring,{duration:529});
    if(!b.matches('.ea-node,.ea-leaf'))return;
    const bounds=b.getBoundingClientRect(),size=Math.min(bounds.height,44);
    const x=e.detail?e.clientX-bounds.left:bounds.width/2,y=e.detail?e.clientY-bounds.top:bounds.height/2;
    // The atlas rebuilds its nodes on selection. Reattach feedback to the new button.
    const selector=b.matches('.ea-node')?'.ea-node':'.ea-leaf',scope=b.closest('.ea-canvas');
    const id=b.dataset.figure||b.dataset.panel||b.textContent;
    requestAnimationFrame(()=>{
      const live=b.isConnected?b:Array.from(scope?.querySelectorAll(selector)||[]).find(n=>(n.dataset.figure||n.dataset.panel||n.textContent)===id);
      if(!live||reduced.matches)return;
      const ripple=document.createElement('i');ripple.className='read-ripple';ripple.setAttribute('aria-hidden','true');
      Object.assign(ripple.style,{left:x-size/2+'px',top:y-size/2+'px',width:size+'px',height:size+'px'});
      live.append(ripple);const anim=ripple.animate([{transform:'scale(.25)',opacity:.28},{transform:'scale(2.4)',opacity:0}],{duration:450,easing:'ease-out'});
      anim.onfinish=anim.oncancel=()=>ripple.remove();
    });
  },true);
  reduced.addEventListener('change',()=>{if(reduced.matches){release();document.querySelectorAll('.read-ripple').forEach(n=>n.remove())}});
})();
/* Ripple at the pointer, elastic switch, verdict feedback and a magnetic main button. */
(() => {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  // Displacement of a damped spring released from 1: frames for WAAPI.
  function spring(k,d,frames=30){
    const w=Math.sqrt(Math.max(1,k-d*d/4)),time=Math.min(1.4,10/d);
    return {time:time*1000,at:Array.from({length:frames+1},(_,i)=>{const t=time*i/frames;return i===frames?0:Math.exp(-d*t/2)*(Math.cos(w*t)+d/(2*w)*Math.sin(w*t))})};
  }
  document.addEventListener('pointerdown',e=>{
    const b=e.target.closest?.('.th-panel,.dk-add>button,.mm-ai,.st-helpmenu button,.ct-more,.rq-paths button,.st-tools .light');
    if(!b||reduced.matches||e.button!==0)return;
    const r=b.getBoundingClientRect(),s=Math.min(Math.max(r.height,40),90),dot=document.createElement('i');
    dot.className='rm-ripple';dot.setAttribute('aria-hidden','true');
    Object.assign(dot.style,{width:s+'px',height:s+'px',left:e.clientX-r.left-s/2+'px',top:e.clientY-r.top-s/2+'px'});
    b.append(dot);
    const a=dot.animate([{transform:'scale(.2)',opacity:.28},{transform:'scale(2.4)',opacity:0}],{duration:450,easing:'ease-out'});
    a.onfinish=a.oncancel=()=>dot.remove();
  });
  document.addEventListener('click',e=>{
    if(reduced.matches)return;
    const toggle=e.target.closest?.('.lens-switch');
    if(toggle){
      const {time,at}=spring(200,14);
      toggle.animate(at.map(v=>({transform:'scaleX('+(1+.35*v)+')'})),{duration:time,pseudoElement:'::after'});
    }
    const verdict=e.target.closest?.('.lens-verdict');
    if(verdict&&verdict.getAttribute('aria-pressed')==='true'){
      const {time,at}=spring(300,10);
      verdict.animate(at.map(v=>({transform:'scale('+(1+.3*v*.35)+')'})),{duration:time,pseudoElement:'::before'});
      if(verdict.dataset.verdict==='hit')for(let i=0;i<8;i++){
        const dot=document.createElement('i'),angle=i*Math.PI/4;dot.className='rm-dot';dot.setAttribute('aria-hidden','true');verdict.append(dot);
        const a=dot.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+Math.cos(angle)*38+'px,'+Math.sin(angle)*26+'px) scale(.3)',opacity:0}],{duration:520,easing:'cubic-bezier(.2,.7,.3,1)'});
        a.onfinish=a.oncancel=()=>dot.remove();
      }
    }
  });
  // Magnetic: within 120px the main button leans 0.35 of the way, then springs home.
  let pulled=null;
  function home(){
    const b=pulled;if(!b)return;pulled=null;
    const m=/translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(b.style.transform);b.style.transform='';
    if(!m)return;
    const {time,at}=spring(150,15);
    b.animate(at.map(v=>({transform:'translate('+m[1]*v+'px,'+m[2]*v+'px)'})),{duration:time});
  }
  document.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'||reduced.matches||document.documentElement.classList.contains('st-loaded')){home();return}
    const b=document.querySelector('.pl-drop-main');if(!b)return;
    const r=b.getBoundingClientRect();
    const m=/translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(b.style.transform),ox=m?+m[1]:0,oy=m?+m[2]:0;
    const cx=r.left-ox+r.width/2,cy=r.top-oy+r.height/2;
    const gap=Math.hypot(Math.max(0,Math.abs(e.clientX-cx)-r.width/2),Math.max(0,Math.abs(e.clientY-cy)-r.height/2));
    if(gap>120){home();return}
    const pull=.35*(1-gap/120),x=Math.max(-16,Math.min(16,(e.clientX-cx)*pull)),y=Math.max(-12,Math.min(12,(e.clientY-cy)*pull));
    pulled=b;b.style.transform='translate('+x.toFixed(1)+'px, '+y.toFixed(1)+'px)';
  },{passive:true});
  document.addEventListener('pointerleave',home);
})();
