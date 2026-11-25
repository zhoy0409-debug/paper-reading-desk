/* Full-screen rehearsal of the deck: the slide alone, a clock, notes on request. */
(() => {
  'use strict';
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
  const clock=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  function button(zh,en,fn){const b=PaperUI.set(el('button'),zh,en);b.type='button';b.addEventListener('click',fn);return b}
  function start({host,slides,paint,from=0}){
    if(!slides.length)return;
    const d=el('dialog','lens-rehearse dk-talk');d.setAttribute('aria-label','试讲 / Rehearsal');
    let i=Math.max(0,Math.min(from,slides.length-1)),shown=false;
    const begun=performance.now(),spent=slides.map(()=>0);let since=begun;
    const top=el('header'),count=el('span'),here=el('span'),time=el('time','','0:00');
    const stage=el('div','lens-stage'),foot=el('footer'),notes=el('p');notes.setAttribute('aria-live','polite');
    const prev=button('← 上一页','← Previous',()=>go(-1)),next=button('下一页 →','Next →',()=>go(1));
    const peek=button('看备注','Show notes',()=>{shown=!shown;draw(false)});
    top.append(count,here,time,button('结束试讲','End',()=>d.close()));
    foot.append(notes,prev,peek,next);d.append(top,stage,foot);
    function draw(repaint=true){
      const s=slides[i];
      count.textContent=(i+1)+' / '+slides.length;prev.disabled=i===0;next.disabled=i===slides.length-1;
      if(shown&&s.say.trim())notes.textContent=s.say;
      else PaperUI.set(notes,shown?'这一页还没有备注':'看着画面，用自己的话讲',shown?'No notes on this slide':'Explain the slide in your own words');
      notes.classList.toggle('lens-shown',shown&&!!s.say.trim());
      PaperUI.set(peek,shown?'盖住备注':'看备注',shown?'Cover notes':'Show notes');
      if(repaint)stage.replaceChildren(paint(s));
    }
    function go(n){
      if(!slides[i+n])return;
      const now=performance.now();spent[i]+=now-since;since=now;i+=n;shown=false;draw();
    }
    d.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'||e.key==='PageDown')go(1);
      else if(e.key==='ArrowLeft'||e.key==='PageUp')go(-1);
      else if(e.key===' '&&!e.target.closest('button')){shown=!shown;draw(false)}else return;
      e.preventDefault();
    });
    const tick=setInterval(()=>{
      const now=performance.now();time.textContent=clock((now-begun)/1000);
      PaperUI.set(here,'本页 '+clock((spent[i]+now-since)/1000),'This slide '+clock((spent[i]+now-since)/1000));
    },500);
    d.addEventListener('close',()=>{clearInterval(tick);d.remove()});
    stage.tabIndex=-1;host.append(d);draw();d.showModal();stage.focus();
  }
  window.ReadingDeckTalk=Object.freeze({start,clock});
})();
