(() => {
  'use strict';
  const hist=/\bhistograms?\b|直方图/i;
  const trim=t=>String(t||'').replace(/\s+/g,' ').trim();
  const sentences=t=>trim(t).split(/(?<=[.!?。])\s+(?=[A-Z])|(?<=。)/u).filter(Boolean);
  const key=t=>trim(t).toLowerCase().replace(/\s*\([^()]*\)\s*$/,'').replace(/\b(activations|errors|weights|values|counts|units)\b/g,m=>m.slice(0,-1)).replace(/[.,:;]+$/,'');
  const pair=(zh,en)=>({zh,en});
  function layout(f){
    if(f.panels?.length!==2||!f.panels.every(p=>p.region))return null;
    const [a,b]=[...f.panels].sort((p,q)=>p.region.x-q.region.x),p=a.region,q=b.region;
    if(p.x+p.width>q.x+.005||Math.min(p.y+p.height,q.y+q.height)-Math.max(p.y,q.y)<Math.min(p.height,q.height)*.65)return null;
    return [a,b];
  }
  function sideCaptions(caption){
    const m=[...caption.matchAll(/(?:^|[.!?。]\s*)(left|right)\s*[:：]\s*/gi)];
    if(m.length!==2||m[0][1].toLowerCase()!=='left'||m[1][1].toLowerCase()!=='right')return [];
    return m.map((v,i)=>trim(caption.slice(v.index+v[0].length,m[i+1]?.index)));
  }
  function scope(f,p){
    if(!hist.test(f.caption||'')&&!hist.test(p?.captionPart||''))return null;
    if(!p&&f.panels?.some(q=>{const part=q.region&&scope(f,q);return part&&!part.uncertain}))return null;
    const peers=layout(f),index=peers?.findIndex(q=>q.id===p?.id)??-1;
    const sides=sideCaptions(f.caption||'');
    const own=p?.reading?.sources?.find(s=>s.kind==='小图图注')?.text||p?.captionPart;
    const caption=index>=0&&sides.length?sides[index]:p?own:f.caption;
    const multi=!p&&(f.panels?.length>1||new Set(Array.from(f.caption.matchAll(/\(([A-H])\)|(?:^|\s)([A-H]):\s/g),m=>m[1]||m[2])).size>1);
    if(multi||/\b(?:two[- ]dimensional|2[- ]D|bivariate)\s+histogram/i.test(f.caption)){
      return {caption,page:f.captionPage||f.page,uncertain:true};
    }
    if(caption&&!hist.test(caption))return null;
    // Without a panel-level caption, do not classify an arbitrary neighbouring plot.
    if(!caption)return null;
    const matched=index>=0&&sides.length===2&&sides.every(s=>hist.test(s));
    return {caption,peers:matched?peers.map(q=>q.printedTitle||q.title||q.label):[],index,
      neural:/\b(?:ReLUs?|neurons?|hidden units?|neural networks?)\b/i.test(f.caption),
      other:matched?sides[1-index]:null,page:f.captionPage||f.page};
  }
  function descriptions(scope){
    const result=[];
    for(const text of sentences(scope)){
      const m=text.match(/\bhistogram of (?:the )?(.{1,90}?)\s+(?:shows?|indicates?|reveals?|has|is|peaks?)\b/i);
      if(m)result.push({metric:key(m[1]),text});
    }
    return result;
  }
  function observation(sentence,metric){
    if(!sentence||/\b(?:if|could|might|not|hypothetical|expected to)\b/i.test(sentence))return null;
    const typical=sentence.match(/\bmost (units|neurons|samples|observations) have (?:an? )?[^.;]{0,65}?\bof (about|approximately|around) ([-+]?\d+(?:\.\d+)?)(?=\s|\.|$)/i);
    if(typical&&metric==='mean activation')return {value:typical[3],reading:pair('图注说，多数'+(/units|neurons/i.test(typical[1])?'单元':'样本')+'的平均激活值约为 '+typical[3]+'。这个数描述它们集中在哪里。','The caption places most mean activations at about '+typical[3]+'. This describes a typical location in the distribution.')};
    if(/\b(?:mode|peak)\s+(?:well\s+)?away from zero\b/i.test(sentence))return {away:true,reading:pair('作者指出零以外还有一个明显的峰，说明相当一部分观测聚集在非零取值附近。','The authors identify a pronounced mode away from zero. Many observations cluster around a nonzero value.')};
    if(/\b(?:peak|mode)\s+(?:at|near) (?:zero|0)\b/i.test(sentence))return {zero:true,reading:pair('图注指出零附近有峰，说明许多观测落进靠近零的区间。单凭柱形不能算出精确等于零的比例。','The caption identifies a peak at or near zero. Many observations fall in that bin. Its height alone does not give the fraction exactly equal to zero.')};
    if(/\b(?:right[- ]skewed|positively skewed)\b/i.test(sentence))return {reading:pair('作者描述了右偏分布：较高取值一端拖着长尾。少数高值可能使均值向右移动。','The authors describe a right-skewed distribution with a longer upper tail. A few large observations can pull the mean upward.')};
    if(/\b(?:left[- ]skewed|negatively skewed)\b/i.test(sentence))return {reading:pair('作者描述了左偏分布：较低取值一端拖着长尾。','The authors describe a left-skewed distribution with a longer lower tail.')};
    if(/\bbimodal\b|\btwo distinct peaks\b/i.test(sentence))return {reading:pair('作者指出有两处峰，观测在两个取值区间相对集中。仅凭双峰形状还不能确定有两个独立来源。','The authors describe two peaks: the data concentrate in two ranges. The shape alone does not identify two underlying populations.')};
    return null;
  }
  function condition(s){
    if(/^without dropout\.?$/i.test(s))return '未使用 dropout';
    const drop=s.match(/^dropout with\s+p\s*=\s*(0(?:\.\d+)?|1(?:\.0+)?)\.?$/i);
    return drop?'使用 dropout（p = '+drop[1]+'）':s;
  }
  function explain(value,chart){
    const name=chart.x||chart.title||'',metric=key(name);
    const own=descriptions(value.caption).filter(x=>x.metric===metric),peer=descriptions(value.other).filter(x=>x.metric===metric);
    const single=chart.only?sentences(value.caption).filter(s=>hist.test(s)&&observation(s,metric)):[],
      quote=own.length===1?own[0].text:single.length===1?single[0]:'';
    const seen=observation(quote,metric),other=peer.length===1?observation(peer[0].text,metric):null;
    const rows=[];
    const add=(zh,en,content)=>rows.push({zh,en,content});
    if(value.peers.length){
      const a=value.peers[value.index],b=value.peers[1-value.index];
      add('比较对象','Comparison',pair('当前是「'+condition(a)+'」，对照组是「'+condition(b)+'」。两组之间比较同名的直方图。','Selected: '+a+' Compare with '+b+' using the corresponding histogram.'));
    }
    const xword=chart.x?'横轴原字':'图内标题',xen=chart.x?'Printed x-axis':'Plot title';
    if(value.neural&&own.length===1&&metric==='mean activation')add('横轴','Horizontal axis',pair(xword+'「'+name+'」。先把每个隐藏单元在不同输入上的激活值取平均，再按这些平均值分箱。每个单元贡献一个平均值。',xen+' “'+name+'”. Average each hidden unit’s response across inputs, then bin these means. Each unit contributes one mean.'));
    else if(value.neural&&own.length===1&&metric==='activation')add('横轴','Horizontal axis',pair(xword+'「'+name+'」。每个值表示一个单元面对一个输入时的响应大小。向右表示响应更强。',xen+' “'+name+'”. Each observation is one unit’s response to one input. Larger values to the right mean stronger responses.'));
    else if(chart.x||own.length===1)add('横轴','Horizontal axis',pair(xword+'「'+name+'」。横向每个区间收集落入该取值范围的观测。',xen+' “'+name+'”. Each bin covers an interval of this quantity.'));
    else add('横轴 · 待核对','Horizontal axis · check',pair((name?'识别到图题「'+name+'」。':'')+'横轴变量名待核对。', (name?'Detected plot title: “'+name+'”. ':'')+'The horizontal variable is unconfirmed.'));
    if(chart.y)add('纵轴','Vertical axis',pair('纵轴标为「'+chart.y+'」。'+(/density/i.test(chart.y)?'比较区间的概率质量要看柱面积。':/percent|%/i.test(chart.y)?'柱高按百分比读。':/count|number/i.test(chart.y)?'柱高表示每个区间的数量。':'按原标注的刻度读柱高。'),'The printed y-axis reads “'+chart.y+'”. '+(/density/i.test(chart.y)?'For density, bin area represents probability mass.':'Use its scale to read the height.')));
    else{
      const counts=chart.ticks.length>=2&&chart.ticks.every(Number.isInteger)&&Math.max(...chart.ticks)>1;
      const units=value.neural&&own.length===1&&metric==='mean activation'?['隐藏单元数','hidden units']:value.neural&&own.length===1&&metric==='activation'?['单元与输入配对的激活观测数','unit–input observations']:['观测数','observations'];
      if(chart.ticks.length&&units[1]==='observations'){
        add('纵轴 · 待核对','Vertical axis · check',pair('可辨纵轴刻度 '+chart.ticks.join('、')+'。单凭刻度无法区分频数、比例和密度。','Legible y ticks: '+chart.ticks.join(', ')+'. Tick values alone do not distinguish counts, proportions and density.'));
      }else
      add('纵轴 · 待核对','Vertical axis · check',counts?pair('可辨整数刻度 '+chart.ticks.join('、')+'。按直方图和计数对象推读，柱高可能表示该区间的'+units[0]+'；未读到明确轴名或归一化说明。','Legible integer ticks: '+chart.ticks.join(', ')+'. Bar height is consistent with the number of '+units[1]+' per bin. The axis title and normalization are unconfirmed.'):pair('未可靠读出纵轴名称或单位。柱高可用于看本图形状；跨图比较绝对高度前，需核对计数、比例或密度及量程。','Y-axis label or unit unresolved. Read the shape within this plot. Check counts, fractions or density and the scale before comparing heights across plots.'));
    }
    if(seen)add('分布变化 · 作者图注','Distribution · caption',seen.reading);
    if(seen&&other&&value.peers.length){
      if(seen.value&&other.value)add('两组一起读','Across groups',pair('本组约 '+seen.value+'，另一组约 '+other.value+'。比较的是典型单元的平均响应位置；这些约数不足以计算效应量或显著性。','Typically about '+seen.value+' here versus '+other.value+' in the other condition. These are approximate locations, not an effect size or a significance test.'));
      if((seen.zero&&other.away||seen.away&&other.zero)&&metric==='activation'){
        const i=seen.zero?value.index:1-value.index;
        if(value.neural)add('两组一起读','Across groups',pair('「'+condition(value.peers[i])+'」组的响应更多集中在零附近，另一组在非零处仍有明显聚集。这支持前一组在这批输入上形成了更稀疏的表示。','Responses concentrate near zero in “'+value.peers[i]+'”, while the other group retains a prominent nonzero mode. This supports a sparser representation for these inputs.'));
      }
    }
    if(!seen&&chart.peak)add('柱形所示 · 目测','Shape · visual estimate',chart.peak);
    if(!seen&&!chart.peak)add('分布变化 · 待核对','Distribution · check',pair('尚不能可靠定位主峰。可按相同横轴位置对照原图，核对峰、尾部和量程。','The dominant peak is unresolved. Compare peaks, tails and scales at matching x positions on the original.'));
    return {rows,quote,peerQuote:peer.length===1&&seen&&other?peer[0].text:''};
  }
  function sharedAxis(label){
    const countsPerWidth=/^(?:entries|counts?|events)\s*(?:\/|per)\s*(?:bin\s*)?width$/i.test(label);
    return pair('这组图旁印有「'+label+'」。'+(countsPerWidth?'每个区间的事件数除以区间宽度得到柱高。要还原事件数，用纵轴读数乘以区间宽度。':'按原图位置推定为组内共用纵轴，可点上方按钮核对。'),
      'The group is labelled “'+label+'”. '+(countsPerWidth?'Height is the number of entries divided by bin width. Multiply the numerical height by that width to recover the count.':'Its position suggests a shared vertical axis. Locate the label to verify it.'));
  }
  window.HistogramEvidence={scope,explain,hist,sharedAxis};
})();
