(() => {
  const selector='.ea-node,.ea-leaf,.frw-steps button,.marker-choices button,.pd-add-slide';
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