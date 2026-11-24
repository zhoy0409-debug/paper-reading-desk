(() => {
  'use strict';
  const width=b=>b.x1-b.x0,height=b=>b.y1-b.y0;
  const midY=b=>(b.y0+b.y1)/2;
  const inside=(b,r,pad=0)=>b.x0>=r.x0-pad&&b.x1<=r.x1+pad&&b.y0>=r.y0-pad&&b.y1<=r.y1+pad;
  const near=(a,b,tol=1)=>['x0','y0','x1','y1'].every(k=>Math.abs(a[k]-b[k])<=tol);
  const normRect=(b,r)=>({x:(b.x0-r.x0)/width(r),y:(b.y0-r.y0)/height(r),width:width(b)/width(r),height:height(b)/height(r)});
  const unite=(a,b)=>({x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)});
  const num=s=>/^[−+-]?\d+(?:\.\d+)?$/.test(s.trim())?Number(s.trim().replace('−','-')):NaN;
  // Keep only continuous, left-to-right PDF strokes. A clip belongs to the
  // saved graphics state. Unknown clipping paths cannot certify visibility.
  function paths(list,ops,V,{mult,at,boxFrom}){
    let st={T:V,color:'#000000',dash:[],alpha:1,clip:null},saved=[],clipNext=false,total=0;
    const out=[];
    for(let i=0;i<list.fnArray.length;i++){
      const op=list.fnArray[i],a=list.argsArray[i]||[];
      if(op===ops.save||op===ops.paintFormXObjectBegin){
        saved.push(st);st={...st};
        if(op===ops.paintFormXObjectBegin&&a[0]?.length===6)st.T=mult(st.T,a[0]);
      }else if(op===ops.restore||op===ops.paintFormXObjectEnd){st=saved.pop()||st}
      else if(op===ops.transform)st.T=mult(st.T,a);
      else if(op===ops.setStrokeRGBColor)st.color=typeof a[0]==='string'?a[0]:null;
      else if(op===ops.setStrokeColorN||op===ops.setStrokeTransparent)st.color=null;
      else if(op===ops.setDash)st.dash=Array.from(a[0]||[]);
      else if(op===ops.setGState){for(const [key,v] of a[0]||[])if(key==='CA')st.alpha=v}
      else if(op===ops.clip||op===ops.eoClip)clipNext=true;
      else if(op===ops.constructPath){
        const p=a[1]?.length===1?a[1][0]:null,b=a[2]?.length===4?boxFrom(st.T,a[2]):null;
        if(clipNext){
          clipNext=false;
          const corners=p?.length===13&&p[12]===4&&[0,3,6,9].every((j,n)=>p[j]===(n?1:0))?
            [0,3,6,9].map(j=>at(st.T,p[j+1],p[j+2])):[];
          if(!b||corners.length!==4||corners.some(([x,y])=>
            Math.min(Math.abs(x-b.x0),Math.abs(x-b.x1))>.01||Math.min(Math.abs(y-b.y0),Math.abs(y-b.y1))>.01)){st.clip=false;continue}
          if(st.clip===false)continue;
          const old=st.clip;
          st.clip=old?{x0:Math.max(b.x0,old.x0),x1:Math.min(b.x1,old.x1),y0:Math.max(b.y0,old.y0),y1:Math.min(b.y1,old.y1)}:b;
          continue;
        }
        if(![ops.stroke,ops.fillStroke,ops.eoFillStroke].includes(a[0])||!p||!b||st.clip===false||
           st.alpha<.2||!/^#[a-f\d]{6}$/i.test(st.color)||width(b)<3||p.length>30000||p[0]!==0)continue;
        if((p.length===13||p.length===16)&&p.at(-1)===4){
          const pts=[0,3,6,9].map(j=>at(st.T,p[j+1],p[j+2]));
          if(width(b)>40&&height(b)>18&&new Set(pts.map(pt=>pt.join(','))).size===4&&pts.every(([x,y])=>
            Math.min(Math.abs(x-b.x0),Math.abs(x-b.x1))<.1&&Math.min(Math.abs(y-b.y0),Math.abs(y-b.y1))<.1))out.push({border:b,b,pts:[]});
          continue;
        }
        if(p.length%3)continue;
        const runs=[];let pts=[];
        for(let j=0;j<p.length;j+=3){
          if(p[j]===0){pts=[];runs.push(pts)}else if(p[j]!==1){runs.length=0;break}
          pts.push(at(st.T,p[j+1],p[j+2]));
        }
        for(const run of runs){
          if(run.length<2)continue;
          if(run[0][0]>run.at(-1)[0])run.reverse();
          if(run.some((pt,j)=>j&&pt[0]<run[j-1][0]-.01))continue;
          const ys=run.map(pt=>pt[1]),box={x0:run[0][0],x1:run.at(-1)[0],y0:Math.min(...ys),y1:Math.max(...ys)};
          if(width(box)<3||run.length===2&&height(box)>.2)continue;
          total+=run.length;if(total>180000||out.length>=5000)return [];
          const dash=st.dash.map(n=>+(n*Math.hypot(st.T[0],st.T[1])).toFixed(3));
          out.push({b:box,pts:run,clip:st.clip,color:st.color,dash,key:st.color+'/'+dash.join(',')});
        }
      }
    }
    return out;
  }
  function colorNames(hex){
    const [r,g,b]=hex.slice(1).match(/../g).map(s=>parseInt(s,16)),hi=Math.max(r,g,b),lo=Math.min(r,g,b);
    if(hi-lo<20)return hi<64?['黑','black']:['灰','gray'];
    if(Math.min(r,b)>hi*.86&&g<hi*.45)return ['品红','magenta'];
    if(b>g*1.18&&r>g*1.3)return ['紫','purple'];
    if(r>g*1.22&&r>b*1.22)return g>b*1.45&&g>70?['橙','orange']:['红','red'];
    if(g>r*1.25&&b>r*1.2&&Math.abs(g-b)<hi*.23)return ['青绿','teal'];
    if(b===hi)return ['蓝','blue'];
    if(g===hi)return ['绿','green'];
    return ['黄褐','ochre'];
  }
  function style(d){
    if(!d.length)return ['实线','solid'];
    if(d.length===4&&Math.max(d[0],d[2])>2*Math.min(d[0],d[2]))return ['点划线','dash-dot'];
    if(d.length===2)return d[0]<=d[1]?['点线','dotted']:['虚线','dashed'];
    return ['间断线','patterned'];
  }
  function legend(all,words,crop){
    const candidates=[];
    for(const seg of all.filter(p=>p.pts.length>=2&&p.pts.length<=4&&height(p.b)<.2&&inside(p.b,crop,1))){
      const b=seg.b;
      const adjacent=words.filter(t=>inside(t,crop,1)&&t.x0>=b.x1-.4&&t.x0-b.x1<1.65*t.size&&
        Math.abs(t.base-t.size*.34-midY(b))<t.size*.45&&width(b)>=t.size*.75&&width(b)<=t.size*9)
        .sort((a,b)=>a.x0-b.x0);
      const left=words.filter(t=>inside(t,crop,1)&&t.x1<=b.x0+.4&&b.x0-t.x1<t.size*1.65&&
        Math.abs(t.base-t.size*.34-midY(b))<t.size*.45&&width(b)>=t.size*.75&&width(b)<=t.size*9).sort((a,b)=>b.x1-a.x1);
      const t=adjacent[0]||left[0];if(!t||!/[\p{L}]/u.test(t.text)||t.text.length>70)continue;
      // Join adjacent PDF text runs on the same legend baseline (math fonts,
      // subscripts and symbols can be emitted as distinct text objects).
      let end=t.x1,label=t.text;let box=unite(b,t);
      for(const n of words.filter(n=>n!==t&&n.x0>=end-.3&&Math.abs(n.base-t.base)<t.size*.27&&inside(n,crop,1)).sort((a,b)=>a.x0-b.x0)){
        if(n.x0-end>t.size*.55||label.length+n.text.length>72)break;
        label+=(n.x0-end>.18*t.size?' ':'')+n.text;end=n.x1;box=unite(box,n);
      }
      candidates.push({name:label.trim(),key:seg.key,color:seg.color,dash:seg.dash,box});
    }
    return candidates;
  }
  function ticksX(words,f){
    const nearAxis=words.filter(t=>t.base>f.y1&&t.base<f.y1+3*t.size&&t.x0>f.x0-2*t.size&&t.x0<f.x1+t.size);
    const powered=[];
    for(const t of nearAxis.filter(t=>t.text==='10')){
      const after=nearAxis.filter(n=>n.size<t.size*.88&&n.x0>=t.x1-1&&n.x0<t.x1+t.size*.45&&n.base<t.base-t.size*.2&&Number.isInteger(num(n.text)));
      if(after.length===1)powered.push({v:10**num(after[0].text),x:(t.x0+after[0].x1)/2});
    }
    const decimals=nearAxis.filter(t=>num(t.text)>0&&Math.abs(t.base-nearAxis.find(n=>n.text==='1')?.base)<1).map(t=>({v:num(t.text),x:(t.x0+t.x1)/2}));
    const sorted=(powered.length?powered:decimals).sort((a,b)=>a.x-b.x);
    if(sorted.length<3||sorted.some((t,i)=>i&&t.v<=sorted[i-1].v))return [];
    const [a,b]=[sorted[0],sorted.at(-1)];
    if(b.x-a.x<width(f)*.55||sorted.some(t=>Math.abs((t.x-a.x)/(b.x-a.x)-Math.log(t.v/a.v)/Math.log(b.v/a.v))>.015))return [];
    return sorted;
  }
  function scaleY(words,f){
    const ts=words.filter(t=>Number.isFinite(num(t.text))&&t.x1<f.x0+1&&f.x0-t.x1<t.size*1.7&&
      t.base-t.size*.35>=f.y0-2&&t.base-t.size*.35<=f.y1+2)
      .map(t=>({y:t.base-t.size*.35,v:num(t.text)})).sort((a,b)=>a.y-b.y);
    if(ts.length<3||ts.some((p,i)=>i&&p.v>=ts[i-1].v))return null;
    const a=ts[0],b=ts.at(-1),s=(b.v-a.v)/(b.y-a.y);
    if(b.y-a.y<height(f)*.55||ts.some(t=>Math.abs(a.v+(t.y-a.y)*s-t.v)>Math.abs(s)*1.7))return null;
    return y=>a.v+(y-a.y)*s;
  }
  function sample(points,x){
    if(x<points[0][0]-.05||x>points.at(-1)[0]+.05)return null;
    let l=1,r=points.length-1;while(l<r){const m=(l+r)>>1;if(points[m][0]<x)l=m+1;else r=m}
    const [a,b]=[points[l-1],points[l]],d=b[0]-a[0];
    return d>0?a[1]+(b[1]-a[1])*(x-a[0])/d:null;
  }
  function detect(all,words,vertical,crop,rows,caption){
    const legends=legend(all,words,crop),groups=[];
    if(legends.length<2)return null;
    const borders=all.filter(p=>p.border&&inside(p.b,crop,2)).map(p=>p.b);
    for(const p of all){
      const box=borders.filter(b=>inside(p.b,b,1)&&width(p.b)>width(b)*.4).sort((a,b)=>width(a)*height(a)-width(b)*height(b))[0];
      const f=box&&(!p.clip||inside(box,p.clip,1))?box:p.clip;
      if(!f||!inside(f,crop,2)||width(f)<45||height(f)<18||width(p.b)<width(f)*.45||p.pts.length<5||!legends.some(l=>l.key===p.key))continue;
      let group=groups.find(g=>near(g.f,f));if(!group){group={f,paths:[]};groups.push(group)}group.paths.push(p);
    }
    if(!groups.length||groups.length>20)return null;
    const ordered=groups.sort((a,b)=>a.f.y0-b.f.y0);
    const aligned=ordered.every((g,i)=>!i||Math.abs(g.f.x0-ordered[0].f.x0)<2&&Math.abs(g.f.x1-ordered[0].f.x1)<2&&g.f.y0>=ordered[i-1].f.y1-1);
    const matrix=!rows?.length&&!aligned&&CurveRatio.matrix(ordered);
    const selected=rows?.length?rows.map(r=>groups.find(g=>near(g.f,r.frame,2.3))):aligned?ordered:matrix||[];
    if(!selected.length||selected.some(g=>!g))return null;
    const entries=[];
    for(const key of new Set(legends.map(l=>l.key))){
      const counts=selected.map(g=>g.paths.filter(p=>p.key===key).length);
      if(!counts.includes(1)||(!matrix&&counts.some(n=>n!==1)))continue;
      const matches=legends.filter(l=>l.key===key);
      if(new Set(matches.map(m=>m.name)).size!==1)continue;
      const entry=matches[0];
      if(entries.some(e=>e.name===entry.name))return null;
      entries.push({...entry,box:normRect(entry.box,crop),cn:colorNames(entry.color),line:style(entry.dash)});
    }
    if(entries.length<2||entries.length>18)return null;
    for(const e of entries){
      const twin=entries.filter(a=>a.color===e.color&&a!==e&&a.dash.length===2&&e.dash.length===2&&Math.abs(a.dash[0]/a.dash[1]-e.dash[0]/e.dash[1])<.06);
      if(twin.length===1&&Math.max(e.dash[0],twin[0].dash[0])>1.5*Math.min(e.dash[0],twin[0].dash[0]))
        e.line=e.dash[0]>twin[0].dash[0]?['长虚线','long-dashed']:['短虚线','short-dashed'];
      const named=e.name.match(/^([A-Za-z-]+)\s*\(((?:19|20)\d{2})\)$/);
      if(named&&e.dash.length===2){
        const print=caption.match(new RegExp('\\b'+named[1]+'(?: et al\\.)?\\s*\\('+named[2]+'[a-z]?\\)[^();.]{0,50}\\((long|short)[ -]dashed\\s*[;,]\\s*'+e.cn[1]+'\\)','i'));
        if(print)e.line=print[1].toLowerCase()==='long'?['长虚线','long-dashed']:['短虚线','short-dashed'];
      }
    }
    const bottom=selected.at(-1).f,xt=ticksX(words,bottom);
    const xTitle=words.find(t=>inside(t,crop,1)&&t.base>bottom.y1&&t.x0>=bottom.x0&&t.x1<=bottom.x1&&/^k(?:\s*[[/(]|$)/i.test(t.text.trim()));
    const axis=words.filter(t=>inside(t,crop,1)&&t.base>bottom.y1&&(!xTitle||Math.abs(t.base-xTitle.base)<xTitle.size*.8)&&t.x0>bottom.x0+width(bottom)*.16&&t.x1<bottom.x1-width(bottom)*.15)
      .sort((a,b)=>a.x0-b.x0).map(t=>t.text).join('').normalize('NFKC').replace(/\s/g,'');
    const k=!!xt.length&&/k(?:\[|\/\(?|\()hMpc[−-]1/i.test(axis);
    const yl=vertical.filter(t=>t.y0>=crop.y0-3&&t.y1<=crop.y1+3&&t.x1<bottom.x0&&bottom.x0-t.x1<width(bottom)*.2)
      .sort((a,b)=>b.y1-a.y1).map(t=>t.text).join('').normalize('NFKC');
    const composite=/^P\/Pcomposite$/i.test(yl.replace(/\s/g,''))&&/reference spectra/i.test(caption)&&/power spectr/i.test(caption);
    const spectra=yl.match(/^P([\p{L}\d -]{2,25})\(k\)\s*\/\s*P([\p{L}\d -]{2,25})\(k\)$/u);
    const ratio=composite||!!spectra&&/ratio of power spectra/i.test(caption);
    const plots=selected.map(({f,paths,cell},i)=>{
      const value=scaleY(words,f),rightTicks=words.filter(t=>Number.isFinite(num(t.text))&&t.x0>f.x1&&t.x0<f.x1+t.size&&t.y0>f.y0&&t.y1<f.y1);
      const calibrated=!matrix&&ratio&&value&&!rightTicks.length&&value(f.y0)>1&&value(f.y1)<1;
      const series=entries.map(e=>{
        const matching=paths.filter(p=>p.key===e.key);
        if(matching.length!==1)return {ys:Array(161).fill(null),bands:[],unresolved:true};
        const pts=matching[0].pts;
        // Keep the sampled evidence local to the visible plot. Missing samples
        // break the highlight and never contribute to a range or overlap.
        const ys=Array.from({length:161},(_,j)=>{
          const y=sample(pts,f.x0+j*width(f)/160);
          return y==null||y<f.y0-.15||y>f.y1+.15?null:+((y-f.y0)/height(f)).toFixed(4);
        });
        const bands=[];
        if(calibrated&&xt.length)for(let j=1;j<xt.length;j++){
          const [a,b]=xt.slice(j-1,j+1);
          const vals=ys.map((y,n)=>({y,x:f.x0+width(f)*n/160})).filter(p=>p.y!=null&&p.x>=a.x-1&&p.x<=b.x+1).map(p=>value(f.y0+p.y*height(f)));
          if(vals.length>=4)bands.push({from:a.v,to:b.v,lo:Math.min(...vals),hi:Math.max(...vals),last:vals.at(-1),partial:vals.length<(b.x-a.x)/width(f)*160*.85});
        }
        return {ys,bands};
      });
      const overlaps=[],sharedSpans=[];
      for(let a=0;a<series.length;a++)for(let b=a+1;b<series.length;b++){
        const pairs=series[a].ys.map((v,j)=>[v,series[b].ys[j]]).filter(([v,w])=>v!=null&&w!=null);
        if(pairs.length>=25&&pairs.filter(([v,w])=>Math.abs(v-w)*height(f)<.75).length>=pairs.length*.93)overlaps.push([a,b]);
        let start=null;
        for(let j=0;j<=series[a].ys.length;j++){
          const v=series[a].ys[j],w=series[b].ys[j];
          if(v!=null&&w!=null&&Math.abs(v-w)*height(f)<.55){start??=j;continue}
          if(start!=null&&j-start>=28&&xt.length&&!matrix){
            const first=xt[0],last=xt.at(-1);
            const atTick=n=>Number((first.v*(last.v/first.v)**((f.x0+n/160*width(f)-first.x)/(last.x-first.x))).toPrecision(2));
            sharedSpans.push({a,b,from:atTick(start),to:atTick(j-1)});
          }
          start=null;
        }
      }
      const ratioAxis=CurveRatio.frameEvidence(f,vertical,words,entries,crop);
      const ordinate=MixedAxes.ordinate(f,vertical,crop,value&&!rightTicks.length?value:null);
      const scale=value&&!rightTicks.length&&value(f.y0)>1&&value(f.y1)<1?{top:value(f.y0),bottom:value(f.y1),tolerance:Math.abs(value(f.y0)-value(f.y0+.8))}:null;
      const guides=scale?all.filter(s=>s.pts.length===2&&s.dash.length&&Math.abs(s.b.x0-f.x0)<1&&Math.abs(s.b.x1-f.x1)<1&&midY(s.b)>f.y0&&midY(s.b)<f.y1)
        .map(s=>value(midY(s.b))):[];
      return {id:rows?.[i]?.id||'plot-'+i,cell,frame:normRect(f,crop),calibrated:!!calibrated,series,overlaps,sharedSpans,ratioAxis,ordinate,scale,guides,condition:rows?.[i]?.conditions?.join(', ')||''};
    });
    const mixed=aligned&&plots.length===2?MixedAxes.sharedAxis(words,bottom,crop,plots):null;
    return {entries,plots,k,ratio,composite,mixed,denominator:composite?'composite':spectra?.[2],xt:xt.map(t=>t.v),tickPositions:xt.map(t=>(t.x-bottom.x0)/width(bottom))};
  }
  const limits=(v)=>Math.round(v*100)/100;
  function overview(chart,plot){
    const fitted=chart.entries.map((e,i)=>({e,b:plot.series[i].bands})).filter(t=>!t.e.simulation&&t.b.length);
    if(!fitted.length)return null;
    const largest=b=>Math.max(b.hi-1,1-b.lo);
    const strong=fitted.map(t=>({e:t.e,b:t.b.reduce((best,b)=>largest(b)>largest(best)?b:best)})).filter(t=>largest(t.b)>=.09);
    if(!strong.length){
      const high=fitted.map(s=>s.b.at(-1)),range=high[0].from+'–'+high[0].to;
      const bound=Math.ceil(Math.max(...high.map(largest))*100);
      return ['在最右一段 '+(chart.k?'k = ':'')+range+'，各条预测仍围绕 1。按图内可见曲线估读，偏离最多约 '+bound+'%。','In the rightmost interval ('+range+'), the predictions remain near one. The largest visible departure there is roughly '+bound+'%.'];
    }
    const lead=strong.reduce((a,b)=>largest(a.b)>largest(b.b)?a:b).b;
    const peers=strong.filter(t=>t.b.from===lead.from&&t.b.to===lead.to&&Math.abs(largest(t.b)-largest(lead))<.015&&
      (t.b.hi-1>1-t.b.lo)===(lead.hi-1>1-lead.lo));
    const names=peers.map(p=>p.e.name).join(' / '),up=lead.hi-1>1-lead.lo;
    return [names+' 在 '+(chart.k?'k = ':'')+lead.from+'–'+lead.to+' 这段可见的偏离最大，向参考线'+(up?'上方':'下方')+'分开。'+(lead.partial?'部分曲线越出图框。':''),names+' depart most clearly '+(up?'above':'below')+' one in the visible part of '+(chart.k?'k = ':'')+lead.from+'–'+lead.to+'.'+(lead.partial?' Part of the trace is outside the plot.':'')];
  }
  function enrich(fig,documentRows){
    const c=fig.curveChart;
    CurveRatio.resolve(fig,documentRows);
    if(c.mixed)MixedAxes.readSources(fig,documentRows);
    const nearby=documentRows.filter(r=>r.page===fig.captionPage).map(r=>r.text).join(' ').normalize('NFKC');
    const composite=c.composite&&nearby.match(/reference spectra.{0,65}?taken from the ([\w-]+) simulation for.{0,65}?and an ensemble of ([\w-]+) simulations/i);
    const fallback=nearby.match(/([A-Z][a-z]+\s*&\s*[A-Z][a-z]+)\s*\((\d{4})\)[^.]{0,280}\.\s*As expected,\s*this model[^.]{0,180}?calibrated beyond\s*z\s*=\s*(\d+)\s+and reverts to that provided by\s*([A-Z][a-z]+)\s+et al\.\s*\((\d{4})\)/);
    for(const e of c.entries){
      const short=e.name.match(/^([A-Za-z-]+)\+(\d\d)$/);
      if(short){
        const ref=fig.caption.match(new RegExp('\\b'+short[1]+'(?: et al\\.| & [A-Z][a-z-]+) (?:19|20)'+short[2]+'\\b'));
        if(ref)e.full=ref[0];
      }
      if(/^[a-z\d-]+$/i.test(e.name)&&fig.caption.toLowerCase().includes(e.name.toLowerCase()+' simulation'))e.simulation=true;
    }
    for(const p of fig.panels){
      const plot=c.plots.find(g=>g.id===p.id);if(!plot||!p.reading)continue;
      const note=overview(c,plot);
      if(note)p.reading.narration=(plot.condition?plot.condition+'，':'')+note[0];
      // A compact legend outside the data frames can travel with any row.
      const boxes=c.entries.map(e=>e.box),left=Math.max(0,Math.min(...boxes.map(b=>b.x))-.006),top=Math.max(0,Math.min(...boxes.map(b=>b.y))-.006);
      const right=Math.min(1,Math.max(...boxes.map(b=>b.x+b.width))+.006),bottom=Math.min(1,Math.max(...boxes.map(b=>b.y+b.height))+.006);
      if(fig.pageBox&&bottom<=c.plots[0].frame.y&&bottom-top<.15&&right>left){
        const b=fig.pageBox;
        p.gridShared.push({kind:'legend',label:'原图共用图例 / Printed legend',box:{x:b.x+left*b.width,y:b.y+top*b.height,width:(right-left)*b.width,height:(bottom-top)*b.height}});
      }
      p.reading.rows=p.reading.rows.filter(r=>!['Axis assignment to verify','Position on the original','Values to verify'].includes(r.en));
      const condition=p.reading.rows.find(r=>r.en==='Condition printed inside the frame');
      if(condition&&c.composite&&/^z\s*=/.test(plot.condition)&&/high redshift/i.test(nearby)){
        condition.zh='图中的 '+plot.condition+' 是红移。z 越大，看到的宇宙越早。上下格在相同的共动尺度上比较不同宇宙时期的预测。';
        condition.enText=plot.condition+' is the redshift. Higher z means an earlier universe. Compare vertically aligned points to see how well the predictions agree at the same comoving scale in different epochs.';
      }
      if(c.k)p.reading.rows.push({role:'沿横轴选尺度',en:'Read the wavenumber',zh:'横轴 k 是共动波数，单位 h Mpc⁻¹。向右一大格，k 增大十倍，对应的空间尺度缩小到十分之一（λ = 2π/k）。上下格竖直对齐的位置代表同一尺度。',enText:'The horizontal axis is comoving wavenumber k in h Mpc⁻¹. One major step right multiplies k by ten and divides the corresponding length by ten (λ = 2π/k). Vertically aligned points probe the same scale.'});
      if(c.composite)p.reading.rows.push({role:'为什么看 1',en:'Why compare with one?',zh:'纵轴是同一红移、同一 k 下的功率除以复合参考谱的功率。功率描述物质密度在这个尺度上的起伏强度。比值为 1 表示与参考相同，例如 1.1 表示高 10%，0.9 表示低 10%。',enText:'At each k and redshift, divide the power in density fluctuations by the composite reference power. One means equal power. For example, 1.1 means 10% more power and 0.9 means 10% less.'});
      if(composite)p.reading.rows.push({role:'参考谱从哪里来',en:'What goes into the reference?',zh:'作者把 '+composite[1]+' 的模拟功率谱与一组 '+composite[2].toUpperCase()+' 模拟的功率谱拼接起来，作为各条曲线共用的分母。',enText:'The authors combine the '+composite[1]+' simulation with an ensemble of '+composite[2].toUpperCase()+' simulations. Every curve uses this composite spectrum as its denominator.'});
      if(/estimated\s*1\s*[σ𝜎]\s*scatter/i.test(fig.caption.normalize('NFKC')))p.reading.rows.push({role:'灰色带',en:'Shaded band',zh:'图注将灰带标为模拟功率估计的一个标准差的散布范围。',enText:'The caption identifies the gray band as the estimated one-standard-deviation scatter of the simulation.'});
      if(fallback&&plot.overlaps.some(pair=>pair.some(i=>c.entries[i].full?.includes(fallback[1]))&&pair.some(i=>c.entries[i].full?.includes(fallback[4])))){
        const [quote,model,,limit,other]=fallback;
        p.reading.rows.push({role:'作者解释了重合原因',en:'Why these lines coincide',zh:'作者说明，'+model+' 的模型只校准到 z = '+limit+'，在更高红移采用 '+other+' 等人的预测，因此两条线在这一格重合。',enText:'The authors explain that '+model+' was calibrated up to z = '+limit+' and reverts to the '+other+' prediction above that redshift. This accounts for the overlaid curves here.'});
        p.reading.sources.push({kind:'模型适用范围 · 正文',en:'Model calibration in the article',page:fig.captionPage,text:'… '+quote.slice(quote.lastIndexOf('not calibrated'))});
      }
      p.reading.rows.push({role:'数值待核对',en:'Values to verify',zh:'区间描述来自图框内可见曲线。精确单点值需核对作者数据。',enText:'Ranges describe the visible curves inside the frame. Exact point values require the underlying data.'});
    }
  }
  function describe(chart,plot,index){
    const s=plot.series[index],out=[];
    for(const b of s.bands){
      const diff=Math.max(Math.abs(b.hi-1),Math.abs(1-b.lo));
      const level=diff<.026?['贴近参考线','stays close to one']:diff<.055?['在参考线附近略有起伏','varies modestly around the reference']:
        b.hi-1>2*(1-b.lo)?['向参考线上方偏离','departs above one']:1-b.lo>2*(b.hi-1)?['向参考线下方偏离','departs below one']:['在参考线上下波动','moves to both sides of one'];
      const lo=limits(b.lo).toFixed(2),hi=limits(b.hi).toFixed(2),range='≈ '+lo+(lo===hi?'':'–'+hi);
      const turns=b.lo<.96&&b.last>1.04;
      out.push({label:(chart.k?'k ':'')+b.from+'–'+b.to,zh:(turns?'从参考线下方转向上方':level[0])+'（'+range+'）'+(b.partial?'，仅图框内可见部分':''),en:(turns?'turns up from below one to above one':level[1])+' ('+range+')'+(b.partial?', visible portion only':'')});
    }
    return out;
  }
  function contrast(c,index){
    if(c.plots.length<2)return null;
    const a=c.plots[0],b=c.plots.at(-1),x=a.series[index].bands,y=b.series[index].bands;
    if(!x.length||x.length!==y.length)return null;
    const dev=b=>Math.max(Math.abs(b.hi-1),Math.abs(b.lo-1));
    const delta=x.map((v,i)=>dev(y[i])-dev(v)),j=delta.indexOf(Math.max(...delta)),band=y[j];
    const first=a.condition||'①',last=b.condition||String(c.plots.length),when=first+' → '+last;
    if(delta[j]<.025)return [when+'，各刻度区间中均未读出偏离明显增大。',when+' · None of the sampled intervals shows a clear increase in departure.'];
    const side=band.hi-1>1-band.lo?['偏高','above']:['偏低','below'];
    return [when+'，偏离增幅最大的可见区段为 '+(c.k?'k = ':'')+band.from+'–'+band.to+'，在下格主要'+side[0]+'。',when+' · The largest increase in visible departure is in '+(c.k?'k = ':'')+band.from+'–'+band.to+', mainly '+side[1]+' one in the bottom frame.'];
  }
  window.CurveReading={paths,legend,ticksX,scaleY,detect,enrich,describe,contrast,overview};
})();
