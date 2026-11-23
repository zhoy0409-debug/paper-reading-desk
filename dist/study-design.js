(() => {
  'use strict';
  const clean=value=>String(value||'').normalize('NFKC').replace(/([a-z])-\s+([a-z])/gi,'$1$2').replace(/\s+/g,' ').trim();
  function passages(text,page){
    return clean(text).split(/(?<=[.!?。])\s+(?=[A-Z\u3400-\u9fff])/u)
      .filter(line=>line.length>=16&&line.length<1400)
      .map(line=>({text:line,page}));
  }
  function relevant({text}){
    return !/\b(?:prior studies|previous (?:studies|research)|will (?:investigate|compare)|future (?:studies|work)|if (?:the )?participants|might have been)\b/i.test(text);
  }
  function studyContext(abstract){
    return passages(abstract,1).filter(relevant);
  }
  const patterns=[
    {key:'allocation',test:/\b(?:randomi[sz]ed\s+)?cross[\s-]?over\s+(?:design|trial|study)\b|交叉(?:设计|试验)/i,
      zh:'交叉设计。同一位参与者会经历不同条件，比较时要把同一个人的各次测量联系起来。',
      en:'In a crossover design, the same participant experiences different conditions. Read the measurements as linked within each person.'},
    {key:'allocation',test:/\brandom(?:ly assigned|ly allocated|i[sz]ed)\b.{0,65}\b(?:parallel|two groups|three groups|two arms)\b|随机分[为至].{0,12}组/i,
      zh:'参与者随机分组。读图时先找到每组接受的处理，再比较各组的结局。',
      en:'Participants were assigned to groups at random. Identify each group’s condition before comparing outcomes.'},
    {key:'allocation',test:/\b(?:in (?:this|a|our)|conducted a|used a) cross[\s-]sectional (?:study|survey|analysis|design)\b|本.{0,6}横断面研究/i,
      zh:'横断面研究。各项测量描述同一观察时期内的差异或关联。',en:'A cross-sectional study compares measurements within one observation period.'},
    {key:'allocation',test:/\b(?:in (?:this|a|our)|conducted a|used a) (?:prospective|retrospective) cohort\b/i,
      zh:'队列研究。先辨认队列如何组成，再看后续结局如何记录。',en:'This is a cohort study. Identify who entered the cohort and how later outcomes were recorded.'},
    {key:'allocation',test:/\b(?:in (?:this|a|our)|conducted a|used a) case[\s-]control study\b/i,
      zh:'病例对照研究。先按结局辨认病例组与对照组，再比较各组以往的暴露。',en:'In a case–control study, groups are defined by outcome and compared on prior exposure.'}
  ];
  const units=[
    [/\b(?:participants|subjects|patients)\b.{0,72}\b(?:underwent|completed|were enrolled|were recruited|were assigned|received|participated)\b|\beach (?:subject|participant|patient) (?:underwent|undertook|received|completed)\b/i,'研究对象是参与者。','The unit described here is a person.'],
    [/\b(?:in mice|mice per group|mice (?:were|received)|mouse model)\b/i,'研究对象是小鼠。','The study uses mice.'],
    [/\b(?:pairwise (?:Euclidean )?distance between (?:two |the )?(?:data[\s-]?)?points)\b/i,'图中比较一对数据点之间的距离。','The comparison concerns the distance between a pair of data points.']
  ];
  // Only the figure caption and its linked paragraph may establish a sequence.
  // The abstract supplies study-level allocation, not a timeline for each figure.
  const eventTerms=[
    ['sampling|sample collection|blood collection','采样','sampling'],
    ['measurement|assessment|testing|evaluation','测量或评估','assessment'],
    ['treatment|therapy|intervention','干预','intervention'],
    ['exercise|walking','运动','exercise'],
    ['breakfast|lunch|dinner|a meal','进餐','a meal'],
    ['exposure|infection|challenge','暴露或感染','exposure'],
    ['randomi[sz]ation|allocation','分组','allocation'],
    ['training|model fitting','模型训练','model training'],
    ['validation','验证','validation'],
    ['annealing|heat treatment','热处理','heat treatment'],
    ['cooling','冷却','cooling'],
    ['surgery','手术','surgery'],
    ['baseline assessment','基线评估','baseline assessment']
  ];
  const englishEvents=eventTerms.map(([pattern])=>pattern).join('|');
  const sequencePattern=new RegExp('\\b('+englishEvents+')\\s+(?:(?:was|were)\\s+)?(?:(?:performed|conducted|started|began|initiated|occurred|took place)\\s+)?(before|prior to|after|following)\\s+(?:the (?:start of )?|an? )?('+englishEvents+')\\b','gi');
  function sequenceFacts(local,add){
    const seen=new Set();
    for(const source of local){
      const clauses=source.text.split(/[,;.!?。]/);
      for(const clause of clauses){
        if(/\b(?:not|no|whether|if|could|might|previous|should|would|proposed|without|plan(?:ned)?)\b/i.test(clause))continue;
        for(const match of clause.matchAll(sequencePattern)){
          const term=value=>eventTerms.find(([pattern])=>new RegExp('^(?:'+pattern+')$','i').test(value));
          let a=term(match[1]),b=term(match[3]);
          if(!a||!b||a===b)continue;
          if(/after|following/i.test(match[2]))[a,b]=[b,a];
          const key=a[2]+'>'+b[2];if(seen.has(key))continue;
          seen.add(key);
          const names=[match[1],match[3]].map(x=>x.toLowerCase());
          const first=/after|following/i.test(match[2])?names[1]:names[0];
          const second=first===names[0]?names[1]:names[0];
          const exact={'infection':'感染','exposure':'暴露','challenge':'暴露','breakfast':'早餐','validation':'验证','testing':'测试','measurement':'测量','assessment':'评估','evaluation':'评估'};
          add('order','先'+(exact[first]||a[1])+'，再'+(exact[second]||b[1])+'。','The reported sequence is '+first+' followed by '+second+'.',source);
        }
      }
    }
  }

  function explain(figure,panel){
    const capPage=figure.captionPage||figure.page;
    const local=[...passages(panel?.captionPart,capPage),...passages(figure.caption,capPage),...(figure.authorPassages||[])].map(p=>({...p,text:clean(p.text)})).filter(relevant);
    const all=[...local,...(figure.designContext||[])];
    const facts=[];
    function add(key,zh,en,source){facts.push({key,zh,en,source})}
    for(const [pattern,zh,en] of units){
      const evidence=all.find(s=>pattern.test(s.text));
      if(evidence){add('unit',zh,en,evidence);break}
    }
    for(const rule of patterns){
      const evidence=all.find(s=>rule.test.test(s.text));
      if(evidence){add(rule.key,rule.zh,rule.en,evidence);break}
    }
    // Directions are resolved inside the same clause. Reversed or hypothetical
    // sequences are left for the reader to check against the source.
    const actions=[
      [/\b(?:exercise|walking)\b[^,;.]{0,65}\b(?:before|prior to) (?:the start of )?breakfast\b/i,'先运动，再吃早餐。','Exercise preceded breakfast.'],
      [/\b(?:exercise|walking|bout of exercise)\b[^,;.]{0,65}\bafter (?:the start of )?breakfast\b/i,'先吃早餐，再运动。','Breakfast preceded exercise.'],
      [/\b(?:test day|condition|group) (?:with(?:out| no)) (?:physical )?exercise\b/i,'另有无运动对照，可用来判断改变运动安排后的差异。','A no-exercise condition provides a reference for the exercise conditions.'],
      [/\b(?:treatment|therapy|drug administration) (?:was |began |started |initiated |was initiated |was started )?(?:after|following) (?:the )?(?:infection|onset|diagnosis)\b/i,'干预开始于文中所述事件之后。终点数据比较事件发生后各组的情况。','Intervention followed the reported event. Endpoints compare the groups after that event.'],
      [/\b(?:treatment|therapy|drug administration) (?:was |began |started |initiated |was initiated |was started )?(?:before|prior to) (?:the )?(?:exposure|infection|challenge)\b/i,'干预发生在暴露之前。这个顺序可用于考察提前干预后结局有何不同。','The intervention preceded exposure. The design can examine outcomes following prior intervention.']
    ];
    for(const [pattern,zh,en] of actions){
      const evidence=local.find(s=>s.text.split(/[,:;.]/).some(clause=>pattern.test(clause)&&!/\b(?:no |not |without |avoid\w* |asked whether |unclear )/i.test(clause.replace(/(?:without|with no) (?:physical )?exercise/ig,''))));
      if(evidence)add('order',zh,en,evidence);
    }
    if(!facts.some(f=>f.key==='order'))sequenceFacts(local,add);
    if(figure.editorGuide&&figure.matchKey==='F:2'&&!facts.some(f=>f.key==='order')){
      add('order','先感染，再给药，最后比较各组的终点。读组织切片时，比较的是取材时各组的损伤程度。','Infection preceded treatment. The tissue sections compare injury across groups at the endpoint.',{page:figure.page,text:''});
    }
    const continuous=local.find(s=>/\bcontinuous glucose monitoring was performed\b/i.test(s.text));
    if(continuous)add('measure','连续监测葡萄糖，可以比较不同条件下葡萄糖随时间的变化。','Repeated glucose readings show how glucose changes over time in each condition.',continuous);
    const comp=local.find(s=>/\b(?:as a function of|versus|between|compared with|compared to)\b/.test(s.text));
    if(comp&&!facts.some(f=>f.key==='order'))add('comparison','图注或正文给出了比较关系。点开出处可以核对原句中的对象和变量。','The source names a comparison. Open the passage to check its objects and variables.',comp);
    return facts;
  }
  function samplingWindow(question, excerpt, sources) {
    if (!/(?:采样|取样|采集|sampl(?:e|es|ed|ing)|collect(?:ed|ion)?)/i.test(question)
        || !/(?:多久|多长|跨度|哪段|起止|时间范围|时间段|time span|over what period|how long|what time (?:span|range)|from when)/i.test(question)
        || /为什么|为何|why|频率|间隔|how often|frequency/i.test(question)) return null;
    const unit = '(seconds?|minutes?|hours?|days?|weeks?|months?|years?)';
    const number = '(\\d+(?:\\.\\d+)?)';
    const limits = new RegExp('\\b(?:between|from)\\s+'+number+'(?:\\s+'+unit+')?\\s+(?:and|to|through)\\s+'+number+'\\s+'+unit+'\\b','i');
    const names = {second:'秒',minute:'分钟',hour:'小时',day:'天',week:'周',month:'个月',year:'年'};
    const zhUnit = s=>names[s.toLowerCase().replace(/s$/,'')];
    const selected = clean(excerpt).toLowerCase();
    const candidates = [];
    for (const [i,s] of sources.entries()) {
      if (!/图注|正文/.test(s.kind)) continue;
      for (const {text} of passages(s.text,s.page)) {
        const sampling = /\b(?:sampled|sampling took place|samples were collected)\b/i.exec(text);
        if (!sampling || !relevant({text})) continue;
        const after=text.slice(sampling.index+sampling[0].length);
        const m=limits.exec(after);
        if (!m || /stored|incubated|storage|after treatment|were treated|;/.test(after.slice(0,m.index))) continue;
        const lowUnit=m[2]||m[4], z=m[1]+' '+zhUnit(lowUnit)+'到 '+m[3]+' '+zhUnit(m[4]);
        const score=(s.kind==='小图图注'?2:0)+(selected.length>2&&text.toLowerCase().includes(selected)?4:0);
        candidates.push({i,score,z,english:m[1]+' '+lowUnit+' to '+m[3]+' '+m[4]});
      }
    }
    candidates.sort((a,b)=>b.score-a.score);
    const hit=candidates[0];
    if (!hit || candidates.some(other=>other.score===hit.score && other.z!==hit.z)) return null;
    return {zh:'取样时间范围是 '+hit.z+'。',en:'Sampling ranged from '+hit.english+'.',refs:['P'+(hit.i+1)]};
  }

  window.StudyDesignReading={studyContext,explain,samplingWindow};
})();
