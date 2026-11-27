/* The mind map surface: draws the tree, moves and zooms it, and follows the figure in view. */
(() => {
  'use strict';
  const SVG='http://www.w3.org/2000/svg';
  const HUES=['#3b5bdb','#0b8f6a','#d9820a','#d6455d','#8250c4','#1786b5','#6b7280'];
  const branchColors={background:HUES[0],aim:HUES[1],results:HUES[2],finding:HUES[2],discussion:HUES[3],limits:HUES[4],talk:HUES[5]};
  const el=cls=>{const n=document.createElement('div');n.className=cls;return n};
  function mount(host,actions){
    const view=el('mm-view'),ground=el('mm-ground'),svg=document.createElementNS(SVG,'svg'),layer=el('mm-layer');
    svg.classList.add('mm-links');ground.append(svg,layer);view.append(ground);host.append(view);
    let tree=null,x=0,y=0,zoom=1,size=[0,0],fresh=true,touched=false,now='',queued=0,drag=null,previousFolds=null;
    const all=[];
    function make(n,depth,color,parent){
      Object.assign(n,{depth,color,parent,auto:!!n.fig&&!n.short});
      if(depth===1&&['talk','discussion','limits'].includes(n.key))n.folded=true;
      all.push(n);
      n.el=ReadingMapNode.build(n,{...actions,fold(){n.folded=!n.folded;n.auto=false;touched=true;layout()}});
      layer.append(n.el);
      (n.children||[]).forEach((c,i)=>make(c,depth+1,depth?color:branchColors[c.key]||HUES[i%HUES.length],n));
    }
    function layout(){
      if(!tree||!view.clientWidth)return;
      const shown=new Set(ReadingMapLayout.visible(tree));
      for(const n of all){
        n.el.hidden=!shown.has(n);n.el.classList.toggle('mm-folded',!!n.folded);
        n.el.querySelector('.mm-dot')?.setAttribute('aria-expanded',String(!n.folded));
      }
      for(const n of shown){
        if(n.fillLabel){n.fillLabel();n.fillLabel=null}
        n.w=n.el.offsetWidth;n.h=n.el.offsetHeight;
      }
      const [w,h]=ReadingMapLayout.arrange(tree);size=[w+40,h+20];
      svg.setAttribute('width',size[0]);svg.setAttribute('height',size[1]);svg.replaceChildren();
      for(const n of shown){
        n.el.style.transform='translate('+n.x+'px,'+(n.y-n.h/2)+'px)';
        if(!n.parent)continue;
        const p=document.createElementNS(SVG,'path');
        p.setAttribute('d',ReadingMapLayout.link(n));p.setAttribute('stroke',n.color);svg.append(p);
      }
      if(!touched){fresh=false;fit(false)}else move();
    }
    function move(){ground.style.transform='translate('+x+'px,'+y+'px) scale('+zoom+')'}
    function fit(all){
      const W=view.clientWidth,H=view.clientHeight;
      const ratio=Math.min((W-48)/size[0],(H-48)/size[1]);
      zoom=Math.max(all ? .05 : .76,Math.min(all?1.35:1,ratio));
      x=size[0]*zoom<W?(W-size[0]*zoom)/2:24;
      y=H/2-tree.y*zoom;if(size[1]*zoom<H)y=(H-size[1]*zoom)/2;move();
    }
    function scale(f,cx=view.clientWidth/2,cy=view.clientHeight/2){
      const z=Math.min(1.8,Math.max(.3,zoom*f));
      x=cx-(cx-x)*z/zoom;y=cy-(cy-y)*z/zoom;zoom=z;move();
    }
    // Bring the node of the current figure into view.
    function reveal(){
      const n=all.find(n=>n.fig===now&&!n.short&&!n.el.hidden);if(!n||!view.clientWidth)return;
      const left=n.x*zoom+x,top=n.y*zoom+y,W=view.clientWidth,H=view.clientHeight;
      const right=Math.max(n.x+n.w,...(n.folded?[]:n.children||[]).map(c=>c.x+c.w))*zoom+x;
      if(right>W-20)x-=Math.min(right-W+20,left-20);else if(left<20)x+=20-left;
      if(top<60||top>H-60)y=H/2-n.y*zoom;
      view.classList.add('mm-glide');move();setTimeout(()=>view.classList.remove('mm-glide'),420);
    }
    function mark(id){
      now=id;
      for(const n of all){
        const here=!!id&&n.fig===id&&!n.short;n.el.classList.toggle('mm-on',here);
        // One figure open at a time, the one beside the map. A branch folded or opened by hand is left alone.
        if(n.auto&&n.fig&&n.children?.length)n.folded=!here;
      }
      if(!tree)return;
      if(fresh){later();return}
      layout();reveal();
    }
    view.addEventListener('pointerdown',e=>{
      if(e.button!==0||e.target.closest('.mm-node'))return;
      touched=true;drag={id:e.pointerId,x:e.clientX-x,y:e.clientY-y};view.setPointerCapture(e.pointerId);view.classList.add('mm-grab');
    });
    view.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){x=e.clientX-drag.x;y=e.clientY-drag.y;move()}});
    for(const k of ['pointerup','pointercancel'])view.addEventListener(k,()=>{drag=null;view.classList.remove('mm-grab')});
    view.addEventListener('wheel',e=>{
      e.preventDefault();touched=true;
      if(e.ctrlKey||e.metaKey){const r=view.getBoundingClientRect();scale(Math.exp(-e.deltaY*.0022),e.clientX-r.left,e.clientY-r.top)}
      else{x-=e.shiftKey?e.deltaY:e.deltaX;y-=e.shiftKey?0:e.deltaY;move()}
    },{passive:false});
    // Translations arrive after the first layout and change widths.
    const later=()=>{cancelAnimationFrame(queued);queued=requestAnimationFrame(layout)};
    const sizes=new ResizeObserver(later);
    function current(){
      const n=all.find(node=>node.fig===now&&!node.short);
      if(!n)return;
      for(let p=n;p;p=p.parent)p.folded=false;
      touched=true;layout();
      const nodes=[n,...(n.children||[])],right=Math.max(...nodes.map(c=>c.x+c.w));
      const top=Math.min(...nodes.map(c=>c.y-c.h/2)),bottom=Math.max(...nodes.map(c=>c.y+c.h/2));
      const w=right-n.x,h=bottom-top,W=view.clientWidth,H=view.clientHeight;
      zoom=Math.max(.3,Math.min(1.3,(W-56)/w,(H-64)/h));
      x=(W-w*zoom)/2-n.x*zoom;y=(H-h*zoom)/2-top*zoom;move();
    }
    return {
      fit(){if(!tree)return;touched=true;layout();fit(true)},current,zoom(f){touched=true;scale(f)},layout:later,mark,
      expandAll(on){
        if(!tree||on===!!previousFolds)return;
        if(on){
          previousFolds=all.map(n=>[n,n.folded,n.auto]);
          for(const n of all){n.folded=false;n.auto=false}
        }else{
          for(const [n,folded,auto] of previousFolds){n.folded=auto&&n.children?.length?n.fig!==now:folded;n.auto=auto}
          previousFolds=null;
        }
        touched=true;layout();fit(true);
      },
      set(next){
        sizes.disconnect();sizes.observe(view);all.length=0;layer.replaceChildren();tree=next;fresh=true;touched=false;previousFolds=null;
        make(tree,0,'#171a21',null);for(const n of all)sizes.observe(n.el);
        mark(now);later();
      },
      destroy(){cancelAnimationFrame(queued);sizes.disconnect();view.remove()}
    };
  }
  window.ReadingMapView=Object.freeze({mount});
})();
