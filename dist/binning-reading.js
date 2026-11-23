(() => {
  'use strict';
  const paired=(zh,en)=>({zh,en});
  const number='(\\d[\\d,]*)';
  const compact=s=>s.toLowerCase().replace(/[’']s\b/g,'').replace(/[^a-z0-9]/g,'');
  function binning(title,context){
    const captionPart=context?.parts?.[compact(title)];
    const m=title.match(new RegExp('(?:[(,;:\\s]|^)'+number+'\\s*(?:equal[- ]width\\s+)?bins?\\b','i'))||
      title.match(new RegExp('\\bbins?\\s*[=:]\\s*'+number,'i'));
    return {name:(m?title.slice(0,m.index):title).trim().replace(/[(,;:\s]+$/,''),
      bins:m?Number(m[1].replaceAll(',','')):captionPart?.bins||null};
  }
  function sample(caption){
    // Only attribute a shared sample when a single dataset is explicitly identified.
    const total=caption.match(/\bhistograms? of ([\d,]+) (?:measurements|observations|values) (?:with|using) (?:\w+ )?(?:different |alternative )?(?:binning|bin[- ]width|bin) (?:rules|methods|widths)/i);
    if(total)return {name:'',n:total[1]};
    const m=caption.match(/\bhistogram(?:s| constructions?| estimates?)?\s+(?:from|of|for)\s+(?:the\s+)?([^.;:]{2,90}?)\s+data(?:\s*set)?\s*,?\s*\(?\s*n\s*=\s*(\d[\d,]*)/i);
    if(!m||/\b(?:and|versus|two|different|respectively|groups?|training|test)\b/i.test(m[1])||/\b(?:subsamples?|subsets?|independent samples|separate samples)\b/i.test(caption))return null;
    return {name:m[1],n:m[2].replace(/,+$/,'')};
  }
  // Definitions are enabled by the abbreviation and its expansion in this PDF.
  // A repeated abbreviation in a figure title alone cannot resolve its meaning.
  const definitions=[
    ['AIC',/Akaike.{0,12}Information Criterion/i,'赤池信息准则权衡拟合程度和模型复杂度。','Akaike’s information criterion balances fit against model complexity.'],
    ['SC',/stochastic complexity/i,'随机复杂度准则用编码观测及模型的代价评价分箱。','Stochastic complexity assesses a partition through its coding cost.'],
    ['BIC',/Bayes(?:ian)? Information Criterion/i,'贝叶斯信息准则权衡拟合和复杂度，增加分箱需要足够的拟合改善。','The Bayesian information criterion admits extra bins when the gain in fit offsets the complexity penalty.'],
    ['BR',/Rozenholc.{0,65}modified AIC penalty/i,'文中使用修正的 AIC 惩罚项来选择箱数。','This procedure selects a bin count with a modified AIC penalty.'],
    ['KLCV',/Kullback.{1,3}Leibler.{0,18}KLCV/i,'Kullback–Leibler 交叉验证用留出观测评价密度拟合，并据此选择箱数。','Kullback–Leibler cross-validation selects a bin count by evaluating density fit on held-out observations.'],
    ['L2CV',/L\s*2\s*cross.validation|cross.validation.{0,45}L2CV/i,'平方误差交叉验证估计密度拟合误差，再据此选箱数。','Least-squares cross-validation estimates density-fitting error to select a bin count.'],
    ['MDL',/minimum description length/i,'最小描述长度法在候选分箱中权衡描述模型和数据所需的编码长度。','Minimum description length weighs the cost of encoding the model and the data.'],
    ['NML',/normalized maximum likelihood/i,'归一化最大似然用编码准则比较不同复杂度的分箱。','Normalized maximum likelihood compares partitions of different complexity using a coding criterion.'],
    ['WAND',/WAND procedure.{0,100}bin width estimator/i,'该方法先估计计算箱宽所需的量，再据此确定箱宽。','This plug-in procedure estimates the quantities needed to choose a bin width.'],
    ['TS',/taut string.{0,50}\bTS\b|\bTS\b.{0,30}taut string/i,'张紧弦法在满足数据拟合要求的候选中寻找峰较少的解；箱宽可变。','The taut-string procedure seeks fewer peaks subject to fitting the data. Its bins can vary in width.'],
    ['KUIP',/KUIP.{0,150}Kuiper/i,'该方法逐步增加箱数，直到满足文中的 Kuiper 拟合条件。','This procedure increases the bin count until the stated Kuiper fit conditions hold.']
  ];
  function documentEvidence(figure,rows){
    const pages=new Map();
    for(const r of rows){
      if(r.fig)continue;
      if(!pages.has(r.page))pages.set(r.page,[]);
      pages.get(r.page).push(r.text);
    }
    const texts=[...pages].map(([page,a])=>[page,a.join(' ').normalize('NFKC').replace(/(\p{L})-\s+(\p{Ll})/gu,'$1$2').replace(/\s+/g,' ')]);
    const used=new Set(figure.openHistogram.cells.flatMap(c=>binning(c.title).name.toUpperCase().split(/[^A-Z0-9]+/)));
    const methods={};
    for(const [abbr,rule,zh,en] of definitions){
      if(!used.has(abbr))continue;
      for(const [page,s] of texts){
        const m=s.match(rule);if(!m)continue;
        const context=s.slice(Math.max(0,m.index-120),m.index+m[0].length+180);
        if(!new RegExp('\\b'+abbr+'\\b','i').test(context))continue;
        methods[abbr]={zh,en,page,quote:m[0]};break;
      }
    }
    const dataset=sample(figure.caption);
    let rounding=null;
    if(dataset){
      const terms=dataset.name.toLowerCase().match(/[a-z]{3,}/g)||[];
      for(const [page,s] of texts){
        for(const sentence of s.split(/(?<=[.!?])\s+(?=[A-Z])/)){
          if(terms.length<2||!terms.slice(0,2).every(t=>sentence.toLowerCase().includes(t))||sentence.length>650)continue;
          const m=sentence.match(/\b(?:heavily |strongly )?rounded\b.{0,85}?\b(?:identically|exactly|equal to)\s+[“"'‘]?([-+]?\d+(?:\.\d+)?)[”"'’]?\s+(?:or|and)\s+[“"'‘]?([-+]?\d+(?:\.\d+)?)/i);
          if(m){rounding={values:[m[1],m[2]],quote:m[0],page};break}
        }
        if(rounding)break;
      }
    }
    const parts={};
    const labels=[...figure.caption.matchAll(/\(([a-z])\)\s*/gi)];
    for(const c of figure.openHistogram.cells){
      const k=compact(c.title);if(k.length<3)continue;
      const slices=labels.map((m,i)=>figure.caption.slice(m.index+m[0].length,labels[i+1]?.index));
      const matches=slices.filter(t=>compact(t).startsWith(k));if(matches.length!==1)continue;
      const section=matches[0],n=section.match(/\((\d[\d,]*)\s+bins?\)/i);
      parts[k]={bins:n?Number(n[1].replaceAll(',','')):null};
      const named={
        sturges:paired('Sturges 规则按样本量选择箱数；样本量每翻一倍，建议箱数约增加一箱。','Sturges’ rule uses the sample size. Doubling it adds roughly one bin.'),
        scott:paired('Scott 规则用样本标准差和样本量决定箱宽。','Scott’s rule uses the sample standard deviation and sample size to choose a bin width.'),
        freedmandiaconis:paired('Freedman–Diaconis 规则用四分位距和样本量决定箱宽，对极端值较不敏感。','The Freedman–Diaconis rule sets width using the interquartile range and sample size, which limits the influence of extreme values.')};
      if(named[k])parts[k].definition={...named[k],page:figure.captionPage||figure.page,quote:section.split(':')[0].trim(),name:c.title};
    }
    const conditions=figure.openHistogram.cells[0]?.conditions;
    let zeroRegime;
    if(figure.openHistogram.cells.some(c=>c.dual?.symbol==='ξ'&&c.dual.at===0)){
      for(const [page,s] of texts){
        const hit=s.match(/\bGumbel\s+regime,\s*associated\s+with\s*ξ\s*=\s*0(?=[.,;\s]|$)/i);
        if(hit){zeroRegime={page,quote:hit[0],name:'Gumbel · ξ = 0'};break}
      }
    }
    return {methods,sample:dataset,rounding,parts,zeroRegime,parameterTerms:conditions?HistogramMatrix.definitions(texts,conditions):null};
  }
  function rowsFor(c,peer,context){
    const info=binning(c.title,context),group=context?.sample,out=[];
    const add=(zh,en,cn,eng)=>out.push({zh,en,content:paired(cn,eng)});
    const defs=references(c,context);
    const methods=defs.map(d=>d.zh+'（PDF p.'+d.page+'）').join(' '),english=defs.map(d=>d.en+' (PDF p.'+d.page+')').join(' ');
    add(info.bins?'分箱方法 · 图内原字':'图内标题','Printed plot title',
      (c.title?'「'+c.title+'」。':'标题待核对。')+(info.bins?'原图或对应图注标出 '+info.bins+' 个区间。':defs.length?'实际箱数待核对。':'分箱规则和箱数待核对。')+(methods?' '+methods:''),
      (c.title?'“'+c.title+'”. ':'Title unconfirmed. ')+(info.bins?'The figure reports '+info.bins+' bins.':defs.length?'The realized bin count is unconfirmed.':'The binning rule and count are unconfirmed.')+' '+english);
    const ticks=c.xTicks,range=ticks[0]+'–'+ticks.at(-1);
    add(c.x?'横轴 · 原图':'横轴 · 刻度可读','Horizontal axis',
      (c.x?'横轴标为「'+c.x+'」。':'原图可辨横轴刻度 '+range+'，变量全名和单位待核对。')+
      (group?'图注给出'+(group.name?' '+group.name+' 数据，':'')+'共 '+group.n+' 个观测。':'')+'每根柱覆盖一段横轴取值，向右数值增大。',
      (c.x?'The axis reads “'+c.x+'”. ':'Visible x ticks run from '+ticks[0]+' to '+ticks.at(-1)+'. The variable name and unit are unconfirmed. ')+
      (group?'The caption identifies '+group.n+' observations'+(group.name?' from the '+group.name+' data':'')+'. ':'')+'Each bar spans an interval of increasing values.');
    const density=/^(?:probability\s+)?density$/i.test(c.y);
    const scale=c.ticks.length>=2?' '+c.ticks.join('、'):'';
    add(c.y?'纵轴 · 原图':'纵轴 · 待核对','Vertical axis',
      (c.y?'「'+c.y+'」。':'未确认纵轴的名称或归一化方式。')+
      (density?'柱高表示概率密度。柱高乘以箱宽，得到该区间所占的样本比例。':/^(?:counts?|frequency)$/i.test(c.y)?'请按原标注与刻度核对每箱的频数。':'')+
      (scale?'可辨纵轴刻度包括'+scale+'。':''),
      (c.y?'“'+c.y+'”. ':'The y label and normalization are unconfirmed. ')+
      (density?'Height is probability density. Height × bin width gives the fraction of observations in the bin. ':'')+
      (scale?'Legible y ticks include '+c.ticks.join(', ')+'.':''));
    if(peer){
      const a=binning(peer.title,context);
      const axesDiffer=c.x&&peer.x&&c.x.trim().toLowerCase()!==peer.x.trim().toLowerCase();
      let zh=group?'这两张图使用图注所述的同一批 '+group.n+' 个观测。':axesDiffer?'两张图的横轴分别印着「'+peer.x+'」和「'+c.x+'」。先从图注核对这两个量之间的关系。':'同一样本的对应关系待从原文核对。';
      let en=group?'Both plots use the same '+group.n+' observations identified by the caption. ':axesDiffer?'The x labels are “'+peer.x+'” and “'+c.x+'”. Check the caption for the relationship between these quantities. ':'A common sample has not been verified. ';
      if(a.bins&&info.bins){
        zh+='「'+(a.name||peer.title)+'」分 '+a.bins+' 箱，「'+(info.name||c.title)+'」分 '+info.bins+' 箱。';
        en+=(a.name||peer.title)+' uses '+a.bins+' bins and '+(info.name||c.title)+' uses '+info.bins+'. ';
        if(a.bins!==info.bins){
          zh+='在相同取值范围内，箱数少时，一根柱汇总更宽范围的观测；箱数多时，相邻取值更容易落进不同的箱，局部起伏也更明显。';
          en+='Over the same range, fewer bins pool a wider interval on average. More bins can separate nearby observations and make local fluctuations more visible. ';
        }else{zh+='箱数相同，仍要核对箱的起点和各箱宽度。';en+='Even with equal bin counts, check the bin origins and widths. '}
      }else{
        if(a.bins||info.bins){
          const known=a.bins?peer:c,n=a.bins||info.bins;
          zh+='「'+known.title+'」注明 '+n+' 箱，另一张的实际箱数待核对。';en+='“'+known.title+'” reports '+n+' bins. The other bin count is unconfirmed. ';
        }
        zh+='读两图时要同时核对比较对象、箱边界和箱宽，才能判断外观差异来自哪里。';
        en+='Check what was measured as well as the bin edges and widths before attributing differences in shape to binning. ';
      }
      if(density&&/density/i.test(peer.y)){
        zh+=axesDiffer?'两幅图的纵轴都表示密度，分别用各自横轴的单位计算区间面积。':'两幅图的纵轴都表示密度，先读各自刻度，再比较可对应的横轴区间的柱面积。';
        en+=axesDiffer?'Both y axes show density. Read each area in intervals defined on its own x scale.':'Both y axes show density. Read each scale and compare areas over corresponding x intervals.';
      }
      out.unshift({zh:'两张图一起读',en:'Reading the pair',content:paired(zh,en)});
      if(context?.rounding){
        const {values,page}=context.rounding;
        add('原文中的取整','Rounding in the data','作者报告这批记录经过取整，有多个观测恰好等于 '+values.join(' 或 ')+'（PDF p.'+page+'）。较窄的箱能把这些重复值集中显示成尖柱。尖柱的高度会随箱宽变化。',
          'The authors report rounded observations, with repeated values of '+values.join(' or ')+' (PDF p.'+page+'). A narrow bin can concentrate tied values into a sharp bar. Its height depends on bin width.');
      }
    }
    return out;
  }
  function references(chart,context){
    const refs=binning(chart.title).name.toUpperCase().split(/[^A-Z0-9]+/).filter(n=>context?.methods[n])
      .map(name=>({name,...context.methods[name]}));
    const rule=context?.parts?.[compact(chart.title)]?.definition;
    return rule?[...refs,rule]:refs;
  }
  function narration(c,context){
    const rule=binning(c.title,context);
    if(!rule.bins||!rule.name)return '';
    const subject=context?.sample?'将图注中的 '+context.sample.n+' 个观测':'将横轴取值';
    return rule.name+' '+subject+'分为 '+rule.bins+' 个区间。'+(/^(?:probability\s+)?density$/i.test(c.y)?'柱面积表示该区间的样本比例。':'');
  }
  window.BinningReading={documentEvidence,rowsFor,references,narration};
})();
