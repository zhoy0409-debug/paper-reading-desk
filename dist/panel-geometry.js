(() => {
  'use strict';
  // Letter anchors must form a readable alphabetical sequence in the figure lane.
  // Boxes are suggestions. The final row may include a shared key or scale.
  function detect(cap, captions, words, lines, view, original) {
    const W = view.width, H = view.height, bottom = cap.line.y0;
    const beside = captions.some(c => c !== cap && Math.abs(c.line.y0-bottom)<45);
    let left = beside && cap.line.x0>W*.43 ? W*.49 : 0;
    let right = beside && cap.line.x0<W*.43 ? W*.51 : W;
    const preceding = lines.filter(l => l.y1 < bottom-5 && l.x0<right && l.x1>left &&
      (l.text.length>65 || captions.some(c=>c.line===l)));
    const top = Math.max(H*.055,bottom-H*.78,...preceding.map(l=>l.y1+1));
    const marks = words.flatMap(word => {
      const m = word.text.trim().match(/^\(?([A-Za-z])\)?[.)]?$/);
      return m && word.x0>=left && word.x1<=right && word.y0>=top && word.y1<bottom-7 ?
        [{...word, letter:m[1].toLowerCase()}] : [];
    });
    const candidates = [];
    for (const first of marks.filter(m=>m.letter==='a')) {
      const seq=[first]; let prev=first;
      for (const letter of 'bcdefghijklmnopqrstuvwx') {
        const next=marks.filter(m=>m.letter===letter && Math.abs(m.size-first.size)<first.size*.22 &&
          ((Math.abs(m.base-prev.base)<first.size*.58 && m.x0>prev.x0+first.size*3) ||
           (m.base>prev.base+first.size*4 && m.x0<=prev.x0+first.size*1.5)));
        if(next.length!==1)break;
        seq.push(next[0]); prev=next[0];
      }
      if(seq.length>=2)candidates.push(seq);
    }
    candidates.sort((a,b)=>b.length-a.length);
    const seq=candidates[0];
    if(!seq || candidates[1]?.length===seq.length)return null;
    const rows=[];
    for(const m of seq){
      const last=rows.at(-1);
      if(!last || Math.abs(last[0].base-m.base)>m.size*.58)rows.push([m]); else last.push(m);
    }
    const gaps=rows.flatMap(row=>row.slice(1).map((m,i)=>m.x0-row[i].x0)).sort((a,b)=>a-b);
    if(!gaps.length)return null;
    const step=gaps[Math.floor(gaps.length/2)], margin=seq[0].size*.65;
    if(step<W*.065 || bottom-seq.at(-1).y0>H*.48)return null;
    left=Math.max(left,Math.min(...seq.map(p=>p.x0))-margin);
    right=Math.min(right,Math.max(...seq.map(p=>p.x0))+step-margin);
    let crop={x0:left,y0:seq[0].y0-margin,x1:right,y1:bottom-2};
    if(original)crop={x0:Math.min(crop.x0,original.x0),x1:Math.max(crop.x1,original.x1),
      y0:Math.min(crop.y0,original.y0),y1:Math.max(crop.y1,original.y1)};
    const panels=[];
    rows.forEach((row,i)=>row.forEach((m,j)=>{
      const x0=Math.max(crop.x0,m.x0-margin), y0=Math.max(crop.y0,row[0].y0-margin);
      const x1=Math.min(crop.x1,(row[j+1]?.x0??m.x0+step)-margin);
      const y1=rows[i+1]?rows[i+1][0].y0-margin:crop.y1;
      const labelLine=lines.find(l=>Math.abs(l.base-m.base)<m.size*.6 && l.x0>=m.x0-margin &&
        l.x1<=x1+1 && (l.text.length>3||/^=\s*\d/.test(l.text)) && l.text.length<70);
      const phrase=labelLine?.text.replace(/^[A-Za-z]\s+/,'');
      const title=phrase||'';
      const markerBox={x:Math.max(0,m.x0-.5)/W,y:Math.max(0,m.y0-.5)/H,
        width:(m.x1-m.x0+1)/W,height:(m.y1-m.y0+1)/H};
      if(x1>x0+10 && y1>y0+10)panels.push({position:m.letter,label:m.letter.toUpperCase(),title,markerBox,
        rect:{x0,y0,x1,y1}});
    }));
    return panels.length===seq.length?{crop,panels}:null;
  }
  function printedTitles(cap,captions,lines,view,words,objects) {
    const c=cap.line, narrow=c.x1-c.x0<view.width*.48;
    const left=narrow&&c.x0>view.width*.44?view.width*.48:0;
    const right=narrow&&c.x1<view.width*.55?view.width*.53:view.width;
    const previous=captions.filter(x=>x!==cap&&x.line.y0<c.y0&&x.line.x0<right&&x.line.x1>left);
    const top=Math.max(c.y0-view.height*.55,...previous.map(x=>x.anchor.endY));
    const hits=[];
    for(const l of lines){
      if(l.y0<top||l.y1>c.y0+1||l.x0<left||l.x1>right||!/^\([a-z]\)/i.test(l.text))continue;
      const matches=[...l.text.matchAll(/(?:^|\s)\(([a-z])\)\s*/gi)];
      for(const [i,m] of matches.entries()){
        const title=l.text.slice(m.index+m[0].length,matches[i+1]?.index).trim();
        if(title.length<2||title.length>80)continue;
        const label=m[1].toUpperCase(),sameLine=words.filter(w=>Math.abs(w.base-l.base)<l.size*.36&&w.x0>=l.x0-1&&w.x1<=l.x1+1);
        const word=sameLine.find(w=>w.text.trim().toUpperCase().startsWith('('+label+')'));
        const last=matches[i+1],next=last&&sameLine.find(w=>w.text.trim().toLowerCase().startsWith('('+last[1].toLowerCase()+')'));
        const x0=word?.x0??(matches.length===1?l.x0:null);
        const x1=next?Math.max(x0??0,...sameLine.filter(w=>w.x0<next.x0&&w.x0>=(x0??l.x0)-1).map(w=>w.x1)):l.x1;
        hits.push({l,label,title,x0,x1,word});
      }
    }
    if(hits.length<2||hits[0].label!=='A')return [];
    if(!hits.every(({l,label},i)=>label===String.fromCharCode(65+i) &&
      Math.abs(l.size-hits[0].l.size)<hits[0].l.size*.2))return [];
    return hits.map(({l,label,title,x0,x1,word})=>{
      const panel={position:label.toLowerCase(),label,title};
      if(x0==null)return panel;
      panel.titleAnchor={x:x0/view.width,y:l.base/view.height};
      if(word?.text.trim().toUpperCase()==='('+label+')'){
        panel.markerBox={x:(word.x0-.4)/view.width,y:(word.y0-.4)/view.height,width:(word.x1-word.x0+.8)/view.width,height:(word.y1-word.y0+.8)/view.height};
      }
      const mid=(x0+x1)/2;
      const candidates=objects.filter(o=>o.kind==='image'&&o.x0<mid&&o.x1>mid&&o.y1<=l.base&&Math.abs(l.y0-o.y1)<l.size*2&&o.x1-o.x0<view.width*.55);
      if(candidates.length===1){
        const o=candidates[0];
        const peers=hits.filter(h=>Math.abs(h.l.base-l.base)<l.size&&h.x0!=null&&(h.x0+h.x1)/2>o.x0&&(h.x0+h.x1)/2<o.x1);
        if(peers.length===1)panel.rect={x0:Math.min(o.x0,x0),x1:Math.max(o.x1,x1),y0:o.y0,y1:l.y1};
      }
      return panel;
    });
  }
  // A detached caption can describe a plate on the preceding page. Only use an
  // uncaptioned plate when its complete, independently printed A… sequence
  // matches the labels in the caption. Treat uncertain page layouts as unlocated.
  function precedingPlate(caption,layout,objects){
    const {words,lines,viewport:{width:W,height:H}}=layout;
    const starts=[...caption.matchAll(/(?:^|[.;:。]\s*)\(?([a-z])(?:\)\s*|\s+)(?=[A-Z])/g)].map(m=>m[1]);
    if(starts[0]!=='a'||starts[1]!=='b')return null;
    const labels=new Set([...starts,...[...caption.matchAll(/\(([a-z])\)/g)].map(m=>m[1])]);
    const groups=new Map();
    for(const word of words){
      const m=word.text.trim().match(/^\(?([a-z])\)?[.]?$/i);
      if(!m||word.y0<H*.045||word.y1>H*.95)continue;
      const key=word.font+'/'+word.size.toFixed(1);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push({...word,letter:m[1].toLowerCase()});
    }
    const candidates=[];
    for(const group of groups.values()){
      if(group.length<3||group.length!==labels.size)continue;
      const rows=[];
      for(const m of group.sort((a,b)=>a.base-b.base||a.x0-b.x0)){
        let row=rows.at(-1);
        if(!row||m.base-row[0].base>m.size*.65){row=[];rows.push(row)}
        row.push(m);
      }
      for(const row of rows)row.sort((a,b)=>a.x0-b.x0);
      const ordered=rows.flat();
      if(rows.length<2||!rows.some(r=>r.length>1)||!ordered.every((m,i)=>m.letter===String.fromCharCode(97+i)&&labels.has(m.letter)))continue;
      if(ordered.at(-1).base-ordered[0].base<H*.24||Math.max(...ordered.map(m=>m.x0))-Math.min(...ordered.map(m=>m.x0))<W*.24)continue;
      candidates.push(rows);
    }
    if(candidates.length!==1)return null;
    const rows=candidates[0],marks=rows.flat(),first=marks[0],last=rows.at(-1)[0],pad=first.size*.57;
    const prose=lines.filter(l=>l.text.length>60&&l.text.split(/\s+/).length>=8&&l.x1-l.x0>W*.27);
    if(first.y0>H*.28||prose.some(l=>l.y0>=first.y0&&l.y0<last.y1))return null;
    const ceiling=Math.max(0,first.y0-pad),floor=Math.min(H*.955,...prose.filter(l=>l.y0>last.y1).map(l=>l.y0-3));
    if(floor-last.y1<last.size*3)return null;
    const drawings=objects.filter(o=>o.y0>=ceiling-2&&o.y1<=floor+2&&o.x0>=0&&o.x1<=W&&o.x1-o.x0>2&&o.y1-o.y0>2);
    if(!drawings.some(o=>o.kind==='image'&&(o.x1-o.x0)*(o.y1-o.y0)>W*H*.025)&&drawings.length<12)return null;
    const evidence=drawings.concat(words.filter(l=>l.y0>=ceiling&&l.y1<=floor));
    const crop={x0:Math.max(0,Math.min(...evidence.map(q=>q.x0))-pad),x1:Math.min(W,Math.max(...evidence.map(q=>q.x1))+pad),
      y0:ceiling,y1:Math.min(floor,Math.max(...evidence.map(q=>q.y1))+pad)};
    const panels=rows.flatMap((row,i)=>row.map((m,j)=>({
      position:m.letter,label:m.letter.toUpperCase(),markerBox:{x:(m.x0-.5)/W,y:(m.y0-.5)/H,width:(m.x1-m.x0+1)/W,height:(m.y1-m.y0+1)/H},
      rect:{x0:j?m.x0-pad:crop.x0,x1:row[j+1]?row[j+1].x0-pad:crop.x1,
        y0:i?Math.min(...row.map(p=>p.y0))-pad:crop.y0,y1:rows[i+1]?Math.min(...rows[i+1].map(p=>p.y0))-pad:crop.y1}
    })));
    if(panels.some(p=>p.rect.x1-p.rect.x0<W*.04||p.rect.y1-p.rect.y0<H*.025))return null;
    return {crop,panels};
  }
  const numeric=t=>/^[-+−]?\d+(?:[.,]\d+)?%?$/.test(t.trim());
  function axisIn(rect,axes,words){
    const w=rect.x1-rect.x0,h=rect.y1-rect.y0;
    const found=axes.filter(a=>a.x0>=rect.x0-1&&a.x1<rect.x0+w*.28&&a.y0>=rect.y0-1&&a.y1<rect.y1&&
      a.y1-a.y0>h*.12&&new Set(words.filter(t=>numeric(t.text)&&t.x0>a.x0&&t.x0<a.x1+w*.16&&
        t.y0>=rect.y0&&t.y1<=rect.y1).map(t=>Math.round(t.base/3))).size>=2);
    return found.length===1?found[0].text:undefined;
  }
  // Match named side captions to two independently drawn Cartesian axes.
  // Axis lines, rotated metric names and ticks must agree on both plots.
  function pairedAxes(cap,captions,axes,words,objects,view){
    const floor=cap.line.y0,W=view.width,H=view.height;
    const near=axes.filter(a=>a.y0>floor-H*.30&&a.y1<floor&&a.x0>=cap.line.x0-12&&a.x0<cap.line.x1+6)
      .sort((a,b)=>a.x0-b.x0);
    if(near.length!==2)return null;
    function metric(text){return text.replace(/\s*[(\[].*?[)\]]\s*$/,'').trim().toLowerCase()}
    const labelText=cap.caption.toLowerCase(),left=labelText.indexOf('(left)'),right=labelText.indexOf('(right)');
    if(left<0||right<left||metric(near[0].text)===metric(near[1].text)||
      !labelText.slice(0,left).trimEnd().endsWith(metric(near[0].text))||
      !labelText.slice(left+6,right).trimEnd().endsWith(metric(near[1].text)))return null;
    const panels=[];
    for(const [i,label] of near.entries()){
      const vertical=objects.filter(o=>o.kind==='vec'&&o.x1-o.x0<2.1&&o.y1-o.y0>H*.043&&o.y1-o.y0<H*.30&&
        o.x0>=label.x1-1&&o.x0-label.x1<W*.045&&o.y0<=label.y0+3&&o.y1>=label.y1-3&&o.y1<floor);
      if(vertical.length!==1)return null;
      const y=vertical[0],horizontal=objects.filter(o=>o.kind==='vec'&&o.y1-o.y0<2.1&&o.x1-o.x0>W*.085&&
        Math.abs(o.x0-y.x0)<3&&Math.abs(o.y1-y.y1)<3);
      if(horizontal.length!==1)return null;
      const x=horizontal[0];
      if(floor-y.y1>H*.085||captions.some(c=>c!==cap&&c.line.y0>y.y0&&c.line.y0<floor&&c.line.x0<x.x1&&c.line.x1>label.x0))return null;
      const under=words.filter(t=>t.x0>=label.x0-1&&t.x1<=x.x1+4&&t.y0>=y.y1-3&&t.y1<floor);
      if(under.filter(t=>numeric(t.text)).length<3||under.some(t=>t.text.length>45))return null;
      const rect={x0:label.x0-2,y0:y.y0-4,x1:x.x1+3,y1:Math.min(floor-1,Math.max(y.y1,...under.map(t=>t.y1))+2)};
      const axis=axisIn(rect,axes,words);if(axis!==label.text)return null;
      const keys=words.filter(t=>t.x0>y.x1&&t.x1<=x.x1+3&&t.y0>=y.y0-2&&t.y1<=y.y1&&
        !numeric(t.text)&&t.text.length>=2&&t.text.length<=40&&labelText.includes(t.text.toLowerCase())).map(t=>t.text);
      const side=i?'right':'left';
      panels.push({position:side,label:i?'右图':'左图',axis,curveLabels:[...new Set(keys)],rect});
    }
    const [a,b]=panels.map(p=>p.rect);
    if(a.x1>=b.x0||Math.abs(a.y0-b.y0)>5||Math.abs(a.y1-b.y1)>7)return null;
    return {panels,crop:{x0:a.x0,x1:b.x1,y0:Math.min(a.y0,b.y0),y1:Math.max(a.y1,b.y1)}};
  }
  // A labelled row of separate image objects can have axes and keys painted
  // outside those objects. Use completely blank columns on the printed page
  // to keep the neighbouring labels with their own panel.
  async function includePrintedMargins(printed,page,view,annotationMode,words){
    if(printed.length<2||printed.length>8||printed.some(p=>!p.rect||!p.titleAnchor))return;
    const rects=printed.map(p=>p.rect);
    const first=rects[0],width=first.x1-first.x0,height=first.y1-first.y0;
    if(rects.some((r,i)=>Math.abs(r.y0-first.y0)>height*.08||Math.abs(r.y1-first.y1)>height*.06||
      Math.abs((r.x1-r.x0)-width)>width*.25||(i&&r.x0<=rects[i-1].x1)))return;
    const gap=(rects.at(-1).x0-first.x0)/(rects.length-1)-width;
    if(gap<4||gap>width*.85)return;
    const left=Math.max(0,first.x0-gap),right=Math.min(view.width,rects.at(-1).x1+gap);
    const top=Math.max(0,Math.min(...rects.map(r=>r.y0))-2),bottom=Math.min(view.height,Math.max(...rects.map(r=>r.y1))+2);
    const scale=Math.min(2.5,1600/(right-left));
    const canvas=document.createElement('canvas');
    canvas.width=Math.ceil((right-left)*scale);canvas.height=Math.ceil((bottom-top)*scale);
    try{
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      await page.render({canvasContext:ctx,canvas,viewport:page.getViewport({scale}),annotationMode,
        background:'#fff',transform:[1,0,0,1,-left*scale,-top*scale]}).promise;
      const px=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const ink=new Uint8Array(canvas.width);
      for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
        const k=(y*canvas.width+x)*4;
        if(Math.min(px[k],px[k+1],px[k+2])<225)ink[x]=1;
      }
      const col=x=>Math.max(0,Math.min(canvas.width,Math.round((x-left)*scale)));
      const cuts=[0];
      for(let i=1;i<rects.length;i++){
        const lo=col(rects[i-1].x1),hi=col(rects[i].x0);
        let start=lo,bestStart=0,bestWidth=0;
        for(let x=lo;x<=hi;x++)if(x===hi||ink[x]){
          if(x-start>bestWidth){bestWidth=x-start;bestStart=start}
          start=x+1;
        }
        if(bestWidth<3*scale)return;
        cuts.push(Math.round(bestStart+bestWidth/2));
      }
      cuts.push(canvas.width);
      // At the outer ends, a separate text column could also be visible.
      // Stop at a gap as wide as the inter-panel gutter.
      const margin=Math.ceil(2*scale);
      for(let i=0;i<rects.length;i++){
        let lo=col(rects[i].x0),hi=col(rects[i].x1)-1;
        let blank=0;
        for(let x=lo-1;x>=cuts[i];x--){if(ink[x]){lo=x;blank=0}else if(++blank>gap*scale*.55)break}
        blank=0;
        for(let x=hi+1;x<cuts[i+1];x++){if(ink[x]){hi=x;blank=0}else if(++blank>gap*scale*.55)break}
        // A PDF can retain a complete number in its text layer even when
        // an embedded plot clips the last glyph. Check the visible ink at
        // different tick labels before flagging a repeated clipping edge.
        const edges=[];
        const labels=words.filter(w=>/^[-−+]?\d+[.,]?\d*$/.test(w.text)&&w.x0>=rects[i].x1-1&&
          col(w.x1)<=cuts[i+1]&&w.y0>=top&&w.y1<=bottom);
        for(const t of labels){
          if(t.text.length<2)continue;
          const first=col(t.x0),last=col(t.x1),y0=Math.max(0,Math.floor((t.y0-top)*scale)),y1=Math.min(canvas.height,Math.ceil((t.y1-top)*scale));
          let tip=-1;
          for(let x=last-1; x>=first&&tip<0; x--)for(let y=y0;y<y1;y++){
            const k=(y*canvas.width+x)*4;if(Math.max(px[k],px[k+1],px[k+2])<155){tip=x;break}
          }
          if(tip>=first&&last-tip>Math.max(2.5,(last-first)/t.text.length*.35))edges.push({tip,last:t.text.slice(-1)});
        }
        printed[i].partialTicks=edges.some(t=>new Set(edges.filter(s=>Math.abs(s.tip-t.tip)<=1).map(s=>s.last)).size>=3);
        rects[i].x0=left+Math.max(cuts[i],lo-margin)/scale;
        rects[i].x1=Math.min(right,left+Math.min(cuts[i+1],hi+1+margin)/scale);
        rects[i].y0=top;rects[i].y1=bottom;
      }
    }finally{canvas.width=canvas.height=0}
  }
  window.PaperPanelGeometry={includePrintedMargins,detect,printedTitles,precedingPlate,axisIn,pairedAxes};
})();
