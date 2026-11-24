/* Locate lettered composite plates from the rendered page. PDF text alone misses outlined letters. */
(() => {
  'use strict';
  const alphabet='ABCDEFGHIJKLMNOPQRST';
  const legal = /(?:^|[.!?;:]\s+)\(?([A-T])(?:\)|\.)?\s+(?=[A-Z(0-9])/g;
  function series(text) {
    const markers=[...text.matchAll(legal)].map(m=>m[1]);
    // Grouped headings such as B–D or B, C and D describe multiple panels together.
    for(const m of text.matchAll(/(?:^|[.;:]\s+)\(?([A-T])\s*[–—-]\s*([A-T])\)?\s/g)){
      for(let i=alphabet.indexOf(m[1]);i<=alphabet.indexOf(m[2]);i++) markers.push(alphabet[i]);
    }
    return new Set(markers);
  }
  function columnCaption(line,lines,view) {
    const W=view.width;
    if(line.x0>W*.30||line.x1>W*.54||line.x1-line.x0<W*.15)return;
    const beside=lines.filter(l=>Math.abs(l.base-line.base)<line.size*.4&&l.x0>W*.46&&l.x0<W*.63&&Math.abs(l.size-line.size)<.75);
    if(beside.length!==1||/^(?:Fig(?:ure)?\.?|Table)\s*\d/i.test(beside[0].text))return;
    function column(start) {
      const parts=[start];
      for(const l of lines){
        if(l.base<=parts.at(-1).base+1||Math.abs(l.x0-start.x0)>start.size*.71)continue;
        if(l.base-parts.at(-1).base>start.size*1.7||Math.abs(l.size-start.size)>.75||/^(?:Fig(?:ure)?\.?|Table)\s*\d+/i.test(l.text))break;
        if(l.x1>start.x0+W*.47||parts.length>=75)break;
        parts.push(l);
      }
      return parts;
    }
    const a=column(line),b=column(beside[0]);
    if(a.length<2||b.length<2)return;
    const text=[...a,...b].map(l=>l.text).join(' ').replace(/(\p{Ll})-\s+(\p{Ll})/gu,'$1$2');
    const letters=series(text);
    if(!letters.has('A')||letters.size<2||!/[.!?)][”"]?$/.test(b.at(-1).text))return;
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
    for(const family of ['Arial','Calibri','Georgia'])for(const weight of ['bold','normal'])for(const ch of alphabet){
      ctx.fillStyle='#fff';ctx.fillRect(0,0,64,64);ctx.fillStyle='#000';ctx.font=weight+' 42px '+family;ctx.fillText(ch,6,49);
      const a=ctx.getImageData(0,0,64,64).data;let x0=64,x1=0,y0=64,y1=0;const p=new Uint8Array(4096);
      for(let y=0;y<64;y++)for(let x=0;x<64;x++){const i=y*64+x;if(a[i*4]<150){p[i]=1;x0=Math.min(x,x0);x1=Math.max(x,x1);y0=Math.min(y,y0);y1=Math.max(y,y1)}}
      result.push({ch,bits:mask(p,64,x0,y0,x1-x0+1,y1-y0+1)});
    }
    return templates=result;
  }
  function glyphs(gray,W,H,scale) {
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
      if(h<4.5*scale||h>22*scale||w<h*.26||w>h*1.32||n<15)continue;
      // A printed panel marker has clear space on both sides. Eliminate letters inside words.
      const gap=Math.max(3,Math.ceil(h*.43));let neighbours=0;
      for(let y=y0;y<=y1;y++)for(let d=1;d<=gap;d++)neighbours+=(gray[y*W+x0-d]||0)+(gray[y*W+x1+d]||0);
      if(neighbours>h*.19)continue;
      const bits=mask(gray,W,x0,y0,w,h);let best=.30,ch='';
      for(const t of referenceLetters()){
        let diff=0;for(let i=0;i<bits.length;i++)diff+=bits[i]^t.bits[i];
        const distance=diff/bits.length;if(distance<best){best=distance;ch=t.ch}
      }
      if(ch&&best<.245)letters.push({ch,x:x0/scale,y:y0/scale,w:w/scale,h:h/scale,score:best});
    }
    return letters;
  }
  function chain(marks,expected){
    if(!expected.has('A')||expected.size<2)return;
    const last=Math.max(...[...expected].map(l=>alphabet.indexOf(l)));
    let paths=marks.filter(m=>m.ch==='A').map(m=>({list:[m],cost:m.score}));
    for(let i=1;i<=last;i++){
      const next=[];
      for(const p of paths)for(const m of marks.filter(n=>n.ch===alphabet[i])){
        const a=p.list[0],b=p.list.at(-1);
        if(Math.abs(m.h/a.h-1)>.28)continue;
        const same=Math.abs(b.y-m.y)<Math.max(2.8,a.h*.55);
        if(same?m.x-b.x<a.h*3:m.y-b.y<a.h*3.2)continue;
        const aligned=p.list.some(n=>Math.abs(n.x-m.x)<a.h*1.35);
        next.push({list:[...p.list,m],cost:p.cost+m.score+(same||aligned?0:.11)+.15*Math.abs(m.h/a.h-1)});
      }
      paths=next.sort((a,b)=>a.cost-b.cost).slice(0,100);
      if(!paths.length)return;
    }
    if(paths.length>1&&paths[1].cost-paths[0].cost<.025)return;
    return paths[0]?.list;
  }
  async function locate(page,view,lines,cap,previous,annotationMode){
    const expected=series(cap.caption);
    if(!expected.has('A')||expected.size<2)return;
    const upper=previous?view.height*.92:cap.line.y0;
    const prose=lines.filter(l=>l.y0<upper&&l.text.length>52&&l.x1-l.x0>view.width*.21);
    const top=previous?view.height*.045:Math.max(view.height*.045,...prose.map(l=>l.y1+1));
    const bottom=previous?Math.min(upper,...prose.filter(l=>l.y0>top+15).map(l=>l.y0-2)):upper-2;
    if(bottom-top<view.height*.15)return;
    const scale=Math.min(2.8,2000/view.width,2500/view.height),v=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(v.width);canvas.height=Math.ceil(v.height);
    try{
      const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvas,canvasContext:ctx,viewport:v,annotationMode,background:'#fff'}).promise;
      const W=canvas.width, H=Math.min(canvas.height,Math.floor(bottom*scale)), data=ctx.getImageData(0,0,W,H).data,gray=new Uint8Array(W*H);
      let left=W,right=0,low=0;
      for(let y=Math.ceil(top*scale);y<H;y++)for(let x=Math.floor(.035*W);x<W*.965;x++){
        const i=y*W+x,k=i*4;if(Math.max(data[k],data[k+1],data[k+2])<154)gray[i]=1;
      }
      const marks=glyphs(gray,W,H,scale),seq=chain(marks,expected);if(!seq)return;
      const rows=[];
      for(const m of seq){if(!rows.length||Math.abs(rows.at(-1)[0].y-m.y)>m.h*.65)rows.push([]);rows.at(-1).push(m);}
      for(let y=Math.max(0,Math.floor(seq[0].y*scale)-2);y<H;y++){
        let count=0,l=W,r=0;
        for(let x=Math.floor(.035*W);x<W*.965;x++){const k=(y*W+x)*4;if(Math.min(data[k],data[k+1],data[k+2])<200){count++;l=Math.min(l,x);r=x;}}
        if(count>=2&&count<W*.9){left=Math.min(left,l);right=Math.max(right,r);low=y;}
      }
      if(right<=left||low<seq.at(-1).y*scale)return;
      const pad=2.5,crop={x0:Math.max(0,left/scale-pad),y0:Math.max(0,seq[0].y-pad),x1:Math.min(view.width,(right+1)/scale+pad),y1:Math.min(bottom,(low+1)/scale+pad)};
      const panels=[];
      rows.forEach((row,i)=>row.forEach((m,j)=>{
        const rect={x0:j===0?crop.x0:m.x-pad,y0:row[0].y-pad,x1:row[j+1]?row[j+1].x-pad:crop.x1,y1:rows[i+1]?rows[i+1][0].y-pad:crop.y1};
        panels.push({label:m.ch,position:m.ch.toLowerCase(),rect,markerBox:{x:m.x/view.width,y:m.y/view.height,width:m.w/view.width,height:m.h/view.height}});
      }));
      return {crop,panels,raster:true};
    }finally{canvas.width=canvas.height=0}
  }
  function labelGuide(label,sources=[],page){
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
  window.CompositePlate={locate,columnCaption,labelGuide};
})();
