/* Name the scientific relationship at the center of a map and keep its evidence. */
(() => {
  'use strict';
  const clean=s=>String(s||'').trim().replace(/\s+/g,' ').replace(/[.。;；]+$/,'');
  const norm=s=>clean(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  const han=s=>/[\u3400-\u9fff]/u.test(s);
  const terms=s=>new Set((s.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)||[]).filter(w=>! /^(the|and|how|for|with|study|using|effect|role|from|this|that|different|what|between|evidence)$/.test(w)));
  const overlap=(a,b)=>[...terms(a)].filter(t=>terms(b).has(t)).length;
  const lower=s=>/^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s|$)/.test(s)?s.replace(/\b[A-Z][a-z]+\b/g,w=>w.toLowerCase()):s;
  const midSentence=s=>s.replace(/^(?:A|An|The|Single|Image|Optical|Thermal|Clinical|Cellular|Neuronal|Pharyngeal|Molecular|Structural|Physical|Mechanical)\b/,w=>w.toLowerCase());
  const verbs={instructs:'instruct',drives:'drive',mediates:'mediate',influences:'influence',affects:'affect',shapes:'shape',
    regulates:'regulate',controls:'control',modulates:'modulate',promotes:'promote',supports:'support',inhibits:'inhibit',governs:'govern',predicts:'predict'};
  function direct(clause){
    const m=clause.match(/^(how|why|when|where)\s+(.+?)\s+(is|are|was|were|can|could|may|might|should|instructs?|drives?|mediates?|affects?|shapes?|regulates?|controls?|modulates?|governs?|influences?|varies|differs?|changes?|interacts?)\s+(.+)$/i);
    if(!m)return '';
    const [,word,subject,verb,object]=m,lead=word[0].toUpperCase()+word.slice(1).toLowerCase();
    if(/^(is|are|was|were|can|could|may|might|should)$/i.test(verb))return lead+' '+verb+' '+subject+' '+object+'?';
    const base=verbs[verb.toLowerCase()]||({varies:'vary',changes:'change',differs:'differ',interacts:'interact'})[verb.toLowerCase()]||verb;
    return lead+' '+(base===verb?'do':'does')+' '+subject+' '+base+' '+object+'?';
  }
  function relation(value){
    const t=clean(value).replace(/:\s*(?:a|an)\s+(?:(?:prospective|retrospective|randomi[sz]ed|controlled|cross-sectional|multicent(?:er|re)|systematic|scoping|pilot|cohort|clinical)[ -]+)+(?:study|trial|review|analysis)$/i,'');
    if(/[?？]$/.test(t)&&t.length>14&&t.length<=220&&!/^(?:(?:how|why) (?:does|is) (?:this|it) (?:work|possible)|这是为什么)[?？]$/i.test(t))return t;
    let m;
    if(han(t)){
      const c=t.replace(/^(?:本研究|本文|我们)(?:的(?:主要)?目的(?:是|在于)|旨在|试图)?(?:探讨|阐明|考察|检验|比较|评估|明确|研究了)?\s*/,'');
      if(/如何|为何|为什么|能否|是否/.test(c))return c.replace(/[？?]$/,'')+'？';
      if(m=c.match(/^(.+?)对(.+?)的(?:作用|影响)机制(?:研究|分析)?$/))return m[1]+'通过什么机制作用于'+m[2]+'？';
      if(m=c.match(/^(.+?)在(.+?)中的(?:作用机制|机制)(?:研究|分析)?$/))return m[1]+'在'+m[2]+'中通过什么机制发挥作用？';
      if(m=c.match(/^(.{2,28}?(?:法|模型))研究(.+的.+)$/))return '用'+m[1]+'能怎样描述'+m[2]+'？';
      if(m=c.match(/^(.+?)对(.+?)的(?:影响|作用|效果)(?:研究|分析)?$/))return m[1]+'对'+m[2]+'有何影响？';
      if(m=c.match(/^(.+?)在(.+?)中的作用(?:研究)?$/))return m[1]+'在'+m[2]+'中起什么作用？';
      if(m=c.match(/^(.+?)(?:与|和)(.+?)的(?:关系|关联|相关性)(?:研究|分析)?$/))return m[1]+'与'+m[2]+'有何关联？';
      return '';
    }
    if(m=t.match(/^(.+?) (?:under|over)estimat(?:e|es|ed) (.+?) (?:compared (?:with|to)|relative to) (.+)$/i))
      return 'How do '+midSentence(m[1])+' and '+m[3]+' compare when estimating '+m[2]+'?';
    if(m=t.match(/^(?:(.{2,70}?) )?mechanisms? (governing|underlying|driving|regulating|mediating) (.+)$/i)){
      const verb={governing:'govern',underlying:'underlie',driving:'drive',regulating:'regulate',mediating:'mediate'}[m[2].toLowerCase()];
      const qualifier=m[1]?midSentence(m[1])+' ':'';
      return 'What '+qualifier+'mechanisms '+verb+' '+m[3]+'?';
    }
    if(m=t.match(/^(?:the )?(?:effects?|efficacy|impact|influence) of (.+?) (?:on|against) (.+)$/i))return 'What effect does '+m[1]+' have on '+m[2]+'?';
    if(m=t.match(/^(?:the )?(?:association|relationship|correlation) between (.+?) and (.+)$/i))return 'What is the association between '+m[1]+' and '+m[2]+'?';
    if(m=t.match(/^(?:the )?role of (.+?) in (.+)$/i))return 'What role does '+m[1]+' play in '+m[2]+'?';
    if(m=t.match(/^(?:the )?(?:structural|molecular|biological|physical) (?:basis|mechanisms?) (?:of|for|underlying) (.+)$/i))return 'What mechanism explains '+m[1]+'?';
    if(m=t.match(/^(?:the )?(?:first |direct )?(?:observation|detection|identification) of (.+)$/i))return 'What evidence establishes the presence of '+m[1]+'?';
    if(m=t.match(/^(?:the )?(prevalence|incidence|distribution|frequency|performance) of (.+?) (in|among|across|during) (.+)$/i))return 'What is the '+m[1].toLowerCase()+' of '+m[2]+' '+m[3]+' '+m[4]+'?';
    if(m=t.match(/^targeting (.+?) for (?:therapeutics|therapies|treatment) (?:in|of) (.+)$/i))return 'What evidence supports targeting '+m[1]+' to treat '+m[2]+'?';
    if(m=t.match(/^predicting (.+?) (?:from|using) (.+)$/i))return 'Can '+m[2]+' predict '+m[1]+'?';
    if(m=t.match(/^(.+?) monitoring of (.+)$/i))return 'How well can '+m[1]+' monitor '+m[2]+'?';
    if(m=t.match(/^(.+?) for (?:improved|enhanced) (.+)$/i)){
      let subject=lower(m[1]);
      if(/\b(?:film|membrane|technique|model|method|platform|device|circuit|sensor)$/i.test(subject)&& !/^(?:a|an|the|this|our)\s/i.test(subject)){
        subject=(/^[aeiou]/i.test(subject)?'an ':'a ')+subject.replace(/^(Ultrathin|Optical|Novel|Flexible|Efficient)\b/,w=>w.toLowerCase());
      }
      return 'Can '+subject+' improve '+m[2]+'?';
    }
    if(m=t.match(/^(.+?) (?:versus|vs\.?) (.+?) for (.+)$/i))return 'How do '+m[1]+' and '+m[2]+' compare for '+m[3]+'?';
    if(m=t.match(/^([A-Za-z]+)[–—-]([A-Za-z]+) (?:spectrum|trade-?offs?) in (.+)$/i))return 'How does the balance between '+m[1].toLowerCase()+' and '+m[2].toLowerCase()+' shape '+lower(m[3])+'?';
    if(m=t.match(/^(.{2,90}?) (?:is|are) associated with (.+)$/i))return 'What is the association between '+m[1]+' and '+m[2]+'?';
    if(m=t.match(/^(.{2,90}?) (instructs|drives|mediates|influences|affects|shapes|regulates|controls|modulates|promotes|supports|inhibits|governs|predicts) (.+)$/i))
      return 'How does '+m[1]+' '+verbs[m[2].toLowerCase()]+' '+m[3]+'?';
    return '';
  }
  function fromAim(text){
    const t=clean(text);
    if(han(t)||/[?？]$/.test(t))return relation(t);
    const stem=t.replace(/^(?:(?:we|this (?:study|review|paper)) (?:also |further )?(?:aim(?:ed|s)? to |sought to |seek to )?|(?:the |our )(?:main |primary )?(?:aim|objective|purpose|goal).{0,60}?\b(?:was|is) to |to (?:better )?)/i,'');
    const subject=stem.replace(/^(?:study|studied|examin(?:e|es|ed)|investigat(?:e|es|ed)|evaluat(?:e|es|ed)|assess(?:es|ed)?|determin(?:e|es|ed)|explor(?:e|es|ed)|understand|test(?:s|ed)?|compar(?:e|es|ed)|quantif(?:y|ied)|clarif(?:y|ied)|ask(?:s|ed)?)\s+/i,'');
    if(subject===stem)return '';
    if(/^whether\s/i.test(subject))return 'Is there evidence that '+subject.slice(8)+'?';
    const question=direct(subject)||relation(subject);
    if(question)return question;
    const contrast=subject.match(/^(.+?) (?:with|versus|vs[.]?) (.+)$/i);
    if(contrast&&/^compar/i.test(stem)){
      const [,group,condition='']=contrast[2].match(/^(.+?)(\s+under\s+.+)?$/i);
      return 'How do '+contrast[1]+' and '+group+' compare'+condition+'?';
    }
    const mechanism=subject.match(/^(?:the )?(?:mechanisms?|basis) (?:of|underlying|behind|for) (.+)$/i);
    if(mechanism)return 'What explains '+mechanism[1]+'?';
    if(/^(?:we|this study|this work|these|this |it |our |the present)/i.test(subject)||subject.length>145||subject.length<10)return '';
    if(/^compar/i.test(stem)||/^the (?:competing|different|alternative)\b/i.test(subject))return 'How do '+subject+' compare?';
    return '';
  }
  function titleEvidence(title,rows){
    const key=norm(title);
    if(key.length<8)return {};
    const pages=new Map();
    for(const r of rows){if(r.page>6)break;pages.set(r.page,(pages.get(r.page)||'')+norm(r.text))}
    for(const [page,text] of pages)if(text.includes(key))return {page,quote:title,check:'source'};
    return {};
  }
  function resolve({title='',rows=[],aims=[],gaps=[],checked,titleConfirmed=false}){
    const evidence=titleEvidence(title,rows);
    if(checked?.en&&checked?.zh){
      const supporting=[];
      for(const pattern of checked.supportPatterns||[]){
        const pages=new Map();
        for(const r of rows)pages.set(r.page,(pages.get(r.page)||'')+' '+r.text);
        for(const [page,body] of pages){
          const match=body.replace(/\s+/g,' ').match(pattern);
          if(match){supporting.push({page,quote:match[0],check:'source'});break}
        }
      }
      const [first,...sources]=supporting;
      return {...(first||evidence),zh:checked.zh,en:checked.en,text:checked.en,sources};
    }
    const question=relation(title);
    const candidates=aims.map(n=>({n,q:fromAim(n.text)})).filter(v=>v.q&&v.q.length<=240)
      .sort((a,b)=>overlap(b.q,title)-overlap(a.q,title));
    const explicit=candidates.find(v=>/[?？]$/.test(v.n.quote||'')&&(overlap(v.q,title)||han(v.q)&&han(title)));
    const why=candidates.find(v=>/^Why\b|为何|为什么/i.test(v.q)&&overlap(v.q,title)>=2);
    if(explicit||why){const v=explicit||why;return {...v.n,text:v.q}}
    if(question&&(evidence.page||titleConfirmed))return {...evidence,text:question};
    if(candidates[0])return {...candidates[0].n,text:candidates[0].q};
    for(const g of gaps.filter(n=>n.role==='gap')){
      const m=clean(g.text).match(/^(?:however,\s*)?(?:it (?:remains|is) (?:unclear|unknown) (?:whether|if) (.+)|(?:whether|if) (.+?) (?:is|remains) (?:unclear|unknown))$/i);
      if(m&&!/^(?:it|this|they|these)\b/i.test(m[1]||m[2]))return {...g,text:'Is there evidence that '+(m[1]||m[2])+'?'};
    }
    return {text:'Central question pending',en:'Central question pending',zh:'核心科学问题待确认',unresolved:true};
  }
  const api={resolve};
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.ReadingQuestion=Object.freeze(api);
})();
