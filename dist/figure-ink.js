/* Recover artwork from the visible ink between a printed caption and nearby prose.
   A single low-resolution rendering serves all captions on a page. */
(() => {
  'use strict';
  const width=b=>b.x1-b.x0,height=b=>b.y1-b.y0;
  const area=b=>width(b)*height(b);
  const overlap=(a,b)=>Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0))*Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));
  function pageReader(page,view,lines,captions,objects,annotationMode){
    const W=view.width,H=view.height,scale=Math.min(1.15,800/W,1050/H);
    const prose=lines.filter(l=>l.text.length>=36&&(l.text.match(/[\p{L}]{2,}/gu)||[]).length>=5);
    const paragraphs=prose.filter(l=>prose.some(t=>l!==t&&l.font===t.font&&Math.abs(t.x0-l.x0)<l.size*1.4&&
      Math.abs(l.base-t.base)>.6*l.size&&Math.abs(l.base-t.base)<l.size*1.85));
    let rendered;
    async function pixels(){
      const v=page.getViewport({scale}),c=document.createElement('canvas');
      c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);
      try{
        const ctx=c.getContext('2d',{willReadFrequently:true});
        await page.render({canvas:c,canvasContext:ctx,viewport:v,annotationMode,background:'#fff'}).promise;
        const rgba=ctx.getImageData(0,0,c.width,c.height).data,ink=new Uint8Array(c.width*c.height);
        for(let i=0;i<ink.length;i++)ink[i]=Math.min(rgba[4*i],rgba[4*i+1],rgba[4*i+2])<209;
        const graphics=ink.slice();
        for(const l of lines){
          const x0=Math.max(0,Math.floor(l.x0*scale)-1),x1=Math.min(c.width,Math.ceil(l.x1*scale)+1);
          const top=Math.max(0,Math.floor(l.y0*scale)-1),bottom=Math.min(c.height,Math.ceil(l.y1*scale)+1);
          for(let y=top;y<bottom;y++)graphics.fill(0,y*c.width+x0,y*c.width+x1);
        }
        return {ink,graphics,stride:c.width};
      }finally{c.width=c.height=0}
    }
    async function band(left,right,upper,lower,fromTop,insideGap=20){
      if(lower-upper<30||right-left<75)return null;
      const {ink,graphics,stride}=await(rendered||=pixels());
      const x0=Math.ceil(left*scale),x1=Math.floor(right*scale),yt=Math.ceil(upper*scale),yb=Math.floor(lower*scale);
      let top=yb,bottom=yt,min=x1,max=x0,blank=0,graphicRows=0,graphicInk=0;
      for(let step=0;step<=yb-yt;step++){
        const y=fromTop?yt+step:yb-step;
        let first=x1,last=x0,count=0,evidence=0;
        for(let x=x0;x<x1;x++){
          if(!ink[y*stride+x])continue;
          first=Math.min(first,x);last=x;count++;evidence+=graphics[y*stride+x];
        }
        if(count<2){if(++blank>(bottom<top?25:insideGap)*scale)break;continue}
        blank=0;min=Math.min(min,first);max=Math.max(max,last);top=Math.min(top,y);bottom=Math.max(bottom,y);
        if(evidence>=3){graphicRows++;graphicInk+=evidence}
      }
      if(graphicRows<14*scale||graphicInk<120*scale*scale||max-min<W*.105*scale||bottom-top<H*.055*scale)return null;
      return {x0:Math.max(left,min/scale-4),x1:Math.min(right,(max+1)/scale+4),y0:Math.max(upper,top/scale-4),y1:Math.min(lower,(bottom+1)/scale+4)};
    }
    return async(cap,old)=>{
      const c=cap.line,leftEdge=W*.032,rightEdge=W*.967,top=H*.052;
      // PDF writers sometimes divide a single illustration into a rectangular mosaic.
      // Edge-to-edge tiles and a filled rectangle distinguish it from separate figures.
      const tiles=objects.filter(b=>b.kind==='image'&&!b.placedForm&&width(b)>10&&height(b)>8&&b.y1<=c.y0+1&&b.y0>=0);
      if(!old&&tiles.length>=3){
        const seed=tiles.find(b=>c.y0-b.y1<13&&b.x1>c.x0&&b.x0<c.x1);
        if(seed){
          const group=new Set([seed]);
          for(const a of group)for(const b of tiles){
            const abutsX=Math.min(Math.abs(a.x1-b.x0),Math.abs(a.x0-b.x1))<1.2;
            const abutsY=Math.min(Math.abs(a.y1-b.y0),Math.abs(a.y0-b.y1))<1.2;
            if(abutsX&&Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0)>7||abutsY&&Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)>7)group.add(b);
          }
          const pieces=[...group],mosaic={x0:Math.min(...pieces.map(b=>b.x0)),y0:Math.min(...pieces.map(b=>b.y0)),x1:Math.max(...pieces.map(b=>b.x1)),y1:Math.max(...pieces.map(b=>b.y1))};
          const fill=pieces.reduce((sum,b)=>sum+area(b),0)/area(mosaic);
          if(group.size>=3&&fill>.98&&fill<1.02&&width(mosaic)>.2*W&&height(mosaic)>.08*H)
            return {x0:Math.max(0,mosaic.x0-3),y0:Math.max(0,mosaic.y0-3),x1:Math.min(W,mosaic.x1+3),y1:Math.min(c.y0-1,mosaic.y1+3)};
        }
      }
      // A photograph may be stored as a stack of abutting horizontal strips.
      // Keep the entire placed image even when its content has large white gaps.
      const images=objects.filter(o=>o.kind==='image'&&!o.placedForm&&width(o)>W*.13&&height(o)>8&&
        o.y0>=0&&o.y1<=c.y0+2&&o.x0>=-1&&o.x1<=W+1);
      const touching=images.filter(b=>c.y0-b.y1<=23&&Math.min(c.x1,b.x1)-Math.max(c.x0,b.x0)>=Math.min(width(c),width(b))*.46);
      if(touching.length===1){
        const image={...touching[0]};
        for(const piece of images.slice().sort((a,b)=>b.y1-a.y1)){
          if(Math.abs(piece.x0-image.x0)<6&&Math.abs(piece.x1-image.x1)<6&&piece.y0<image.y0&&image.y0-piece.y1>=-2&&image.y0-piece.y1<15&&
            !captions.some(k=>k!==cap&&k.line.y0>=piece.y1-1&&k.line.y0<image.y0))image.y0=piece.y0;
        }
        const frame=objects.find(b=>b.kind==='vec'&&Math.abs(b.x0-c.x0)<4&&Math.abs(b.x1-c.x1)<4&&
          b.y0<=image.y0&&image.y0-b.y0<22&&b.y1>=image.y1&&c.y0-b.y1>=-1&&c.y0-b.y1<8&&overlap(b,image)>.98*area(image));
        if(frame)return {x0:Math.max(0,frame.x0-2),x1:Math.min(W,frame.x1+2),y0:Math.max(0,frame.y0-2),y1:Math.min(c.y0-1,frame.y1+2)};
        if(old&&overlap(old,image)>.96*area(image)){
          const labelRow=lines.filter(l=>l.y0>=old.y0-3&&l.y1<image.y0-3&&l.x0>=old.x0-3&&l.x1<=old.x1+3&&/^\(?[a-z]\)?[.:]?$/i.test(l.text.trim()));
          if(labelRow.some(a=>labelRow.some(b=>b!==a&&b.text!==a.text&&Math.abs(a.y0-b.y0)<5&&Math.abs(a.x0-b.x0)>20)))return null;
          if(area(old)<1.95*area(image)&&old.y0>image.y0-Math.max(24,height(image)*.22))return null;
        }
        const ownHeading=captions.some(k=>k!==cap&&k.anchor.endY<=image.y0+2&&image.y0-k.anchor.endY<15&&
          Math.min(k.line.x1,image.x1)-Math.max(k.line.x0,image.x0)>width(image)*.30);
        const outside=lines.filter(l=>l.y0>image.y0-5&&l.y1<image.y1+4&&(l.x1<image.x0-4||l.x0>image.x1+4)&&
          !paragraphs.includes(l)&&/\p{L}/u.test(l.text)&&l.text.length<38&&(!old||l.x1>old.x0&&l.x0<old.x1));
        if(!ownHeading&&height(image)>H*.075&&width(image)>W*.18&&outside.length<3&&
            !images.some(b=>b!==touching[0]&&Math.min(b.y1,image.y1)-Math.max(b.y0,image.y0)>Math.min(height(b),height(image))*.45&&(b.x0>=image.x1-2||b.x1<=image.x0+2)&&
              !captions.some(k=>k!==cap&&Math.abs(k.line.y0-b.y1)<32&&k.line.x1>b.x0&&k.line.x0<b.x1))){
          return {x0:Math.max(0,image.x0-5),x1:Math.min(W,image.x1+5),y0:Math.max(0,image.y0-5),y1:Math.min(c.y0-1,image.y1+6)};
        }
      }
      // A caption beside the illustration starts near its upper edge and spans multiple lines.
      if(!old&&c.x0>W*.49&&c.y0<H*.32&&cap.anchor.endY-c.y0>c.size*2.5){
        const left=leftEdge,right=c.x0-6,begin=Math.max(top,c.y0-6);
        const below=paragraphs.filter(l=>l.y0>begin+12&&l.x0<right-15&&l.x1>left+15);
        const end=Math.min(H*.92,...below.map(l=>l.y0-2),...captions.filter(k=>k!==cap&&k.line.y0>begin&&k.line.x0<right).map(k=>k.line.y0-2));
        const side=await band(left,right,begin,end,true);
        if(side&&side.x1>right-W*.12&&side.y0<c.y0+16&&height(side)>H*.10)return side;
      }
      if(c.y0-top<H*.065)return null;
      let left=leftEdge,right=rightEdge;
      const beside=paragraphs.filter(l=>l.y0<c.y0&&l.y1>c.y0-H*.17);
      if(c.x0>=W*.48&&beside.some(l=>l.x1<c.x0+2))left=Math.max(left,c.x0-12);
      else if(c.x0<W*.19&&c.x1<W*.56&&beside.some(l=>l.x0>W*.48&&l.x0>c.x1)){
        right=Math.min(right,...beside.filter(l=>l.x0>W*.48&&l.x0>c.x1).map(l=>l.x0-5));
      }
      const intersects=l=>l.x1>left+6&&l.x0<right-6;
      const ceiling=Math.max(top,...paragraphs.filter(l=>l.y1<=c.y0&&intersects(l)).map(l=>l.y1+1),
        ...captions.filter(k=>k!==cap&&k.line.y0<c.y0&&intersects(k.line)).map(k=>k.anchor.endY+1));
      const box=await band(left,right,ceiling,c.y0-2,false,old?20:Math.min(44,H*.055));
      if(!box||!intersects(c)||Math.min(c.x1,box.x1)-Math.max(c.x0,box.x0)<Math.min(width(c),width(box))*.28)return null;
      if(!old)return box;
      const shared=overlap(old,box);
      // A blank gap between plot rows must not shorten a detected plate.
      if(width(box)>.84*width(old)&&height(box)<.82*height(old)&&box.y0>old.y0)return null;
      return shared<.78*area(box)||shared<.46*area(old)?box:null;
    };
  }
  window.FigureInk=Object.freeze({pageReader});
})();
