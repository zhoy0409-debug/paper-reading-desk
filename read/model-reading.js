/* Resolve the current paper's animal cohort separately from published background. */
(() => {
  'use strict';
  const mouse = /\b(?:mouse|mice|murine)\b|小鼠/i;
  const nonCohort = /\b(?:cell lines?|hybridomas?|previous studies|previously reported|not used|were excluded|cited by)\b|未采用|既往研究/i;
  const normalize = value => String(value || '').normalize('NFKC').replace(/\u00ad/g,'').replace(/[\u2010-\u2014]/g,'-').replace(/\s+/g,' ').trim();
  const known = /\b(?:BALB\s*\/\s*c(?:J(?:Gpt)?|ByJ|AnNCrl|AnN|NCrl| nude)?|C57BL\s*\/?\s*6(?:J(?:Gpt)?|N(?:J|Crl|Tac|Gpt)?)?|(?:E3L|APOE\*?3-?Leiden)\.CETP|NSG|CD-1|DBA\/2J?|FVB\/NJ?|C3H\/He[NJ]|NOD[-/]scid|Swiss Webster|ICR)\b/ig;
  const sources = {
    balb:['BALB/c 品系档案','BALB/c strain record','https://informatics.jax.org/inbred_strains/mouse/docs/BALB.shtml'],
    b6:['C57BL/6J 品系档案','C57BL/6J strain record','https://www.jax.org/strain/000664'],
    survey:['同类研究的品系统计 · 表 2','Strains across studies · Table 2','https://doi.org/10.3389/fmicb.2022.988728'],
    lipids:['E3L.CETP 的脂蛋白研究','E3L.CETP lipoprotein study','https://pubmed.ncbi.nlm.nih.gov/16946130/'],
    nsg:['NSG 的免疫特征','NSG immune profile','https://www.jax.org/jax-mice-and-services/find-mice/nsg-portfolio/frequently-asked-nsg-questions'],
    behavior:['动情周期与探索行为','Estrous state and exploration','https://pubmed.ncbi.nlm.nih.gov/36889318/']
  };
  function family(name) {
    if (/^BALB/i.test(name)) return 'BALB/c';
    if (/^C57BL/i.test(name)) return 'C57BL/6';
    if (name.endsWith('.CETP')) return 'E3L.CETP';
    return name;
  }
  function strains(text) {
    const names = Array.from(text.matchAll(known), m => m[0].replace(/\s*\/\s*/g,'/').replace(/^C57BL\s*6/i,'C57BL/6'));
    // Unlisted line names need an explicit mouse noun and a distinctive identifier.
    for (const m of text.matchAll(/\b([A-Za-z][A-Za-z0-9.*+/-]{2,34})\s+(?:strain of\s+)?(?:mice|mouse)\b/g)) {
      if (/[0-9]/.test(m[1]) && /[A-Z]/.test(m[1]) && !names.some(n=>family(n).toLowerCase()===family(m[1].replace(/^C57BL6/i,'C57BL/6')).toLowerCase()) && !/^(?:Fig|IL-|CD\d+\+|P\d+$|SPF|week)/i.test(m[1])) names.push(m[1]);
    }
    return [...new Set(names)];
  }
  function sexes(text) {
    const f=/\bfemale(?:s)?\b|雌性/i.test(text), m=/\bmale(?:s)?\b|雄性/i.test(text);
    if (f && m || /\bboth sexes\b|雌雄/i.test(text)) return 'both';
    return f ? 'female' : m ? 'male' : '';
  }
  function paperContext(model) {
    const cohorts=[];
    for (const section of model?.sections || []) {
      if (!['methods','results','abstract','unclassified'].includes(section.key)) continue;
      for (const r of section.rows || []) {
        if (r.heading || r.ref || r.fig) continue;
        for (const original of normalize(r.text).split(/(?<=[.!?。])\s+(?=[A-Z])/)) {
          if (!mouse.test(original) || nonCohort.test(original)) continue;
          const names=strains(original);
          for (const name of names) {
            const sex=names.length===1?sexes(original):'';
            if (!sex && section.key!=='methods' && !/\b(?:we used|we studied|were enrolled|purchased|obtained)\b|本研究/i.test(original)) continue;
            const record={name,sex,page:r.page,method:section.key==='methods',text:original};
            if (!cohorts.some(c=>c.name===name&&c.sex===sex&&c.page===r.page)) cohorts.push(record);
          }
        }
      }
    }
    return cohorts;
  }
  const contexts = [
    {key:'lung', test:t=>/pneumonia|肺炎/i.test(t)&&/antibiotic|antimicrobial|abaucin|CRAB|bacteri|抗菌|细菌/i.test(t), terms:'bacterial pneumonia antimicrobial', relevant:/bacterial pneumonia|antibiotic|antimicrobial/i},
    {key:'liver', test:t=>/\b(?:NASH|NAFLD|MASLD|MASH)\b|fatty liver|hepatic steatosis|脂肪肝|脂肪性肝炎/i.test(t), terms:'hepatic steatosis',relevant:/steatosis|fatty liver|steatohepatitis|NAFLD|MASLD/i},
    {key:'behavior',test:t=>/open.field|exploratory behavio|旷场|探索行为/i.test(t), terms:'open field behavior',relevant:/open.field|exploratory behavio/i},
    {key:'graft',test:t=>/xenograft|human.cell graft|异种移植/i.test(t), terms:'xenograft histology',relevant:/xenograft|engraftment/i},
    {key:'bone',test:t=>/osteoporos|bone density|骨质疏松/i.test(t),terms:'bone density',relevant:/bone density|osteoporos/i},
    {key:'glucose',test:t=>/diabet|insulin resistance|糖尿病/i.test(t),terms:'glucose metabolism',relevant:/diabet|glucose|insulin/i}
  ];
  // The shared lead describes the figure as a whole. Sibling panel text is never part of it.
  function panelPassage(caption,part){
    caption=normalize(caption);
    if(!part?.id)return {text:caption,lead:'',local:false};
    const id=part.id.toLowerCase();
    const marked=[...caption.matchAll(/\(([A-Za-z])\)/g)];
    const before=marked.length?caption.slice(0,marked[0].index).trimEnd():'';
    const suffix=marked.length>1 && /(?:patients?|subjects?|controls?|mouse|mice|tissues?|samples?|groups?)\s*$/i.test(before);
    if(suffix){
      const i=marked.findIndex(m=>m[1].toLowerCase()===id);
      if(i>=0){
        const start=i?marked[i-1].index+marked[i-1][0].length:0;
        const clauses=caption.slice(start,marked[i].index).split(/[;；]|[.!?。]\s+/);
        const lead=before.split(/[.!?。]\s+/).slice(0,-1).join('. ');
        return {text:clauses.at(-1).trim(),lead,local:true};
      }
    }
    const prefix=marked.length>=2 && (!before || /[.:;|。；：]$/.test(before) || /(?:fig(?:ure)?\.?\s*)?\d+$/i.test(before)) ? marked : [];
    const bare=[...caption.matchAll(/(?:^|(?<=[.!?;:。；：|])\s*)([a-zA-Z])(?:[).、:]\s*|\s+(?=[A-Z\p{Script=Han}]))/gu)];
    // A parenthetic abbreviation can contain a lower-case letter such as “MV; h)”.
    const bareSeries=bare.filter((t,i)=>bare.slice(0,i).every(prior=>prior[1].toLowerCase()<t[1].toLowerCase()));
    const tokens=prefix.length?prefix:bareSeries;
    if(tokens.length>=2 && tokens[0][1].toLowerCase()==='a'){
      const at=tokens.findIndex(m=>m[1].toLowerCase()===id);
      const lead=caption.slice(0,tokens[0].index).trim();
      if(at>=0){
        const t=tokens[at],end=tokens[at+1]?.index??caption.length;
        return {text:caption.slice(t.index+t[0].length,end).trim(),lead,local:true};
      }
    }
    const extracted=part.captionPart || part.reading?.sources?.find(s=>s.kind==='小图图注')?.text;
    if(extracted && normalize(extracted)!==caption)return {text:normalize(extracted),lead:'',local:true};
    const mixed=(/\b(?:patients?|humans?|subjects?)\b/i.test(caption)&&mouse.test(caption))||
      strains(caption).length>1 || (sexes(caption)==='both'&&marked.length>=2);
    return {text:mixed?'':caption,lead:'',local:false};
  }

  function contextualTerms(scope) {
    // Public biological subject terms only. Never send uploaded passages or file names.
    const subjects=[
      [/retin(?:a|al)|视网膜/i,'retina'],[/circadian|昼夜节律/i,'circadian rhythm'],
      [/kidney|renal|肾脏/i,'kidney'],[/hearing|auditory|听觉/i,'hearing'],
      [/endometriosis|子宫内膜异位/i,'endometriosis'],[/adipos|obes|肥胖/i,'obesity'],
      [/spatial memory|空间记忆/i,'spatial memory'],[/learning|cognition|认知/i,'learning'],
      [/fibrosis|纤维化/i,'fibrosis'],[/tumo[u]?r|cancer|肿瘤/i,'tumor'],
      [/cartilage|软骨/i,'cartilage'],[/neuron|神经元/i,'neurons'],[/cardiac|心肌/i,'cardiac function']
    ];
    const hits=subjects.filter(([re])=>re.test(scope)).slice(0,2);
    return hits.length?{key:'topic',terms:hits.map(h=>h[1]).join(' '),relevant:new RegExp(hits.map(h=>h[0].source).join('|'),'i')}:
      {key:'general',terms:'mouse strain phenotype',relevant:/mouse|mice|murine/i};
  }
  function resolve(raw,part,label='') {
    if (!raw) return [];
    const caption=normalize(raw.caption);
    const passage=panelPassage(caption,part), scope=passage.text;
    if(!scope || (passage.local && /\b(?:patients?|humans?|control subjects?)\b/i.test(scope) && !mouse.test(scope)))return [];
    if (/\b(?:in vitro|cell line|hybridoma)\b/i.test(scope)&&!/\b(?:in vivo|live mice)\b/i.test(scope)) return [];
    const printed=normalize(label);
    const exactLabel=(raw.animalCohorts||[]).find(c=>c.name.toLowerCase()===printed.toLowerCase());
    const pointed=exactLabel?[exactLabel.name]:strains(printed);
    const named=pointed.length?pointed:strains(scope);
    if (!named.length && !mouse.test(scope) && !mouse.test(passage.lead)) return [];
    const context=contexts.find(c=>c.test(scope)) || contexts.find(c=>c.test(passage.lead)) || contextualTerms(scope+' '+passage.lead);
    const cohorts=raw.animalCohorts||[];
    const names=named.length?named:[...new Set(cohorts.map(c=>family(c.name)))];
    if (!named.length && (names.length!==1 || /multiple (?:strains|models)|different (?:strains|mouse models)|several (?:strains|mouse models)/i.test(scope))) return [];
    return names.flatMap(name=>{
      const matched=cohorts.filter(c=>family(c.name)===family(name) && (name===family(name)||c.name===name));
      const method=matched.filter(c=>c.method);
      const records=method.length?method:matched;
      const localSex=sexes(scope);
      const compatible=records.filter(c=>!localSex||!c.sex||c.sex===localSex||c.sex==='both');
      const specific=[...new Set(compatible.map(c=>c.name).filter(n=>n!==family(n)))];
      const exact=(name===family(name)&&specific.length===1)?specific[0]:name;
      const relevant=compatible.filter(c=>c.name===exact||c.name===name);
      const knownSex=[...new Set(relevant.map(c=>c.sex).filter(Boolean))];
      const sex=(named.length<=1 && strains(scope).length<=1 && !/\b(?:patient|human subject)/i.test(scope) && localSex) || (knownSex.length===1?knownSex[0]:'');
      const record=relevant.find(c=>sex&&c.sex===sex)||relevant[0];
      if (!record && !mouse.test(scope) && !mouse.test(caption)) return [];
      return [{name:exact,family:family(exact),context,sex,record,page:record?.page||raw.captionPage||raw.page,caption,
        query:family(exact)+' '+context.terms}];
    });
  }
  function entry(m) {
    const fam=m.family,ctx=m.context.key;
    const sex={male:['雄性','male '],female:['雌性','female '],both:['雌雄两性的','male and female ']}[m.sex]||['',''];
    const reported=['图中小鼠对应本文的'+sex[0]+' '+m.name+' 组。','The mice shown belong to the '+sex[1]+m.name+' cohort.'];
    const citations=[];
    let fact=[];
    if (fam==='BALB/c' && ctx==='lung') {
      fact=['BALB/c 是近交系，各组小鼠遗传背景相近，适合比较给药后的差异。在一份涵盖 53 项革兰阴性菌肺炎药效研究的统计中，8 项使用 BALB/c（15.1%）。','Using inbred BALB/c mice gives treatment groups a closely matched genetic background. A survey of 53 studies of Gram-negative bacterial pneumonia found that 8 used BALB/c (15.1%).'];
      citations.push(sources.survey);
    } else if (fam==='E3L.CETP') {
      fact=['E3L.CETP 小鼠表达人胆固醇酯转移蛋白，可用来研究脂质如何在血浆脂蛋白之间转移。','E3L.CETP mice express human cholesteryl ester transfer protein, allowing researchers to study lipid transfer between plasma lipoproteins.'];
      citations.push(sources.lipids);
    } else if (fam==='NSG') {
      fact=['NSG 是遗传性免疫缺陷品系，缺少成熟的 T 细胞、B 细胞和功能性 NK 细胞。','NSG is a genetically immunodeficient strain lacking mature T and B cells and functional NK cells.'];
      citations.push(sources.nsg);
    } else if (fam==='BALB/c' || m.name==='C57BL/6J') {
      fact=[fam+' 是近交系。同一品系的个体遗传背景相近，便于在相同背景下比较各组的测量结果。',fam+' is an inbred strain. Animals share a closely matched genetic background, which helps comparisons across study groups.'];
      citations.push(fam==='BALB/c'?sources.balb:sources.b6);
    }
    if (ctx==='lung' && /injury/i.test(m.caption)&&/ventilation/i.test(m.caption)&&/bacterial (?:burden|load|counts)|colony.forming/i.test(m.caption)) {
      reported[0]+='作者在同一品系内比较用药后肺部的细菌负荷、组织损伤和通气量。';
      reported[1]+=' The authors compared pulmonary bacterial burden, tissue injury and ventilation after treatment within this strain.';
    }
    if (ctx==='liver' && /patient/i.test(m.caption)&&/steatosis/i.test(m.caption)&&/inflammation/i.test(m.caption)) {
      reported[0]+='图中把小鼠和患者的肝切片并排，比较脂肪变性和炎症在两者中是什么样子。';
      reported[1]+=' Mouse and human liver sections are placed side by side to compare the appearance of steatosis and inflammation.';
    }
    if (ctx==='behavior' && /estrous|oestrous|动情/i.test(m.caption)) {
      fact=['在一项旷场研究中，小鼠个体之间的差异比动情周期更能解释雌鼠探索行为的变化。','In an open-field study, individual differences explained more variation in female exploratory behavior than estrous stage.'];
      citations.push(sources.behavior);
    }
    const explicit=m.record?.text||'';
    const reason=explicit.match(/\b(?:because|chosen (?:for|to)|selected (?:for|to))\s+(.{12,210}?)(?:[.!?](?:\s|$)|$)/i);
    const authorReason=reason && /(?:mice|strain|小鼠).{0,40}(?:were (?:chosen|selected)|because)|(?:used|chose|selected).{0,55}(?:mice|strain).{0,8}because/i.test(explicit) && !/pneumonia|infect|pathogen|susceptib|virus|bacteri|dose|inocul|immunodeficien|neutropen/i.test(explicit+' '+m.caption)
      ? reason[0].replace(/[.!?]$/,'') : '';
    const arr=[m.name+' 在这项研究中起什么作用？','Why use '+m.name+' mice here?',
      [...fact.slice(0,1),reported[0]].join(''),[fact[1],reported[1]].filter(Boolean).join(' '),m.page];
    arr.model={...m,citations,reported,fact,authorReason};
    return arr;
  }
  // Persist only published bibliographic records. Cohorts always come from the currently open PDF.
  const refreshInterval=30*86400000, pending=new Map();
  const legacyKey='reader-public-model-evidence-v1';
  const publicLink=r=>r && typeof r.title==='string' && /^https:\/\/(?:doi\.org|pubmed\.ncbi\.nlm\.nih\.gov)\//.test(r.url);
  let libraryPromise;
  function legacyTopics(){
    try{
      const topics=JSON.parse(localStorage.getItem(legacyKey));
      return Array.isArray(topics)?topics.filter(t=>typeof t?.key==='string'&&Array.isArray(t.records)):[];
    }catch{return []}
  }
  function mergedRecords(previous, incoming){
    const byUrl=new Map();
    for(const r of [...previous,...incoming].filter(publicLink)){
      const id=r.url.toLowerCase().replace(/\/$/,'');
      const old=byUrl.get(id);
      byUrl.set(id,{title:r.title,url:r.url,observation:r.observation||old?.observation});
    }
    return [...byUrl.values()];
  }
  function library(){
    if(!libraryPromise){
      libraryPromise=new Promise((resolve,reject)=>{
        const req=indexedDB.open('paper-reader-public-literature',1);
        req.onupgradeneeded=()=>{
          const store=req.result.createObjectStore('topics',{keyPath:'key'});
          for(const topic of legacyTopics())store.put({key:topic.key,at:topic.at||0,records:mergedRecords([],topic.records)});
        };
        req.onerror=()=>reject(req.error);
        req.onsuccess=()=>{
          const db=req.result;
          db.onversionchange=()=>{db.close();libraryPromise=undefined};
          resolve(db);
        };
      }).catch(error=>{libraryPromise=undefined;throw error});
    }
    return libraryPromise;
  }
  // Read and merge in one transaction so simultaneous readers cannot overwrite each other's findings.
  async function topicRecord(key, incoming){
    const db=await library(), write=incoming!==undefined;
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('topics',write?'readwrite':'readonly'), store=tx.objectStore('topics');
      const request=store.get(key);let topic;
      request.onsuccess=()=>{
        topic=request.result||{key,at:0,records:[]};
        if(write){
          topic={key,at:Date.now(),records:mergedRecords(topic.records,incoming)};
          if(topic.records.length)store.put(topic);
        }
      };
      tx.oncomplete=()=>resolve(topic);
      tx.onabort=()=>reject(tx.error||Error('storage'));
    });
  }
  const normalizeID = s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  function vetted(records,m) {
    return records.filter(r=>{
      if (!publicLink(r)) return false;
      const brief=r.title+' '+(r.abstract||'');
      const aliases=m.family==='E3L.CETP'?['e3lcetp','apoe3leidencetp']:[normalizeID(m.family)];
      return aliases.some(x=>normalizeID(brief).includes(x)) && m.context.relevant.test(brief);
    }).map(r=>{
      const observation=(r.abstract||'').split(/(?<=[.!?])\s+(?=[A-Z])/).find(line=>
        line.length<=175 && line.split(/\s+/).length<=24 && m.context.relevant.test(line) &&
        /\b(?:associated|correlated|varied|differed|similar|variation)\b/i.test(line) &&
        !/dose|infection|pathogen|susceptib|pneumonia|bacteri|virus|virulence/i.test(line));
      return {title:r.title.slice(0,350),url:r.url,observation};
    });
  }
  async function updatePublications(m,saved){
    const key=saved.key;
    if(pending.has(key))return pending.get(key);
    const operation=(async()=>{
      const data=await ReaderAccess.search(m.query);
      if(data.search?.status==='unavailable'||!Array.isArray(data.literature))throw Error('index');
      const incoming=vetted(data.literature,m);
      try{return await topicRecord(key,incoming)}
      catch{return {key,records:mergedRecords(saved.records,incoming),saveFailed:incoming.length>0}}
    })();
    pending.set(key,operation);
    try{return await operation}finally{pending.delete(key)}
  }
  function details(host,m) {
    const d=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('div');
    d.className='rq-model-sources';
    PaperUI.set(summary,'同类研究与出处','Related studies and sources');
    const add=(target,url,zh,en)=>{
      const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';
      if(en)PaperUI.set(a,zh,en);else{a.dataset.sourceText='';a.textContent=zh}
      const p=document.createElement('p');p.append(a);target.append(p);
    };
    if(m.authorReason){
      const title=document.createElement('strong'),quote=document.createElement('blockquote');
      PaperUI.set(title,'作者说明的选择理由','Authors’ stated rationale');
      quote.dataset.sourceText='';quote.textContent=m.authorReason;d.append(title,quote);
    }
    for (const [zh,en,url] of m.citations) add(d,url,zh,en);
    const contextNote=document.createElement('p');
    contextNote.hidden=true;contextNote.className='rq-model-context';
    d.prepend(summary);d.append(list);host.append(contextNote,d);
    const status=document.createElement('small');
    status.hidden=true;status.setAttribute('role','status');d.append(status);
    let done=false,loading=false;
    function render(records){
        list.replaceChildren();
        const more=document.createElement('details');
        if(records.length>3){const title=document.createElement('summary');PaperUI.set(title,'其余 '+(records.length-3)+' 篇研究','Show '+(records.length-3)+' more studies');more.append(title)}
        for(const [index,r] of records.entries()){
          const container=index<3?list:more;
          add(container,r.url,r.title);
          if(r.observation){const quote=document.createElement('blockquote');quote.dataset.sourceText='';quote.textContent=r.observation;container.append(quote)}
        }
        if(records.length>3)list.append(more);
        if(records.length && !m.fact.length){
          const themes={lung:['细菌性肺炎药效','antibacterial studies of pneumonia'],liver:['肝脏脂质沉积','hepatic steatosis'],behavior:['旷场探索行为','open-field exploration'],bone:['骨密度','bone density'],glucose:['糖代谢','glucose metabolism'],graft:['移植物组织学','xenograft histology']};
          const theme=themes[m.context.key];
          const contextZh=theme?'公开文献中也有同时讨论 '+m.family+' 小鼠与'+theme[0]+'的研究。':'公开文献中也有该品系与当前主题相关的研究。';
          const contextEn=theme?'Published work also discusses '+m.family+' mice in research on '+theme[1]+'.':'Published literature also discusses this strain in the current research context.';
          // Indexing establishes co-mention. Only an explicit cohort phrase establishes use.
          PaperUI.set(contextNote,contextZh,contextEn);
          contextNote.hidden=false;
        }
        if(!records.length)PaperUI.set(list,'本次检索未找到同时匹配品系和主题的记录。','No indexed record matched both strain and topic in this search.');
    }
    async function lookup(){
      if(done||loading)return;
      loading=true;status.hidden=true;
      const key=m.query.toLowerCase();
      let saved;
      try{
        try{saved=await topicRecord(key)}
        catch{saved=legacyTopics().find(t=>t.key===key)||{key,records:[],at:0}}
        saved.records=saved.records.filter(publicLink);
        if(saved.records.length){
          render(saved.records);
          if(Date.now()-saved.at<refreshInterval){done=true;return}
        }else PaperUI.set(list,'正在查找同类研究…','Finding related studies…');
        const update=await updatePublications(m,saved);
        render(update.records);
        if(update.saveFailed){
          PaperUI.set(status,'浏览器暂时无法保存本次新增的文献。','The browser could not save the new publications.');
          status.hidden=false;
        }
        done=!!update.records.length&&!update.saveFailed;
      }catch{
        if(saved?.records.length){
          PaperUI.set(status,'已显示保存的文献，本次更新未完成。','Showing saved publications. The update could not be completed.');
          status.hidden=false;
        }else PaperUI.set(list,'索引连接中断，重新展开可重试。','Index unavailable. Reopen to retry.');
      }finally{loading=false}
    }
    d.ontoggle=()=>{if(d.open)lookup()};
    // Known evidence reads instantly. Other models look up related papers on first inspection.
    if(!m.fact.length){
      if (host.tagName==='DETAILS')host.addEventListener('toggle',()=>{if(host.open)lookup()});
      else lookup();
    }
  }
  async function searchHistory(query,records=[]){
    const term=normalize(query).toLowerCase();
    if(!term)return [];
    // Retain public bibliographic metadata, never the question, quoted selection or paper-specific citation flag.
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(term));
    const key='search:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    const items=records.filter(publicLink).map(({title,url})=>({title,url}));
    const prior=await topicRecord(term);
    const entry=await topicRecord(key,items.length?items:undefined);
    return mergedRecords(prior.records,entry.records);
  }
  window.ModelReading=Object.freeze({paperContext,panelPassage,resolve,strains,entry,details,searchHistory});
})();
