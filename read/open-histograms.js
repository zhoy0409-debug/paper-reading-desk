(() => {
  'use strict';
  const cx=b=>(b.x0+b.x1)/2,cy=b=>(b.y0+b.y1)/2;
  const number=/^[−+\-]?(?:\d+(?:[.,]\d*)?|\.\d+)$/;
  const val=t=>Number(t.text.replace('−','-').replace(',','.'));
  const union=(items)=>({x0:Math.min(...items.map(b=>b.x0)),y0:Math.min(...items.map(b=>b.y0)),x1:Math.max(...items.map(b=>b.x1)),y1:Math.max(...items.map(b=>b.y1))});
  const relative=(r,b)=>({x:(r.x-b.x)/b.width,y:(r.y-b.y)/b.height,width:r.width/b.width,height:r.height/b.height});
  function baselines(items){
    const rows=[];
    for(const t of [...items].sort((a,b)=>cy(a)-cy(b)||cx(a)-cx(b))){
      const row=rows.at(-1);
      if(row&&Math.abs(cy(row[0])-cy(t))<t.size*.42)row.push(t);
      else rows.push([t]);
    }
    return rows;
  }
  function tickRuns(words){
    const out=[];
    for(const row of baselines(words.filter(t=>number.test(t.text)))){
      let run=[],step=0;
      function flush(){if(run.length>=3)out.push(run);run=[];step=0}
      for(const t of row.sort((a,b)=>cx(a)-cx(b))){
        const prev=run.at(-1),d=prev?cx(t)-cx(prev):0;
        if(prev&&(val(t)<=val(prev)||d<t.size*.48||d>t.size*14||step&&Math.abs(d/step-1)>.32))flush();
        if(run.length)step=cx(t)-cx(run.at(-1));
        run.push(t);
      }
      flush();
    }
    return out;
  }
  function locate(cap,caps,words,axes,lines,marks,view){
    if(!/\bhistograms?\b/i.test(cap.caption)||/\b(?:bivariate|2[- ]?D|two[- ]dimensional|scatter ?plots?|box ?plots?|barplots?|empirical distribution function|(?:first|last) (?:graph|panel))\b/i.test(cap.caption))return null;
    const W=view.width,H=view.height,ceiling=Math.max(0,...caps.filter(c=>c.line.y1<cap.line.y0).map(c=>c.anchor.endY));
    if(caps.some(c=>c!==cap&&Math.abs(c.line.y0-cap.line.y0)<cap.line.size*1.2))return null;
    const above=t=>t.y0>ceiling&&t.y1<cap.line.y0;
    const upright=words.filter(above),rotated=axes.filter(above);
    const runs=tickRuns(upright),plots=[];
    const compact=s=>s.toLowerCase().replace(/[’']s\b/g,'').replace(/[^a-z0-9]/g,'');
    const headings=[...cap.caption.matchAll(/\([a-z]\)\s*([^;:().]{2,80})/gi)].map(m=>compact(m[1]));
    for(const ticks of runs){
      const first=ticks[0],last=ticks.at(-1),s=first.size;
      const left=cx(first),right=cx(last),span=right-left,bottom=first.y0-s*.9;
      if(span<W*.065||span>W*.92)continue;
      // A tick sequence alone could be a table. Require an adjoining y scale.
      const beside=t=>t.x1<left+s*.25&&t.x1>left-Math.min(span*.49,8*s)&&cy(t)<bottom-s*.7&&cy(t)>bottom-span*1.5;
      const nearbyNumbers=[...upright,...rotated].filter(t=>number.test(t.text)&&beside(t));
      const ladders=[];
      for(const t of nearbyNumbers.sort((a,b)=>cy(b)-cy(a))){
        const ladder=ladders.find(a=>Math.abs(a[0].x1-t.x1)<s*.85);
        if(ladder)ladder.push(t);else ladders.push([t]);
      }
      const scales=[];
      for(const ladder of ladders){
        const seq=[];
        for(const t of ladder){
          if(seq.length&&(val(t)<=val(seq.at(-1))||cy(seq.at(-1))-cy(t)>span*.65))break;
          seq.push(t);
        }
        if(seq.length>=2&&bottom-cy(seq[0])<span*.39)scales.push(seq);
      }
      const axisWord=rotated.filter(t=>beside(t)&&/[\p{L}]{2}/u.test(t.text)).sort((a,b)=>cy(b)-cy(a))[0];
      const scale=scales.sort((a,b)=>b.length-a.length)[0]||[];
      if(!axisWord&&!scale.length)continue;
      const lineTop=axisWord?2*cy(axisWord)-bottom:cy(scale.at(-1))-s*.5;
      const top=Math.min(lineTop,scale.length?cy(scale.at(-1)):bottom);
      const h=bottom-top;
      if(h<s*2||h>span*1.85)continue;
      const central=t=>Math.abs(cx(t)-(left+right)/2)<span*.30&&t.x0>=left-span*.35&&t.x1<=right+span*.35;
      const complete=t=>t&&lines.find(l=>central(l)&&l.text.length<=85&&Math.abs(l.base-t.base)<s*.25&&l.x0<=t.x0+.5&&l.x1>=t.x1-.5)||t;
      const setting=t=>/^[\p{L}][\p{L}\d_]*\s*=\s*[+−-]?\d[\d,. ]*$/u.test(t.text);
      const candidates=upright.filter(t=>central(t)&&t.text.length<=85&&(/[\p{L}]{2}/u.test(t.text)||setting(t))&&
        t.y1<=top+s*1.4&&t.y1>=top-Math.max(s*2.8,h*.28)&&t.y1<bottom-h*.60);
      const sideTitle=axisWord&&compact(axisWord.text).length>=3&&headings.some(t=>t.startsWith(compact(axisWord.text)))?axisWord:null;
      const below=upright.filter(t=>central(t)&&t.y0>=last.y1-s*.15&&t.y1<=last.y1+s*2.6);
      const printedSettings=below.filter(setting);
      const title=complete(candidates.sort((a,b)=>b.y1-a.y1)[0])||sideTitle||(printedSettings.length===1?printedSettings[0]:null);
      const under=below.filter(t=>/[\p{L}]{2}/u.test(t.text)&&!setting(t));
      const xLabel=under.length===1&&(!title||Math.abs(under[0].size-title.size)>s*.08||under[0].font!==title.font)?complete(under[0]):null;
      const evidence=[ticks[0],last,...scale,...[axisWord,title,xLabel].filter(Boolean)];
      if(/right.{0,6}(?:y[- ]?axis|vertical axis)/i.test(cap.caption)){
        const rightTicks=upright.filter(t=>number.test(t.text)&&t.x0>right&&t.x0<right+s*4&&cy(t)>=top-s&&cy(t)<=bottom+s);
        if(rightTicks.length>1)evidence.push(...rightTicks);
      }
      const graphic={x0:left-s*.9,y0:top,x1:right+s*.9,y1:bottom};
      const hasMark=marks.some(m=>m.x0<right&&m.x1>left&&m.y0<bottom+s&&m.y1>top&&m.x1-m.x0<span*1.5&&m.y1-m.y0>s);
      const crop=union([...evidence,graphic]);
      const underSetting=printedSettings.length===1?printedSettings[0]:null;
      const ownCrop=underSetting&&title!==underSetting&&title?.text===underSetting.text?
        union([...evidence.filter(t=>t!==title),underSetting,graphic]):null;
      plots.push({ticks,axisWord:sideTitle?null:axisWord,scale,title,xLabel,crop,ownCrop,graphic,hasMark});
    }
    if(plots.length<2||plots.length>100)return null;
    const grouped=baselines(plots.map(p=>({...p,...p.ticks[0]}))).reverse();
    const selected=[];
    let end=cap.line.y0;
    for(const row of grouped){
      row.sort((a,b)=>a.crop.x0-b.crop.x0);
      const r=union(row.map(p=>p.crop)),font=row[0].size;
      if(end-r.y1>Math.max(32,font*6)||lines.some(t=>t.y0>r.y1+2&&t.y1<end-1&&t.text.length>50))break;
      if(row.some((p,i)=>i&&row[i-1].crop.x1>p.crop.x0+font))return null;
      if(selected.length&&(selected[0].length!==row.length||row.some((p,i)=>Math.abs(cx(p.graphic)-cx(selected[0][i].graphic))>font*3)))break;
      selected.unshift(row);end=r.y0;
    }
    const all=selected.flat();
    if(all.length<2||all.length>96)return null;
    const bounds=union(all.map(p=>p.crop));
    if(cap.line.x1<bounds.x0||cap.line.x0>bounds.x1)return null;
    function region(b,pad){
      const x=Math.max(0,b.x0-pad),y=Math.max(0,b.y0-pad);
      return {x:x/W,y:y/H,width:(Math.min(W,b.x1+pad)-x)/W,height:(Math.min(H,b.y1+pad)-y)/H};
    }
    const box=region(bounds,4),cells=[],atom=DualAxis.atom(cap.caption);
    for(const [row,list] of selected.entries())for(const [col,p] of list.entries()){
      const zero=p.scale.find(t=>val(t)===0),span=p.graphic.x1-p.graphic.x0;
      const bars=atom&&zero?marks.map(m=>m.barRect).filter(b=>b&&b.x0>=p.graphic.x0&&b.x1<=p.graphic.x1&&
        b.x1-b.x0<span*.3&&Math.abs(b.y1-cy(zero))<p.ticks[0].size*.7&&b.y0>=p.graphic.y0-span*.45):[];
      cells.push({row,col,title:p.title?.text||'',x:p.xLabel?.text||'',y:p.axisWord?.text||'',
        dual:atom?{...DualAxis.measure(atom,p,upright,marks,view),leftBox:p.scale.length>=2?region(union([...p.scale,...[p.axisWord].filter(Boolean)]),1):null}:undefined,
        ownCrop:atom&&p.ownCrop?region(p.ownCrop,1.8):null,
        tightAxes:!!atom&&list.some(q=>q!==p&&p.crop.x0<q.crop.x1&&q.crop.x0<p.crop.x1),
        barExtent:bars.length>=3?region(union(bars),1.8):null,
        xLabelBox:p.xLabel?region(p.xLabel,1):null,ticks:p.scale.map(val),xTicks:p.ticks.map(val),crop:region(p.crop,1.8),rect:region(p.graphic,1),open:true});
    }
    const bottom=cells.filter(p=>p.row===selected.length-1);
    if(bottom.length>=2&&bottom.every(p=>p.x&&p.x===bottom[0].x)){
      for(const cell of cells){
        const q=bottom.find(p=>p.col===cell.col);
        if(!cell.x&&q&&cell.xTicks.join()===q.xTicks.join())cell.sharedX={label:q.x,rect:q.xLabelBox};
      }
    }
    const rowHeight=selected[0][0].crop.y1-selected[0][0].crop.y0;
    const nearbyRuns=runs.some(ts=>ts[0].y1<bounds.y0&&bounds.y0-ts[0].y1<rowHeight*1.8&&
      cx(ts[0])>=bounds.x0&&cx(ts.at(-1))<=bounds.x1);
    // A valid column can be a subset of a larger plate. Look for aligned tick
    // labels even where a neighbouring plot's vertical scale could not be read.
    const extraColumns=all.some(p=>{
      const tick=p.ticks[0];
      return upright.filter(t=>Math.abs(t.base-tick.base)<tick.size*.65&&
        (t.x0>bounds.x1+tick.size*2||t.x1<bounds.x0-tick.size*2)&&
        /^[\s\d.,+−-]+$/.test(t.text)&&/\d/.test(t.text)).length>=2;
    });
    const describedRows=/\bthird (?:row|line)\b/i.test(cap.caption)?3:/\bsecond (?:row|line)\b/i.test(cap.caption)?2:0;
    const partial=nearbyRuns||extraColumns||selected.length<describedRows;
    if(!partial&&HistogramMatrix.fromCaption(cap.caption,cells)){
      for(const [i,p] of all.entries())cells[i].profile=HistogramMatrix.barProfile(marks,p.ticks,p.scale,atom?-Infinity:p.graphic.y0);
    }else if(/\b(?:first|top|bottom|left|right)\s+(?:row|line|column)\b/i.test(cap.caption)&&cap.caption.includes('=')){
      for(const cell of cells)cell.conditionsUnclear=true;
    }
    return {box,cells,partial,needsPixels:all.some(p=>!p.hasMark)};
  }
  function cover(a,b){
    const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y);
    return {x,y,width:Math.max(a.x+a.width,b.x+b.width)-x,height:Math.max(a.y+a.height,b.y+b.height)-y};
  }
  // Tick labels often stop before the plotted data. Follow the actual axis
  // stroke past both outer ticks; never extend through an adjacent subplot.
  function baselineAt(dark,W,H,r){
    const span=r.width*W,left=r.x*W,right=left+span,h=r.height*H,bottom=(r.y+r.height)*H;
    const start=Math.max(0,Math.floor(left-span*.48)),end=Math.min(W-1,Math.ceil(right+span*.48));
    let best=null;
    for(let y=Math.max(0,Math.round(bottom-h*.10-2));y<=Math.min(H-1,Math.round(bottom+h*.12+2));y++){
      let begin=start,last=start-5;
      for(let x=start;x<=end+3;x++){
        if(x<=end&&dark(x,y)){if(last<x-3)begin=x;last=x;continue}
        if(x!==last+3||begin>left+span*.095||last<right-span*.095)continue;
        const width=last-begin+1;
        if(width<span*.80||width>span*1.85)continue;
        const score=width/span-Math.abs(y-bottom)/Math.max(10,h);
        if(!best||score>best.score)best={left:begin,right:last,y,score};
      }
    }
    return best;
  }
  async function confirmInk(page,plate,annotationMode){
    const unit=page.getViewport({scale:1}),scale=Math.min(2,1550/Math.max(unit.width,unit.height));
    const viewport=page.getViewport({scale}),canvas=document.createElement('canvas');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    try{
      await page.render({canvas,canvasContext:ctx,viewport,annotationMode,background:'#fff'}).promise;
      const W=canvas.width,H=canvas.height,data=ctx.getImageData(0,0,W,H).data;
      const dark=(x,y)=>data[(y*W+x)*4]<195;
      const tickBox=plate.box;
      let valid=true;
      for(const cell of plate.cells){
        if(cell.ownCrop){cell.crop=cell.ownCrop;plate.box=cover(plate.box,cell.crop)}
        const r=cell.rect;
        const left=Math.max(0,Math.ceil((r.x+r.width*.08)*W)),right=Math.min(W-1,Math.floor((r.x+r.width*.92)*W));
        const top=Math.max(0,Math.ceil((r.y+r.height*.1)*H));
        const low=Math.max(top,Math.floor((r.y+r.height*.76)*H)),high=Math.min(H-1,Math.ceil((r.y+r.height*1.12)*H));
        let baseline=false,traces=0;
        for(let y=low;y<=high&&!baseline;y++){
          let ink=0;for(let x=left;x<=right;x++)if(dark(x,y))ink++;
          baseline=ink>(right-left)*.75;
        }
        for(let x=left;x<=right;x+=2){
          for(let y=top;y<low;y++)if(dark(x,y)){traces++;break}
        }
        if(!baseline||traces<=(right-left)*.035)valid=false;
        const stroke=baselineAt(dark,W,H,r);
        if(cell.barExtent){
          cell.tickRect=r;cell.rect=cover(r,cell.barExtent);cell.crop=cover(cell.crop,cell.rect);plate.box=cover(plate.box,cell.crop);
        }
        if(!stroke){cell.edgeCheck=true;continue}
        const endpoints={x:Math.max(0,stroke.left-2)/W,y:r.y,
          width:(Math.min(W,stroke.right+3)-Math.max(0,stroke.left-2))/W,height:Math.max(r.height,(stroke.y+2)/H-r.y)};
        cell.tickRect=r;
        cell.rect=cover(cell.rect,endpoints);
        cell.crop=cover(cell.crop,cell.rect);
        plate.box=cover(plate.box,cell.crop);
      }
      plate.tickBox=tickBox;
      return !plate.needsPixels||valid;
    }finally{canvas.width=canvas.height=0}
  }
  function charts(found,base){
    const groupBox=relative(found.box,base);
    const cropped=found.tickBox&&Object.keys(base).filter(k=>['x','y','width','height'].includes(k)).every(k=>Math.abs(base[k]-found.box[k])<1e-8);
    const keyBase=cropped?found.tickBox:base,keyGroup=relative(found.tickBox||found.box,keyBase);
    return found.cells.map(p=>({...p,pageTickRect:p.tickRect||p.rect,rect:relative(p.rect,base),crop:relative(p.crop,base),keyBase,keyGroup,keyRect:relative(p.tickRect||p.rect,keyBase),group:'plate',groupBox,groupLabel:'',
      axisGuide:p.dual?.guide?relative(p.dual.guide,base):null,rightScale:p.dual?.rightBox?relative(p.dual.rightBox,base):null,
      leftScale:p.dual?.leftBox?relative(p.dual.leftBox,base):null,
      shared:p.sharedX?[{kind:'x',label:p.sharedX.label,rect:relative(p.sharedX.rect,base)}]:[]}));
  }
  window.OpenHistograms={locate,charts,confirmInk};
})();
