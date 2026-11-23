(() => {
  'use strict';
  const tidy=s=>s.replace(/(\p{Ll})-\s+(\p{Ll})/gu,'$1$2').replace(/\s+/g,' ').trim();
  function evidence(lines,page){
    const found=[];
    for(let i=0;i<lines.length;i++){
      const l=lines[i],t=l.text;
      const citation=t.match(/^Fig(?:ure)?\.?\s+(\d+) (?:shows|presents|displays) the Hubble diagram/i);
      const difference=t.match(/[μµ]\s*(?:measured|obs(?:erved)?)\s*[−–-]\s*[μµ]\s*(?:model|pred(?:icted)?)/i);
      if(difference&&/residual/i.test(t))found.push({kind:'sign',page,text:t});
      if(!citation)continue;
      const same=lines.slice(i).filter(x=>x.x1>l.x0&&x.x0<l.x0+18&&x.x0>l.x0-20);
      const part=[l];
      for(const next of same.slice(1,13)){
        const last=part.at(-1);
        if(next.base-last.base<2||next.base-last.base>l.size*1.6||Math.abs(next.size-l.size)>1.2||
          /^\d+\.\d+\./.test(next.text)||(/[.!?]$/.test(last.text)&&next.x0>Math.min(...part.map(p=>p.x0))+5))break;
        part.push(next);
      }
      found.push({kind:'story',key:'F:'+citation[1],page,text:tidy(part.map(p=>p.text).join(' ')),anchor:t});
    }
    return found;
  }
  function locate(cap,paths,viewport){
    const lineSentence=cap.caption.split(/(?<=[.!?])\s+/).find(t=>/\bsolid (?:line|curve)\b/i.test(t));
    if(!/\bHubble diagram\b/i.test(cap.caption)||!lineSentence||!(/\bbest[- ]fit/i.test(lineSentence)&&/\bflat\s+[ΛL]CDM/i.test(lineSentence)&&/\b(?:supernovae|SNe)\s+(?:alone|only)\b/i.test(lineSentence)))return;
    const fits=paths.filter(p=>p.clip&&p.pts.length>=10&&!p.dash?.length&&p.color==='#000000'&&p.b.x1-p.b.x0>.9*(p.clip.x1-p.clip.x0)&&
      p.b.y1-p.b.y0>.45*(p.clip.y1-p.clip.y0)&&p.clip.y1<=cap.line.y0&&cap.line.y0-p.clip.y1<(p.clip.x1-p.clip.x0)*.14&&p.pts.every((v,i)=>!i||v[1]<=p.pts[i-1][1]+.1));
    if(fits.length!==1)return;
    const p=fits[0],r=p.clip,w=r.x1-r.x0,h=r.y1-r.y0;
    const borders=paths.filter(q=>q.pts.length===2&&Math.abs(q.b.x0-r.x0)<2&&Math.abs(q.b.x1-r.x1)<2&&Math.abs(q.b.y1-q.b.y0)<1);
    if(borders.length!==2||![r.y0,r.y1].every(y=>borders.some(q=>Math.abs(q.b.y0-y)<1)))return;
    const crop={x0:Math.max(0,r.x0-w*.10),y0:Math.max(0,r.y0-h*.035),x1:Math.min(viewport.width,r.x1+w*.025),y1:cap.line.y0-1};
    return {frame:r,crop,line:p.pts};
  }
  function symbols(list,ops,V,geometry,{mult,boxFrom}){
    let transform=V;const stack=[],dots=[];const r=geometry.frame;
    for(let i=0;i<list.fnArray.length;i++){
      const op=list.fnArray[i],a=list.argsArray[i]||[];
      if(op===ops.save||op===ops.paintFormXObjectBegin){stack.push(transform);if(op===ops.paintFormXObjectBegin&&a[0]?.length===6)transform=mult(transform,a[0])}
      else if(op===ops.restore||op===ops.paintFormXObjectEnd)transform=stack.pop()||V;
      else if(op===ops.transform)transform=mult(transform,a);
      else if(op===ops.constructPath&&a[0]===ops.fill&&a[2]?.length===4){
        const path=a[1]?.[0];if(!path||path[0]!==0||path[3]!==2||(path.at(-1)!==4&&(Math.abs(path.at(-2)-path[1])>.02||Math.abs(path.at(-1)-path[2])>.02)))continue;
        const b=boxFrom(transform,a[2]),width=b.x1-b.x0,height=b.y1-b.y0;
        if(width<1||width>7||Math.abs(width-height)>.15*width||b.x0<r.x0||b.x1>r.x1||b.y0<r.y0||b.y1>r.y1)continue;
        dots.push([(b.x0+b.x1)/2,(b.y0+b.y1)/2]);if(dots.length>3000)return [];
      }
    }
    return dots;
  }
  function modelY(line,x){
    const i=line.findIndex(p=>p[0]>=x);if(i<1)return null;
    const [a,b]=line.slice(i-1,i+1);return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
  }
  function mount(parent,chart,ui){
    const section=document.createElement('section');section.className='curve-reader hubble-reader';parent.append(section);
    const add=(tag,zh,en)=>{const n=document.createElement(tag);section.append(PaperUI.set(n,zh,en));return n};
    const source=(label,title,src)=>{if(src){const b=add('button',label+' · p.'+src.page,title);b.type='button';b.className='frw-inline';b.onclick=()=>ui.open(src.page,src.anchor||src.text)}};
    add('strong','为什么作者在这里放这张图','Why the authors show this figure here');
    const story=chart.story,extra=story?.text.match(/\badd (\d+) SNe Ia\b/i);
    if(extra){
      add('p','作者先筛选样本并拟合距离与红移的关系，随后把本研究新增的 '+extra[1]+' 颗 Ia 型超新星放回汇总样本，观察它们怎样延伸已有的红移覆盖。','After selecting the sample and fitting the distance–redshift relation, the authors place '+extra[1]+' new Type Ia supernovae alongside the compilation to show the redshift coverage they add.');
      source('引出本图的正文','Article passage',story);
    }else if(story){const q=document.createElement('blockquote');q.textContent=story.text;section.append(q);source('引出本图的正文','Article passage',story)}
    add('strong','原图 · 距离模数与红移','Original · distance modulus versus redshift');
    add('p','横轴红移 z 表示光的波长相对发出时拉长了多少。纵轴距离模数 μ 用星等表示光度距离。圆点是超新星测量，竖线显示其不确定性。黑色实线是只用超新星数据拟合的平坦 ΛCDM 模型。','Redshift z gives the fractional stretching of the light’s wavelength. Distance modulus μ expresses luminosity distance in magnitudes. The circles show supernova measurements with vertical uncertainties. The solid black curve is the flat ΛCDM model fitted to supernovae alone.');
    if(chart.excluded)add('p','红三角 '+chart.excluded+' 在图中展示。它超出了作者采用的光变曲线形状参数范围，因此未参与这次拟合。','The red triangle marks '+chart.excluded+'. It falls outside the adopted light-curve shape cut and was excluded from this fit.');
    add('strong','点原图，比同一红移的点和线','Click a point to compare it with the curve at the same redshift');
    if(chart.sign){
      add('p','作者将距离残差定义为观测 μ 减去模型 μ。点在曲线上方时为正，下方为负，点在线上时为零。原图只有这一格，黑线上的 μ 随红移变化。','The paper defines the distance residual as measured μ minus model μ. A point above the curve has a positive residual, one below has a negative residual, and one on it has zero residual. The original contains one plot. The μ value on its black curve changes with redshift.');
      source('作者定义残差的出处','Residual definition',chart.sign);
    }
    source('原图注与拟合模型','Caption and fitted model',chart.caption);
    const result=add('p','点密集处可放大原图。逐点精确数值需核对数据表。','Zoom in where points overlap. Exact individual values require the data table.');result.setAttribute('aria-live','polite');
    const {frame:r,crop:c,line,dots}=chart,w=c.x1-c.x0,h=c.y1-c.y0;
    function choose(x,y){
      const nearest=dots.map(([px,py])=>({x:px,y:py,d:Math.hypot(px-x,py-y)})).sort((a,b)=>a.d-b.d);
      if(!nearest.length||nearest[0].d>6||nearest[1]?.d-nearest[0].d<1){ui.mark(null);PaperUI.set(result,'当前位置无法分辨单个观测点。请点一个分开的圆点。','No single observation is distinguishable here. Click an isolated circle.');return}
      const p=nearest[0],pred=modelY(line,p.x);if(pred==null){ui.mark(null);PaperUI.set(result,'该位置没有可核对的模型曲线。','The model curve cannot be read at this position.');return}
      const delta=pred-p.y,above=delta>0;
      ui.mark({x:(p.x-c.x0)/w,y:(p.y-c.y0)/h,model:(pred-c.y0)/h});
      PaperUI.set(result,Math.abs(delta)<2?'圆点与拟合线重合，差值的正负待核对。':('这个圆点在同一红移的黑线'+(above?'上方，观测距离模数较大':'下方，观测距离模数较小')+(chart.sign?(above?'，残差为正':'，残差为负'):'')+'。'),
        Math.abs(delta)<2?'The point and the fit overlap. The sign is unresolved.':'At this redshift the observed modulus is '+(above?'larger':'smaller')+' than the fitted value'+(chart.sign?', giving a '+(above?'positive':'negative')+' residual':'')+'.');
    }
    const rect={x:(r.x0-c.x0)/w,y:(r.y0-c.y0)/h,width:(r.x1-r.x0)/w,height:(r.y1-r.y0)/h};
    return {rect,choose:(fx,fy)=>choose(r.x0+fx*(r.x1-r.x0),r.y0+fy*(r.y1-r.y0)),example:()=>{
      const p=dots.find(p=>Math.abs(modelY(line,p[0])-p[1])>5&&dots.every(q=>q===p||Math.hypot(q[0]-p[0],q[1]-p[1])>5));if(p)choose(...p);
    }};
  }
  window.HubbleReading={evidence,locate,symbols,mount};
})();