(() => {
  'use strict';
  const clean=text=>String(text||'').normalize('NFKC').replace(/([a-z])-\s+([a-z])/g,'$1$2').replace(/\s+/g,' ').trim();
  const symbol=text=>clean(text).replace(/[−–]/g,'-').replace(/\s/g,'');
  const number=text=>/^[−+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim())?Number(text.trim().replace('−','-')):NaN;
  const round=v=>String(Number(v.toPrecision(2)));
  function captionRows(text){
    const cap=clean(text),tags=[...cap.matchAll(/\b(top|upper|bottom|lower)\s*(?:panels?\b|(?=:))/gi)];
    if(tags.length!==2||tags.some(t=>/panels$/i.test(t[0]))||/\b(?:middle|centr[ae]l|left|right)\s*(?:panels?\b|:)/i.test(cap))return null;
    const sides=tags.map(t=>/^(top|upper)$/i.test(t[1])?'upper':'lower');
    if(sides[0]===sides[1])return null;
    const rows={};
    tags.forEach((tag,i)=>{
      const passage=cap.slice(tag.index,tags[i+1]?.index||cap.length);
      rows[sides[i]]=passage.replace(/\s*(?:(?:while|whereas|and|in)\s+)?the\s*$/i,'').trim();
    });
    if(Object.values(rows).some(s=>s.length<20))return null;
    return rows;
  }
  function framePair(cap,objects,lines,page,column){
    const c=cap.line,W=page.width,H=page.height;
    const lane=o=>column?.side==='right'?o.x0>=column.split-2:column?.side==='left'?o.x1<=column.split+2:true;
    const vicinity=objects.filter(o=>lane(o)&&o.y1<=c.y0+1&&o.y0>=Math.max(H*.04,c.y0-H*.68));
    const horizontal=vicinity.filter(o=>o.y1-o.y0<=2&&o.x1-o.x0>W*.17);
    const vertical=vicinity.filter(o=>o.x1-o.x0<=2&&o.y1-o.y0>H*.045);
    const frames=[];
    for(const l of vertical){
      const x0=(l.x0+l.x1)/2,y0=l.y0,y1=l.y1;
      for(const r of vertical){
        const x1=(r.x0+r.x1)/2;
        if(x1-x0<W*.17||Math.abs(y0-r.y0)>1.5||Math.abs(y1-r.y1)>1.5||(x0+x1)/2<c.x0-8||(x0+x1)/2>c.x1+8)continue;
        const edges=horizontal.filter(h=>Math.abs(h.x0-x0)<2&&Math.abs(h.x1-x1)<2);
        if(![y0,y1].every(y=>edges.some(h=>Math.abs(y-(h.y0+h.y1)/2)<2)))continue;
        if(!frames.some(f=>Math.abs(f.x0-x0)<2&&Math.abs(f.y0-y0)<2&&Math.abs(f.y1-y1)<2))frames.push({x0,x1,y0,y1});
      }
    }
    const pairs=[];
    for(const top of frames)for(const bot of frames){
      const width=top.x1-top.x0;
      if(bot.y0<top.y1-2||bot.y0-top.y1>width*.25||c.y0-bot.y1>width*.35||Math.abs(top.x0-bot.x0)>2||Math.abs(top.x1-bot.x1)>2)continue;
      const inColumn=t=>t.x0<top.x1&&t.x1>top.x0&&t.y0>=top.y0&&t.y1<c.y0;
      if(lines.some(t=>inColumn(t)&&t.text.length>65&&t.x1-t.x0>width*.8))continue;
      const pad=3;
      const ext=vicinity.filter(o=>o.x0>=top.x0-width*.30&&o.x1<=top.x1+width*.08&&o.y0>=top.y0-5&&o.y1<Math.min(c.y0,bot.y1+width*.22));
      const crop={x0:Math.max(0,Math.min(top.x0,...ext.map(o=>o.x0))-pad),x1:Math.min(W,Math.max(top.x1,...ext.map(o=>o.x1))+pad),y0:Math.max(0,Math.min(top.y0,...ext.map(o=>o.y0))-pad),y1:Math.min(c.y0,Math.max(bot.y1,...ext.map(o=>o.y1))+pad)};
      pairs.push({crop,frames:[top,bot]});
    }
    return pairs.length===1?pairs[0]:null;
  }
  function ordinate(f,vertical,crop,scale){
    const labels=vertical.filter(t=>t.y0>=f.y0-1&&t.y1<=f.y1+1&&t.x0>=crop.x0-1&&t.x1<=f.x0&&f.x0-t.x1<(f.x1-f.x0)*.26);
    labels.sort((a,b)=>b.y1-a.y1);
    if(!labels.length||labels.some((t,i)=>i&&Math.abs(t.x0-labels[i-1].x0)>7))return null;
    return {label:clean(labels.map(t=>t.text).join('')),scale:scale?{top:scale(f.y0),bottom:scale(f.y1),resolution:Math.abs(scale(f.y0)-scale(f.y0+.8))}:null};
  }
  function sharedAxis(words,f,crop,plots){
    if(plots.some(p=>!p.ordinate?.label)||symbol(plots[0].ordinate.label)===symbol(plots[1].ordinate.label))return null;
    const width=f.x1-f.x0;
    const below=words.filter(t=>t.base>f.y1&&t.y0<crop.y1&&t.x0>=f.x0-t.size&&t.x1<=f.x1+t.size);
    const numeric=below.filter(t=>t.base<f.y1+2.8*t.size&&Number.isFinite(number(t.text)));
    const rows=[];
    for(const t of numeric){
      let row=rows.find(row=>Math.abs(row[0].base-t.base)<t.size*.22);
      if(!row){row=[];rows.push(row)}row.push(t);
    }
    const candidates=rows.filter(row=>row.length>=3).map(row=>row.sort((a,b)=>a.x0-b.x0)).filter(row=>row.every((t,i)=>!i||number(t.text)>number(row[i-1].text)));
    if(candidates.length!==1)return null;
    const row=candidates[0],ticks=row.map(t=>({x:((t.x0+t.x1)/2-f.x0)/width,v:number(t.text)})),first=ticks[0],last=ticks.at(-1);
    if(last.x-first.x<.58||ticks.some(t=>Math.abs((t.x-first.x)/(last.x-first.x)-(t.v-first.v)/(last.v-first.v))>.014))return null;
    const titles=below.filter(t=>t.base>row[0].base+t.size*.55&&t.base<row[0].base+t.size*3&&Math.abs((t.x0+t.x1)/2-(f.x0+f.x1)/2)<width*.2&&!Number.isFinite(number(t.text)));
    if(titles.length!==1)return null;
    return {title:clean(titles[0].text),first,last};
  }
  function readSources(fig,rows){
    const chart=fig.curveChart,m=chart.mixed,cap=clean(fig.caption);
    if(symbol(m.title)!=='a'||!/(?:scale|expansion) factor/i.test(cap)||!/growth factor/i.test(cap))return;
    const top=symbol(chart.plots[0].ordinate.label),bottom=symbol(chart.plots[1].ordinate.label);
    const term=top.match(/^([gDG])\(a\)$/);
    if(!term)return;
    const q=term[1],fraction=bottom.match(new RegExp('^'+q+'\\(a\\)/'+q+'([\\p{L}\\d_]+)\\(a\\)$','u'));
    if(!fraction||!/(?:upper|top) panel.{0,100}growth/i.test(cap)||!/(?:lower|bottom) panel.{0,35}ratio.{0,45}growth/i.test(cap))return;
    const den=fraction[1],name=den.replace(/^LCDM$/i,'ΛCDM');
    const denClause=cap.match(/(?:with respect to|relative to|compared to|divided by)\s+(?:the\s+)?([\p{L}\d_-]+)/iu);
    if(!denClause||symbol(denClause[1]).toLowerCase()!==symbol(name).toLowerCase())return;
    const normalized=new RegExp('normali[sz]ed[^.]{0,50}'+q+'\\s*\\(\\s*a\\s*=\\s*1\\s*\\)\\s*=\\s*1\\b','i').test(cap)||/normali[sz]ed to (?:unity|one|1) (?:today|at a\s*=\s*1)/i.test(cap);
    if(!normalized||/\b(?:not|never)\s+normali[sz]ed/i.test(cap))return;
    // Only the paragraph citing this figure can corroborate its normalization.
    // An adjacent paragraph about power-spectrum ratios is a different observable.
    let body=null;
    for(let i=0;i<rows.length;i++){
      const r=rows[i];
      if(r.fig||!r.mentions?.includes(fig.matchKey))continue;
      const block=[];
      for(const line of rows.slice(Math.max(0,i-1),i+6)){
        if(line.page!==r.page||line.fig||line!==r&&line.mentions?.some(key=>key.startsWith('F:')&&key!==fig.matchKey))break;
        block.push(line.text);
      }
      const text=clean(block.join(' '));
      const quote=text.match(/\b[A-Z][^.!?]{0,185}?\ba\s*=\s*1,\s*when their linear (?:content|amplitudes?) (?:is|are) identical\./);
      if(quote){body={page:r.page,text:quote[0].trim()};break}
    }
    const capSource=cap.match(/(?:The )?(?:lower|bottom) panel.{0,200}?(?:with respect to|relative to|compared to|divided by)\s+(?:the\s+)?[\p{L}\d_-]+/iu);
    m.growth={q,den:name,body,caption:{page:fig.captionPage,text:capSource?.[0]||cap},normalization:normalized};
  }
  function explanation(chart,plot,entry){
    const m=chart.mixed,lower=plot===chart.plots[1],g=m.growth;
    if(!g)return {formula:plot.ordinate.label,zh:'本格印刷纵轴如上。上下格使用不同量，沿同一横坐标 '+m.title+' 对齐比较。轴标题的物理含义待核对。',en:'This is the printed y-axis. The rows show different quantities at the same '+m.title+'. The physical interpretation still needs verification.'};
    const name=entry.name.replace(/-(?=\d)/g,'−');
    return lower?{formula:g.q+'('+name+', a) / '+g.q+'('+g.den+', a)',zh:'在同一 a，把所选暗能量模型的增长因子除以 '+g.den+' 的增长因子。1 表示相等，1.10 表示这个模型在该时刻的归一化增长因子高 10%。',en:'At the same a, divide the growth factor of the selected dark-energy model by that of '+g.den+'. One means agreement. A ratio of 1.10 means the normalized growth factor is 10% higher at that epoch.'}:
      {formula:g.q+'(a) · '+g.q+'(1) = 1',zh:'线性增长因子表示小的物质密度起伏怎样随宇宙演化。每条线都除以这个模型自己今天的增长因子，使今天的值等于 1。例如 0.6 表示起伏幅度达到本模型今天的六成。这让终点相同的模型可以比较此前的增长历程。',en:'The linear growth factor tracks the amplitude of small matter-density fluctuations. Divide each history by its own present-day growth factor so it ends at one. A value of 0.6 means 60% of today’s amplitude in that model. Matching the endpoints lets you compare the paths to the same final amplitude.'};
  }
  function separation(chart,plot,index,peer){
    const m=chart.mixed,scale=plot.ordinate.scale;
    if(!scale||peer===index||!plot.series[peer])return null;
    const one=plot.series[index].ys,two=plot.series[peer].ys,points=[];
    const xAt=x=>m.first.v+(m.last.v-m.first.v)*(x-m.first.x)/(m.last.x-m.first.x);
    const val=y=>scale.top+(scale.bottom-scale.top)*y;
    for(let j=0;j<one.length;j++){
      const x=j/(one.length-1),a=xAt(x);
      if(x<m.first.x-.002||x>m.last.x+.002||one[j]==null||two[j]==null||m.growth&&a<=0)continue;
      const gap=val(one[j])-val(two[j]);
      points.push({x,a,j,one:one[j],two:two[j],gap});
    }
    if(points.length<10)return null;
    const peak=points.reduce((best,p)=>Math.abs(p.gap)>Math.abs(best.gap)?p:best);
    if(Math.abs(peak.gap)<=2*scale.resolution)return {unresolved:true};
    // Report the connected band around the peak that is indistinguishable
    // within the source stroke width. Do not bridge a missing interval.
    const at=points.indexOf(peak),close=p=>Math.sign(p.gap)===Math.sign(peak.gap)&&Math.abs(peak.gap)-Math.abs(p.gap)<=scale.resolution;
    let lo=at,hi=at;
    while(lo&&points[lo-1].j===points[lo].j-1&&close(points[lo-1]))lo--;
    while(hi+1<points.length&&points[hi+1].j===points[hi].j+1&&close(points[hi+1]))hi++;
    const names=[chart.entries[index].name,chart.entries[peer].name].map(n=>n.replace(/-(?=\d)/g,'−'));
    if(peak.gap<0)names.reverse();
    const early=m.growth&&lo===0&&m.first.v===0&&points[0].a<.02&&points[hi].a<.2;
    const range=early?m.title+' ≲ '+Number(points[hi].a.toPrecision(1)):m.title+' ≈ '+round(points[lo].a)+'–'+round(points[hi].a);
    const isRatio=m.growth&&plot===chart.plots[1];
    const digits=Math.max(0,Math.min(8,Math.floor(-Math.log10(scale.resolution))));
    const display=v=>Number(v.toFixed(digits)).toString();
    const difference=display(Math.abs(peak.gap));
    let zh='在 '+range+'，两条曲线分得最开。'+names[0]+' 在上，'+names[1]+' 在下，纵轴约相差 '+difference+'。';
    let en='Across the readable strokes, '+names[0]+' lies furthest above '+names[1]+' around '+range+', a vertical gap of about '+difference+'.';
    if(isRatio){zh+='两条比值约为 '+display(Math.max(val(peak.one),val(peak.two)))+' 和 '+display(Math.min(val(peak.one),val(peak.two)))+'。';en+=' The two ratios read approximately '+display(Math.max(val(peak.one),val(peak.two)))+' and '+display(Math.min(val(peak.one),val(peak.two)))+'.'}
    if(isRatio){const percent=Math.round(100*Math.abs(peak.gap));zh+='相当于当时 '+m.growth.den+' 增长因子的约 '+percent+'%。';en+=' The gap is about '+percent+'% of the reference growth factor at that epoch.'}
    if(m.growth&&lo===0&&points[0].a<.05){zh+='这是最早可读的一段，a = 0 处没有可读比值。';en+=' This is the earliest readable interval. The ratio at a = 0 is not measurable from the plot.'}
    return {peak,mark:points[Math.round((lo+hi)/2)],band:[points[lo].x,points[hi].x],zh,en};
  }
  window.MixedAxes={ordinate,sharedAxis,readSources,explanation,separation,captionRows,framePair};
})();
