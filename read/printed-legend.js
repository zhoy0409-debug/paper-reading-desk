(() => {
  'use strict';
  // Look for a compact ink component alongside a printed name. Require a second
  // aligned sample to distinguish a legend from coloured data beside annotations.
  function samples(words,canvas,axis=''){
    const W=canvas.width,H=canvas.height;
    if(W<20||H<20||W*H>4e6)return [];
    const pixels=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
    const candidates=[];
    for(const word of words.slice(0,180)){
      const name=word.text.trim(),h=(word.y1-word.y0)*H;
      if(word.rotate||h<3||h>H*.13||name.length>75||!/[\p{L}]/u.test(name))continue;
      const top=Math.max(0,Math.floor(word.y0*H-h*.18)),bottom=Math.min(H,Math.ceil(word.y1*H+h*.18));
      const right=Math.max(0,Math.min(W,Math.floor(word.x0*W-h*.08))),left=Math.max(0,Math.floor(right-h*4.7));
      const w=right-left,rows=bottom-top;
      if(w<4||rows<3||w*rows>150000)continue;
      const ink=new Uint8Array(w*rows);
      for(let y=0;y<rows;y++)for(let x=0;x<w;x++){
        const i=((top+y)*W+left+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
        const hi=Math.max(r,g,b),lo=Math.min(r,g,b);
        // Chromatic ink or a dark monochrome swatch. Keep its colour identity
        // while walking adjacent pixels, even over a different coloured curve.
        if(hi-lo>45&&lo<175)ink[y*w+x]=1+(r>lo+(hi-lo)*.58?4:0)+(g>lo+(hi-lo)*.58?2:0)+(b>lo+(hi-lo)*.58?1:0);
        else if(hi<120)ink[y*w+x]=9;
      }
      let best;
      for(let start=0;start<ink.length;start++){
        const paint=ink[start];if(!paint)continue;
        const todo=[start];ink[start]=0;
        let l=w,r=-1,t=rows,b=-1,count=0,colour=[0,0,0],darkest=Infinity;
        while(todo.length){
          const j=todo.pop(),x=j%w,y=(j-x)/w,idx=((top+y)*W+left+x)*4;
          count++;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
          const sum=pixels[idx]+pixels[idx+1]+pixels[idx+2];
          if(sum<darkest){darkest=sum;colour=[pixels[idx],pixels[idx+1],pixels[idx+2]]}
          const adjacent=[];
          if(x)adjacent.push(j-1);if(x<w-1)adjacent.push(j+1);if(y)adjacent.push(j-w);if(y<rows-1)adjacent.push(j+w);
          for(const k of adjacent)if(ink[k]===paint){ink[k]=0;todo.push(k)}
        }
        const sw=r-l+1,sh=b-t+1,gap=word.x0*W-(left+r+1),mid=top+(t+b+1)/2;
        if(l===0||gap>h*1.6||sw<h*.52||sh>h*1.24||Math.abs(mid-(word.y0+word.y1)*H/2)>h*.39||
           count<Math.max(3,sw*.65)||paint===9&&(sw<h*1.35&&count/(sw*sh)<.74))continue;
        const rank=gap+Math.abs(mid-(word.y0+word.y1)*H/2);
        if(!best||rank<best.rank)best={rank,word,h,name,sw,mid,solidBox:count/(sw*sh)>.9&&Math.abs(sw/sh-1)<.22,left:left+l,right:left+r+1,top:top+t,bottom:top+b+1,
          color:'#'+colour.map(v=>v.toString(16).padStart(2,'0')).join('')};
      }
      if(best)candidates.push(best);
    }
    const marks=[];
    for(const a of candidates){
      const peer=candidates.some(b=>b!==a&&b.name!==a.name&&a.h/b.h>.64&&a.h/b.h<1.55&&
        (Math.abs(a.left-b.left)<a.h*.65&&Math.abs(a.mid-b.mid)<a.h*7||
         Math.abs(a.mid-b.mid)<a.h*.4&&b.left!==a.left&&Math.abs(a.sw-b.sw)<a.h*.5)&&
        (a.color!==b.color||Math.abs(a.sw-b.sw)<a.h*.3));
      if(!peer)continue;
      const line=a.sw>2.6*(a.bottom-a.top);
      const chart={name:a.name,color:a.color,swatch:true,line,solidBox:a.solidBox,context:{axes:axis?[axis]:[],yName:axis,caption:''}};
      marks.push({...a.word,chart:{...chart,kind:'legend'}},{text:a.name,x0:a.left/W,y0:a.top/H,x1:a.right/W,y1:a.bottom/H,chart:{...chart,kind:'symbol'}});
    }
    return marks;
  }
  // An outlined rectangle can be joined to its label by OCR. Find printed
  // pairs of swatches first so the adjacent word can be read in isolation.
  function outlinedKeys(canvas){
    const W=canvas.width,H=canvas.height;
    const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
    const dark=(x,y)=>{const i=4*(y*W+x);return Math.max(data[i],data[i+1],data[i+2])<110};
    const minW=Math.max(8,W*.011),maxW=Math.min(W*.18,H*.19),byLeft=new Map(),boxes=[];
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;){
      if(!dark(x,y)){x++;continue}
      const l=x++;while(x<W-1&&dark(x,y))x++;
      const w=x-l;
      if(w<minW||w>maxW)continue;
      const bucket=Math.round(l/3);
      for(const k of [bucket-1,bucket,bucket+1]){
        for(const line of byLeft.get(k)||[]){
          const h=y-line.y;
          if(h<Math.max(6,w*.27)||h>w*1.32||Math.abs(line.r-x)>3||Math.abs(line.l-l)>3)continue;
          let walls=0;
          for(let yy=line.y+1;yy<y;yy++){
            if([0,1,2].some(d=>dark(l+d,yy))&&[1,2,3].some(d=>dark(x-d,yy)))walls++;
          }
          if(walls<(h-1)*.82)continue;
          if(boxes.some(b=>Math.abs(b.l-l)<3&&Math.abs(b.t-line.y)<4))continue;
          const m=4*((line.y+Math.floor(h/2))*W+l+Math.floor(w/2)),rgb=[...data.slice(m,m+3)];
          if(Math.max(...rgb)<120)continue;
          boxes.push({l,r:x,t:line.y,b:y+1,w,h,open:Math.min(...rgb)>215,color:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('')});
        }
      }
      const current=(byLeft.get(bucket)||[]).filter(e=>y-e.y<maxW*1.33);
      current.push({l,r:x,y});byLeft.set(bucket,current);
    }
    const peers=boxes.filter(a=>boxes.some(b=>a!==b&&Math.abs(a.l-b.l)<a.w*.18&&Math.abs(a.w-b.w)<a.w*.24&&Math.abs(a.h-b.h)<a.h*.25&&
      Math.abs(a.t-b.t)>a.h*.85&&Math.abs(a.t-b.t)<a.h*3.6&&a.color!==b.color));
    return peers.sort((a,b)=>a.t-b.t).slice(0,24);
  }
  window.PrintedLegend={samples,outlinedKeys};
})();
