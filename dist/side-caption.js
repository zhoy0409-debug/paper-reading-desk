/* Locate a figure printed beside its caption. Used only when nothing was found above the caption.
   Any competing text, caption or graphic leaves the figure on its original page. */
(() => {
  'use strict';
  const w=b=>b.x1-b.x0,h=b=>b.y1-b.y0;
  const overlap=(a0,a1,b0,b1)=>Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));
  const gap=(a0,a1,b0,b1)=>Math.max(0,b0-a1,a0-b1);
  const unite=(a,b)=>({x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)});

  function captionBlock(cap,lines){
    const c=cap.line,key=s=>s.replace(/\s+/g,''),whole=key(cap.caption);
    const own=lines.filter(l=>l===c||l.y0>=c.y0-1&&l.y1<=cap.anchor.endY+1&&l.x0>=c.x0-2&&
      key(l.text).length>3&&whole.includes(key(l.text)));
    return {box:own.reduce(unite),own:new Set(own)};
  }

  function locate(cap,captions,lines,objects,view,vertical=[]){
    const W=view.width,H=view.height,{box:block,own}=captionBlock(cap,lines);
    if(w(block)>W*.6||h(block)<cap.line.size*2)return null;
    const others=captions.filter(x=>x!==cap).map(x=>captionBlock(x,lines));
    const foreign=new Set(others.flatMap(o=>[...o.own]));
    const results=[];
    for(const side of ['left','right']){
      const lane=side==='left'?{x0:W*.03,x1:block.x0-2}:{x0:block.x1+2,x1:W*.97};
      if(w(lane)<W*.13)continue;
      const inLane=b=>b.x0>=lane.x0-2&&b.x1<=lane.x1+2;
      // Prose and other captions close the band above and below the caption.
      let top=H*.045,bottom=H*.955;
      const mid=(block.y0+block.y1)/2;
      for(const l of lines){
        if(own.has(l)||overlap(l.x0,l.x1,lane.x0,lane.x1)<3)continue;
        const prose=foreign.has(l)||l.text.length>42&&w(l)>w(lane)*.6||l.x0<lane.x1-8&&l.x1>lane.x1+8||l.x0<lane.x0&&l.x1>lane.x0+8;
        if(!prose)continue;
        if(l.y1<=mid)top=Math.max(top,l.y1);else if(l.y0>=mid)bottom=Math.min(bottom,l.y0);else{top=bottom;break}
      }
      if(bottom-top<H*.05)continue;
      const inBand=b=>inLane(b)&&b.y0>=top-1&&b.y1<=bottom+1;
      const marks=objects.filter(o=>inBand(o)&&!(h(o)<3&&w(o)>w(lane)*.9));
      const groups=[];
      for(const m of marks){
        let grown={box:{...m},items:[m]};
        for(let i=groups.length-1;i>=0;i--){
          const g=groups[i];
          if(gap(g.box.x0,g.box.x1,grown.box.x0,grown.box.x1)<=Math.min(34,W*.06)&&gap(g.box.y0,g.box.y1,grown.box.y0,grown.box.y1)<=20){
            grown={box:unite(grown.box,g.box),items:[...grown.items,...g.items]};groups.splice(i,1);i=groups.length;
          }
        }
        groups.push(grown);
      }
      const solid=groups.filter(g=>w(g.box)>=W*.1&&h(g.box)>=H*.045&&
        overlap(g.box.y0,g.box.y1,block.y0,block.y1)>=Math.min(h(g.box),h(block))*.5&&
        (g.items.some(o=>o.kind==='image'&&w(o)*h(o)>W*H*.002)||g.items.filter(o=>w(o)>4||h(o)>4).length>=5));
      if(!solid.length)continue;
      if(solid.length>1){results.push(null);continue}
      let box=solid[0].box;
      const spacing=side==='left'?block.x0-box.x1:box.x0-block.x1;
      if(spacing>W*.12)continue;
      // Another drawing in the band that is not part of the group would make the crop partial.
      if(groups.some(g=>g!==solid[0]&&w(g.box)>W*.06&&h(g.box)>H*.03)){results.push(null);continue}
      // Printed titles, ticks and axis names within a short reach belong to the figure.
      const labels=[...lines.filter(l=>!own.has(l)&&!foreign.has(l)&&l.text.length<=44),...vertical].filter(inBand);
      for(let pass=0;pass<4;pass++){
        const before=JSON.stringify(box);
        for(const l of labels)if(gap(l.x0,l.x1,box.x0,box.x1)<=12&&gap(l.y0,l.y1,box.y0,box.y1)<=12)box=unite(box,l);
        if(JSON.stringify(box)===before)break;
      }
      const edge=side==='left'?{x0:Math.max(0,box.x0-8),x1:Math.min(block.x0-3,box.x1+8)}:{x0:Math.max(block.x1+3,box.x0-8),x1:Math.min(W,box.x1+8)};
      results.push({...edge,y0:Math.max(top,box.y0-6),y1:Math.min(bottom,box.y1+6)});
    }
    return results.length===1?results[0]:null;
  }

  // Panel letters are read only inside the located crop.
  function panels(cap,crop,words,lines,view,axes){
    const inside=b=>b.x0>=crop.x0-1&&b.x1<=crop.x1+1&&b.y0>=crop.y0-1&&b.y1<=crop.y1+1;
    const found=globalThis.PaperPanelGeometry?.detect({...cap,line:{...cap.line,x0:crop.x0,x1:crop.x1,y0:crop.y1+2}},[],
      words.filter(inside),lines.filter(inside),view,crop,axes.filter(inside));
    if(!found)return null;
    const clip=r=>({x0:Math.max(crop.x0,r.x0),y0:Math.max(crop.y0,r.y0),x1:Math.min(crop.x1,r.x1),y1:Math.min(crop.y1,r.y1)});
    const list=found.panels.map(p=>({...p,rect:clip(p.rect)}));
    // The final column and row run to the edge of the figure.
    const last=list.at(-1);
    if(last&&list.every(p=>p===last||p.rect.x1<=last.rect.x0+2))last.rect.x1=crop.x1;
    return list.every(p=>w(p.rect)>10&&h(p.rect)>10)?{crop,panels:list}:null;
  }
  const api=Object.freeze({locate,panels});
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.SideCaption=api;
})();
