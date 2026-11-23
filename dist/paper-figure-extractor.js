(() => {
'use strict';

// Local PDF.js scan. The PDF is never URL-addressed, uploaded, or interpreted as a claim.
const base = new URL('./vendor/pdf/', document.currentScript.src);
const MB = 1024 * 1024;
const MAX_FILE = 64 * MB, MAX_PAGES = 54, DEFAULT_PAGES = 34, MAX_FIGURES = 55;
const MAX_GRAPHIC_PAGES = 18, MAX_TEXT_ITEMS = 6500, MAX_OPS = 35000, MAX_GRAPHICS = 850;
const UNIT = [1,0,0,1,0,0];
let library;

const stop = () => new DOMException('已取消读取 PDF。','AbortError');
const clamp = (x,a,b) => Math.max(a,Math.min(x,b));
const numArray = (v,n) => v && typeof v.length === 'number' && v.length === n && Array.from(v).every(Number.isFinite);
const area = b => Math.max(0,b.x1-b.x0)*Math.max(0,b.y1-b.y0);
const overlap = (a0,a1,b0,b1) => Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));
const gap = (a0,a1,b0,b1) => Math.max(0,b0-a1,a0-b1);
const unite = (a,b) => ({x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)});
const w = b => b.x1-b.x0, h = b => b.y1-b.y0;
const norm = x => String(x??'').replace(/\s+/g,' ').trim();
const close = (p,q,e) => Math.abs(p-q)<=e;
const mult = (a,b) => [
 a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],
 a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]
];
const at = (m,x,y) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function boxFrom(m,b){
 const p=[at(m,b[0],b[1]),at(m,b[2],b[1]),at(m,b[2],b[3]),at(m,b[0],b[3])];
 return {x0:Math.min(...p.map(x=>x[0])),y0:Math.min(...p.map(x=>x[1])),x1:Math.max(...p.map(x=>x[0])),y1:Math.max(...p.map(x=>x[1]))};
}
function verticalLabels(content,view,includeTicks=false){
 const labels=[];
 for(const t of content.items.slice(0,MAX_TEXT_ITEMS)){
  const tick=includeTicks&&/^[−+\-]?[\d.,]+$/.test(t.str);
  if(!t.str||!(/[\p{L}]{2}/u.test(t.str)||tick)||!numArray(t.transform,6)||t.width<=0||(!tick&&t.width<2))continue;
  const m=mult(view.transform,t.transform),scale=Math.hypot(m[0],m[1]);
  if(!scale||Math.abs(m[0])>scale*.06||Math.abs(m[1])<scale*.97)continue;
  labels.push({text:norm(t.str),...boxFrom(m,[0,-.2,t.width/scale,.9])});
 }
 return labels;
}
function positions(content,viewport,raw=false){
 const points = [], V = viewport.transform;
 for(let i=0;i<Math.min(content.items.length,MAX_TEXT_ITEMS);++i){
  const item=content.items[i];if(typeof item.str!=='string'||!item.str.trim()||!numArray(item.transform,6))continue;
  const T=mult(V,item.transform), size=Math.max(3,Math.min(140,Math.abs(item.height||0)||Math.hypot(T[2],T[3])));
  if(Math.abs(T[1])>Math.max(1,Math.abs(T[0])*.13))continue; // upright text only; page still viewable
  const dx=Math.max(Math.abs(item.width)||0,size*.25);
  points.push({text:item.str,font:item.fontName,x0:T[4],x1:T[4]+dx,y0:T[5]-size*.91,y1:T[5]+size*.21,base:T[5],size});
 }
 points.sort((a,b)=>a.base-b.base||a.x0-b.x0);
 if(raw)return points;
 const rows=[];
 for(const p of points){
  let row=rows.at(-1);
  if(!row||!close(row[0].base,p.base,Math.max(1.2,Math.min(row[0].size,p.size)*.34))){row=[];rows.push(row);}
  row.push(p);
 }
 const out=[];
 for(const row of rows){
  row.sort((a,b)=>a.x0-b.x0);
  let line=null;
  for(const p of row){
   if(!line||p.x0-line.x1>Math.min(12,Math.max(4,p.size*.95))||p.x0<line.x1-Math.max(18,p.size*1.7)){
    line={...p};out.push(line);continue;
   }
   const space=/\s$/.test(line.text)||/^\s/.test(p.text)?'':p.x0-line.x1>Math.max(.7,p.size*.09)?' ':'';
   line.text+=space+p.text;line.x1=Math.max(line.x1,p.x1);line.y0=Math.min(line.y0,p.y0);line.y1=Math.max(line.y1,p.y1);
   if(p.text.trim().length>=4)line.bodySize=Math.max(line.bodySize||line.size,p.size);
  }
 }
 for(const line of out)line.text=norm(line.text);
 return out.filter(x=>x.text);
}
const CAP = /^(?:(?:(Extended\s+Data|Supplementary|Supplemental)\s+)?(Fig(?:ure)?s?\.?)\s*([sS]?\s*\d{1,3})|((?:扩展数据|补充|附)?图)\s*([sS]?\s*\d{1,3}))(?=\s*(?:[.:：|｜]|[—–-]\s)|\s+(?:(?:posterior|prior|empirical|observed|simulated|normalized|normalised|marginal|frequency|density)\s+){0,2}histograms?\s+(?:of|for|showing)\b)/iu;
function capHead(text){
 const m=norm(text).replace(/^((?:Fig(?:ure)?\.?)\s*[sS]?\d{1,3})\s*\((?:colou?r online|online colou?r)\)(?=\s*[.:])/i,'$1').match(CAP);
 if(!m)return null;
 const id=(m[3]||m[5]).replace(/\s/g,'').toUpperCase();
 const lead=m[1]||m[4]||'';
 const tag=/extended|扩展/i.test(lead)?'ED'+id:/supplement|补充|附/i.test(lead)&&!id.startsWith('S')?'S'+id:id;
 return {label:m[0],matchKey:'F:'+tag,tag};
}
function captions(lines,p){
 const found=[];
 // A wrapped sentence can put its figure reference at the beginning of a line.
 const wrapped=new Set();
 for(const line of lines.filter(l=>capHead(l.text))){
  const previous=lines.findLast(l=>l.base<line.base-2&&line.base-l.base<=line.size*1.65&&
   Math.abs(l.x0-line.x0)<line.size&&close(l.size,line.size,line.size*.15));
  if(previous&&/\b(?:in|see|as in|shown in|used in|of|from|compare with)\s*$/i.test(previous.text))wrapped.add(line);
 }
 for(let idx=0;idx<lines.length;idx++){
  const line=lines[idx], name=capHead(line.text);
  if(!name||wrapped.has(line))continue;
  const chunks=[line.text];
  let firstExtent=line;
  if(/^fig(?:ure)?\.?\s*[sS]?\d+\s*(?:\((?:colou?r online|online colou?r)\))?\s*[.:]$/i.test(line.text)){
   const onRow=lines.filter(t=>t!==line&&Math.abs(t.base-line.base)<line.size*.22&&t.x0>=line.x1&&t.x0-line.x1<line.size*4&&
    close(t.size,line.size,line.size*.2)&&!capHead(t.text));
   if(onRow.length===1){chunks[0]+=' '+onRow[0].text;firstExtent={...line,x1:onRow[0].x1,text:chunks[0]}}
  }
  let prev=firstExtent, endY=line.y1;
  for(let k=1;k<=16;k++){
   const captionSize=x=>close(x.size,line.size,Math.max(1.1,line.size*.18))||close(x.bodySize,line.size,Math.max(.6,line.size*.10));
   // A small-caps figure number and the following caption can use different
   // fonts. Continue an unfinished sentence at the size of its actual prose.
   const continuesProse=x=>line.bodySize&&!/[.!?。！？]$/.test(prev.text)&&
     close(x.size,line.bodySize,.65)&&Math.abs(x.x0-line.x0)<=line.bodySize&&
     x.base-prev.base>2&&x.base-prev.base<=line.bodySize*1.5&&/^[\p{Ll}(\d]/u.test(x.text);
   let next=lines.find(x=>x.base>prev.base+2&&x.base-prev.base<=Math.max(16,prev.size*1.57)&&captionSize(x)&&
    (Math.abs(x.x0-prev.x0)<=Math.max(4,line.size*.86)||(k===1&&x.x0>=line.x0&&x.x0-line.x0<line.size*6)||
      (k===1&&x.x0<line.x0&&line.x0-x.x0<line.size*2.4&&Math.abs(x.x1-line.x1)<line.size*2.5&&!/[.!?]$/.test(prev.text)&&(/[-,]$/.test(prev.text)||/^[a-z]/.test(x.text)))));
   if(!next)next=lines.find(continuesProse);
   if(!next&&!/[.!?]$/.test(prev.text)&&/\((?:right|left)(?:[- ]hand)?\s+(?:y[- ]?)?axis\)/i.test(prev.text)){
    const neighbour=lines.find(x=>x.base>prev.base+2&&x.x0<prev.x1&&x.x1>prev.x0);
    if(neighbour&&neighbour.base-prev.base<=prev.size*2.6&&Math.abs(neighbour.x0-line.x0)<line.size&&
       DualAxis.explicitSides([...chunks,neighbour.text].join(' ')).length===2)next=neighbour;
   }
   if(!next||(!wrapped.has(next)&&(capHead(next.text)||
      /^(?:fig(?:ure)?\b|table\b|图\s*\d|表\s*\d|references$|results$|discussion$|methods$|摘要$|结果$|讨论$|方法$)/iu.test(next.text)))||
      !(captionSize(next)||continuesProse(next)))break;
   if(chunks.join(' ').length+next.text.length>2400)break;
   // A short complete line followed by a paragraph at body spacing is not a verified continuation.
   if(/[.!?。！？]$/.test(k===1?chunks[0]:prev.text)&&((prev.base+line.size*1.35)<next.base||w(prev)<Math.min(p.width*.18,95))){
    const priorLabels=[...chunks.join(' ').matchAll(/(?:^|[.;。]\s+)([a-z])\s+(?=[A-Z])/g)];
    const nextLabel=next.text.match(/^([a-z])\s+(?=[A-Z])/);
    const firstPanel=k===1&&nextLabel?.[1]==='a'&&Math.abs(next.x0-line.x0)<3&&next.base-prev.base<line.size*1.7;
    if(!firstPanel&&(!nextLabel||!priorLabels.length||nextLabel[1].charCodeAt(0)!==priorLabels.at(-1)[1].charCodeAt(0)+1))break;
   }
   let continued=next.text;
   for(let end=next.x1;end< p.width;){
    const power=lines.find(t=>t!==next&&/^[−+-]?\d{1,2}$/.test(t.text)&&t.size<next.size*.85&&
     next.base-t.base>next.size*.18&&next.base-t.base<next.size*.72&&Math.abs(t.x0-end)<next.size*.4);
    if(!power)break;
    const tail=lines.find(t=>t!==next&&Math.abs(t.base-next.base)<.6&&t.x0>=power.x1-.5&&t.x0-power.x1<next.size*.8);
    if(!tail||tail.x1<=end)break;
    const superscript={'−':'⁻','-':'⁻','+':'⁺','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
    continued+=Array.from(power.text,v=>superscript[v]).join('')+' '+tail.text;end=tail.x1;
   }
   chunks.push(continued);prev=next;endY=Math.max(endY,next.y1);
  }
  // Some journals continue a wide figure's caption at the top of the right column.
  // Require an unfinished left sentence, aligned type and the next panel heading.
  const startLabels=s=>[...s.matchAll(/(?:^|[.;。]\s+)([a-z])\s+(?=[A-Z])/g)].map(m=>m[1]);
  const suffixLabels=s=>Array.from(s.matchAll(/\bin\s*\(\s*([a-z])\s*\)/g),m=>m[1]);
  const suffix=suffixLabels(chunks.join(' ')),leading=startLabels(chunks.join(' '));
  const trailing=!leading.length&&suffix[0]==='a', labels=trailing?suffix:leading;
  if(chunks.length>2&&(labels.length>=2||trailing)&&line.x0<p.width*.35&&line.x1<p.width*.56&&!/[.!?。！？]$/.test(prev.text)){
   const first=lines.filter(r=>r.x0>p.width*.47&&r.x0<p.width*.65&&r.x0>line.x1&&Math.abs(r.base-line.base)<line.size*.5);
   if(first.length===1&&(/^[a-z]/.test(first[0].text)||trailing)){
    const other=lines.filter(r=>Math.abs(r.x0-first[0].x0)<line.size*.9&&r.base>=first[0].base&&r.y0<=endY+line.size&&close(r.size,line.size,line.size*.16));
    const continuation=[];
    for(const r of other){
     if(capHead(r.text)||(continuation.length&&r.base-continuation.at(-1).base>line.size*1.7))break;
     continuation.push(r);
    }
    const text=continuation.map(r=>r.text).join(' '),nextLabel=String.fromCharCode(labels.at(-1).charCodeAt(0)+1);
    if((trailing?suffixLabels(text)[0]===nextLabel:startLabels(text).includes(nextLabel))){chunks.push(text);endY=Math.max(endY,continuation.at(-1).y1)}
   }
  }
  // Two parallel caption columns can meet mid-sentence (including a list of colours).
  if(line.text.includes('|') && line.x0<p.width*.28 && line.x1<p.width*.53 &&
     chunks.some(t=>/^a\s+[A-Z]/.test(t)) && /[,;\-]$/.test(chunks.at(-1))){
   const right=lines.find(t=>Math.abs(t.base-line.base)<1 && t.x0>p.width*.47 && t.x0<p.width*.62 &&
      close(t.size,line.size,.55)&&t.x1-t.x0>p.width*.2);
   if(right){
    const parts=[right];let last=right;
    for(const t of lines){
     if(t.base<=last.base+2||t.base-line.base> endY-line.y0+2||Math.abs(t.x0-right.x0)>3||!close(t.size,right.size,.65))continue;
     if(t.base-last.base>line.size*1.75||capHead(t.text))break;
     parts.push(t);last=t;
    }
    const continuation=parts.map(t=>t.text).join(' ');
    if(/\bb\s+[A-Z]/.test(continuation)&&!chunks.join(' ').includes(right.text))chunks.push(continuation);
   }
  }
  const columns=window.CompositePlate?.columnCaption(line,lines,p);
  const caption=columns?.text||chunks.join(' ');
  if(columns)endY=columns.endY;
  found.push({...name,caption,partial:!/[.!?。！？][”")\]]?$/.test(caption),line,anchor:{x:line.x0,y:line.y0,endY,line:idx+1}});
 }
 return found;
}
function drawings(list,ops,V){
 if(list.fnArray.length>MAX_OPS)return [];
 const paints=new Set([ops.stroke,ops.closeStroke,ops.fill,ops.eoFill,ops.fillStroke,ops.eoFillStroke,ops.closeFillStroke,ops.closeEOFillStroke]);
 const rast=new Set([ops.paintImageXObject,ops.paintInlineImageXObject,ops.paintImageMaskXObject]);
 const output=[], stack=[];
 let T=UNIT, opacity=1;
 const push=()=>stack.push([T,opacity]);
 const pop=()=>{if(stack.length)[T,opacity]=stack.pop();};
 const add=(m,b,kind,path,stroke=false)=>{
  if(output.length>=MAX_GRAPHICS||opacity<.03)return;
  const q=boxFrom(mult(V,m),b);
  if(!Object.values(q).every(Number.isFinite))return;
  let barRect;
  if(path&&path.length===13&&path[0]===0&&path[3]===1&&path[6]===1&&path[9]===1&&path[12]===4&&
     ((path[2]===path[5]&&path[4]===path[7]&&path[8]===path[11]&&path[10]===path[1])||
      (path[1]===path[4]&&path[5]===path[8]&&path[7]===path[10]&&path[11]===path[2]))){
   const axes=mult(V,m);
   if((!axes[1]&&!axes[2])||(!axes[0]&&!axes[3]))barRect={...q};
  }
  const vertical=stroke&&path?.length===6&&path[0]===0&&path[3]===1&&w(q)<.09;
  if(kind==='vec'){
   if(w(q)<.8){q.x0-=.5;q.x1+=.5;}if(h(q)<.8){q.y0-=.5;q.y1+=.5;}
   if(w(q)<2&&h(q)<2)return;
  }
  output.push(barRect?{...q,kind,barRect}:vertical?{...q,kind,stroke:true}:{...q,kind});
 };
 for(let i=0;i<list.fnArray.length;i++){
  const op=list.fnArray[i], a=list.argsArray[i]||[];
  if(op===ops.save)push();
  else if(op===ops.restore)pop();
  else if(op===ops.transform&&numArray(a,6))T=mult(T,a);
  else if(op===ops.paintFormXObjectBegin){push();if(numArray(a[0],6))T=mult(T,a[0]);}
  else if(op===ops.paintFormXObjectEnd)pop();
  else if(op===ops.setGState&&Array.isArray(a[0])){
   for(const s of a[0])if(Array.isArray(s)&&s[0]==='ca'&&Number.isFinite(s[1]))opacity=s[1];
  }
  else if(rast.has(op))add(T,[0,0,1,1],'image');
  else if(op===ops.constructPath&&paints.has(a[0])&&numArray(a[2],4))add(T,a[2],'vec',a[1]?.length===1?a[1][0]:null,a[0]===ops.stroke);
 }
 return output.length>=MAX_GRAPHICS?[]:output;
}
function columnAt(lines,cap,W){
 const useful=lines.filter(l=>l.text.length>=16&&w(l)>W*.105);
 const left=useful.filter(l=>l.x0<W*.30&&l.x1<W*.57);
 const right=useful.filter(l=>l.x0>W*.44&&l.x1>W*.59);
 if(left.length<3||right.length<3)return null;
 // Infer an actual gutter from positioned text, not from text stream order.
 const lx=left.map(l=>l.x1).sort((a,b)=>a-b);
 const rx=right.map(l=>l.x0).sort((a,b)=>a-b);
 const edgeL=lx[Math.floor((lx.length-1)*.78)], edgeR=rx[Math.floor((rx.length-1)*.23)];
 if(edgeR-edgeL<11||edgeR-edgeL>W*.36)return null;
 const split=(edgeL+edgeR)/2;
 if(cap.x0>=split-3)return {side:'right',split};
 if(cap.x1<=split+10)return {side:'left',split};
 return {side:'span',split};
}
function cropFor(cap,lines,objs,viewport,priorCaps){
 const W=viewport.width,H=viewport.height,c=cap.line;
 let column=columnAt(lines,c,W);
 // A large, nearby raster that explicitly spans the gutter can anchor a full-width composite,
 // even if the first caption line is short. Text-contamination checks still apply.
 const spanImage=objs.find(q=>q.kind==='image'&&w(q)>=W*.64&&h(q)>=H*.13&&q.x0<W*.24&&q.x1>W*.76&&
  c.y0-q.y1>=-3&&c.y0-q.y1<=30&&Math.abs(q.x0-c.x0)<W*.13);
 if(column?.side==='left'&&spanImage)column={side:'span',split:column.split};
 const minTop=Math.max(H*.02,c.y0-Math.min(H*.65,465));
 const separation=q=>c.y0-q.y1;
 const inVertical=q=>q.y0>=minTop-2&&q.y0<c.y0-9&&q.y1<=c.y0+3&&q.y1>=c.y0-Math.min(H*.55,370);
 const pageArea=W*H;
 const regular=q=>inVertical(q)&&q.x0>=-4&&q.x1<=W+4&&w(q)<W*.97&&area(q)<pageArea*.55;
 const crosses=q=>column?.side==='left'?q.x1>column.split+7:column?.side==='right'?q.x0<column.split-7:false;
 const sane=objs.filter(regular);
 const inLane=sane.filter(q=>!crosses(q)||column?.side==='left'&&q.kind==='image'&&w(q)>W*.66&&Math.abs(q.x0-c.x0)<W*.11);
 const usableSeed=q=>separation(q)<=Math.max(47,c.size*4.3)&&
   (q.kind==='image'?w(q)>=W*.12&&h(q)>=H*.06&&area(q)>=pageArea*.009:w(q)>=W*.022&&h(q)>=H*.023);
 let seeds=inLane.filter(usableSeed);
 if(!seeds.length)return null;
 const score=q=>Math.max(0,separation(q))*.75+Math.min(W*.32,Math.abs(q.x0-c.x0))*.18-(q.kind==='image'?9:0);
 seeds=seeds.sort((a,b)=>score(a)-score(b));
 const seed=seeds[0], group=new Set([seed]);let union={...seed}, pass=0;
 function adjacency(a,b){
  const ox=overlap(a.x0,a.x1,b.x0,b.x1),oy=overlap(a.y0,a.y1,b.y0,b.y1);
  const gx=gap(a.x0,a.x1,b.x0,b.x1),gy=gap(a.y0,a.y1,b.y0,b.y1);
  return (ox>=Math.min(w(a),w(b),3)&&gy<=20)||(oy>=Math.min(h(a),h(b),3)&&gx<=Math.min(34,W*.075))||(gx<3&&gy<3);
 }
 while(pass++<7){
  let added=0;
  for(const q of inLane){
   if(group.has(q)||!adjacency(union,q))continue;
   const total=unite(union,q);
   if(w(total)>W*.94||h(total)>H*.64)continue;
   union=total;group.add(q);added++;
  }
  if(!added)break;
 }
 if(w(union)<W*.15||h(union)<H*.055||area(union)<pageArea*.012||separation(union)>55)return null;
 if(!Array.from(group).some(q=>q.kind==='image'&&area(q)>pageArea*.009)&&
    Array.from(group).filter(q=>q.kind==='vec'&&h(q)>4&&w(q)>4).length<3)return null;
 // Adjacent same-lane contenders or cross-gutter painted marks make a partial crop unsafe.
 if(seeds.slice(1).some(q=>!group.has(q)&&score(q)-score(seed)<30&&gap(q.y0,q.y1,union.y0,union.y1)<28))return null;
 if(sane.some(q=>!group.has(q)&&column&&crosses(q)&&q.x0<column.split-10&&q.x1>column.split+10&&
     overlap(q.y0,q.y1,union.y0,union.y1)>Math.min(15,h(union)*.2)&&w(q)>W*.14&&h(q)>15))return null;
 if(priorCaps.some(x=>x!==cap&&x.line.y0<union.y1&&x.line.y1>=union.y0-12&&overlap(x.line.x0,x.line.x1,union.x0,union.x1)>13))return null;
 const relevant=l=>l!==c&&l.y0<c.y0-1&&l.y1>union.y0-12&&overlap(l.x0,l.x1,union.x0-15,union.x1+15)>3;
 const near=lines.filter(relevant);
 const body=near.filter(l=>l.text.length>42&&w(l)>w(union)*.55);
 if(body.some(l=>l.y0>=union.y1-4)||body.filter(l=>l.y0<=union.y1&&l.y1>=union.y0).length>1)return null;
 for(const l of near){
  if(l.text.length>44||capHead(l.text)||l.y0>=c.y0-3||l.y1<c.y0-240)continue;
  if(overlap(l.x0,l.x1,union.x0-13,union.x1+13)>2&&
     gap(l.y0,l.y1,union.y0,union.y1)<=14)union=unite(union,l);
 }
 const x0=clamp(union.x0-10,0,W), x1=clamp(union.x1+10,0,W);
 const y0=clamp(union.y0-8,0,H), y1=clamp(Math.min(c.y0,union.y1+8),0,H);
 if(x1-x0<W*.15||y1-y0<H*.055||(x1-x0)*(y1-y0)>pageArea*.68)return null;
 return {x0,y0,x1,y1};
}
function hasExplicitSides(caption){
 const left=caption.match(/\(\s*(?:left|左侧|左)\s*\)|（\s*(?:left|左侧|左)\s*）/giu)||[];
 const right=caption.match(/\(\s*(?:right|右侧|右)\s*\)|（\s*(?:right|右侧|右)\s*）/giu)||[];
 return left.length===1&&right.length===1;
}
function pairedCrop(cap,lines,objects,viewport,otherCaptions){
 const W=viewport.width,H=viewport.height,c=cap.line;
 // Only disconnected, large rendered raster regions can justify side identities.
 // Vector-only panels and ambiguous extra regions stay on the paper's original page.
 const candidates=objects.filter(q=>q.kind==='image'&&w(q)>W*.061&&h(q)>H*.052&&area(q)>W*H*.007&&
      q.y1<=c.y0+3&&q.y1>=c.y0-Math.min(89,H*.128)&&q.y0>=c.y0-H*.61&&q.x0>=0&&q.x1<=W);
 if(candidates.length!==2)return null;
 const [a,b]=candidates.sort((q,r)=>q.x0-r.x0), sep=b.x0-a.x1;
 if(sep<Math.max(20,W*.045)||sep>W*.42||c.y0-Math.max(a.y1,b.y1)>44||
   overlap(a.y0,a.y1,b.y0,b.y1)<Math.min(h(a),h(b))*.70)return null;
 const joined=unite(a,b);
 if(joined.x1-joined.x0<W*.27||joined.x1-joined.x0>W*.91||joined.y1-joined.y0>H*.58)return null;
 if(otherCaptions.some(q=>q!==cap&&q.line.y0<joined.y1+4&&q.line.y1>joined.y0-24&&
  overlap(q.line.x0,q.line.x1,joined.x0,joined.x1)>20))return null;
 const near=lines.filter(l=>l!==c&&l.y0<c.y0-2&&l.y1>joined.y0-28&&
  overlap(l.x0,l.x1,joined.x0-25,joined.x1+25)>4);
 let A={...a},B={...b};
 const split=(a.x1+b.x0)/2;
 for(const l of near){
  const touchesA=overlap(l.x0,l.x1,a.x0-20,a.x1+20)>4&&gap(l.y0,l.y1,a.y0,a.y1)<=25;
  const touchesB=overlap(l.x0,l.x1,b.x0-20,b.x1+20)>4&&gap(l.y0,l.y1,b.y0,b.y1)<=25;
  if(touchesA&&touchesB||overlap(l.x0,l.x1,a.x0-20,b.x1+20)>W*.26&&l.text.length>45)return null;
  if(capHead(l.text))return null;
  if(touchesA&&l.x1<split-3)A=unite(A,l);
  if(touchesB&&l.x0>split+3)B=unite(B,l);
 }
 if(B.x0-A.x1<14)return null;
 // Large third graphics or a painted path across the confirmed blank split imply ambiguity.
 if(objects.some(q=>!candidates.includes(q)&&q.y0<joined.y1+4&&q.y1>joined.y0-9&&
   (q.kind==='image'&&area(q)>W*H*.007&&w(q)>W*.06||
    q.x0<split-8&&q.x1>split+8&&w(q)>W*.074&&h(q)>7)))return null;
 const pad=q=>({x0:clamp(q.x0-9,0,W),y0:clamp(q.y0-8,0,H),
   x1:clamp(q.x1+9,0,W),y1:clamp(Math.min(c.y0,q.y1+8),0,H)});
 const left=pad(A),right=pad(B);
 if(left.x1>=right.x0-3)return null;
 const crop=unite(left,right);
 return {crop,panels:[
   {position:'left',label:'左侧（原文 left）',rect:left},
   {position:'right',label:'右侧（原文 right）',rect:right}
 ]};
}
function normalized(rect,region){
 return {x:(rect.x0-region.x0)/w(region),y:(rect.y0-region.y0)/h(region),width:w(rect)/w(region),height:h(rect)/h(region)};
}
function cleanTitle(meta){
 const title=norm(meta?.metadata?.get?.('dc:title')||meta?.info?.Title||'');
 if(title.length<6||title.length>250||/^(?:untitled|document|manuscript|microsoft word)$/i.test(title)||/\.pdf$/i.test(title))return '';
 return title;
}
function toPNG(canvas){
 return new Promise((ok,no)=>canvas.toBlob(b=>b?ok(b):no(Error('浏览器不能生成 PNG 预览。')),'image/png'));
}
function hasContent(ctx,width,height){
 try{
  const p=ctx.getImageData(0,0,width,height).data;
  const step=4*Math.max(1,Math.floor(width*height/18000));let dark=0;
  for(let i=0;i<p.length;i+=step)if(p[i+3]>12&&Math.min(p[i],p[i+1],p[i+2])<239&&++dark>5)return true;
  return false;
 }catch{return true;}
}
async function scan(file,options={}){
 const signal=options?.signal, check=()=>{if(signal?.aborted)throw stop();};
 check();
 if(!file||typeof file.arrayBuffer!=='function'||!Number.isFinite(file.size)||file.size<6)throw Error('请选择一个可打开的 PDF 文件。');
 if(file.size>MAX_FILE)throw Error('原图提取只支持 64 MiB 以内的 PDF；请选择原文相关页面的副本。');
 const bytes=new Uint8Array(await file.arrayBuffer());check();
 if(!/%PDF-\d/.test(new TextDecoder('latin1').decode(bytes.subarray(0,1024))))throw Error('没有找到 PDF 文件头。');
 const pdfjs=await (library ||= import(new URL('pdf.min.mjs',base).href).catch(e=>{library=null;throw e;}));check();
 pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',base).href;
 const task=pdfjs.getDocument({data:bytes,cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,
   standardFontDataUrl:new URL('standard_fonts/',base).href,wasmUrl:new URL('wasm/',base).href,useWasm:false,
   isEvalSupported:false,disableFontFace:true,useSystemFonts:false,enableXfa:false,
   disableAutoFetch:true,disableStream:true,disableRange:true,stopAtErrors:false});
 let disposed=false, activeRender=null, queue=Promise.resolve();
 async function destroy(){
  if(disposed)return;disposed=true;signal?.removeEventListener('abort',abort);
  if(activeRender)try{activeRender.cancel();}catch{}
  await task.destroy().catch(()=>{});
 }
 function abort(){void destroy();}
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 try{
  const pdf=await task.promise;check();
  let documentTitle='';
  try{documentTitle=cleanTitle(await pdf.getMetadata());}catch{check();}
  const pageCap=clamp(Math.floor(Number(options?.maxPages)||DEFAULT_PAGES),1,MAX_PAGES);
  const figures=[],tables=[],internals=new Map(),seen=new Map(),unlabelledPages=[],noTextPages=[],warnings=[], failed=[];
  const hubblePassages=[];
  let scannedPages=0, usedDrawings=0,unclaimed=null;
  for(let pg=1;pg<=Math.min(pageCap,pdf.numPages)&&figures.length<MAX_FIGURES;pg++){
   check();scannedPages=pg;let page;
   const previous=unclaimed;unclaimed=null;
   try{
    page=await pdf.getPage(pg);
    const viewport=page.getViewport({scale:1});
    const text=await page.getTextContent({disableNormalization:false});check();
    if(!text.items.some(x=>typeof x.str==='string'&&x.str.trim()))noTextPages.push(pg);
    const lines=positions(text,viewport), here=captions(lines,viewport);
    if(lines.some(l=>/^Table\s+\d+\b/i.test(l.text))&&!(page.rotate%360)){
     tables.push(...DualAxis.readTables(positions(text,viewport,true),pg,viewport));
    }
    if(pg===1&&!documentTitle){
     const pool=lines.filter(l=>l.y0>viewport.height*.035&&l.y0<viewport.height*.42&&
      l.text.length>16&&l.text.length<210&&!/https?:|@|doi:|copyright|journal of|submitted/i.test(l.text));
     pool.sort((a,b)=>b.size-a.size||a.y0-b.y0);
     if(pool.length){
      const first=pool[0], parts=[first.text];
      let last=first;
      // Consecutive title lines must share type size and a column or centre line.
      for(const line of lines.slice(lines.indexOf(first)+1)){
       if(parts.length>=4 || Math.abs(line.size-first.size)>first.size*.06 ||
          line.base-last.base<first.size*.65 || line.base-last.base>first.size*1.65)break;
       const aligned=Math.abs(line.x0-first.x0)<first.size ||
         Math.abs(line.x0+line.x1-first.x0-first.x1)<2*first.size;
       if(!aligned || line.text.length<3 || /@|https?:/i.test(line.text) || parts.join(' ').length+line.text.length>240)break;
       parts.push(line.text);last=line;
      }
      documentTitle=parts.join(' ');
     }
    }
    hubblePassages.push(...HubbleReading.evidence(lines,pg));
    if(!here.length){
     unlabelledPages.push(pg);
     if(!(page.rotate%360)&&text.items.length<=MAX_TEXT_ITEMS)unclaimed={pg,lines,viewport,words:positions(text,viewport,true),axes:verticalLabels(text,viewport)};
     continue;
    }
    let objects=[],curvePaths=[];
    if(usedDrawings<MAX_GRAPHIC_PAGES&&((page.rotate??0)%360===0)&&text.items.length<=MAX_TEXT_ITEMS){
     usedDrawings++;
     try{
      const list=await page.getOperatorList({annotationMode:pdfjs.AnnotationMode.DISABLE});
      objects=drawings(list,pdfjs.OPS,viewport.transform);
      if(list.fnArray.length<=MAX_OPS)curvePaths=CurveReading.paths(list,pdfjs.OPS,viewport.transform,{mult,at,boxFrom});
     }
     catch{check();}
    }
    const words=positions(text,viewport,true),axes=verticalLabels(text,viewport);
    for(const cap of here){
     if(figures.length>=MAX_FIGURES)break;
     const digest=cap.matchKey+'\n'+cap.caption.toLowerCase();
     if(seen.has(digest)){
      const d=seen.get(digest);if(!d.duplicatePages.includes(pg)&&pg!==d.captionPage)d.duplicatePages.push(pg);
      continue;
     }
     const pair=hasExplicitSides(cap.caption)?pairedCrop(cap,lines,objects,viewport,here)||
       window.PaperPanelGeometry?.pairedAxes(cap,here,axes,words,objects,viewport):null;
     const initial=hasExplicitSides(cap.caption)?pair?.crop??null:objects.length?cropFor(cap,lines,objects,viewport,here):null;
     const grid=pair?null:window.PaperPanelGeometry?.detect(cap,here,words,lines,viewport,initial);
     const printed=window.PaperPanelGeometry?.printedTitles(cap,here,lines,viewport,words,objects)||[];
     if(!grid&&!pair)await window.PaperPanelGeometry?.includePrintedMargins(printed,page,viewport,pdfjs.AnnotationMode.DISABLE,words).catch(()=>{});
     let crop=grid?.crop||initial;
     for(const p of printed)if(p.rect)crop=crop?unite(crop,p.rect):p.rect;
     const stack=await MarkedPlots.locate(cap,objects,words,page,viewport,pdfjs.AnnotationMode.DISABLE).catch(()=>null);
     if(stack)crop=stack.crop;
     const layers=!stack&&await StackedPlots.locate(cap,crop,objects,words,page,viewport,pdfjs.AnnotationMode.DISABLE).catch(()=>null);
     if(layers)crop=layers.crop;
     let plate=null;
     let raster=null;
     if(!grid&&!pair&&!stack&&!layers&&!printed.some(p=>p.rect)&&here.length===1&&cap.line.y0>viewport.height*.22){
       raster=await window.CompositePlate?.locate(page,viewport,lines,cap,false,pdfjs.AnnotationMode.DISABLE).catch(()=>null);
       check();if(raster)crop=raster.crop;
     }
     if(!crop&&previous&&cap===here[0]&&cap.line.y0<viewport.height*.16&&usedDrawings<MAX_GRAPHIC_PAGES){
      let earlier;
      try{
       earlier=await pdf.getPage(previous.pg);usedDrawings++;
       const marks=drawings(await earlier.getOperatorList({annotationMode:pdfjs.AnnotationMode.DISABLE}),pdfjs.OPS,previous.viewport.transform);
       plate=window.PaperPanelGeometry?.precedingPlate(cap.caption,previous,marks);
       if(!plate&&(!marks.length||marks.some(q=>q.kind==='image'&&area(q)>previous.viewport.width*previous.viewport.height*.05)))
         plate=await window.CompositePlate?.locate(earlier,previous.viewport,previous.lines,cap,true,pdfjs.AnnotationMode.DISABLE);
      }catch{check()}finally{earlier?.cleanup()}
     }
     const imagePage=plate?previous.pg:pg,imageView=plate?previous.viewport:viewport;
     if(plate)crop=plate.crop;
     const id=cap.matchKey+'@'+pg+':'+cap.anchor.line;
     const panels=(layers?.panels??stack?.panels??plate?.panels??pair?.panels??grid?.panels??raster?.panels??[]).map(panel=>{
      const pId=id+':'+panel.position;
      internals.set(pId,{page:imagePage,crop:panel.rect});
      const printedAxis=panel.axis||window.PaperPanelGeometry?.axisIn(panel.rect,plate?previous.axes:axes,plate?previous.words:words);
      const mic=panel.rect&&!plate?PaperPanelReading.micTable(words,panel.rect):null;
      return {id:pId,label:panel.label,position:panel.position,title:panel.title,markerBox:panel.markerBox,bbox:normalized(panel.rect,crop),bboxSpace:'figure-crop',axis:printedAxis,curveLabels:panel.curveLabels,mic};
     });
     for(const label of plate?[]:printed){
      const existing=panels.find(p=>p.position===label.position);
      if(existing){existing.title||=label.title;existing.titleAnchor=label.titleAnchor}
      else{
       const pId=id+':'+label.position;
       if(label.rect)internals.set(pId,{page:pg,crop:label.rect});
       panels.push({...label,id:pId,bbox:label.rect?normalized(label.rect,crop):null});
      }
     }
     const figure={id,rasterPlate:Boolean(raster||plate?.raster),matchKey:cap.matchKey,label:cap.label,layerStack:layers?{rows:layers.rows,horizontal:layers.horizontal,ticks:layers.ticks,shared:normalized(layers.shared,{x0:0,y0:0,x1:imageView.width,y1:imageView.height})}:null,markedStack:stack?{first:stack.first,rows:stack.rows}:null,
      page:imagePage,captionPage:pg,caption:cap.caption,captionPartial:cap.partial,anchor:{page:pg,...cap.anchor},panels,pageBox:crop?normalized(crop,{x0:0,y0:0,x1:imageView.width,y1:imageView.height}):null,mode:crop?'crop':'page',duplicatePages:[],
      reason:plate?'前页图内编号与本页图注编号吻合，已定位跨页图版。':crop?'按明确图注和紧邻版面选取的原文区域。':'已定位图注，图形范围待核对。'};
     if(!plate&&!pair&&/\bhistograms?\b/i.test(cap.caption)){
      const open=window.OpenHistograms?.locate(cap,here,words,verticalLabels(text,viewport,true),lines,objects,viewport);
      if(open&&await window.OpenHistograms.confirmInk(page,open,pdfjs.AnnotationMode.DISABLE).catch(()=>{open.cells.forEach(c=>c.edgeCheck=true);return !open.needsPixels})){
       const b=figure.pageBox,q=open.box;
       if(!panels.some(p=>p.bbox)||b&&q.x>=b.x&&q.y>=b.y&&q.x+q.width<=b.x+b.width&&q.y+q.height<=b.y+b.height)figure.openHistogram=open;
      }
     }
     if(!plate&&crop&&curvePaths.length){
      const vertical=text.items.filter(t=>t.str?.trim()&&t.transform&&Math.abs(t.transform[1])>10*Math.abs(t.transform[0]))
       .map(t=>({text:t.str,...boxFrom(mult(viewport.transform,t.transform),[0,-.2,t.width/Math.hypot(...t.transform.slice(0,2)),.9])}));
      const withAxes=!panels.length?CurveRatio.includeAxes(crop,vertical):crop;
      figure.curveChart=CurveReading.detect(curvePaths,words,vertical,withAxes,layers?.rows,cap.caption);
      if(figure.curveChart&&withAxes!==crop){
       crop=withAxes;figure.pageBox=normalized(crop,{x0:0,y0:0,x1:imageView.width,y1:imageView.height});
      }
     }
     if(!plate&&(figure.curveChart?.plots.length||0)<2&&!panels.length&&!stack&&!layers&&!figure.openHistogram){
      const passages=MixedAxes.captionRows(cap.caption);
      if(passages){
       const pair=MixedAxes.framePair(cap,objects,lines,viewport,columnAt(lines,cap.line,viewport.width))||
         await ResidualReading.rasterPair(cap,objects,page,viewport,pdfjs.AnnotationMode.DISABLE).catch(()=>null);
       if(pair&&!crop){
        crop=pair.crop;figure.mode='crop';figure.pageBox=normalized(crop,{x0:0,y0:0,x1:viewport.width,y1:viewport.height});
        figure.reason='上下两组坐标框与本栏图注对齐。';
       }
       const aligned=pair&&crop&&pair.frames.every(f=>f.x0>=crop.x0&&f.x1<=crop.x1&&f.y0>=crop.y0&&f.y1<=crop.y1);
       const frames=aligned?pair.frames.map(f=>normalized(f,crop)):null;
       const trace=figure.curveChart?.plots[0]?.frame;
       const traceRow=trace&&frames?frames.findIndex(f=>['x','y','width','height'].every(k=>Math.abs(f[k]-trace[k])<.015)):-1;
       if(!trace||traceRow>=0)figure.captionRows={passages,frames,traceRow,ticks:pair?.ticks||null};
      }
     }
     if(!plate&&!figure.captionRows&&!panels.length&&!/\b(?:residuals?|upper|lower|bottom|top panel)\b/i.test(cap.caption)){
      const single=HubbleReading.locate(cap,curvePaths,viewport);
      if(single){
       const list=await page.getOperatorList({annotationMode:pdfjs.AnnotationMode.DISABLE});
       const dots=HubbleReading.symbols(list,pdfjs.OPS,viewport.transform,single,{mult,boxFrom});
       if(dots.length>=8){
        crop=single.crop;figure.mode='crop';figure.pageBox=normalized(crop,{x0:0,y0:0,x1:viewport.width,y1:viewport.height});
        figure.singleHubble={...single,dots,caption:{text:cap.caption,page:pg},excluded:cap.caption.match(/\b(SN [A-Z0-9]+) falls outside[^.]+excluded/i)?.[1]};
       }
      }
     }
     figures.push(figure);internals.set(id,{page:imagePage,crop});seen.set(digest,figure);
    }
   }catch(e){check();failed.push(pg);}
   finally{if(page)try{page.cleanup();}catch{}}
  }
  for(const f of figures.filter(f=>f.singleHubble)){
   f.singleHubble.story=hubblePassages.find(p=>p.key===f.matchKey);
   const signs=hubblePassages.filter(p=>p.kind==='sign'&&p.page<=f.page&&f.page-p.page<=4);
   if(signs.length===1)f.singleHubble.sign=signs[0];
  }
  DualAxis.attach(figures,tables);
  if(scannedPages<pdf.numPages)warnings.push('图注只检查了前 '+scannedPages+' / '+pdf.numPages+' 页。');
  if(noTextPages.length)warnings.push('其中 '+noTextPages.length+' 页没有可读文字层；仅可查看原页，不识别图注或面板。');
  if(failed.length)warnings.push('有 '+failed.length+' 页未能读取图注；可打开原文页核对。');
  if(!figures.length)warnings.push('未找到可以确认的编号图注。不会据图片或正文猜测图号。');
  async function paint(pageNumber,crop,quality='screen'){
   check();if(disposed)throw stop();
   const page=await pdf.getPage(pageNumber);let canvas;
   try{
    const unit=page.getViewport({scale:1}), region=crop||{x0:0,y0:0,x1:unit.width,y1:unit.height};
    const rw=w(region),rh=h(region);
    if(!Number.isFinite(rw)||!Number.isFinite(rh)||rw<=.2||rh<=.2)throw Error('原页尺寸无法预览。');
    const desired=quality==='slide'?Math.min(12,Math.max(2.25,1500/Math.max(rw,rh))):crop?2.25:1.7;
    const scale=Math.min(desired,Math.sqrt(3400000/(rw*rh)),2100/Math.max(rw,rh));
    const width=Math.max(1,Math.ceil(rw*scale)),height=Math.max(1,Math.ceil(rh*scale));
    canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:!!crop});if(!ctx)throw Error('当前浏览器无法生成图片。');
    const args={canvasContext:ctx,canvas,viewport:page.getViewport({scale}),annotationMode:pdfjs.AnnotationMode.DISABLE,background:'#ffffff'};
    if(crop)args.transform=[1,0,0,1,-crop.x0*scale,-crop.y0*scale];
    activeRender=page.render(args);await activeRender.promise;activeRender=null;check();if(disposed)throw stop();
    if(crop&&!hasContent(ctx,width,height))return null;
    const blob=await toPNG(canvas);check();if(disposed)throw stop();
    return {blob,width,height,mode:crop?'crop':'page',page:pageNumber};
   }finally{
    activeRender=null;
    if(canvas)canvas.width=canvas.height=0;
    try{page.cleanup();}catch{}
   }
  }
  function serialized(fn){
   const p=queue.then(fn,fn);queue=p.catch(()=>{});return p;
  }
  return {
   figures,unlabelledPages,noTextPages,scannedPages,totalPages:pdf.numPages,documentTitle,warnings,
   render(figureOrId,{forcePage=false}={}){
    const id=typeof figureOrId==='string'?figureOrId:figureOrId?.id, ref=internals.get(id);
    if(!ref)return Promise.reject(Error('无法定位这张图的原文页。'));
    return serialized(async()=>{
     if(!forcePage&&ref.crop){const cropped=await paint(ref.page,ref.crop);if(cropped)return cropped;}
     return paint(ref.page,null);
    });
   },
   renderPage(page){
    if(!Number.isSafeInteger(page)||page<1||page>pdf.numPages)return Promise.reject(Error('PDF 页码不在范围内。'));
    return serialized(()=>paint(page,null));
   },
   async chartText(n,b){
    check();const pg=await pdf.getPage(n),v=pg.getViewport({scale:1}),txt=await pg.getTextContent();
    const width=b.width*v.width,height=b.height*v.height,x=b.x*v.width,y=b.y*v.height;
    return positions(txt,v,true).concat(verticalLabels(txt,v).map(t=>({...t,rotate:true})))
      .filter(t=>t.x0>=x-1&&t.x1<=x+width+1&&t.y0>=y-1&&t.y1<=y+height+1)
      .map(t=>({text:t.text,rotate:!!t.rotate,x0:(t.x0-x)/width,x1:(t.x1-x)/width,y0:(t.y0-y)/height,y1:(t.y1-y)/height}));
   },
   async locateExcerpt(n,quote){
    check();if(disposed)return null;
    const page=await pdf.getPage(n),view=page.getViewport({scale:1});
    const lines=positions(await page.getTextContent(),view);
    const compact=t=>t.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
    const text=compact(quote),values=lines.map(l=>compact(l.text));
    // Match a unique sequence near the start of the cited passage, even mid-line.
    for(let start=0;start<=Math.min(70,text.length-18);start++){
      const fragment=text.slice(start,start+24);
      if(fragment.length<18)break;
      const i=values.findIndex(v=>v.includes(fragment));
      if(i<0||values.some((v,j)=>j!==i&&v.includes(fragment)))continue;
      const l=lines[i];
      return {x:l.x0/view.width,y:l.y0/view.height,width:w(l)/view.width,height:h(l)/view.height};
    }
    return null;
   },
   // Caller-provided, visually verified page coordinates. Never identifies a panel on its own.
   renderRegion(page,bounds,{quality='screen'}={}){
    const {x,y,width,height}=bounds??{};
    if(!Number.isSafeInteger(page)||page<1||page>pdf.numPages||
      ![x,y,width,height].every(Number.isFinite)||x<0||y<0||width<=0||height<=0||x+width>1.000000001||y+height>1.000000001)
     return Promise.reject(Error('所选原文区域超出该页范围。'));
    return serialized(async()=>{
     check();if(disposed)throw stop();
     const original=await pdf.getPage(page),view=original.getViewport({scale:1});
     const region={x0:x*view.width,y0:y*view.height,x1:Math.min(1,x+width)*view.width,y1:Math.min(1,y+height)*view.height};
     try{original.cleanup();}catch{}
     const result=await paint(page,region,quality);
     if(result)return {...result,provenance:'explicit-region'};
     return paint(page,null);
    });
   },
   destroy
  };
 }catch(e){
  await destroy();
  if(signal?.aborted)throw stop();
  if(e?.name==='PasswordException')throw Error('这个 PDF 有密码保护。请选择可读取的副本。');
  throw e;
 }
}
window.PaperFigureExtractor=Object.freeze({scan});
})();
