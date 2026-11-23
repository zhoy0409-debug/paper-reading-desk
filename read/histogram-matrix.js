(() => {
  'use strict';
  const num=String.raw`[+−-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+−-]?\d+)?`;
  const scalar=String.raw`(?:\d{1,3}(?:,\s?\d{3})+(?:\.\d+)?|${num})`;
  const assignment=new RegExp(String.raw`(?<![\p{L}\p{N}_])([\p{L}][\p{L}\p{N}_]{0,13})\s*=\s*(\(\s*${num}(?:\s*,\s*${num})+\s*\)|${scalar})(?![\p{L}\d%/×^])`,'gu');
  const ordinals=['first','second','third','fourth','fifth','sixth'];
  const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
  const fmt=x=>String(Number(x.toPrecision(3)));
  const row=(zh,en,cn,eng)=>({zh,en,content:{zh:cn,en:eng}});
  function assignments(s){
    const result={};
    for(const m of s.matchAll(assignment)){
      if(Object.hasOwn(result,m[1]))return null;
      const v=m[2].replace(/\s/g,'').replace(/−/g,'-');
      result[m[1]]=v.startsWith('(')?v.slice(1,-1).split(','):[v.replaceAll(',','')];
    }
    return result;
  }
  // A tuple only acquires a position when the caption accounts for the full
  // observed lattice. Do not borrow an assignment from an adjacent row.
  function fromCaption(caption,cells){
    const nRows=Math.max(...cells.map(c=>c.row))+1,nCols=Math.max(...cells.map(c=>c.col))+1;
    if(cells.length!==nRows*nCols||nRows<2||nCols<2)return false;
    const headers=[...caption.matchAll(/\b(first|second|third|fourth|fifth|sixth|top|middle|bottom|left|right)\s+(row|line|column)\s*[:–—-]\s*/gi)];
    if(!headers.length)return false;
    const vertical=headers[0][2].toLowerCase()==='column',count=vertical?nCols:nRows,across=vertical?nRows:nCols;
    if(headers.length!==count)return false;
    const intro=caption.slice(0,headers[0].index);
    const global=assignments(intro.split(/\b(?:with|at|fixed at)\b/i).slice(1).join(' '));
    if(!global||Object.values(global).some(a=>a.length!==1))return false;
    const bands=[];
    for(const [i,h] of headers.entries()){
      const name=h[1].toLowerCase(),order=ordinals.indexOf(name);
      const side=(vertical?['left','right']:['top','bottom']).indexOf(name);
      const pos=order>=0?order:side===0?0:side===1?count-1:name==='middle'&&count===3?1:-1;
      if(pos!==i||(h[2].toLowerCase()==='column')!==vertical)return false;
      const clause=caption.slice(h.index+h[0].length,headers[i+1]?.index).split(/\.(?:\s|$)/)[0];
      const locals=assignments(clause);
      if(!locals||!Object.keys(locals).length||Object.keys(locals).some(k=>Object.hasOwn(global,k))||
         Object.values(locals).some(v=>v.length!==1&&v.length!==across))return false;
      // Reject unparsed formulas/units instead of silently treating their leading number as a setting.
      if(clause.replace(assignment,'').replace(/\band\b/gi,'').replace(/[\s,;]+/g,'')!=='')return false;
      bands.push({...locals,...global});
    }
    const names=Object.keys(bands[0]);
    if(bands.some(b=>names.length!==Object.keys(b).length||!names.every(k=>Object.hasOwn(b,k))))return false;
    const titles=cells.map(c=>assignments(c.title||''));
    const titleKeys=Object.keys(titles[0]||{});
    const useTitles=titleKeys.length&&titles.every((t,i)=>t&&Object.keys(t).length===titleKeys.length&&
      titleKeys.every(k=>t[k]?.length===1)&&!(cells[i].title||'').replace(assignment,'').replace(/[ ,;()]/g,''));
    const sets=[];
    for(const [i,c] of cells.entries()){
      const band=bands[vertical?c.col:c.row],j=vertical?c.row:c.col;
      const values=Object.fromEntries(names.map(k=>[k,band[k][j]??band[k][0]]));
      if(useTitles)for(const k of titleKeys){
        if(Object.hasOwn(values,k)&&Number(values[k])!==Number(titles[i][k][0]))return false;
        values[k]=titles[i][k][0];
      }
      sets.push(values);
    }
    cells.forEach((c,i)=>{c.conditions=sets[i]});
    return true;
  }

  // Only use equal-width vector rectangles sharing a zero baseline. Curves,
  // legends and raster pixels cannot establish bar heights with this method.
  function barProfile(marks,xt,yt,top){
    if(xt.length<3||yt.length<2)return null;
    const zero=yt.find(t=>Number(t.text)===0);
    if(!zero)return null;
    const centerX=b=>(b.x0+b.x1)/2,centerY=b=>(b.y0+b.y1)/2;
    const read=t=>Number(t.text.replace('−','-').replace(',','.'));
    const x0=centerX(xt[0]),x1=centerX(xt.at(-1)),span=x1-x0,range=read(xt.at(-1))-read(xt[0]);
    const xUnit=range/span,zy=centerY(zero),last=yt.at(-1),yUnit=read(last)/(zy-centerY(last));
    if(!(xUnit>0&&yUnit>0)||xt.some(t=>Math.abs(read(t)-read(xt[0])-(centerX(t)-x0)*xUnit)>range*.015)||
       yt.some(t=>Math.abs(read(t)-(zy-centerY(t))*yUnit)>read(last)*.04))return null;
    const rects=marks.map(m=>m.barRect).filter(b=>b&&Math.abs(b.y1-zy)<xt[0].size*.85&&
      b.x0>=x0-span*.16&&b.x1<=x1+span*.16&&b.x1-b.x0>span*.006&&b.x1-b.x0<span*.30&&b.y1>b.y0);
    if(rects.length<5)return null;
    const width=median(rects.map(b=>b.x1-b.x0));
    const seq=rects.filter(b=>Math.abs((b.x1-b.x0)/width-1)<.09).sort((a,b)=>a.x0-b.x0);
    if(seq.length<5||seq.length<rects.length*.9||seq.some((b,i)=>i&&b.x0<seq[i-1].x1-width*.09))return null;
    const gap=seq.slice(1).map((b,i)=>(b.x0-seq[i].x1)/width);
    if(gap.filter(g=>Math.abs(g)<.10).length<gap.length*.65||gap.some(g=>Math.abs(g-Math.round(g))>.13))return null;
    const bars=seq.map(b=>({lo:(b.x0-x0)*xUnit+read(xt[0]),hi:(b.x1-x0)*xUnit+read(xt[0]),
      height:(b.y1-Math.max(top,b.y0))*yUnit}));
    const max=Math.max(...bars.map(b=>b.height));
    if(!(max>0))return null;
    const peaks=bars.filter(b=>b.height>=max*.96),binsAt=(low,high)=>bars.filter(b=>{
      const mid=((b.lo+b.hi)/2-read(xt[0]))/range;return mid>=low&&mid<=high;
    });
    const mean=bs=>bs.length?bs.reduce((n,b)=>n+b.height,0)/bs.length:NaN;
    const middle=mean(binsAt(.35,.65)),left=mean(binsAt(0,.2)),right=mean(binsAt(.8,1));
    const bothEnds=middle>0&&left>middle*1.7&&right>middle*1.7;
    const concentrated=peaks.at(-1).hi-peaks[0].lo<=range*.30;
    const neat=x=>fmt(Math.abs(x)<range*.0005?0:Math.round(x/(width*xUnit*.01))*width*xUnit*.01);
    const integral=bars.reduce((total,b)=>total+(b.hi-b.lo)*b.height,0);
    function quartile(fraction){
      let target=integral*fraction;
      for(const b of bars){
        const area=(b.hi-b.lo)*b.height;
        if(area>0&&target<=area)return b.lo+target/b.height;
        target-=area;
      }
      return null;
    }
    const middleHalf=Math.abs(integral-1)<.07?[quartile(.25),quartile(.75)]:null;
    return {peak:concentrated?[neat(peaks[0].lo),neat(peaks.at(-1).hi)]:null,bothEnds,
      middleHalf,densityArea:Math.abs(integral-1)<.07};
  }
  const position=c=>'R'+(c.row+1)+' · C'+(c.col+1);
  const settings=c=>Object.entries(c.conditions).map(([k,v])=>k+' = '+v).join(', ');
  function definitions(texts,conditions){
    const symbol=String.raw`[\p{L}][\p{L}\d_]{0,10}`;
    const role='median|mean|variance|dispersion|scale|location|skewness|shape';
    const list=atom=>atom+'(?:(?:\\s*,\\s*|\\s*,?\\s+and\\s+)'+atom+')+';
    const pattern=new RegExp('\\bparameters?\\s+(?<symbols>'+list(symbol)+')\\s+(?:represent|denote|are)\\s+(?:the\\s+)?(?<roles>'+list('(?:'+role+')')+')(?=\\s|[.,;])','giu');
    const result={},ambiguous=new Set();
    for(const [page,text] of texts){
      for(const m of text.matchAll(pattern)){
        const separator=/\s*,\s*(?:and\s+)?|\s+and\s+/;
        const keys=m.groups.symbols.split(separator),roles=m.groups.roles.toLowerCase().split(separator);
        if(keys.length!==roles.length||keys.some(k=>!Object.hasOwn(conditions,k)))continue;
        for(const [i,k] of keys.entries()){
          if(result[k]&&result[k].role!==roles[i])ambiguous.add(k);
          result[k]||={role:roles[i],page,quote:m[0]};
        }
      }
    }
    for(const k of ambiguous)delete result[k];
    return result;
  }
  const meanings={
    median:['中位数，把取值分成上下各一半','median, the halfway point of the distribution'],
    dispersion:['离散程度，描述取值有多分散','dispersion, how spread out the values are'],
    skewness:['偏度，描述分布两侧的不对称程度','skewness, the asymmetry of the distribution'],
    mean:['均值','mean'],variance:['方差','variance'],location:['位置参数','location parameter'],
    scale:['尺度参数','scale parameter'],shape:['形状参数','shape parameter']
  };
  function shape(c){
    const prefix=position(c);
    if(c.profile?.bothEnds)return [prefix+' 两端的柱子整体高中间低，样本向取值范围两端集中。',prefix+' has taller bars at both ends than in the middle.'];
    if(c.profile?.peak){
      const bin=c.profile.peak.join('–');
      return [prefix+' 最高的一组柱子约在 '+bin+'。',prefix+' has its tallest bars around '+bin+'.'];
    }
    return [prefix+' 的主要集中区待从原图核对。',prefix+' has no reliably located peak interval.'];
  }
  function reading(c,peer,caption,evidence){
    const out=[],sim=/histograms? of (?:simulated|random|generated) (?:numbers|values|samples|observations)/i.test(caption);
    const curve=/\b(?:solid (?:lines?|curves?)[^.]{0,95}\bdensit(?:y|ies)|densit(?:y|ies)[^.]{0,60}\bsolid (?:lines?|curves?))/i.test(caption);
    const dual=/right.{0,6}(?:y[- ]?axis|vertical axis)/i.test(caption);
    if(peer){
      const keys=Object.keys(c.conditions),changed=keys.filter(k=>Number(peer.conditions[k])!==Number(c.conditions[k]));
      const fixed=keys.filter(k=>!changed.includes(k)).map(k=>k+' = '+c.conditions[k]).join(', ');
      const moves=changed.map(k=>k+' '+peer.conditions[k]+' → '+c.conditions[k]).join(', ');
      const tag=c.row===peer.row?['同行','Same row']:c.col===peer.col?['同列','Same column']:['跨行跨列','Different rows and columns'];
      const pair=position(peer)+' → '+position(c);
      out.push(row(tag[0]+'对比',tag[1],pair+'。'+(moves?'变化的参数为 '+moves+'。':'两格已核对的参数值相同。')+
        (fixed?'两图共有 '+fixed+'。':'')+(changed.length>1?'多个参数同时改变，单凭这两格无法分开它们各自的作用。':!changed.length?'两图的设置相同，图注未说明是否复用同一组随机数。':''),
        pair+'. '+(moves?'Changed: '+moves+'. ':'All reported settings match. ')+(fixed?'Shared: '+fixed+'. ':'')+
        (changed.length>1?'These settings change together, so this pair cannot isolate their individual effects.':!changed.length?'The caption does not say whether the random draws were reused.':'')));
    }else out.push(row('本格的参数','Settings for this plot',position(c)+'。从图注及原图读到 '+settings(c)+'。',position(c)+'. Settings in the figure and caption: '+settings(c)+'.'));
    if(c.dual&&(!peer||peer.dual?.symbol===c.dual.symbol)){
      const plots=peer?[peer,c]:[c],d=c.dual,s=d.symbol,event=s+' = '+d.at;
      if(peer&&c.col===peer.col&&c.row!==peer.row&&c.dual.reported&&peer.dual.reported){
        const [upper,lower]=[c,peer].sort((a,b)=>a.row-b.row);
        const a=upper.dual.reported.printed,b=lower.dual.reported.printed,diff=Math.round((Number(b)-Number(a))*10000)/100;
        out.push(row('同列的点说明什么','Compare the two dots',
          '上格的原表值为 '+a+'，下格为 '+b+'。'+(diff?'下格给“'+event+'”的权重比上格'+(diff>0?'高':'低')+' '+Math.abs(diff)+' 个百分点。':'两格给这个取值的权重相同。')+'这次比较只涉及图中的这两组数据。',
          'The table gives '+a+' for the upper plot and '+b+' for the lower plot. '+(diff?'The lower dataset assigns '+Math.abs(diff)+' percentage points '+(diff>0?'more':'less')+' posterior weight to '+event+'.':'Both assign the same weight to this value.')+' This comparison describes these two datasets.'));
      }
      const read=(p,k)=>p[k]?.length?position(p)+'  '+p[k][0]+' … '+p[k].at(-1):position(p)+'  (?)';
      const span=k=>plots.map(p=>read(p,k)).join(' / ');
      out.push(row('横轴 · 参数可能取什么值','Horizontal axis',
        '每根柱横跨 '+s+' 的一个取值区间。可辨的横轴刻度为 '+span('xTicks')+'。先在各自的横轴找到 '+d.at+'，两行的刻度范围可能不同。',
        'Each bar spans an interval of '+s+'. Visible x ticks run from '+span('xTicks')+'. Find '+d.at+' on each plot’s own scale.'));
      const density=plots.every(p=>/^density$/i.test(p.y));
      out.push(row('纵轴 · 柱子读左轴','Left axis · bars',
        density?'左轴印为 Density（密度），可辨刻度为 '+span('ticks')+'。柱子越高，连续部分在这段取值越集中。比较两个区间时看柱面积（宽 × 高）。':'柱子按左侧刻度读。柱高的单位和归一化方式待核对。',
        density?'The left axis reads Density. Visible ticks run from '+span('ticks')+'. Taller bars mean the continuous component is more concentrated there. Compare intervals by bar area (width × height).':'Read the bars on the left. Their units and normalization are unconfirmed.'));
      if(density){
        const peaks=plots.filter(p=>p.profile?.peak).map(p=>position(p)+'  '+p.profile.peak.join(' … '));
        if(peaks.length)out.push(row('最高的柱落在哪里','Where the tallest bars fall',
          '按原柱的边界估读，最高的一组约落在 '+peaks.join(' / ')+'。这些区间描述连续部分的集中位置。判断 '+event+' 要单独看点。',
          'From the printed bin edges, the tallest bars lie roughly in '+peaks.join(' / ')+'. These intervals locate the peak of the continuous part. Read the dot separately for '+event+'.'));
      }
      out.push(row('右轴 · 从点顶水平读数','Secondary axis · point and stem',
        '在 '+event+' 处，竖线从基线连到标记点。沿点顶水平向右读，这个高度给出模型分给该单一取值的概率。竖线的长度没有误差范围的含义。',
        'At '+event+', the stem runs from the baseline to the dot. Trace its tip horizontally to the right axis to read the probability assigned to this one value. The stem does not show an uncertainty interval.'));
      out.push(row('这个概率回答什么','What the probability means',
        '模型允许 '+s+' 恰好等于 '+d.at+'。给定模型、先验和本格观测数据，右轴给出这个选项获得的后验权重。靠近 '+d.at+' 的连续取值已经画在柱子里。',
        'The model allows '+s+' to equal '+d.at+' exactly. Given the model, prior and this panel’s data, the right axis gives the posterior weight of that exact case. Nearby continuous values appear in the histogram.'));
      if(evidence?.zeroRegime&&s==='ξ'&&d.at===0){
        const page=evidence.zeroRegime.page;
        out.push(row('零在这篇论文中的含义','Why zero matters here',
          '在本文的极值模型中，ξ = 0 对应 Gumbel（冈贝尔）尾部类型。点越高，模型对这类尾部的支持越强。正文见 p.'+page+'。',
          'In this extreme-value model, ξ = 0 selects the Gumbel tail regime. A higher dot means stronger posterior support for that regime (p.'+page+').'));
      }
      if(/\bsimulations?\b/i.test(caption)&&Object.hasOwn(c.conditions,s)){
        const pair=plots.map(p=>position(p)+'  '+s+' = '+p.conditions[s]).join(' / ');
        const both=peer&&c.col===peer.col&&c.row!==peer.row;
        out.push(row('模拟设定与读图结果','Simulation setting and inference',
          pair+' 是生成数据时设定的真值。'+(both?'同列样本量相同，上下两组各自产生数据，再让模型判断 '+event+' 有多可信。':'拟合模型后，点高才告诉你数据给 '+event+' 多少支持。'),
          pair+' gives the values used to generate the data. '+(both?'The sample size is held fixed in this column. Each row supplies its own simulated data, and the model assesses '+event+' for each dataset.':'After fitting the model, the dot shows how much support these data give '+event+'.')));
      }
      return out;
    }
    const descriptions=(peer?[peer,c]:[c]).map(shape);
    if(!dual&&peer?.profile?.middleHalf&&c.profile?.middleHalf&&c.xTicks.join()===peer.xTicks.join()&&c.x===peer.x){
      const a=peer.profile.middleHalf,b=c.profile.middleHalf,ratio=(b[1]-b[0])/(a[1]-a[0]);
      if(ratio>1.4||ratio<1/1.4){
        const step=10**(Math.floor(Math.log10(c.xTicks.at(-1)-c.xTicks[0]))-2);
        const band=q=>q.map(v=>fmt(Math.round(v/step)*step)).join('–');
        descriptions.push(['按柱面积估读，并近似认为每个箱内均匀，中间一半样本的范围由约 '+band(a)+' 变为 '+band(b)+'，'+(ratio>1?'分布更分散。':'分布更集中。'),
          'Estimating from bar areas with uniform values within each bin, the middle half spans roughly '+band(a)+' then '+band(b)+', showing '+(ratio>1?'greater spread.':'a tighter concentration.')]);
      }
    }
    out.push(row('对照原图看柱形','Read the bars',descriptions.map(x=>x[0]).join(' '),descriptions.map(x=>x[1]).join(' ')));
    const xRange=p=>p.xTicks[0]+'–'+p.xTicks.at(-1);
    const ranges=peer&&xRange(peer)!==xRange(c)?position(peer)+' '+xRange(peer)+' / '+position(c)+' '+xRange(c):xRange(c);
    const xAxis=c.x?'图上印有 '+c.x+'。':sim?'每根柱覆盖一段模拟取值。':'每根柱覆盖一段横轴取值。';
    const yScale=p=>p.ticks.length?position(p)+' '+p.ticks[0]+'–'+p.ticks.at(-1):position(p)+' (?)';
    out.push(row('横轴 · 取值区间','Horizontal axis',xAxis+'可辨刻度 '+ranges+'。'+(!c.x?'轴变量的完整名称和单位待核对。':''),
      (c.x?'Printed label: '+c.x+'. ':sim?'Each bin spans a range of simulated values. ':'Each bin spans a range of values. ')+'Visible ticks: '+ranges+'. '+(!c.x?'The full variable name and unit are unconfirmed.':'')));
    const scales=(peer?[peer,c]:[c]).map(yScale).join(' / ');
    const density=curve&&c.profile?.densityArea&&(!peer||peer.profile?.densityArea);
    out.push(row('纵轴 · 按各格刻度读','Vertical axis', '可辨刻度 '+scales+'。'+(c.y?'图内标为 '+c.y+'。':'')+
      (curve?'图注明确实线表示对应分布的密度。':'')+(density?'按原图柱宽和刻度估算，柱面积合计接近 1。区间里的样本比例看柱面积。':!c.y?'柱子的归一化方式待核对。':''),
      'Visible scales: '+scales+'. '+(c.y?'Printed label: '+c.y+'. ':'')+(curve?'The caption identifies the solid curve as the model density. ':'')+
      (density?'The bar areas read from the axes sum to about one. Bin area represents the sample fraction.':!c.y?'Normalization of the bars is unconfirmed.':'')));
    if(dual)out.push(row('原图还有右轴','Secondary axis','上面列出的是左轴。图注另指明右侧纵轴，两套刻度需分开读。','The scales listed above belong to the left axis. The caption also identifies a right axis. Read its scale separately.'));
    const terms=Object.entries(evidence?.parameterTerms||{}).filter(([k])=>!peer||Number(c.conditions[k])!==Number(peer.conditions[k]));
    if(terms.length){
      out.push(row('这些参数是什么意思','Meaning of the settings',terms.map(([k,t])=>k+' 表示'+meanings[t.role][0]+'（PDF p.'+t.page+'）。').join(' '),
        terms.map(([k,t])=>k+' denotes '+meanings[t.role][1]+' (PDF p.'+t.page+').').join(' ')));
    }
    return out;
  }
  window.HistogramMatrix={fromCaption,barProfile,reading,settings,position,definitions};
})();
