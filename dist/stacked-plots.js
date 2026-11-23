(() => {
  'use strict';
  const mid=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
  function parts(caption){
    const named=MarkedPlots.sections(caption.replace(/\(\s*colou?r online\s*\)\s*/ig,''));
    if(named.length>=3&&named.length<=8&&named.every((p,i)=>p.id===String.fromCharCode(97+i)))return named;
    if(/\b(?:top|upper)\b.{0,80}\bmiddle\b.{0,80}\b(?:bottom|lower)\b/i.test(caption))return ['top','middle','bottom'].map(id=>({id,text:''}));
    return [];
  }
  // Long aligned rules, with both side walls present between successive rules.
  // This accepts a shared seam, or a narrow blank gutter. Heights may differ.
  function frames(data,W,H,count){
    const ink=(x,y)=>{const i=4*(W*y+x);return Math.min(data[i],data[i+1],data[i+2])<177};
    const rules=[];
    for(let y=0;y<H;y++){
      let start=-1,last=-1;
      for(let x=0;x<=W+2;x++){
        if(x<W&&ink(x,y)){if(start<0)start=x;last=x;continue}
        if(start<0||x-last<3)continue;
        if(last-start>W*.38)rules.push({x0:start,x1:last,y});
        if(rules.length>180)return [];
        start=-1;
      }
    }
    const accepted=new Map(),seen=new Set();
    for(const anchor of rules){
      const width=anchor.x1-anchor.x0,tol=Math.max(3,width*.027);
      const family=rules.filter(r=>Math.abs(r.x0-anchor.x0)<tol&&Math.abs(r.x1-anchor.x1)<tol);
      const key=family.map(r=>r.y+','+r.x0+','+r.x1).join('/');
      if(seen.has(key))continue;seen.add(key);
      const bands=[];
      for(const r of family){
        const prev=bands.at(-1);
        if(prev&&r.y-prev.at(-1).y<4)prev.push(r);else bands.push([r]);
      }
      const edges=bands.map(b=>({y:mid(b.map(r=>r.y)),x0:mid(b.map(r=>r.x0)),x1:mid(b.map(r=>r.x1))}));
      const result=[];
      for(let i=1;i<edges.length;i++){
        const a=edges[i-1],b=edges[i],height=b.y-a.y;
        if(height<Math.max(27,H*.04)||height>H*.75)continue;
        function wall(near){
          let best=0,bx=null;
          for(let x=Math.max(0,Math.floor(near-tol));x<Math.min(W,near+tol+1);x++){
            let hits=0,total=0;
            for(let y=a.y+2;y<b.y-1;y+=3){total++;if(ink(x,y))hits++}
            if(hits/total>best){best=hits/total;bx=x}
          }
          return best>.83?bx:null;
        }
        const x0=wall((a.x0+b.x0)/2),x1=wall((a.x1+b.x1)/2);
        if(x0!==null&&x1!==null)result.push({x0,x1,y0:a.y,y1:b.y});
      }
      if(result.length!==count)continue;
      const height=mid(result.map(f=>f.y1-f.y0));
      if(result.some((f,i)=>i&&f.y0-result[i-1].y1>height*.40))continue;
      accepted.set(result.map(f=>[f.x0,f.x1,f.y0,f.y1].join(',')).join('/'),result);
    }
    return accepted.size===1?[...accepted.values()][0]:[];
  }
  // A thin connecting line or an error bar erodes away. Filled markers retain
  // a compact core. Require common measurement positions in both colour bands.
  function series(data,W,f,expected=[]){
    const w=f.x1-f.x0+1,h=f.y1-f.y0+1;
    function points(red){
      const mask=new Uint8Array(w*h),core=new Uint8Array(w*h);
      for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
        const i=4*((f.y0+y)*W+f.x0+x),r=data[i],g=data[i+1],b=data[i+2];
        mask[y*w+x]=red?r>140&&r-g>70&&r-b>70:Math.max(r,g,b)<165&&Math.max(r,g,b)-Math.min(r,g,b)<32;
      }
      const radius=Math.max(1,Math.round(w*.0028));
      for(let y=radius+1;y<h-radius-1;y++)for(let x=radius+1;x<w-radius-1;x++){
        const k=y*w+x;if(!mask[k])continue;
        core[k]=[-radius,0,radius].every(d=>[-radius,0,radius].every(e=>mask[k+d*w+e]));
      }
      const found=[];
      for(let k=0;k<core.length;k++){
        if(!core[k])continue;
        const queue=[k];core[k]=0;let x0=w,x1=0,y0=h,y1=0;
        for(let j=0;j<queue.length;j++){
          const t=queue[j],x=t%w,y=Math.floor(t/w);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
          for(const n of [t-1,t+1,t-w,t+w])if(core[n]){core[n]=0;queue.push(n)}
        }
        const dx=x1-x0+1,dy=y1-y0+1,size=(dx+dy)/2+2*radius;
        if(size<w*.006||size>w*.034||Math.min(dx,dy)<Math.max(dx,dy)*.57||queue.length<3)continue;
        const cx=(x0+x1)/2,cy=(y0+y1)/2,d=Math.max(1,Math.round((size-1)*.42));
        let corners=0;
        for(const sx of [-1,1])for(const sy of [-1,1])corners+=mask[Math.round(cy+sy*d)*w+Math.round(cx+sx*d)]||0;
        found.push({x:cx+f.x0,y:cy+f.y0,shape:corners>=3?'squares':corners<=1?'circles':'',size});
      }
      return found;
    }
    const red=points(true),gray=points(false),tol=Math.max(2,w*.007);
    const candidates=red.filter(a=>a.x>f.x0+.035*w&&a.x<f.x1-.035*w).sort((a,b)=>a.x-b.x);
    const sequences=[];
    if(candidates.length<=60&&gray.length<=140){
      for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
        const first=candidates[i],step=candidates[j].x-first.x;
        if(step<w*.04)continue;
        const line=[first,candidates[j]];
        for(let pos=first.x+step*2;pos<f.x1;pos+=step){
          const next=candidates.filter(p=>Math.abs(p.x-pos)<tol&&Math.abs(p.size-first.size)<first.size*.34);
          if(next.length!==1)break;line.push(next[0]);
        }
        if(line.length<4||line.at(-1).x-first.x<w*.56||line.some(p=>Math.abs(p.size-first.size)>first.size*.34))continue;
        const other=line.flatMap(p=>{const hits=gray.filter(b=>Math.abs(p.x-b.x)<tol&&Math.abs(p.size-b.size)<p.size*.35);return hits.length===1?hits:[]});
        if(other.length<Math.max(4,line.length*.72)||Math.abs(other[0].x-first.x)>tol||Math.abs(other.at(-1).x-line.at(-1).x)>tol)continue;
        function track(points,color){
          const shape=['circles','squares'].find(s=>points.filter(p=>p.shape===s).length>=points.length*.6);
          return {points,shape,color};
        }
        const tracks=[track(line,'red'),track(other,'gray')];
        if(expected.length===2&&expected.includes('squares')&&expected.includes('circles')){
          for(const [index,t] of tracks.entries()){
            const peer=tracks[1-index],otherShape=peer.shape==='squares'?'circles':'squares';
            if(peer.shape&&peer.points.every(p=>p.shape===peer.shape)&&t.points.filter(p=>p.shape===otherShape).length>=2)t.shape=otherShape;
          }
        }
        if(tracks.every(t=>t.shape)&&tracks[0].shape!==tracks[1].shape)sequences.push(tracks);
      }
    }
    sequences.sort((a,b)=>b[0].points.length-a[0].points.length);
    return {red,gray,tracks:sequences.length&&sequences[1]?.[0].points.length!==sequences[0][0].points.length?sequences[0]:[]};
  }
  function cropCanvas(canvas,rect,zoom=1){
    const c=document.createElement('canvas'),w=rect.x1-rect.x0,h=rect.y1-rect.y0;
    c.width=Math.max(1,Math.round(w*zoom));c.height=Math.max(1,Math.round(h*zoom));
    c.getContext('2d').drawImage(canvas,rect.x0,rect.y0,w,h,0,0,c.width,c.height);return c;
  }
  async function worker(){
    const base=new URL('./vendor/ocr/',document.baseURI),file=n=>new URL(n,base).href;
    const {default:ocr}=await import(file('tesseract.esm.min.js'));
    return ocr.createWorker('eng',1,{workerPath:file('worker.min.js'),corePath:file('tesseract-core-lstm.wasm.js'),langPath:base.href,workerBlobURL:false,cacheMethod:'none'});
  }
  const rel=(a,b)=>({x:(a.x0-b.x0)/(b.x1-b.x0),y:(a.y0-b.y0)/(b.y1-b.y0),width:(a.x1-a.x0)/(b.x1-b.x0),height:(a.y1-a.y0)/(b.y1-b.y0)});
  const toPage=(r,b,scale)=>({x0:b.x0+r.x0/scale,x1:b.x0+r.x1/scale,y0:b.y0+r.y0/scale,y1:b.y0+r.y1/scale});
  function printedSettings(words,box){
    const lines=[];
    for(const t of words.filter(t=>t.x0>=box.x0&&t.x1<=box.x1&&t.y0>=box.y0&&t.y1<=box.y1).sort((a,b)=>a.base-b.base||a.x0-b.x0)){
      const line=lines.at(-1);
      if(!line||Math.abs(line[0].base-t.base)>t.size*.35)lines.push([t]);else line.push(t);
    }
    const settings=[];
    for(const line of lines){
      let text='',end=-Infinity;
      for(const t of line.sort((a,b)=>a.x0-b.x0)){
        text+=(t.x0-end>t.size?'|':'')+t.text;end=t.x1;
      }
      for(const chunk of text.normalize('NFKC').split('|')){
        const m=chunk.trim().match(/^([\p{L}][\p{L}\d_]{0,8})\s*=\s*([−-]?\d+(?:\.\d+)?)$/u);
        if(m)settings.push({name:m[1],value:m[2]});
      }
    }
    return settings;
  }
  async function locate(cap,initial,marks,words,page,view,annotationMode){
    const partsFound=parts(cap.caption);
    if(/\bleft[- ]hand column\b/i.test(cap.caption)&&/\bright[- ]hand column\b/i.test(cap.caption))return null;
    if(!initial||!partsFound.length||!/power|intensit|spectr|curves?|axis|axes|time|frequency|temperature|distribution|versus|measure|energy|density|flux|velocity/i.test(cap.caption))return null;
    const near=marks.filter(m=>m.kind==='image'&&m.x0>=initial.x0-2&&m.x1<=initial.x1+2&&m.y0>=initial.y0-2&&m.y1<=initial.y1+2&&(m.x1-m.x0)>.7*(initial.x1-initial.x0)&&(m.y1-m.y0)>.7*(initial.y1-initial.y0));
    const crop=near.length===1?near[0]:initial,w=crop.x1-crop.x0,h=crop.y1-crop.y0;
    if(h<w*.46||w<35||h<50)return null;
    const scale=Math.min(4.4,1420/h,1150/w),c=document.createElement('canvas');
    c.width=Math.ceil(w*scale);c.height=Math.ceil(h*scale);
    const ctx=c.getContext('2d',{willReadFrequently:true});let ocr;
    try{
      await page.render({canvas:c,canvasContext:ctx,viewport:page.getViewport({scale}),transform:[1,0,0,1,-crop.x0*scale,-crop.y0*scale],annotationMode,background:'#fff'}).promise;
      const data=ctx.getImageData(0,0,c.width,c.height).data,boxes=frames(data,c.width,c.height,partsFound.length);
      if(!boxes.length)return null;
      const last=boxes.at(-1),shared={x0:0,x1:w*scale,y0:last.y1+1,y1:h*scale};
      if(shared.y1-shared.y0<5)return null;
      const pixelBox={x0:0,y0:0,x1:w*scale,y1:h*scale};
      async function read(r,mode='6',numeric=false,withWords=false){
        ocr||=await worker();await ocr.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:numeric?'0123456789.-−':''});
        const z=cropCanvas(c,r);
        try{
          const {data}=await ocr.recognize(z,{},withWords?{blocks:true}:{});
          return withWords?data:data.text.trim();
        }finally{z.width=z.height=0}
      }
      const axisText=await read(shared,'6',false,true).catch(()=>null),horizontal=axisText?.text.trim()||'';
      const tickLines=(axisText?.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines)).filter(l=>l.words.length>=3&&l.words.every(w=>/^[−-]?\d+(?:\.\d+)?$/.test(w.text)&&w.confidence>=65));
      const ticks=tickLines.length===1?tickLines[0].words.map(v=>({value:Number(v.text.replace('−','-')),x:((v.bbox.x0+v.bbox.x1)/2-last.x0)/(last.x1-last.x0)})):[];
      const rows=[];
      for(const [i,f] of boxes.entries()){
        const part=partsFound[i],fw=f.x1-f.x0,fh=f.y1-f.y0;
        const window={x0:f.x0+2,x1:Math.min(f.x1,f.x0+fw*.115),y0:f.y0+2,y1:f.y0+Math.min(fh*.28,fw*.10)};
        let letter='';
        if(part.id.length===1){
          const vector=words.find(t=>t.x0>=crop.x0+window.x0/scale-2&&t.x0<=crop.x0+window.x1/scale&&t.y0>=crop.y0+window.y0/scale-2&&t.y1<=crop.y0+window.y1/scale+2&&/^\(?[a-h]\)?$/.test(t.text.trim()));
          const stamp=vector?.text||(await read(window,'6').catch(()=>''));
          letter=stamp.trim().match(/^\s*[(\[]?\s*([a-h])\s*[)\].]?(?:\s*[\],|.])*\s*$/i)?.[1]?.toLowerCase()||'';
          if(letter&&letter!==part.id)return null;
        }
        const rect={x0:0,x1:pixelBox.x1,y0:i?(boxes[i-1].y1+f.y0)/2:0,y1:boxes[i+1]?(f.y1+boxes[i+1].y0)/2:pixelBox.y1};
        const map=MarkedPlots.mappings(part.text);
        const raw=map.length||/FWHM|half.maximum/i.test(part.text)?series(data,c.width,f,map.map(m=>m.shape)):{tracks:[],red:[],gray:[]};
        const tracks=raw.tracks.map(t=>{
          const ys=t.points.map(p=>(p.y-f.y0)/fh),threshold=Math.max(.009,mid(t.points.map(p=>p.size))/fh*.7);
          const direction=d=>Math.abs(d)<threshold?0:d>0?-1:1;
          return {shape:t.shape,color:t.color,net:direction(ys.at(-1)-ys[0]),changes:ys.slice(1).map((y,j)=>direction(y-ys[j])),xs:t.points.map(p=>(p.x-f.x0)/fw),biggest:ys.slice(1).map((y,j)=>Math.abs(y-ys[j])).indexOf(Math.max(...ys.slice(1).map((y,j)=>Math.abs(y-ys[j]))))};
        });
        const yArea=side=>({x0:side==='left'?0:f.x1+1,x1:side==='left'?f.x0:pixelBox.x1,y0:f.y0+3,y1:f.y1-3});
        const right=yArea('right');let occupied=0;
        for(let y=Math.ceil(right.y0);y<right.y1;y++)for(let x=Math.ceil(right.x0)+2;x<right.x1-1;x++){const k=4*(y*c.width+x);if(Math.min(data[k],data[k+1],data[k+2])<160)occupied++}
        const axes={left:rel(yArea('left'),pixelBox),right:rel(right,pixelBox),x:rel(shared,pixelBox)};
        const directions={};
        if(tracks.length){
          for(const side of ['left',...(occupied?['right']:[])]){
            const r=yArea(side);
            if(side==='left'){r.x1-=fw*.012;r.x0=Math.max(0,r.x1-fw*.16)}
            else {r.x0+=fw*.012;r.x1=Math.min(r.x1,r.x0+fw*.16)}
            r.y0+=fh*.035;r.y1-=fh*.035;
            const cols=[];
            for(let x=Math.ceil(r.x0);x<r.x1;x++){
              let n=0;for(let y=Math.ceil(r.y0);y<r.y1;y++){const k=4*(c.width*y+x);if(Math.min(data[k],data[k+1],data[k+2])<150)n++}
              if(n>1){const last=cols.at(-1);if(last&&x-last[1]<=fw*.009)last[1]=x;else cols.push([x,x])}
            }
            const candidates=cols.filter(([a,b])=>b-a>=fw*.025);
            const col=side==='right'?candidates[0]:candidates.at(-1);
            if(!col)continue;r.x0=col[0]-3;r.x1=col[1]+4;
            function direction(text){
              const ticks=text.split(/\n/).flatMap(l=>{
                const n=l.trim().match(/^\s*([−-]?\d+(?:\.\d+)?)\s*[-.]?\s*$/u);
                return n?[Number(n[1].replace('−','-'))]:[];
              });
              const diffs=ticks.slice(1).map((v,j)=>Math.sign(ticks[j]-v));
              return diffs.length>=2&&diffs.every(v=>v===diffs[0])?diffs[0]:0;
            }
            directions[side]=direction(await read(r,'6',true).catch(()=>''));
            if(!directions[side]){
              const wide=yArea(side);
              if(side==='left')wide.x0=Math.max(0,wide.x1-fw*.15);else wide.x1=Math.min(wide.x1,wide.x0+fw*.14);
              directions[side]=direction(await read(wide).catch(()=>''));
            }
          }
        }
        let legend=[];
        if(/\bFWHM\b|half.maximum/i.test(part.text)){
          legend=await readLegend(part.text,read,c,data,f,raw).catch(()=>[]);
        }
        rows.push({id:part.id,letter,part:part.text,rect:toPage(rect,crop,scale),frame:toPage(f,crop,scale),axes,directions,tracks,legend,
          settings:printedSettings(words,toPage(f,crop,scale)),single:!occupied&&right.x1-right.x0>fw*.035});
      }
      // With a caption sequence, require independent letter evidence. Never
      // present an observed conflicting letter as the next entry in a sequence.
      const named=partsFound[0].id.length===1;
      if(named&&rows.filter(r=>r.letter===r.id).length<Math.ceil(rows.length/2))return null;
      for(const candidate of rows[0].settings){
        const matches=rows.map(r=>r.settings.filter(s=>s.name===candidate.name));
        if(matches.every(m=>m.length===1)&&new Set(matches.map(m=>m[0].value)).size===rows.length)
          rows.forEach((r,i)=>{(r.conditions||=[]).push(matches[i][0].name+' = '+matches[i][0].value)});
      }
      for(const r of rows)delete r.settings;
      return {crop,rows,horizontal,ticks,shared:toPage(shared,crop,scale),panels:rows.map(r=>({position:r.id,label:r.id.toUpperCase(),rect:r.rect}))};
    }finally{if(ocr)await ocr.terminate();c.width=c.height=0}
  }
  async function readLegend(text,read,canvas,data,f,raw){
    const labels=[...text.matchAll(/\((\d{3,4})\)/g)].map(m=>m[1]);
    if(labels.length!==2)return [];
    const w=f.x1-f.x0,h=f.y1-f.y0;
    for(const circle of raw.red.filter(p=>p.shape==='circles'&&p.x>f.x0+w*.55&&p.y<f.y0+h*.48)){
      const square=raw.gray.find(p=>p.shape==='squares'&&Math.abs(p.x-circle.x)<p.size*.7&&Math.abs(p.y-circle.y)>p.size*1.5&&Math.abs(p.y-circle.y)<h*.2);
      if(!square)continue;
      const entries=[];
      for(const p of [circle,square]){
        const r={x0:Math.round(p.x+p.size*1.7),x1:f.x1-4,y0:Math.round(p.y-p.size*1.75),y1:Math.round(p.y+p.size*1.75)};
        const value=(await read(r,'7')).replace(/\s/g,'').match(/\(?(\d{3,4})\)?/)?.[1];
        if(!labels.includes(value))break;
        // A short, detached horizontal stroke directly beneath a digit can
        // carry the Miller-index sign lost from a PDF's plain text.
        const runs=[];
        for(let y=Math.round(p.y);y<r.y1;y++){
          let start=-1;
          for(let x=r.x0;x<=r.x1;x++){
            const k=4*(canvas.width*y+x),dark=x<r.x1&&Math.max(data[k],data[k+1],data[k+2])<130;
            if(dark&&start<0)start=x;
            if(!dark&&start>=0){if(x-start>=p.size*.7)runs.push({start,end:x,y});start=-1}
          }
        }
        const line=runs.filter(v=>v.y>p.y+p.size*.65&&v.y<p.y+p.size*1.45&&v.end-v.start<p.size*1.55&&[1,2,3,4].some(d=>{
          for(let x=v.start;x<v.end;x++){const k=4*(canvas.width*(v.y-d)+x);if(Math.max(data[k],data[k+1],data[k+2])<135)return false}return true;
        })).at(-1);
        let printed=value,signUncertain=false;
        if(line){
          const cols=[];
          for(let x=r.x0;x<r.x1;x++)for(let y=Math.round(p.y-p.size);y<=p.y+p.size*.45;y++){
            const k=4*(canvas.width*y+x);if(Math.max(data[k],data[k+1],data[k+2])<150){cols.push(x);break}
          }
          const spans=[];for(const x of cols){if(!spans.length||x>spans.at(-1)[1]+1)spans.push([x,x]);else spans.at(-1)[1]=x}
          const cx=(line.start+line.end)/2,at=spans.findIndex(([a,b])=>cx>=a&&cx<=b);
          if(spans.length===value.length+2&&at>0&&at<=value.length){printed=value.slice(0,at)+ '\u0305'+value.slice(at)}
          else signUncertain=true;
        }
        entries.push({shape:p.shape,printed,raw:value,signUncertain});
      }
      if(entries.length===2&&entries[0].raw!==entries[1].raw)return entries;
    }
    return [];
  }
  const shapeName={circles:'圆点',squares:'方块',diamonds:'菱形',triangles:'三角形'};
  function quantity(text,m){
    if(/lattice parameters?\b/i.test(text)&&/^[ac]$/i.test(m.quantity))
      return ['晶格参数 '+m.quantity,'lattice parameter '+m.quantity];
    if(/ratio/i.test(m.quantity)){
      const ratio=text.match(/\b([a-z]\s*\/\s*[a-z])\s+(?:lattice parameter\s+)?ratio/i)?.[1];
      if(ratio)return [ratio+' 晶格轴长比',ratio+' lattice-parameter ratio'];
    }
    if(/intensity/i.test(m.quantity)){
      const peak=text.match(/(\(\d{3,4}\))\s+peak relative intensity/i)?.[1];
      if(peak)return [peak+' 衍射峰的相对强度',peak+' relative peak intensity'];
    }
    return [m.quantity,m.quantity];
  }
  function evidence(rows,fig,id){
    const number=fig.matchKey.split(':')[1],ref=new RegExp('\\bFig(?:ure)?\\.?\\s*'+number+'\\s*\\(?'+id+'\\b','i');
    if(id.length!==1)return [];
    const result=[];
    for(let i=0;i<rows.length;i++){
      const line=rows[i];if(line.fig||!ref.test(line.text))continue;
      let a=i,b=i;
      while(a>0&&i-a<5&&rows[a-1].page===line.page&&!rows[a-1].fig&&!rows[a-1].heading&&!/[.!?]$/.test(rows[a-1].text))a--;
      while(b+1<rows.length&&b-i<8&&rows[b+1].page===line.page&&!rows[b+1].fig&&!rows[b+1].heading)b++;
      const passage=rows.slice(a,b+1).map(r=>r.text).join(' ');
      // Keep the passage as printed, including decimal points. Finish at a
      // sentence boundary where possible and stop before a subsequent figure.
      const end=passage.search(/(?<=[.!?])\s+(?=Figure\s+\d+\s+shows)/);
      const raw=end>0?passage.slice(0,end):passage;
      const stop=[...raw.matchAll(/[.!?](?=\s+[A-Z]|$)/g)].at(-1)?.index;
      const quote=stop!=null&&ref.test(raw.slice(0,stop+1))?raw.slice(0,stop+1):raw;
      if(!result.some(r=>r.page===line.page&&r.text.includes(line.text)))result.push({page:line.page,text:quote});
      if(result.length===3)break;
    }
    return result;
  }
  function enrich(fig,documentRows){
    const stack=fig.layerStack;if(!stack)return;
    const ocrX=stack.horizontal.split(/\n/).map(s=>s.trim());
    const ticks=stack.ticks||[];
    const power=ticks.length>=3&&ticks.every((v,i)=>!i||v.x>ticks[i-1].x&&v.value>ticks[i-1].value)&&ocrX.some(s=>/\bRF\s*Power\s*\(\s*W\s*\)/i.test(s))&&/\bRF\s+powers?\b/i.test(fig.caption);
    for(const [i,s] of stack.rows.entries()){
      const p=fig.panels.find(p=>p.id===s.id);if(!p)continue;
      const rows=[],sources=[],add=(role,en,zh,enText)=>rows.push({role,en,zh,enText});
      const pos=i===0?['上格','Top']:i===stack.rows.length-1?['下格','Bottom']:stack.rows.length===3?['中格','Middle']:['第 '+(i+1)+' 格','Row '+(i+1)];
      const maps=MarkedPlots.mappings(s.part).filter(m=>!m.inset);
      const axes=maps.map(m=>({...m,name:quantity(s.part,m)}));
      if(s.single&&s.legend.length===2&&/FWHM|half.maximum/i.test(s.part)){
        for(const l of s.legend){
          const key=l.signUncertain?'原图标作 '+l.raw+'（指数符号待核对）':'('+l.printed+')';
          axes.push({shape:l.shape,side:'left',name:[key+' 峰的半高全宽',(l.signUncertain?'the peak labelled '+l.raw+' (index sign to verify)':'the ('+l.printed+') peak')+' FWHM']});
        }
      }
      const scoped=evidence(documentRows,fig,s.id);
      const body=scoped.map(v=>v.text).join(' ');
      const caption=s.part||fig.caption;
      sources.push({kind:s.part?'小图图注':'整图图注',en:s.part?'Panel caption':'Figure caption',page:fig.captionPage||fig.page,text:caption});
      for(const q of scoped)sources.push({kind:'提及本小图的正文',en:'Article text citing this panel',...q});
      p.layerPosition=pos;p.markerAxes=s.axes;p.markerMap=axes;
      p.gridShared=[{kind:'x',label:'底部横轴 / Bottom x-axis',box:stack.shared}];
      const diffraction=/\b(?:XRD|diffraction|diffractograms?)\b/i.test(caption+' '+body);
      const title=/lattice parameters?\s+a\b/i.test(s.part)?['晶胞的轴长','Unit-cell dimensions']:
        /lattice parameter ratio/i.test(s.part)?['轴长比与相对峰强','Axis ratio and relative intensity']:
        /FWHM|half.maximum/i.test(s.part)?(diffraction?['衍射峰宽','Diffraction peak widths']:['峰宽','Peak widths']):pos;
      if(s.conditions?.length){
        const condition=s.conditions.join(', ');
        add('这一格的条件','Condition printed inside the frame','原图在这一格标出 '+condition+'。切换到相邻格可对照同一参数的其他取值。','This frame is labelled '+condition+'. Select a neighbouring plot to compare another value of the same parameter.');
        sources.push({kind:'图内标注',en:'Printed condition',page:fig.page,text:condition});
      }
      p.title=title[0];
      if(power)add('沿共用横轴读','Shared horizontal axis','从左向右，射频功率增大，单位为瓦（W）。上下对齐的位置对应同一个功率。','RF power increases from left to right, in watts (W). Vertically aligned positions represent the same power.');
      else add('在原图中的位置','Position on the original',pos[0]+'。沿这一格的符号或曲线看变化，下方按钮可以定位底部横轴。',pos[1]+' plot. Follow its marks across the frame. Use the axis button to locate the bottom scale.');
      for(const m of axes){
        const side=m.side==='left'?'左轴':'右轴',sh=shapeName[m.shape];
        let explanation='',en='';
        if(/lattice parameter [ac]$/i.test(m.name[1])){
          explanation=m.quantity==='a'?'它描述晶胞底面内的边长。':'它描述晶胞沿 c 方向的高度。';
          en=m.quantity==='a'?' This is the basal-plane cell length.':' This is the cell length along the c direction.';
        }else if(/parameter ratio/.test(m.name[1])){
          const [num,den]=m.name[1].split(' ')[0].split('/');
          explanation='用 '+num+' 方向的轴长除以 '+den+' 方向的轴长，得到无单位的比值。';en=' Dividing the '+num+' length by the '+den+' length gives a dimensionless ratio.';
        }else if(/relative peak intensity/.test(m.name[1])){
          explanation='读的是该反射在作者比较的衍射峰中的相对强弱。';en=' It measures the relative prominence of this reflection among the peaks being compared.';
        }
        add(sh+' · '+side,m.shape+' · '+m.side+' axis','从'+sh+'水平读'+side+'的'+m.name[0]+'。'+explanation,'Read the '+m.shape+' horizontally against the '+m.side+' axis for '+m.name[1]+'.'+en);
      }
      if(s.single&&s.legend.length===2&&/FWHM|half.maximum/i.test(s.part))add('半高全宽怎么读','Reading the peak width','两组都用左轴。在峰的一半高度处量两侧之间的'+(diffraction?'衍射角间隔':'间隔')+'。数值越大，峰越宽。','Both series use the left scale. FWHM is the '+(diffraction?'angular ':'')+'distance between the two sides of a peak at half its maximum height. A larger value means a broader peak.');
      const trends=[];
      for(const t of s.tracks){
        const m=axes.find(v=>v.shape===t.shape);
        const sign=m&&s.directions[m.side];if(!sign)continue;
        const net=t.net*sign,last=t.changes.at(-1)*sign;
        function xLabel(idx){
          if(!power||!ticks.every((v,j)=>!j||v.value>ticks[j-1].value))return '';
          const hit=ticks.filter(v=>Math.abs(v.x-t.xs[idx])<.018);
          return hit.length===1?hit[0].value+' W':'';
        }
        const up=net>0,down=net<0;
        let zh=m.name[0]+(/[a-z]$/i.test(m.name[0])?' ':'')+(up?'整体上升':down?'整体下降':'首末两点接近'),en=m.name[1]+(up?' rises overall':down?' falls overall':' ends close to where it starts');
        if(net&&last===-net){const from=xLabel(t.changes.length-1),to=xLabel(t.changes.length);
          zh+='，但'+(from&&to?'从 '+from+' 到 '+to+' ':'到最后一个点')+(last>0?'又回升':'略有回落');
          en+=', with '+(last>0?'an upturn':'a downturn')+(from&&to?' from '+from+' to '+to:' at the last point');
        }else if(t.changes.length>2&&t.changes.every(v=>v*sign<=0)&&down){
          const from=xLabel(t.biggest),to=xLabel(t.biggest+1);
          if(from&&to){zh+='，图中降幅最大的一段在 '+from+' 与 '+to+' 之间';en+=', with the largest visible drop between '+from+' and '+to}
        }
        trends.push([zh+'。',en.replace(/^(?:the|lattice)\b/,v=>v[0].toUpperCase()+v.slice(1))+'.']);
      }
      if(trends.length)add('图上看到的变化','Trends in the plotted markers',trends.map(r=>r[0]).join(''),trends.map(r=>r[1]).join(' '));
      const lattice=body.match(/Both ([ac]) and ([ac]) parameters tend to show an overall and slight decrease with increasing RF power/i);
      if(lattice&&/lattice parameters/i.test(s.part))add('作者怎样概括','Authors’ description','作者把两条曲线概括为晶格参数随功率升高总体略降。小幅波动要对照各点的误差线。','The authors describe a slight overall decrease in both lattice parameters with increasing power. Compare small fluctuations with the plotted error bars.');
      const ratio=body.match(/ratio starts at ([\d.]+) for RF power of (\d+) W and establishes around ([\d.]+) for RF powers above (\d+) W/i);
      if(ratio&&/lattice parameter ratio/i.test(s.part))add('正文给出的读数','Values reported in the text','作者报告，在 '+ratio[2]+' W 时 c/a 为 '+ratio[1]+'，超过 '+ratio[4]+' W 后约为 '+ratio[3]+'。','The authors report c/a of '+ratio[1]+' at '+ratio[2]+' W and about '+ratio[3]+' above '+ratio[4]+' W.');
      if(!axes.length)add('读轴待核对','Axis assignment to verify','本格已定位。请对照原图的轴标题和图例，确认每条曲线读哪根轴。','The plot has been located. Check its printed axis labels and legend to assign series to scales.');
      add('数值待核对','Values to verify','单点纵坐标和误差线端点尚未逐点核实。'+(trends.length?'趋势按可定位的符号中心读取。':''),'Individual y-values and error-bar endpoints have not been verified.'+(trends.length?' Trends use the centers of the identified markers.':''));
      p.reading={kind:'stack',title,rows,sources,narration:trends.map(t=>t[0]).join('')};
      delete p.markReading;
    }
  }
  window.StackedPlots={parts,frames,series,locate,enrich,createOcrWorker:worker};
})();
