(() => {
  'use strict';
  const clean=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
  const compact=s=>clean(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const joinText=rows=>clean(rows.map(r=>r.text).join(' ')).replace(/(\p{Ll})-\s+(\p{Ll})/gu,'$1$2');
  function matrix(groups){
    const columns=[];
    for(const g of groups){
      let col=columns.find(col=>Math.abs(col[0].f.x0-g.f.x0)<2&&Math.abs(col[0].f.x1-g.f.x1)<2);
      if(!col){col=[];columns.push(col)}col.push(g);
    }
    columns.sort((a,b)=>a[0].f.x0-b[0].f.x0);
    const rows=columns[0].length;
    if(columns.length<2||columns.length>5||!rows||columns.some((col,i)=>col.length!==rows||i&&col[0].f.x0<columns[i-1][0].f.x1-1||
      col.some(({f},r)=>Math.abs(f.y0-columns[0][r].f.y0)>2||Math.abs(f.y1-columns[0][r].f.y1)>2||r&&f.y0<col[r-1].f.y1-1)))return null;
    return Array.from({length:rows},(_,r)=>columns.map((col,j)=>({...col[r],cell:{row:r+1,col:j+1}}))).flat();
  }
  function includeAxes(crop,vertical){
    const near=vertical.filter(t=>t.x0<crop.x0&&t.x0>=crop.x0-Math.min(22,(crop.x1-crop.x0)*.10)&&t.y0>=crop.y0&&t.y1<=crop.y1);
    return near.some(t=>t.text.includes('/'))?{...crop,x0:Math.max(0,Math.min(...near.map(t=>t.x0))-1.5)}:crop;
  }
  function frameEvidence(f,vertical,words,entries,crop){
    // Read each vertical label in its own frame. A shared horizontal crop alone
    // cannot establish that two rows use the same denominator.
    const label=vertical.filter(t=>t.y0>=f.y0-1&&t.y1<=f.y1+1&&t.x0>=crop.x0-1&&t.x1<f.x0&&f.x0-t.x1<(f.x1-f.x0)*.24)
      .sort((a,b)=>b.y1-a.y1).map(t=>t.text).join('').normalize('NFKC').replace(/[∆Δ]/g,'Δ').replace(/\s/g,'');
    const fraction=label.match(/^(Δ2|P)([\p{L}\d_-]*)\(k\)\/\1([\p{L}][\p{L}\d_-]*)\(k\)$/u);
    const fixed=label.match(/^(P|Δ2)\(k\)\/\1\(k\)([\p{L}][\p{L}\d_]{0,12})=([−+-]?\d+(?:\.\d+)?)([a-zA-ZμµÅ]*)$/u);
    if(!fraction&&!fixed)return null;
    const labels=words.filter(t=>t.x0>=f.x0&&t.x1<=f.x1&&t.y0>=f.y0&&t.y1<=f.y1&&t.text.length<65&&/[\p{L}]/u.test(t.text)&&!entries.some(e=>compact(e.name)===compact(t.text)))
      .map(t=>clean(t.text));
    if(fixed){
      const variable=fixed[2],unit=fixed[4],tokens=words.filter(t=>t.x0>=f.x0&&t.x1<=f.x1&&t.y0>=f.y0&&t.y1<=f.y1);
      const condition=tokens.filter(t=>t.text.includes('=')).flatMap(t=>{
        const line=tokens.filter(n=>Math.abs(n.base-t.base)<t.size*.45&&n.x0<=t.x1&&n.x1>=t.x0-3*t.size).sort((a,b)=>a.x0-b.x0);
        const m=clean(line.map(n=>n.text).join('')).match(new RegExp(escape(variable)+'\\s*=\\s*([−+-]?\\d+(?:\\.\\d+)?)\\s*'+escape(unit)+'(?:\\s*[;,]\\s*(z\\s*=\\s*[\\d.]+))?','u'));
        return m?[{value:m[1],other:m[2]||''}]:[];
      });
      return {quantity:fixed[1]==='Δ2'?'Δ²':'P',variable,value:fixed[3],unit,setting:condition.length===1?condition[0]:null};
    }
    return {quantity:fraction[1]==='Δ2'?'Δ²':'P',num:fraction[2],den:fraction[3],labels};
  }
  function captionModels(caption){
    // Case is retained for symbol and code names. Stop before the next
    // preposition rather than swallowing the rest of the caption.
    const name='[A-Z][A-Za-z0-9_-]*(?: [A-Z][A-Za-z0-9_-]*){0,2}';
    const pair='('+name+') and ('+name+')',reference='('+name+')(?=\\s+(?:for|at|in|using|with)|[.,;()]|$)';
    const m=caption.match(new RegExp('(?:power spectrum|power spectra)\\b(?:[^.;]|\\.(?=\\d)){0,90}?\\bof '+pair+' to (?:that|those) of '+reference))
      ||caption.match(new RegExp('(?:power spectra|predictions) (?:from|of) '+pair+'(?:,? (?:each |both )?(?:divided by|normali[sz]ed to) (?:the (?:spectrum|power) (?:of|from) )?)'+reference));
    return m&&{models:[m[1],m[2]],den:m[3],text:m[0]};
  }
  function bodyForFigure(fig,rows){
    const page=rows.filter(r=>r.page===fig.captionPage),start=page.findIndex(r=>r.fig===fig.matchKey);
    if(start<0)return '';
    const cap=compact(fig.caption);let end=start+1;
    // Math superscripts can be detached or absent in the extracted caption.
    while(end<page.length&&end-start<25){
      const row=page[end],s=compact(row.text);
      if(row.fig||!s||(!cap.includes(s)&&s.length>2))break;
      end++;
    }
    const regions=[];
    for(let i=0;i<page.length;i++){
      if(page[i].fig||!page[i].mentions?.includes(fig.matchKey)||i>=start&&i<end)continue;
      const lines=[];
      for(let j=i;j<page.length&&lines.length<25;j++){
        const r=page[j];
        if(r.fig||j===start||r.mentions?.some(k=>k.startsWith('F:')&&k!==fig.matchKey))break;
        lines.push(r);
        // Some PDFs insert the entire figure between two halves of a word
        // at a column break. The matching caption and both word fragments
        // anchor the continuation to the paragraph citing this figure.
        if(j<start&&/-$/.test(r.text)&&/^[a-z]/.test(page[end]?.text||'')&&
           page.slice(j+1,start).every(t=>!t.fig&&!t.mentions?.length&&t.text.length<50&&!/[.!?]\s+[A-Z]/.test(t.text)))j=end-1;
      }
      regions.push(joinText(lines));
    }
    return regions.join('\n');
  }
  function matchingLabel(axis,model,body){
    const exact=axis.labels.find(s=>compact(s)===compact(model));
    if(exact)return {label:exact,model};
    for(const s of axis.labels){
      const cite=s.match(/^([A-Z][\p{L}-]+)\s*\(?((?:19|20)\d\d)\)?$/u);
      if(cite&&new RegExp('\\b'+escape(cite[1])+'(?: et al\\.)?\\s*\\(?'+cite[2]+'\\)?\\s+(?:version of |revision of )?'+escape(model)+'\\b','i').test(body))return {label:s,model};
    }
    return null;
  }
  function resolve(fig,rows){
    const c=fig.curveChart;
    for(const p of c.plots){
      const a=p.ratioAxis;
      if(a?.variable&&a.setting){p.axisReference=a.variable+' = '+a.value+(a.unit?' '+a.unit:'');p.condition=a.variable+' = '+a.setting.value+(a.unit?' '+a.unit:'')+(a.setting.other?' · '+a.setting.other:'')}
    }
    if(c.composite||c.plots.length!==2||!c.k||!c.plots.every(p=>p.ratioAxis?.den))return;
    const quote=clean(fig.caption),reference=captionModels(quote);
    if(!reference||reference.models[0]===reference.models[1])return;
    if(!c.plots.every(p=>reference.den.split(/[\s_-]+/).some(n=>compact(n)===compact(p.ratioAxis.den))))return;
    const body=bodyForFigure(fig,rows),den=escape(reference.den);
    const match=body.match(new RegExp('\\b(?:we compare (?:to|with|against)|(?:we use|we take) as (?:a |the )?reference|(?:are|were) compared (?:with|to|against)) '+den+'\\b.{0,220}?(?:at z\\s*=\\s*[\\d.]+(?=\\s+[A-Z]|$)|[.!?](?=\\s+[A-Z]|$))','i'));
    if(!match)return;
    const passage=match[0];
    const ids=c.plots.map(p=>reference.models.map(m=>matchingLabel(p.ratioAxis,m,passage)).filter(Boolean));
    if(ids.some(a=>a.length>1))return;
    const unmatched=ids.findIndex(a=>!a.length);
    if(unmatched>=0){
      const peer=ids[1-unmatched][0],axis=c.plots[unmatched].ratioAxis,label=axis.labels.find(t=>/^(this work|our model|this study)$/i.test(t));
      if(!peer||!label||!/(?:both|and) our (?:calibrated |revised |new )?(?:[\w-]+ ){0,3}model\b/i.test(passage))return;
      ids[unmatched]=[{label,model:reference.models.find(m=>m!==peer.model)}];
    }
    if(ids[0][0].model===ids[1][0].model||reference.models.includes(reference.den)||
       c.plots.some((p,i)=>p.ratioAxis.num&&compact(p.ratioAxis.num)!==compact(ids[i][0].model)))return;
    const redshift=quote.match(/\bz\s*=\s*(\d+(?:\.\d+)?)/i)?.[1];
    const measuredZ=c.plots.flatMap(p=>p.ratioAxis.labels.map(s=>s.match(/^z\s*=\s*(\d+(?:\.\d+)?)$/i)?.[1]).filter(Boolean));
    const z=redshift&&measuredZ.length&&measuredZ.every(v=>Number(v)===Number(redshift))?redshift:'';
    c.documentRatio={denominator:reference.den,z,cosmologies:/cosmological models/i.test(quote),
      caption:quote.slice(0,quote.indexOf(reference.text)+reference.text.length),body:passage,page:fig.captionPage};
    c.ratio=true;c.denominator=reference.den;
    for(const [i,p] of c.plots.entries()){
      p.model=ids[i][0].model;p.printedModel=ids[i][0].label;p.condition=p.model;
      if(p.scale)measure(p,c);
      const peak=body.match(/over[ -]prediction of the amplitude of the BAO peaks around k\s*=\s*(\d+(?:\.\d+)?)/i);
      if(peak&&/^(?:this work|our model|this study)$/i.test(p.printedModel)&&/BAO peak/i.test(quote)){
        p.author={zh:'作者把 k ≈ '+peak[1]+' h Mpc⁻¹ 附近的偏高归于对重子声学振荡（BAO）峰高的高估。这是物质分布中早期声波留下的一组起伏。',en:'The authors locate an overprediction near k ≈ '+peak[1]+' h Mpc⁻¹ at the baryon acoustic oscillation (BAO) peaks, ripples left by sound waves in the early universe.',quote:peak[0]};
      }
      const broad=quote.match(new RegExp('(?:The )?'+escape(p.model)+' error rises to around (\\d+(?:\\.\\d+)?) per cent for k\\s*>\\s*(\\d+(?:\\.\\d+)?)','i'));
      if(broad)p.author={zh:'作者概括，这几组参数在 k > '+broad[2]+' h Mpc⁻¹ 时偏差约为 '+broad[1]+'%。切换颜色可以核对各组的起伏。',en:'The caption reports about '+broad[1]+'% error for these cosmologies at k > '+broad[2]+' h Mpc⁻¹. Select a colour to inspect the variation within each curve.',quote:broad[0]};
    }
  }
  function measure(plot,c){
    const ticks=c.xt,xs=c.tickPositions,scale=plot.scale;
    if(!xs||ticks.length<3||ticks.some((v,i)=>v<=0||i&&v<=ticks[i-1]))return;
    const first=xs[0],last=xs.at(-1),log=Math.log(ticks.at(-1)/ticks[0]);
    const kAt=x=>ticks[0]*Math.exp(log*(x-first)/(last-first));
    // A tolerance band is reported only if symmetric dashed guides were
    // measured in this frame. The width is read from the calibrated axis.
    const upper=plot.guides.filter(v=>v>1+scale.tolerance*2&&plot.guides.some(w=>Math.abs(2-v-w)<scale.tolerance*2));
    const guide=upper.length===1?Math.round((upper[0]-1)*1000)/1000:null;
    plot.guide=guide;plot.calibrated=true;
    for(const s of plot.series){
      const data=s.ys.map((y,i)=>{
        const x=i/(s.ys.length-1);return y==null||x<first-.0001||x>last+.0001?null:{k:kAt(x),y:scale.top+y*(scale.bottom-scale.top),x,position:y};
      });
      s.bands=[];
      for(let j=1;j<ticks.length;j++){
        const points=data.filter(p=>p&&p.k>=ticks[j-1]&&p.k<=ticks[j]);if(points.length<4)continue;
        const ys=points.map(p=>p.y),expected=(xs[j]-xs[j-1])*(data.length-1);
        s.bands.push({from:ticks[j-1],to:ticks[j],lo:Math.min(...ys),hi:Math.max(...ys),last:ys.at(-1),partial:ys.length<expected*.85});
      }
      const valid=data.filter(Boolean);
      if(!valid.length)continue;
      const peak=valid.reduce((a,b)=>Math.abs(a.y-1)>=Math.abs(b.y-1)?a:b);
      s.peak=peak;
      if(!guide)continue;
      const runs=[];let run=null;
      for(const p of data){
        if(!p||Math.abs(p.y-1)<=guide+scale.tolerance){run=null;continue}
        const sign=Math.sign(p.y-1);
        if(!run||run.sign!==sign){run={sign,from:p.k,to:p.k};runs.push(run)}
        run.to=p.k;
      }
      s.wide=runs.filter(r=>r.to/r.from>1.13).sort((a,b)=>b.to/b.from-a.to/a.from)[0];
    }
  }
  function sameColor(c,index){
    if(!c.documentRatio)return null;
    const name=c.entries[index].name,fmt=v=>Number(v.toPrecision(2)),rows=[];
    for(const [i,p] of c.plots.entries()){
      const s=p.series[index];if(!s.peak)return null;
      const q=s.peak,high=q.y>1,percent=Math.round(Math.abs(q.y-1)*100),r=s.wide;
      rows.push({model:p.model,where:i?'下格':'上格',enWhere:i?'Lower':'Upper',
        zh:'在 k ≈ '+fmt(q.k)+' 处可见偏离最大，约'+(high?'高':'低')+' '+percent+'%。'+(r?'较连续的一段在 k ≈ '+fmt(r.from)+'–'+fmt(r.to)+'，'+(r.sign>0?'高出':'低于')+'参考约 '+Math.round(p.guide*100)+'% 以上。':''),
        en:'The largest sampled departure is near k ≈ '+fmt(q.k)+', about '+percent+'% '+(high?'above':'below')+' the reference.'+(r?' A sustained stretch more than about '+Math.round(p.guide*100)+'% '+(r.sign>0?'above':'below')+' runs from k ≈ '+fmt(r.from)+' to '+fmt(r.to)+'.':'')});
    }
    return {name,rows};
  }
  window.CurveRatio={matrix,includeAxes,frameEvidence,resolve,sameColor};
})();
