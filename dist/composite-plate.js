/* Locate lettered composite plates from the rendered page. PDF text alone misses outlined letters. */
(() => {
  'use strict';
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const legal = /(?:^|[.!?;:]\s+)\(?([A-T])(?:\)|\.)?\s+(?=[A-Z(0-9])/g;
  function series(text) {
    const markers=[...text.matchAll(legal)].map(m=>m[1]);
    // Grouped headings such as B–D or B, C and D describe multiple panels together.
    for(const m of text.matchAll(/(?:^|[.;:]\s+)\(?([A-T])\s*[–—-]\s*([A-T])\)?\s/g)){
      for(let i=alphabet.indexOf(m[1]);i<=alphabet.indexOf(m[2]);i++) markers.push(alphabet[i]);
    }
    return new Set(markers);
  }
  function columnCaption(line,lines,view,read=l=>l.captionText||l.text) {
    const W=view.width;
    if(line.x0>W*.30||line.x1>W*.54||line.x1-line.x0<W*.15)return;
    const beside=lines.filter(l=>Math.abs(l.base-line.base)<line.size*.4&&l.x0>W*.46&&l.x0<W*.63&&Math.abs(l.size-line.size)<.75);
    if(beside.length!==1||/^(?:Fig(?:ure)?\.?|Table)\s*\d/i.test(beside[0].text))return;
    function column(start) {
      const parts=[start];
      for(const l of lines){
        if(l.base<=parts.at(-1).base+1||Math.abs(l.x0-start.x0)>start.size*.71||l.size<start.size*.80)continue;
        if(l.base-parts.at(-1).base>start.size*1.7||Math.abs(l.size-start.size)>.75||/^(?:Fig(?:ure)?\.?|Table)\s*\d+/i.test(l.text))break;
        if(l.x1>start.x0+W*.47||parts.length>=75)break;
        parts.push(l);
      }
      return parts;
    }
    const a=column(line),b=column(beside[0]);
    if(a.length<2||b.length<2)return;
    const text=[...a,...b].map(read).join(' ');
    const letters=series(text);
    const lower=globalThis.CaptionFlow?.headings(text)||[];
    const continuedSeries=lower.length>=3&&lower.some(m=>m.at>=a.map(l=>l.text).join(' ').length);
    // Source-data footers in a parallel caption column also delimit inline
    // panel references such as "(A)" or "A, B" which are not sentence headings.
    const captionFooter=/\bsource data (?:are|is) provided\b[^.]*\.\s*$/i.test(text)&&
      /\(\s*A\s*\)|\bA,\s*B\b/.test(a.map(read).join(' '));
    if((!letters.has('A')||letters.size<2)&&!continuedSeries&&!captionFooter||!/[.!?)][”"]?$/.test(b.at(-1).text))return;
    return {text,endY:Math.max(a.at(-1).y1,b.at(-1).y1)};
  }
  const size=20;
  function mask(pixels,width,x,y,w,h){
    const bits=new Uint8Array(size*size);
    for(let j=0;j<size;j++)for(let i=0;i<size;i++){
      const idx=(y+Math.min(h-1,Math.floor((j+.5)*h/size)))*width+x+Math.min(w-1,Math.floor((i+.5)*w/size));
      bits[j*size+i]=pixels[idx]?1:0;
    }
    return bits;
  }
  let templates;
  function referenceLetters(){
    if(templates)return templates;
    const c=document.createElement('canvas');c.width=64;c.height=64;const ctx=c.getContext('2d',{willReadFrequently:true});
    const result=[];
    for(const family of ['Arial','Calibri','Georgia'])for(const weight of ['bold','normal'])for(const ch of alphabet+alphabet.toLowerCase()){
      ctx.fillStyle='#fff';ctx.fillRect(0,0,64,64);ctx.fillStyle='#000';ctx.font=weight+' 42px '+family;ctx.fillText(ch,6,49);
      const a=ctx.getImageData(0,0,64,64).data;let x0=64,x1=0,y0=64,y1=0;const p=new Uint8Array(4096);
      for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=y*64+x;if(a[i*4]<150){p[i]=1;x0=Math.min(x,x0);x1=Math.max(x,x1);y0=Math.min(y,y0);y1=Math.max(y,y1)}}
      result.push({ch,lower:ch===ch.toLowerCase(),bits:mask(p,64,x0,y0,x1-x0+1,y1-y0+1)});
    }
    return templates=result;
  }
  function glyphs(gray,W,H,scale,style=null) {
    const seen=new Uint8Array(gray.length),todo=new Int32Array(gray.length),letters=[];
    for(let seed=0;seed<gray.length;seed++){
      if(!gray[seed]||seen[seed])continue;
      let n=1,k=0,x0=W,x1=0,y0=H,y1=0;todo[0]=seed;seen[seed]=1;
      while(k<n){
        const idx=todo[k++],x=idx%W,y=Math.floor(idx/W);
        x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
        for(let dy=-1;dy<=1;dy++){if(y+dy<0||y+dy>=H)continue;
          for(let dx=-1;dx<=1;dx++){if((dx===0&&dy===0)||x+dx<0||x+dx>=W)continue;
            const v=idx+dy*W+dx;if(gray[v]&&!seen[v]){seen[v]=1;todo[n++]=v}
          }
        }
      }
      const w=x1-x0+1,h=y1-y0+1;
      if(h<(style?3.4:4.5)*scale||h>22*scale||w<h*(style ? .1 : .26)||w>h*1.32||n<15)continue;
      // A printed panel marker has clear space on both sides. Eliminate letters inside words.
      const gap=Math.max(3,Math.ceil(h*.43));let neighbours=0;
      for(let y=y0;y<=y1;y++)for(let d=1;d<=gap;d++)neighbours+=(gray[y*W+x0-d]||0)+(gray[y*W+x1+d]||0);
      if(neighbours>h*.19){
        if(!style)continue;
        let left=0,right=0;
        for(let y=y0;y<=y1;y++)for(let d=1;d<=gap;d++){left+=gray[y*W+x0-d]||0;right+=gray[y*W+x1+d]||0}
        if(Math.min(left,right)>h*.18)continue;
      }
      const bits=mask(gray,W,x0,y0,w,h);let best=.30,ch='';
      for(const t of referenceLetters()){
        if(t.lower!==(style==='lower'))continue;
        let diff=0;for(let i=0;i<bits.length;i++)diff+=bits[i]^t.bits[i];
        const distance=diff/bits.length;if(distance<best){best=distance;ch=t.ch}
      }
      if(ch&&best<.245)letters.push({ch:ch.toUpperCase(),x:x0/scale,y:y0/scale,w:w/scale,h:h/scale,score:best});
    }
    return letters;
  }
  function chain(marks,expected,lower=false,columns=false){
    if(!expected.has('A')||expected.size<2)return;
    const last=Math.max(...[...expected].map(l=>alphabet.indexOf(l)));
    let paths=marks.filter(m=>m.ch==='A').map(m=>({list:[m],cost:m.score}));
    for(let i=1;i<=last;i++){
      const next=[];
      for(const p of paths)for(const m of marks.filter(n=>n.ch===alphabet[i])){
        const a=p.list[0],b=p.list.at(-1);
        if(Math.abs(m.h/a.h-1)>(lower ? .65 : .28))continue;
        const same=Math.abs(b.y-m.y)<Math.max(2.8,a.h*.55);
        const returnsUp=columns && m.y<b.y-a.h*3.2 && m.x>b.x+a.h*3 &&
          p.list.some(n=>Math.abs(n.y-m.y)<a.h*.7 && n.x<m.x-a.h*3);
        if(same?m.x-b.x<a.h*3:!returnsUp&&m.y-b.y<a.h*3.2)continue;
        const aligned=p.list.some(n=>Math.abs(n.x-m.x)<a.h*1.35);
        next.push({list:[...p.list,m],cost:p.cost+m.score+(same||aligned?0:.11)+.15*Math.abs(m.h/a.h-1)+(returnsUp ? .12 : 0)});
      }
      paths=next.sort((a,b)=>a.cost-b.cost).slice(0,100);
      if(!paths.length)return;
    }
    if(paths.length>1&&paths[1].cost-paths[0].cost<.025)return;
    return paths[0]?.list;
  }
  function panelBoxes(seq,crop,ink,pixelWidth,scale,view){
    const rows=[],pad=2.5;
    for(const mark of seq.slice().sort((a,b)=>a.y-b.y||a.x-b.x)){
      const row=rows.at(-1);
      if(!row||mark.y-row[0].y>mark.h*.7)rows.push([mark]);
      else row.push(mark);
    }
    const panels=[],active=[];
    for(const row of rows){
      const top=Math.max(crop.y0,row[0].y-pad);
      row.sort((a,b)=>a.x-b.x);
      for(let i=active.length-1;i>=0;i--){
        const panel=active[i],rect=panel.rect;
        const startsInside=row.some(m=>m.x>=rect.x0-m.h*.5&&m.x<rect.x1-m.h*.5);
        // A large micrograph can continue alongside a second row of smaller charts.
        // For a new panel on the left, distinguish a continuing image from
        // ticks and rotated labels that extend just below the next row's letter.
        let continued=!startsInside;
        if(continued&&row.some(m=>m.x<rect.x1-m.h*.6)){
          const left=Math.ceil(rect.x0*scale),right=Math.floor(rect.x1*scale);
          const first=Math.max(0,Math.floor((top-row[0].h)*scale));
          const last=Math.min(Math.floor(crop.y1*scale)-1,Math.ceil((row[0].y+row[0].h*.65)*scale));
          const gutter=Math.max(2,Math.ceil(row[0].h*scale*.48));
          let blank=0;
          for(let y=first;y<=last;y++){
            let hits=0;
            for(let x=left;x<right;x++)hits+=ink[y*pixelWidth+x]||0;
            blank=hits<Math.max(3,(right-left)*.07)?blank+1:0;
            if(blank>=gutter){continued=false;break}
          }
        }
        if(!continued){rect.y1=top;active.splice(i,1)}
      }
      const carried=active.slice();
      for(const [j,m] of row.entries()){
        const x0=j===0&&!carried.some(p=>p.rect.x0<m.x)?crop.x0:Math.max(crop.x0,m.x-pad);
        const x1=Math.min(row[j+1]?row[j+1].x-pad:crop.x1,...carried.filter(p=>p.rect.x0>m.x).map(p=>p.rect.x0));
        const panel={position:m.ch.toLowerCase(),label:m.ch,rect:{x0,y0:top,x1,y1:crop.y1},
          markerBox:{x:m.x/view.width,y:m.y/view.height,width:m.w/view.width,height:m.h/view.height}};
        panels.push(panel);active.push(panel);
      }
    }
    return panels.sort((a,b)=>a.position.localeCompare(b.position));
  }
  // A single embedded image can carry the complete plate, with labels either
  // painted into the bitmap or printed as a separate PDF text layer above it.
  function adjacentImage(objects,cap,lines,view){
    const c=cap.line;
    const images=objects.filter(o=>o.kind==='image' && o.x1-o.x0>view.width*.40 && o.y1-o.y0>view.height*.18 &&
      o.x1-o.x0<view.width*.98 && o.y0>0 && c.y0-o.y1>=-3 && c.y0-o.y1<Math.max(24,c.size*3) &&
      Math.min(o.x1,c.x1)-Math.max(o.x0,c.x0)>Math.min(c.x1-c.x0,o.x1-o.x0)*.24);
    if(images.length!==1)return null;
    const image=images[0];
    if(lines.some(l=>l.text.length>65 && l.y0>image.y1 && l.y1<c.y0))return null;
    const pad=Math.min(34,(image.x1-image.x0)*.11);
    const preceding=lines.filter(l=>l.text.length>65&&l.y1<=image.y0&&l.x1>image.x0&&l.x0<image.x1);
    return {x0:Math.max(0,image.x0-pad),x1:Math.min(view.width,image.x1+pad),y0:Math.max(0,image.y0-pad,...preceding.map(l=>l.y1+2)),y1:Math.min(c.y0-2,image.y1+pad),imageOp:image.imageOp};
  }
  function standaloneImage(objects,{viewport:view,lines},allowOuterText=false){
    const images=objects.filter(o=>o.kind==='image'&&o.x1-o.x0>view.width*.4&&o.y1-o.y0>view.height*.28&&
      o.x0>=0&&o.y0>=0&&o.x1<=view.width+1&&o.y1<=view.height+1);
    if(images.length!==1)return null;
    const image=images[0];
    if(allowOuterText && (image.x1-image.x0)*(image.y1-image.y0)<view.width*view.height*.35)return null;
    const prose=lines.filter(l=>l.text.length>75&&l.y0>view.height*.08&&l.y1<view.height*.92);
    if(prose.some(l=>!allowOuterText || l.y0<image.y1-2&&l.y1>image.y0+2&&l.x0<image.x1&&l.x1>image.x0))return null;
    return image;
  }
  // Typeset vector plates can consist of hundreds of small shapes. The crop seeded
  // at the legend may span the last rows only. Walk contiguous bands of printed ink
  // upwards, stopping at body paragraphs, another caption or a gap between figures.
  async function completeTop(page,view,lines,cap,crop,annotationMode){
    const W=view.width,H=view.height;
    if(!crop||crop.x1-crop.x0<W*.5||crop.y0<H*.16||cap.line.y0<H*.48||
       Math.abs(cap.line.y0-crop.y1)>40||crop.y1-crop.y0<H*.19)return crop;
    const lane=lines.filter(l=>l.y0>=H*.048&&l.y0<crop.y0&&l.x1>crop.x0&&l.x0<crop.x1);
    const prose=lane.some((l,i)=>/^(?:(?:fig(?:ur[ea])?\.?|table|[图表])\s*\d+)/iu.test(l.text)||
      l.text.length>=40&&lane.slice(i+1).some(t=>t.text.length>=36&&t.font===l.font&&
       Math.abs(t.x0-l.x0)<l.size&&t.base-l.base>l.size*.8&&t.base-l.base<l.size*1.8));
    if(prose)return crop;
    const scale=Math.min(1,720/W),v=page.getViewport({scale}),canvas=document.createElement('canvas');
    canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
    try{
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      await page.render({canvas,canvasContext:ctx,viewport:v,annotationMode,background:'#fff'}).promise;
      const left=Math.max(0,Math.floor(crop.x0*scale)),right=Math.min(canvas.width,Math.ceil(crop.x1*scale));
      const upper=Math.max(0,Math.floor(H*.048*scale)),lower=Math.min(canvas.height,Math.ceil((crop.y0+8)*scale));
      const width=right-left,data=ctx.getImageData(left,upper,width,lower-upper).data;
      let blank=0,top=lower,inkRows=0;
      for(let row=lower-1;row>=upper;row--){
        let ink=0;
        for(let x=0;x<width;x++){const i=((row-upper)*width+x)*4;if(Math.min(data[i],data[i+1],data[i+2])<198&&++ink>=3)break}
        if(ink>=3){top=row;inkRows++;blank=0}
        else if(++blank>Math.max(18,scale*H*.042))break;
      }
      return inkRows>=10&&top/scale<crop.y0-10?{...crop,y0:Math.max(0,top/scale-3)}:crop;
    }finally{canvas.width=canvas.height=0}
  }
  function textSequence(words,box){
    const letters=words.filter(w=>/^[a-z]$/i.test(w.text.trim())&&w.x0>=box.x0-9&&w.x1<=box.x1+3&&w.y0>=box.y0-9&&w.y1<=box.y1+1);
    const sequences=[];
    for(const start of letters.filter(w=>/^a$/i.test(w.text.trim()))){
      const seq=[start];
      for(const letter of alphabet.slice(1)){
        const last=seq.at(-1);
        const near=letters.filter(w=>w.text.trim().toUpperCase()===letter&&w.font===start.font&&Math.abs(w.size-start.size)<start.size*.22&&
          (Math.abs(w.base-last.base)<start.size*.8?w.x0>last.x0+start.size*3:w.base>last.base+start.size*3.5));
        if(near.length!==1)break;
        seq.push(near[0]);
      }
      if(seq.length>=3)sequences.push(seq);
    }
    sequences.sort((a,b)=>b.length-a.length);
    if(!sequences[0]||sequences[0].length===sequences[1]?.length)return null;
    return sequences[0].map(w=>({ch:w.text.trim().toUpperCase(),x:w.x0,y:w.y0,w:w.x1-w.x0,h:w.y1-w.y0}));
  }
  async function locate(page,view,lines,cap,previous,annotationMode,box=null,words=[]){
    const expected=series(cap.caption);
    if(box){
      for(const heading of globalThis.CaptionFlow?.headings(cap.caption)||[]){
        for(const id of heading.ids)expected.add(id.toUpperCase());
      }
    }
    for(const m of cap.caption.matchAll(/\(([A-T])(?:\s*(?:and|,|[-–—])\s*([A-T]))?\)/g)){
      expected.add(m[1]);if(m[2])expected.add(m[2]);
    }
    // A, B down the left with C spanning both rows cannot be split on a row grid.
    // Match a consistent set of printed panel labels, then measure the whole plate's ink.
    let irregular;
    if(!box&&!previous&&expected.has('A')&&expected.has('B')&&expected.has('C')){
      const labels=words.filter(w=>expected.has(w.text.trim())&&w.y0>view.height*.05&&w.y1<cap.line.y0);
      for(const a of labels.filter(w=>w.text.trim()==='A')){
        const peers=labels.filter(w=>w.font===a.font&&Math.abs(w.size-a.size)<a.size*.13);
        const letters=new Set(peers.map(w=>w.text.trim()));
        if(letters.size<4||letters.size!==peers.length||!['A','B','C'].every(c=>letters.has(c)))continue;
        const ordered=peers.slice().sort((a,b)=>a.text.trim().localeCompare(b.text.trim()));
        if(!ordered.some((l,i)=>i&&l.y1<ordered[i-1].y0-2*a.size))continue;
        const top=Math.min(...peers.map(l=>l.y0));
        if(Math.max(...peers.map(l=>l.x1))-Math.min(...peers.map(l=>l.x0))<view.width*.30||
           cap.line.y0-top<view.height*.22||lines.some(l=>l.y0>=top&&l.y1<cap.line.y0&&l.text.length>70))continue;
        irregular={top};break;
      }
    }
    const textMarks=box&&textSequence(words,box);
    const lower=box&&/(?:[.;:]\s+|\()a(?:\)|[.])?\s+(?=[A-Z])/u.test(cap.caption);
    if(box){
      if(lower)for(const m of cap.caption.matchAll(/(?:[.;:]\s+|\()([a-t])(?:\)|[.])?\s+(?=[A-Z])/gu))expected.add(m[1].toUpperCase());
      for(const m of cap.caption.matchAll(/\(([A-T])(?:\s*[-–—]\s*([A-T]))?\)/g)){
        expected.add(m[1]);if(m[2])expected.add(m[2]);
      }
    }
    if(!textMarks&&(!expected.has('A')||expected.size<2))return;
    const upper=previous?view.height*.92:cap.line.y0;
    const prose=lines.filter(l=>l.y0<upper&&l.text.length>52&&l.x1-l.x0>view.width*.21);
    const top=box?box.y0:irregular?Math.max(0,irregular.top-6):previous?view.height*.045:Math.max(view.height*.045,...prose.map(l=>l.y1+1));
    const bottom=box?box.y1:previous?Math.min(upper,...prose.filter(l=>l.y0>top+15).map(l=>l.y0-2)):upper-2;
    if(bottom-top<view.height*.15)return;
    const scale=Math.min(2.8,2000/view.width,2500/view.height),v=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
    try{
      const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvas,canvasContext:ctx,viewport:v,annotationMode,background:'#fff'}).promise;
      const W=canvas.width, H=Math.min(canvas.height,Math.floor(bottom*scale)), data=ctx.getImageData(0,0,W,H).data,gray=new Uint8Array(W*H);
      let left=W,right=0,low=0;
      const xMin=Math.max(0,Math.floor(box?box.x0*scale:.035*W)),xMax=Math.min(W,Math.ceil(box?box.x1*scale:W*.965));
      if(irregular){
        let high=H;
        for(let y=Math.ceil(top*scale);y<H;y++)for(let x=xMin;x<xMax;x++){
          const k=(y*W+x)*4;
          if(Math.min(data[k],data[k+1],data[k+2])>=195)continue;
          left=Math.min(left,x);right=Math.max(right,x);high=Math.min(high,y);low=y;
        }
        if(right-left>W*.4&&bottom-low/scale<30)return {crop:{x0:left/scale-2,y0:high/scale-2,x1:(right+1)/scale+2,y1:Math.min(bottom,(low+1)/scale+2)},panels:[]};
        return;
      }
      function threshold(pixels){
        for(let y=Math.max(0,Math.ceil(top*scale));y<H;y++)for(let x=xMin;x<xMax;x++){
          const i=y*W+x,k=i*4;gray[i]=Math.max(pixels[k],pixels[k+1],pixels[k+2])<154?1:0;
        }
      }
      threshold(data);
      const style=box?(lower?'lower':'upper'):null;
      let marks=textMarks?[]:glyphs(gray,W,H,scale,style);
      const match=()=>chain(marks,expected,lower)||(box&&expected.size>=4&&chain(marks,expected,lower,true));
      let seq=textMarks||match();
      if(!seq&&Number.isInteger(box?.imageOp)){
        // A page header painted over an embedded plate may cover the tops of
        // its letters. Read the plate at its own paint operation for indexing.
        await page.render({canvas,canvasContext:ctx,viewport:v,annotationMode,background:'#fff',operationsFilter:i=>i<=box.imageOp}).promise;
        threshold(ctx.getImageData(0,0,W,H).data);
        marks=glyphs(gray,W,H,scale,style);seq=match();
      }
      if(!seq)return;
      // Captions can continue on the next page. Extend only with matching
      // printed letters of the same size in reading order.
      if(box&&!previous&&!textMarks&&!lower){
        for(const letter of alphabet.slice(seq.length)){
          const next=new Set(['A',letter]);
          const extended=chain(marks,next);
          if(!extended||!seq.every((m,i)=>extended[i]===m))break;
          seq=extended;
        }
      }
      for(let y=Math.max(0,Math.floor(seq[0].y*scale)-2);y<H;y++){
        let count=0,l=W,r=0;
        for(let x=xMin;x<xMax;x++){const k=(y*W+x)*4;if(Math.min(data[k],data[k+1],data[k+2])<200){count++;l=Math.min(l,x);r=x;}}
        if(count>=2&&count<W*.9){left=Math.min(left,l);right=Math.max(right,r);low=y;}
      }
      if(right<=left||low<seq.at(-1).y*scale)return;
      const pad=2.5,lane=box&&previous?box:{x0:0,y0:0,x1:view.width,y1:bottom};
      const crop={x0:Math.max(lane.x0,left/scale-pad),y0:Math.max(lane.y0,seq[0].y-pad),
        x1:Math.min(lane.x1,(right+1)/scale+pad),y1:Math.min(lane.y1,(low+1)/scale+pad)};
      const panels=panelBoxes(seq,crop,gray,W,scale,view);
      return {crop,panels,raster:true};
    }finally{canvas.width=canvas.height=0}
  }
  function labelGuide(label,sources=[],page){
    const extent=label.match(/^\s*([xy])\s*[:：]\s*\d+\s*\(\s*(\d+(?:\.\d+)?)\s*[µμu]m\s*\)\s*$/i);
    if(extent){
      const horizontal=extent[1].toLowerCase()==='x',length=extent[2]+' µm';
      const zh=horizontal?'横向箭头从视野左边指向右边。括号里的 '+length+' 是整幅图像在这个方向上的宽度。':'纵向箭头标出视野从上到下的范围。括号里的 '+length+' 是整幅图像在这个方向上的高度。';
      const en='The '+(horizontal?'horizontal':'vertical')+' arrow spans the field of view. The '+length+' in parentheses is the physical '+(horizontal?'width':'height')+' of the image.';
      return [label,label,zh,en,page];
    }
    const pairs=[
      [/\btime\b|\b\d+\s*(?:h|hr|min|s)\b/i,'时间标记。先看标注的单位，再沿时间轴读出观测的先后顺序。','Read the time unit first, then follow the order of observations along the timeline.'],
      [/\d\s*[µμu]m\b(?![²2])/i,'比例尺标的是图上这段线对应的实际长度，可用来估计同一幅图中结构的大小。','The scale bar gives the physical length of the marked segment. Compare structures against it within this image.'],
      [/\barea\b|[µμu]m[²2]/i,'面积表示结构在图像平面中占据的范围。读数时同时看面积单位和该轴的刻度。','Area measures the extent of a structure in the image plane. Read the area unit together with the tick spacing.'],
      [/\bprojection\b/i,'投影把多个维度的信息合在一个平面中。先按图中的轴标判断每个方向表示什么。','A projection maps several dimensions onto one plane. Read the axis labels to identify their directions.'],
      [/\braw data\b/i,'这是作者标作原始数据的图像，可与同一小图里的处理结果对照。','The label identifies the original data. Compare them with the processed view in the same panel.'],
      [/\b(?:start|finish|end)\b/i,'这是图中流程的起点或终点；沿连线可以读出各节点的顺序。','This label marks an endpoint of the workflow. Follow the line to read its sequence.'],
      [/\bmedian\b/i,'中位数是把观测值排序后的中间位置。比较各组中位数时，还要看数据的分布。','The median is the middle of the ordered observations. Read it alongside the spread in each group.']
    ];
    const hit=pairs.find(([re])=>re.test(label));
    if(hit)return [label,label,hit[1],hit[2],page];
    return null;
  }
  window.CompositePlate={locate,columnCaption,labelGuide,adjacentImage,standaloneImage,completeTop};
})();
