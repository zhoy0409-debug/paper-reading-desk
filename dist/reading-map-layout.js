/* Geometry of the mind map: a tidy left-to-right tree from measured boxes. */
(() => {
  'use strict';
  const GAP_X=46,GAP_Y=7;
  const kids=n=>n.folded?[]:n.children||[];
  const gap=n=>GAP_Y+(n.depth===0?22:n.depth===1?5:0);
  function visible(tree){const out=[];(function walk(n){out.push(n);kids(n).forEach(walk)})(tree);return out}
  // Each node needs w, h and depth. Sets x, y (vertical centre) and returns the size of the whole tree.
  function arrange(tree){
    let width=0;
    const tall=n=>{
      const k=kids(n),sum=k.reduce((s,c)=>s+tall(c),0)+gap(n)*Math.max(0,k.length-1);
      n.span=sum;n.tall=Math.max(n.h,sum);return n.tall;
    };
    tall(tree);
    (function place(n,left,top){
      n.x=left;n.y=top+n.tall/2;width=Math.max(width,left+n.w);
      let at=top+(n.tall-n.span)/2;
      for(const c of kids(n)){place(c,left+n.w+GAP_X,at);at+=c.tall+gap(n)}
    })(tree,0,0);
    return [width,tree.tall];
  }
  function link(n){
    const p=n.parent,a=p.x+p.w+(p.root?0:8),b=n.x,m=(a+b)/2;
    return 'M'+a+' '+p.y+' C'+m+' '+p.y+' '+m+' '+n.y+' '+b+' '+n.y;
  }
  const api={visible,arrange,link};
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.ReadingMapLayout=Object.freeze(api);
})();
