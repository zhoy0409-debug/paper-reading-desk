(() => {
  'use strict';
  const el=(tag,cls='')=>{const n=document.createElement(tag);n.className=cls;return n};
  const pair=(n,zh,en)=>PaperUI.set(n,zh,en);
  const btn=(zh,en,fn)=>{const b=pair(el('button'),zh,en);b.type='button';b.onclick=fn;return b};
  function chat(host,openSource,guideFor,topicFor){
    const draft=el('textarea'),question=el('textarea'),remember=el('input'),log=el('div','rq-log'),state=el('p','rq-status');
    const field=(name,node)=>{const l=el('label');l.append(document.createTextNode(name),node);return l};
    function select(cls,choices){
      const node=el('select',cls);
      for(const [value,name] of choices){const option=el('option');option.value=value;option.textContent=name;node.append(option)}
      return node;
    }
    const provider=select('rq-provider',[['auto','自动选择'],['evidence','原文导读 · 免账号'],['deepseek','DeepSeek'],['qwen','通义千问'],['ollama','Ollama · 本机模型'],['chatgpt','ChatGPT · 本机账号']]);
    const range=select('rq-search-range',[['search','本文、引文与公开文献'],['paper','仅核对本文'],['selection','仅使用选段']]);
    const providers={evidence:'原文导读',deepseek:'DeepSeek',qwen:'通义千问',ollama:'Ollama',chatgpt:'ChatGPT'};
    const service=field('回答方式',provider);service.className='rq-service';let recommended='';
    const topic=el('input','rq-topic');topic.maxLength=120;topic.placeholder='例如，abaucin';
    const lookup=btn('查公开文献','',findPublic),lookState=el('div','rq-literature');
    const searchTools=el('div','rq-search-tools');searchTools.append(field('公开检索词',topic),lookup);
    const options=el('details','rq-options');options.append(pair(el('summary'),'回答与检索设置',''),field('回答依据',range),searchTools,lookState);
    const sourceView=el('details','rq-source-preview'),sourceSummary=el('summary'),sourceList=el('div');sourceView.append(sourceSummary,sourceList);
    const transcript=el('details'),previous=el('pre');transcript.append(pair(el('summary'),'已附带的追问记录',''),previous);transcript.hidden=true;
    const confirmation=field('',remember);remember.type='checkbox';confirmation.className='rq-consent';
    confirmation.append(document.createTextNode('允许将所示文字发给所选模型，并按所选范围检索。'));
    const send=btn('发送提问','Send question',submit);state.setAttribute('role','status');lookState.setAttribute('aria-live','polite');
    draft.maxLength=3200;draft.rows=2;question.maxLength=1200;question.rows=2;question.placeholder='为什么要做这项比较？';
    const excerptBox=el('details');excerptBox.append(pair(el('summary'),'核对或编辑选段',''),field('所选文字',draft));
    const note=el('p','rq-privacy');
    options.append(note);
    host.append(log,field('想弄懂什么？',question),service,options,excerptBox,sourceView,transcript,confirmation,send,state);
    let suggestedQuery='';
    let history=[],controller,lookupController,version=0,spot='',sources=[];
    const guideOnly=()=>provider.value==='evidence'||(provider.value==='auto'&&recommended==='evidence');
    function preview(){
      const free=guideOnly(),search=range.value==='search';
      confirmation.hidden=free;searchTools.hidden=!search;lookState.hidden=!search;
      sourceView.hidden=range.value==='selection'||!sources.length;sourceList.replaceChildren();
      sourceSummary.textContent='核对随问题使用的原文（'+sources.length+' 段）';
      for(const s of sources){
        const p=el('p');const quote=el('span');quote.dataset.sourceText='';quote.textContent=s.text;p.append(btn(s.kind+' · p.'+s.page,(window.ReaderEnglish[s.kind]||'Source')+' · p.'+s.page,()=>openSource(s.page,s.text)),quote);sourceList.append(p);
      }
      const label=free?'原文导读无需登录。':provider.value==='auto'?(recommended?'自动选择将使用'+providers[recommended]+'。':'自动选择已配置的问答服务。'):'本次使用'+providers[provider.value]+'。';
      const name=({qwen:'Qwen',evidence:'Source guide',deepseek:'DeepSeek',ollama:'Ollama',chatgpt:'ChatGPT'})[provider.value==='auto'?recommended:provider.value];
      const serviceText=free?'No account required.':name?'Answer service: '+name+'.':'Selects an available answer service.';
      pair(note,label+(search?' 公开数据库接收检索词及待核对的书目信息。':''),serviceText+(search?' The public index receives search terms and bibliographic details.':''));
    }
    const initialLabels=Array.from(provider.options,o=>[o.value,o.textContent]);
    if(!ReaderAccess.local){provider.value='evidence';service.hidden=true;range.value='paper';recommended='evidence';}
    function refreshOptions(config){
      if(!config?.available)return;
      recommended=config.automatic;
      for(const [value] of initialLabels){
        if(!['deepseek','qwen','ollama','chatgpt'].includes(value))continue;
        const item=Array.from(provider.options).find(o=>o.value===value), name=providers[value];
        const english={qwen:'Qwen',deepseek:'DeepSeek',ollama:'Ollama',chatgpt:'ChatGPT'}[value];
        item.dataset.needsKey=String(!config.available[value]);
        pair(item,name+(config.available[value]?'':'（待配置）'),english+(config.available[value]?'':' (set up)'));
      }
      preview();
    }
    ReaderAccess.options().then(refreshOptions).catch(()=>{});
    ReaderAccess.connections(options,provider,refreshOptions);
    ReaderAccess.webChat(host,()=>{
      if(!question.value.trim())return '';
      const prior=history.map(turn=>turn.question+'\n'+turn.answer);
      return [question.value,spot,draft.value,...(range.value==='selection'?[]:sources).map(s=>'[p.'+s.page+'] '+s.text),...prior].filter(Boolean).join('\n\n');
    });
    function resetHistory(){history=[];transcript.hidden=true;previous.textContent='';state.textContent=''}
    function busy(on){for(const control of [send,provider,range,topic,lookup,draft,question,remember])control.disabled=on}
    function clear(keepTurns=false){
      if(!keepTurns)log.replaceChildren();
      version++;controller?.abort();lookupController?.abort();resetHistory();remember.checked=false;question.value='';draft.value='';lookState.replaceChildren();topic.value='';suggestedQuery='';topic.placeholder='例如，abaucin';sources=[];preview();busy(false);
    }
    function change(){lookupController?.abort();lookState.replaceChildren();resetHistory();remember.checked=false;preview()}
    provider.onchange=range.onchange=change;draft.oninput=()=>{resetHistory();remember.checked=false};
    function updateQuery(){
      suggestedQuery=topicFor(draft.value,question.value);
      topic.placeholder=suggestedQuery?ReaderLanguage.choose('建议检索词：'+suggestedQuery,'Suggested: '+suggestedQuery):'';
    }
    question.addEventListener('input',updateQuery);
    draft.addEventListener('input',updateQuery);
    function link(record){
      if(!record||!/^https:\/\/(?:doi\.org|pubmed\.ncbi\.nlm\.nih\.gov)\//i.test(record.url))return null;
      const a=el('a');a.dataset.sourceText='';a.href=record.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=record.title+(record.year?' ('+record.year+')':'');return a;
    }
    function publications(host,data){
      host.replaceChildren();
      if(!data?.search||data.search.status==='off')return;
      const records=data.literature||[];
      if(!records.length){
        host.textContent=({unavailable:'公开索引暂时无响应，可继续阅读本文出处。',no_results:'这组检索词没有返回相关摘要，可在设置中调整主题词。',no_query:'填写公开主题词即可查询文献。'})[data.search.status]||'';savedPublications(host,data.search.query,records);return;
      }
      const d=el('details');d.append(pair(el('summary'),'查看检索文献（'+records.length+'）',''));
      for(const r of records){
        const a=link(r);if(!a)continue;
        const block=el('article');if(r.cited)block.append(pair(el('strong'),'本文所引 · 已核对书目',''));
        block.append(a);if(r.abstract){const more=el('details'),p=el('p');p.dataset.sourceText='';p.textContent=r.abstract;more.append(pair(el('summary'),'查看摘要',''),p);block.append(more)}d.append(block);
      }
      host.append(d);savedPublications(host,data.search.query,records);
    }
    async function savedPublications(host,query,records){
      if(!query)return;
      const holder=el('div');host.append(holder);
      try{
        const saved=await ModelReading.searchHistory(query,records);
        const seen=new Set(records.map(r=>r.url?.toLowerCase().replace(/\/$/,'')));
        const previous=saved.filter(r=>!seen.has(r.url.toLowerCase().replace(/\/$/,'')));
        if(!previous.length)return;
        const more=el('details');
        more.append(pair(el('summary'),'此前保存的 '+previous.length+' 篇文献','Previously saved publications ('+previous.length+')'));
        for(const r of previous){const a=link(r);if(a){const p=el('p');p.append(a);more.append(p)}}
        holder.append(more);
      }catch{if(records.length)pair(holder,'浏览器暂时无法保存本次文献。','The browser could not save these publications.')}
    }
    async function findPublic(){
      const q=(topic.value.trim()||suggestedQuery);if(!q){lookState.textContent='请填写公开检索词。';topic.focus();return}
      lookupController?.abort();const active=new AbortController();lookupController=active;lookState.textContent='正在检索公开文献…';
      try{
        const data=await ReaderAccess.search(q,active.signal);
        if(!active.signal.aborted){publications(lookState,data);const d=lookState.querySelector('details');if(d)d.open=true}
      }catch{if(!active.signal.aborted)publications(lookState,{search:{query:q,status:'unavailable'}})}
    }
    function referenceButtons(refs,data){
      const box=el('div','rq-citations');
      for(const ref of new Set(refs||[])){
        if(/^P[1-9]\d*$/.test(ref)){
          const s=sources[Number(ref.slice(1))-1];if(s){
            const name=window.ReaderEnglish[s.kind]||PaperUI.english(s.kind)||'Source';
            box.append(PaperSourceNotes.card([{...s,zh:s.kind,en:name}],s.kind+' · p.'+s.page,name+' · p.'+s.page,openSource));
          }
        }else{const a=link(data.literature?.find(r=>r.id===ref));if(a)box.append(a)}
      }
      return box;
    }
    function display(q,data,free){
      const turn=el('article','rq-turn');const questionTitle=el('h4');questionTitle.dataset.sourceText='';questionTitle.textContent=q;turn.append(questionTitle);
      const fallback=free||data.provider==='evidence'||!data.reported;
      const answer=fallback?guideFor(q,draft.value,range.value==='selection'?[]:sources,data.literature||[]):data;
      for(const [key,title] of [['reported',fallback?'读原文':'本文依据'],['background','怎样理解'],['uncertain','证据边界']]){
        const line=answer[key];if(!line?.zh)continue;
        turn.append(pair(el('strong'),title,''),pair(el('p'),line.zh,line.en));
        const refs=referenceButtons(line.refs,data);if(refs.childNodes.length)turn.append(refs);
      }
      if(answer.teachingSource){
        const a=el('a');a.href='https://www.histologyguide.com/slidebox/01-introduction.html';a.target='_blank';a.rel='noopener noreferrer';
        pair(a,'组织学图谱 · H&E 染色','Histology Guide · H&E staining');const box=el('div','rq-citations');box.append(a);turn.append(box);
      }
      if(answer.modelSources)ModelReading.details(turn,answer.modelSources);
      const status=el('small','rq-search-result');const modelTitle=fallback?'原文导读':(providers[data.provider]||'模型解读');
      const enModel=fallback?'Source guide':(data.provider==='qwen'?'Qwen':providers[data.provider]||'Model response');
      pair(status,(data.modelNotice?data.modelNotice+' · ':'')+modelTitle,(data.modelNotice?(window.ReaderEnglish[data.modelNotice]||'The model service is unavailable.')+' · ':'')+enModel);turn.append(status);
      const modes={paper:['仅本文','Paper only'],selection:['仅选段','Selection only'],search:['本文与公开文献','Paper and public literature']};
      const mode=modes[range.value];status.append(document.createTextNode(' · '),pair(el('span'),mode[0],mode[1]));
      const list=el('div','rq-literature');publications(list,data);turn.append(list);
      log.append(turn);turn.scrollIntoView({block:'nearest'});
      const short=['reported','background','uncertain'].map(k=>answer[k]?.zh||'').join('\n').trim();
      const english=['reported','background','uncertain'].map(k=>answer[k]?.en|| (answer[k]?.zh?PaperUI.english(answer[k].zh)||window.ReaderEnglish[answer[k].zh]||answer[k].zh:'')).filter(Boolean).join('\n');
      if(english && !/\p{Script=Han}/u.test(english))turn.append(btn('听英文回答','Listen to the English answer',e=>EnglishPractice.open({sentence:english,scope:spot,origin:e.currentTarget})));
      if(short)history=[...history,{question:q,answer:ReaderLanguage.choose(short,english).slice(0,1800)}].slice(-4);
      previous.textContent=history.map(h=>h.question+'\n'+h.answer).join('\n\n');transcript.hidden=!history.length;
    }
    async function submit(){
      const free=guideOnly();
      if(!draft.value.trim()||!question.value.trim()||(!free&&!remember.checked)){state.textContent=free?'请填写选段与问题。':'请填写问题，并确认可发送所示文字。';return}
      const mine=++version,q=question.value.trim(),search=range.value==='search';controller=new AbortController();busy(true);
      state.textContent=search?'正在核对本文、引文和公开文献…':'正在核对本文…';
      try{
        const data=await ReaderAccess.ask({excerpt:draft.value.trim(),question:q,location:spot,history,sharePublic:true,paper:range.value==='selection'?[]:sources,searchPublic:search,provider:provider.value,query:search?(topic.value.trim()||suggestedQuery):''},controller.signal);
        if(mine!==version)return;
        display(q,data,free);question.value='';updateQuery();state.textContent='可以接着问。';
      }catch(err){if(mine===version){display(q,{modelNotice:err.message||'联网问答暂时不可用',search:{query:topic.value.trim()||suggestedQuery,status:search?'unavailable':'off'}},true);state.textContent='已保留本页依据。'}}
      finally{if(mine===version){busy(false);controller=null}}
    }
    return {open(excerpt,newSpot,prompt='',evidence=[]){
      if(excerpt!==draft.value||spot!==newSpot||JSON.stringify(evidence)!==JSON.stringify(sources)){
        clear(spot===newSpot);spot=newSpot;draft.value=excerpt;sources=evidence;suggestedQuery=topicFor(excerpt);topic.value='';topic.placeholder=suggestedQuery?'建议检索词：'+suggestedQuery:'例如，abaucin';preview();
      }
      if(prompt)question.value=ReaderLanguage.choose(prompt,PaperUI.english(prompt)||window.ReaderEnglish[prompt]);updateQuery();question.focus({preventScroll:true});
    },hasText:()=>Boolean(draft.value),clear};
  }

  function mount({notes,visual,img,session,lookupTerm,findPassage,histograms,desk,source,resetPanel,selectPanel}){
    const tabs=el('nav','rq-tabs'),primer=el('section','rq-primer'),ask=el('section','rq-ask');
    const viewer=el('section','rq-focus'),bar=el('div','rq-focus-bar'),label=el('strong'),stage=el('div','rq-stage'),
      viewport=el('div','rq-viewport'),sheet=el('div','rq-sheet'),canvas=el('canvas'),layer=el('div','rq-hits'),callout=el('article','rq-callout'),
      wire=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(wire.namespaceURI,'path');
    wire.append(path);wire.setAttribute('aria-hidden','true');wire.classList.add('rq-wire');
    let figure,part,key='',selectionTag='',epoch=0,activeHit=null;
    function modelEntries(label=''){
      return ModelReading.resolve(figure?.raw,part?.raw,label).map(ModelReading.entry);
    }
    function selectedModel(text){
      const printed=String(text||'').trim();
      const names=ModelReading.strains(printed);
      for(const c of figure?.raw?.animalCohorts||[]){if(printed.includes(c.name)&&!names.includes(c.name))names.push(c.name)}
      const found=modelEntries().filter(e=>names.some(n=>e.model.name===n||e.model.family===n));
      if(found.length===1)return found[0];
      if(!names.length&&/品系|雄鼠|雌鼠|雌性|雄性|免疫缺陷|小鼠|mouse strain|sex of the mice|female mice|male mice/i.test(text)){
        const all=modelEntries();if(all.length===1)return all[0];
      }
    }
    const heTerm=/\bH\s*&\s*E\b|h[ae]+matoxylin|苏木(?:精|素)|伊红/i;
    const il1=/\b(?:IL|interleukin)[\s–-]*1[\s–-]*(?:β|beta|b\b)|白细胞介素[\s–-]*1β/i;
    const il6=/\b(?:IL|interleukin)[\s–-]*6\b|白细胞介素[\s–-]*6/i;
    const meropenem=/美罗培南|meropenem|\bMEM\b/i;
    const piperacillin=/哌拉西林|piperacillin|\bPIP\b/i;
    function requestedSubject(text){
      const phrase=text.match(/(?:只(?:想|需要)?(?:知道|解释|讲|看|谈|说|问|关注)?|单独|重点解释|specifically|focus on|(?:only|just)(?: explain| discuss| cover)?)[：:\s]*(.+)/i)?.[1] || text.match(/([^,，;；。]+?)\s+only[.!?？。\s]*$/i)?.[1];
      if(!phrase)return '';
      const terms=[[il1,'il1'],[il6,'il6'],[meropenem,'mem'],[piperacillin,'pip']].filter(([re])=>re.test(phrase));
      return terms.length===1?terms[0][1]:'';
    }
    function comparisonTopic(text){
      if((il1.test(text)&&il6.test(text))||/两(?:种|项|个).{0,6}(?:细胞因子|炎症(?:因子|指标))|(?:both|two|these) (?:inflammatory )?cytokines/i.test(text))return 'markers';
      if((meropenem.test(text)&&piperacillin.test(text))||/两(?:种|个).{0,5}(?:参照药|对照药)|(?:both|two) (?:comparator|reference) (?:drugs|antibiotics)/i.test(text))return 'comparators';
      return '';
    }
    const termRules=[
      [heTerm,'histology hematoxylin eosin',true],
      [il1,'interleukin-1 beta',true], [il6,'interleukin-6',true],
      [/炎症因子|细胞因子|cytokine/i,'inflammation cytokines',true],
      [meropenem,'meropenem'], [piperacillin,'piperacillin'],
      [/\bsham\b|\bvehicle\b|假处理|溶媒/i,'sham vehicle controls'],
      [/通气量|minute ventilation/i,'minute ventilation'],
      [/体重|body weight/i,'body weight'],
      [/β-lactamase|β-内酰胺酶/i,'antimicrobial susceptibility'],
      [/t-SNE|\bSNE\b/i,'stochastic neighbor embedding']
    ];
    const namedTerms={il1:il1,il6:il6,mem:meropenem,pip:piperacillin};
    function tissue(text){
      const organs=[[/\blung\b|pulmonary|alveol|肺泡|肺组织/i,'lung'],[/\bliver\b|hepat|steatosis|NAFLD|NASH|肝脏|肝组织/i,'liver'],[/kidney|renal|肾/i,'kidney'],[/retina|视网膜/i,'retina'],[/heart|cardiac|心肌/i,'heart']];
      const hits=organs.filter(([re])=>re.test(text));
      return hits.length===1?hits[0][1]:'';
    }
    function topicFor(excerpt,question=''){
      const passage=ModelReading.panelPassage(figure?.caption,part?.raw);
      const ruleQuery=([,query,byOrgan])=>{
        const organ=byOrgan&&(tissue(passage.text)||tissue(passage.lead));
        return organ?organ+' '+query:query;
      };
      const queryTerms=text=>{
        const subject=requestedSubject(text);
        if(subject)return ruleQuery(termRules.find(([pattern])=>pattern===namedTerms[subject]));
        const comparison=comparisonTopic(text);
        if(comparison==='markers')return ruleQuery([null,'interleukin-1 beta interleukin-6',true]);
        if(comparison==='comparators')return 'meropenem piperacillin';
        const term=termRules.find(([re])=>re.test(text));return term?ruleQuery(term):'';
      };
      const explicit=queryTerms(question);if(explicit)return explicit;
      const model=selectedModel(question);if(model)return model.model.query;
      const picked=queryTerms(excerpt);
      if(picked && !selectedModel(excerpt))return picked;
      const mouseEntry=selectedModel(excerpt);if(mouseEntry)return mouseEntry.model.query;
      if(figure?.raw?.checkedIsolateTable)return 'abaucin Acinetobacter';
      if(figure?.raw.editorGuide)return 'abaucin';
      const text=passage.text||figure?.caption||'';
      return (text.match(/\b[A-Za-z][A-Za-z-]{3,}\b/g)||[]).filter(w=>!(/^(figure|table|panel|shows?|this|that|with|from|each|these|were|data|using|between|results|three|types|function|represents?)$/i).test(w)).slice(0,5).join(' ');
    }

    function sourceGuide(q,excerpt,src,records){
      const refs=(pattern)=>src.flatMap((s,i)=>pattern.test(s.kind)?['P'+(i+1)]:[]);
      const input=q.trim();
      const deictic=/^(?:为什么|为何|有何用|什么意思|为什么(?:要)?(?:用|选|选择|这样做|这么做|测)?(?:它|这个|这种|这个方法)?|why(?: this| that)?|what does (?:that|this|it) mean)[?？。!！\s]*$/i.test(input);
      if(heTerm.test(input)||(deictic&&heTerm.test(excerpt))){
        const caption=src.length?figure.caption:'';
        const passage=ModelReading.panelPassage(caption,src.length?part?.raw:null);
        const organ=tissue(passage.text)||tissue(passage.lead);
        const captionShowsStain=heTerm.test(passage.text)||heTerm.test(passage.lead)||/\ball (?:photomicrographs|panels|sections).{0,55}(?:h[ae]+matoxylin|H&E)/i.test(caption);
        const meaning={zh:'苏木精使细胞核通常呈蓝紫色，伊红使许多细胞质和细胞外蛋白呈粉红色。两种颜色把细胞核和周围组织区分开，方便观察形状、大小以及细胞在哪里聚集。',en:'Hematoxylin usually stains nuclei blue-purple. Eosin stains much of the cytoplasm and extracellular protein pink. This contrast shows cell shape, size and where cells cluster.',refs:[]};
        const answer={background:meaning,teachingSource:true};
        if(captionShowsStain){
          let zh='图注说明这里使用苏木精–伊红（H&E）染色观察组织结构。',en='The caption identifies hematoxylin and eosin (H&E) staining to examine tissue structure.';
          if(organ==='liver'){
            zh+='读肝切片时，先沿粉红色胞质看清肝细胞的轮廓，再找蓝紫色细胞核。';
            en+=' On a liver section, trace the pink hepatocyte cytoplasm and locate its blue-purple nucleus.';
            const signs=[
              [/steatosis|脂肪变/i,'细胞内空泡','intracellular vacuoles'],
              [/hypertroph|肥大/i,'肝细胞大小','hepatocyte size'],
              [/inflammat|炎症/i,'炎症细胞是否聚集','clusters of inflammatory cells']
            ].filter(([re])=>re.test(passage.text));
            if(signs.length){
              zh+='结合这段图注，再观察'+signs.map(x=>x[1]).join('、')+'。';
              en+=' The caption points to '+signs.map(x=>x[2]).join(', ')+'.';
            }
          }else if(organ==='lung' && /alveol|lung section/i.test(passage.text)){
            zh+='在肺切片上，先沿白色气腔看肺泡壁，再比较各组间隔厚度和细胞聚集情况。';
            en+=' Trace the walls around the open air spaces, then compare septal thickness and cellular crowding across groups.';
          }
          answer.reported={zh,en,refs:src.flatMap((s,i)=>/图注/.test(s.kind)&&heTerm.test(s.text)?['P'+(i+1)]:[]).slice(0,2)};
        }
        return answer;
      }

      const targetTerm=termRules.some(([re])=>re.test(input));
      const modelFollowUp=deictic || /品系|雄鼠|雌鼠|雄性|雌性|性别|免疫状态|这种小鼠|这个品种|this strain|sex of|this mouse/i.test(input);
      const mouseEntry=src.length && !targetTerm && (selectedModel(input)||(modelFollowUp&&selectedModel(excerpt)));
      if(mouseEntry){
        const m=mouseEntry.model;
        const answer={reported:{zh:m.reported[0],en:m.reported[1],refs:refs(/动物资料/)}};
        if(m.fact.length)answer.background={zh:m.fact[0],en:m.fact[1],refs:[]};
        if(/性别|雄性|雄鼠|雌性|雌鼠|雌激素|激素|sex|female|male|hormon/i.test(input) && m.context.key==='lung' && m.citations.some(c=>c[0].includes('表 2'))){
          answer.background={zh:'同类肺炎药效研究也使用雌鼠。同一份 53 项研究的统计中，34 项只用雌鼠，9 项只用雄鼠，1 项同时用了两性，另有 9 项未报告性别。'+(m.sex==='male'?'本文的各治疗组在雄鼠中比较。':''),en:'Of 53 comparator studies, 34 used females only, 9 males only and 1 both sexes. Nine did not report sex.',refs:[]};
        }
        if(/免疫|缺陷|中性粒|immun|neutropeni/i.test(input) && /\bneutropeni[ac]\b/i.test(m.caption)){
          answer.background={zh:'图注中的 neutropenic 指这些小鼠在观察时中性粒细胞减少。中性粒细胞是一类参与先天免疫的白细胞。品系名交代遗传背景，这个形容词交代实验时的免疫状态。',en:'Neutropenic means the mice had reduced numbers of neutrophils, a type of white blood cell involved in innate immunity. The strain names their genetic background. This adjective describes their immune state during the study.',refs:refs(/整图图注/)};
        }
        answer.modelSources=m;return answer;
      }
      if(figure?.raw.checkedIsolateTable&&part?.id==='a'&&src.length&&(/菌|基因|耐药|对照|选择|为何选|为什么选|为什么这么做|依据|前作|HX-|bla[A-Z]|isolat|strain|control|compar|select|susceptib/i.test(input)||(!input&&/HX-|bla[A-Z]/.test(excerpt)))){
        const id=src.find(s=>s.kind==='所点表格行')?.text.match(/Row:\s*(HX-[RS]\d+)/i)?.[1];
        const geneOnly=/基因|gene/i.test(q)&&!/为什么|选择|选|对照|why|select/i.test(q);
        const prior=records.find(r=>r.cited&&r.url==='https://doi.org/10.1038/s41589-023-01349-8');
        const studyEn=(id?id+' is one of six clinical A. baumannii isolates tested. ':'Six clinical A. baumannii isolates were tested. ')+'The authors asked whether activity previously observed in archived strains extended to recent ICU isolates. Panel A includes three carbapenem-susceptible and three resistant isolates.';
        const obj=id?id+' 是受测的鲍曼不动杆菌临床分离株。':'图 1A 列出了六株来自临床的鲍曼不动杆菌。';
        return {reported:{zh:obj+'作者想知道，前作在存档菌株上观察到的抗菌活性，到了近期 ICU 患者的分离株上是否还能看到。图 A 同时测了三株碳青霉烯敏感株和三株耐药株。',en:studyEn,refs:refs(/所点表格行|研究目的|整图图注/)},
          background:{zh:geneOnly?'基因列描述各株的 β-内酰胺酶背景。右侧两列才是实测药敏结果。MIC 是能抑制可见生长的最低药物浓度；每一行都可以横向比较两种药。':'先横着读一行。基因列交代该株的耐药背景，右侧两列是 abaucin 与氨苄西林的最低抑菌浓度。再跨图比较：B 看其他耐药病原菌，C 看所选肠道共生菌。三格合起来回答药物的作用范围有多窄。文献 54 已报告 abaucin 对鲍曼不动杆菌的窄谱活性，本文扩大了临床菌株和共生菌的检测范围。',en:geneOnly?'The gene column describes the β-lactamase background. The two MIC columns give the lowest concentrations that inhibited visible growth. Read across a row to compare the drugs.':'Read across each row to compare abaucin and ampicillin MICs. The gene column describes the resistance background. Panels B and C extend the comparison to other tested pathogens and gut commensals. The earlier work is reference 54.',refs:[...refs(/整图图注|引文所在句|参考文献/),...(prior?[prior.id]:[])]},
          uncertain:{zh:id?'原文说明了这类菌为什么值得测。它把 '+id+' 列为受测样本，未记载单独选中这株的理由；这一行也没有检验某个基因能否导致特定的药敏结果。':'这些结果适用于本次受测菌株。图 A 没有单独检验某个基因对药敏的因果作用。',en:(id?'The paper explains the choice of this class of isolates, without giving a separate reason for selecting '+id+'. ':'The results describe the isolates tested. ')+'Panel A does not isolate the contribution of an individual gene.',refs:refs(/所点表格行|整图图注/).slice(0,1)}};
      }
      if(src.length&&figure?.raw.editorGuide){
        const map=[[meropenem,'mem'],[piperacillin,'pip'],[/造模顺序|先感染|先给药|先治疗|预防|顺序|sequence/i,'sequence'],[/假处理|\bsham\b/i,'sham'],[/溶媒|\bvehicle\b/i,'vehicle'],[/为什么.{0,14}(炎症|因子)|选择.{0,6}炎症指标|why.{0,25}cytokine/i,'markers'],[il1,'il1'],[il6,'il6'],[/体重|weight/i,'weight'],[/空隙|肺泡腔|气腔|air space/i,'air'],[/细胞核|苏木精|伊红|H&E/i,'stain'],[/分钟通气|ventilation/i,'vent'],[/颜色|脏器|整肺/i,'gross']];
        const scopedKey=text=>requestedSubject(text)||comparisonTopic(text)||(part?.id==='d'&&/四组|分组|几组|four groups|which groups/i.test(text)?'infectedGroups':map.find(([re])=>re.test(text))?.[1]);
        const key=figure.raw.matchKey==='F:2'&&(scopedKey(q)||scopedKey(excerpt));
        const e=key&&ReadingPrimer.entries[key];if(e)return {reported:{zh:e[2],en:e[3],refs:src.flatMap((s,i)=>s.page===e[4]?['P'+(i+1)]:[]).slice(0,2)}};
      }
      const windowAnswer=StudyDesignReading.samplingWindow(q,excerpt,src);
      if(windowAnswer)return {reported:windowAnswer};
      const matches=(q.match(/[A-Za-z][A-Za-z0-9-]{2,}/g)||[]).map(t=>t.toLowerCase());
      const why=/为什么|为何|理由|why|purpose/i.test(q);
      const pick=src.map((s,i)=>({s,i,score:(why&&s.kind==='研究目的原句'?12:0)+(/正文|小图图注/.test(s.kind)?2:0)+matches.filter(t=>s.text.toLowerCase().includes(t)).length*3})).sort((a,b)=>b.score-a.score)[0];
      const result={reported:{zh:pick?'可从第 '+pick.s.page+' 页这段原文核对当前问题。':'当前选段可供核对。',en:pick?.s.text||excerpt,refs:pick?['P'+(pick.i+1)]:[]}};
      if(src.length){
        const category=/先后|之前|之后|时间|before|after/i.test(q)?'order':/分组|随机|random/i.test(q)?'allocation':/指标|测量|测什么|measure/i.test(q)?'measure':/对照|比较|compar|control/i.test(q)?'comparison':null;
        const facts=StudyDesignReading.explain(figure.raw,part?.raw)||[];
        const f=category&&facts.find(v=>v.key===category&&v.zh);
        if(f)result.background={zh:f.zh,en:f.en,refs:src.flatMap((s,i)=>f.source?.page===s.page&&s.text.includes(f.source.text)?['P'+(i+1)]:[]).slice(0,1)};
      }
      if(!result.background&&src.length){
        const explanations=[
          [/\bMIC\b|minimum inhibitory concentration|最低抑菌浓度/i,'最低抑菌浓度（MIC）是抑制可见生长所需的最低药物浓度。同一株菌横向比较药物，同一种药纵向比较菌株。','The minimum inhibitory concentration (MIC) is the lowest concentration that inhibits visible growth. Compare drugs within an isolate or compare isolates for one drug.'],
          [/\bvehicle\b|溶媒|溶剂对照/i,'溶媒组接受载送药物的液体。用它与疾病背景相同的给药组比较，可以看加入药物后同一终点的差异。','The vehicle group receives the liquid used to deliver the drug. Comparing it with a treated group under the same conditions shows how the measured outcome differs with the drug.'],
          [/baseline.{0,45}follow.up|before and after|paired observations|配对(?:观测|测量|数据)|前后测量/i,'先确认两个数是否来自同一对象。同一对象前后相减得到个体变化，不同组的终点读数则反映组间差异。','First check whether both measurements belong to the same individual. Subtracting paired values gives a within-individual change. Endpoint values from separate groups give a between-group comparison.'],
          [/random(?:ized|ised|ly assigned)|随机分组|随机分配/i,'随机分组是用随机过程分配干预。它减少分组时的系统偏差，让各组在平均意义上更可比。','Random allocation assigns interventions by chance. It reduces systematic differences introduced by assignment and makes groups comparable on average.'],
          [/shannon/i,'Shannon 指数同时反映样本中有多少类群，以及它们的丰度有多均匀。再看组成图，可以辨认主要类群。','The Shannon index reflects both the number of groups present and how evenly their abundance is distributed. A composition plot shows which groups are most abundant.'],
          [/confidence intervals?|\b95\s*%?\s*CI\b|置信区间/i,'先找点估计，再看区间的上下限。相同条件下，区间越窄，估计越精确。读组间差值时可对照 0，读比值时可对照 1。','Find the point estimate and the lower and upper limits. Under comparable conditions a narrower interval indicates a more precise estimate. The reference for no difference is 0 for a difference and 1 for a ratio.']];
        const rule=explanations.find(([re])=>re.test(q))||explanations.find(([re])=>re.test(excerpt));
        if(rule)result.background={zh:rule[1],en:rule[2],refs:[]};
      }
      const cited=records.find(r=>r.cited);
      if(cited&&/依据|前作|引用|参考|previous|prior|cit/i.test(q)){
        const context=src.find(s=>s.kind==='引文所在句');
        result.background={zh:'本文在这里引用了《'+cited.title.replace(/\.$/,'')+'》。'+(context?'下方出处可回到作者使用这条引文的原句。':''),en:context?.text||'',refs:[...refs(/引文所在句|参考文献/),cited.id]};
      }
      if(pick&&!result.background)result.reported.zh='第 '+pick.s.page+' 页的'+pick.s.kind+'写道：'+pick.s.text;
      return result;
    }
    const conversation=chat(ask,source,sourceGuide,topicFor);
    let tableRows=[];
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const goFull=()=>{resetPanel();visual.scrollIntoView({block:'nearest'})};
    let enterAnimation;
    function revealCrop(from){
      enterAnimation?.cancel();
      if(reduced.matches||!from||!sheet.animate)return;
      const to=sheet.getBoundingClientRect();
      if(!to.width||!from.width||from.bottom<0||from.top>innerHeight)return;
      const dx=from.left-to.left,dy=from.top-to.top;
      enterAnimation=sheet.animate([
        {transformOrigin:'0 0',transform:'translate('+dx+'px,'+dy+'px) scale('+from.width/to.width+','+from.height/to.height+')',opacity:.65},
        {transformOrigin:'0 0',transform:'none',opacity:1}
      ],{duration:290,easing:'cubic-bezier(.18,.8,.22,1)'});
    }
    const pageButton=btn('原文','PDF',()=>source(figure.page));
    const barActions=el('div','rq-bar-actions');
    const zoomButton=btn('放大','Zoom in',()=>setZoom(!viewport.classList.contains('rq-magnified')));
    zoomButton.className='rq-zoom';
    // Inertial scrolling can consume the synthesized click even when a button receives a tap.
    let zoomTouch=null;
    zoomButton.addEventListener('touchstart',e=>{
      zoomTouch=e.touches.length===1?e.touches[0]:null;
    },{passive:true});
    zoomButton.addEventListener('touchcancel',()=>{zoomTouch=null});
    zoomButton.addEventListener('touchend',e=>{
      const start=zoomTouch,end=e.changedTouches[0];zoomTouch=null;
      if(!start||!end||start.identifier!==end.identifier||e.touches.length||!e.cancelable)return;
      if(Math.hypot(end.clientX-start.clientX,end.clientY-start.clientY)>8)return;
      e.preventDefault();
      zoomButton.focus({preventScroll:true});zoomButton.click();
    },{passive:false});
    zoomButton.setAttribute('aria-pressed','false');
    stage.tabIndex=0;
    stage.setAttribute('role','region');
    function nameStage(){stage.setAttribute('aria-label',ReaderLanguage.choose('小图与元素解释','Panel and annotation'))}
    nameStage();
    viewport.setAttribute('role','region');
    viewport.setAttribute('aria-label','小图细节 / Panel detail');
    function centerHit(hit){
      const v=viewport.getBoundingClientRect(),h=hit.getBoundingClientRect();
      viewport.scrollBy({left:h.left+h.width/2-v.left-v.width/2,top:h.top+h.height/2-v.top-v.height/2,behavior:'instant'});
    }
    function setZoom(on){
      viewport.classList.toggle('rq-magnified',on);
      zoomButton.setAttribute('aria-pressed',String(on));
      pair(zoomButton,on?'还原大小':'放大',on?'Fit panel':'Zoom in');
      if(on){
        viewport.tabIndex=0;
        if(activeHit)centerHit(activeHit);
      }else{
        viewport.removeAttribute('tabindex');
        viewport.scrollTo(0,0);
      }
      drawWire();
    }
    // Touch uses native scrolling. Start a mouse drag only after it moves beyond a click.
    let drag=null,ignoreDragClick=false;
    viewport.addEventListener('pointerdown',e=>{
      ignoreDragClick=false;
      if(e.pointerType!=='mouse'||e.button!==0||!viewport.classList.contains('rq-magnified'))return;
      drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false};
    });
    viewport.addEventListener('pointermove',e=>{
      if(!drag||e.pointerId!==drag.id)return;
      if(e.buttons!==1){drag=null;viewport.classList.remove('rq-panning');return}
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(!drag.moved){
        if(Math.hypot(dx,dy)<5)return;
        drag.moved=true;
        viewport.setPointerCapture(e.pointerId);
        viewport.classList.add('rq-panning');
      }
      viewport.scrollTo(drag.left-dx,drag.top-dy);
    });
    function endDrag(e){
      if(!drag||e.pointerId!==drag.id)return;
      ignoreDragClick=drag.moved&&e.type==='pointerup';
      drag=null;viewport.classList.remove('rq-panning');
    }
    viewport.addEventListener('pointerup',endDrag);
    viewport.addEventListener('pointercancel',endDrag);
    viewport.addEventListener('lostpointercapture',endDrag);
    viewport.addEventListener('click',e=>{
      if(!ignoreDragClick||!e.detail)return;
      ignoreDragClick=false;e.stopPropagation();e.preventDefault();
    },true);
    viewport.addEventListener('scroll',drawWire,{passive:true});
    barActions.append(desk.focusAdd,zoomButton,btn('返回整图','Full figure',goFull),pageButton,desk.focusCrop);
    bar.append(label,barActions);const shared=el('div','rq-shared-legend');shared.hidden=true;stage.append(viewport,shared,wire,callout);viewport.append(sheet);sheet.append(canvas,layer);
    const keys=el('details','rq-key-list'),keySummary=el('summary'),keyList=el('div');keys.append(keySummary,keyList);
    const tickNote=btn('右侧部分刻度在原页中也显示不全 · 核对原页','Clipped tick labels · View PDF',()=>source(figure.page));
    tickNote.className='rq-tick-note';tickNote.hidden=true;
    keys.hidden=true;
    const pointProgress=FigureClicks.feedback();
    viewer.append(bar,pointProgress.node,stage,tickNote);viewer.hidden=callout.hidden=true;visual.querySelector('.frw-caption').before(viewer);
    const locate=btn('定位图中标注','Locate on figure',()=>{
      if(activeHit){centerHit(activeHit);activeHit.focus({preventScroll:true});drawWire()}
    });
    locate.className='rq-locate';locate.hidden=true;
    const observer=new ResizeObserver(()=>drawWire());observer.observe(stage);observer.observe(callout);observer.observe(sheet);
    function drawWire(){
      if(!activeHit||callout.hidden)return;
      const r=wire.getBoundingClientRect(),a=activeHit.getBoundingClientRect(),b=callout.getBoundingClientRect();
      const v=(shared.contains(activeHit)?shared:viewport).getBoundingClientRect();
      const left=Math.max(a.left,v.left),right=Math.min(a.right,v.right),top=Math.max(a.top,v.top),bottom=Math.min(a.bottom,v.bottom);
      const outside=right<=left||bottom<=top;
      locate.hidden=!outside;
      if(outside){path.removeAttribute('d');return}
      const box=canvas.getBoundingClientRect();
      const x=traceAnchor?box.left+traceAnchor[0]*box.width-r.left:(left+right)/2-r.left;
      const y=traceAnchor?box.top+traceAnchor[1]*box.height-r.top:(top+bottom)/2-r.top;
      const ey=b.top-r.top,ex=b.left+16-r.left;
      wire.setAttribute('viewBox','0 0 '+Math.max(1,r.width)+' '+Math.max(1,r.height));
      if(!traceAnchor && layer.contains(activeHit) && shared.hidden){
        const onLeft=x+r.left<(box.left+box.right)/2;
        const start=(onLeft?left-2:right+2)-r.left;
        const side=onLeft?Math.max(v.left,box.left-6):Math.min(v.right,box.right+6);
        const lane=side-r.left;
        path.setAttribute('d','M '+start+' '+y+' H '+lane+' V '+ey);
        return;
      }
      const offset=ey-12;
      const startY=traceAnchor?y:(ey>=y?bottom+2:top-2)-r.top;
      if(!shared.hidden && !shared.contains(activeHit)){
        const below=Math.min(offset,viewport.getBoundingClientRect().bottom-r.top+3);
        path.setAttribute('d','M '+x+' '+startY+' V '+below+' H '+ex+' V '+ey);
      }else path.setAttribute('d','M '+x+' '+startY+' V '+offset+' L '+ex+' '+ey);
    }
    function revealTip(){
      // Reveal the start of a long note. Keep its remaining paragraphs in the same scroll area.
      if(stage.scrollHeight>stage.clientHeight && getComputedStyle(stage).overflowY==='auto'){
        const area=stage.getBoundingClientRect(),note=callout.getBoundingClientRect();
        const delta=Math.min(note.top-area.top-10,Math.max(0,note.bottom-area.bottom+10));
        if(delta)stage.scrollBy({top:delta,behavior:'instant'});
      }
      if(matchMedia('(max-width:1000px)').matches)callout.scrollIntoView({block:'nearest',behavior:'instant'});
    }
    let traceAnchor=null;
    function showTip(b,entry,row,anchor=null){
      pointProgress.cancelTap();
      enterAnimation?.finish();
      if(entry.lookup)entry=findPassage?.(entry[0],figure.page)||entry;
      traceAnchor=anchor;
      activeHit?.setAttribute('aria-pressed','false');activeHit=b;b.setAttribute('aria-pressed','true');
      callout.replaceChildren(pair(el('h4'),entry[0],entry[1]),pair(el('p'),entry[2],entry[3]));
      if(entry.localize)PaperLanguageText.bind(callout.querySelector('p'),entry[3],{showSource:true});
      const actions=el('div','rq-actions');actions.append(locate);
      if(entry[4])actions.append(btn('对照 p.'+entry[4],'Source · p.'+entry[4],()=>source(entry[4],entry.quote)));
      if(entry[3])actions.append(btn('英文跟读','English practice',e=>EnglishPractice.open({
        text:entry[1],sentence:entry[3],scope:selectionTag,origin:e.currentTarget,onAsk:(text,prompt)=>openQuestion(text,prompt,row)
      })));
      actions.append(btn('继续追问','Ask a question',()=>openQuestion([ReaderLanguage.choose(entry[0],entry[1]),ReaderLanguage.choose(entry[2],entry[3])].join('\n'),'',row)));
      if(entry.model)ModelReading.details(callout,entry.model);
      callout.append(actions);callout.hidden=false;wire.classList.remove('rq-draw');drawWire();
      requestAnimationFrame(()=>{if(activeHit!==b||callout.hidden)return;revealTip();wire.classList.add('rq-draw');drawWire()});
    }
    function closeTip(){activeHit?.setAttribute('aria-pressed','false');activeHit=null;callout.hidden=true;locate.hidden=true;path.removeAttribute('d');wire.classList.remove('rq-draw')}
    function setTab(to){
      notes.dataset.studyTab=to;
      for(const [index,b] of Array.from(tabs.querySelectorAll('[data-view]')).entries()){
        const active=b.dataset.view===to;b.setAttribute('aria-pressed',String(active));
        if(active)tabs.style.setProperty('--rq-tab',index);
      }
      primer.hidden=to!=='basics';ask.hidden=to!=='ask';
    }
    for(const [mode,zh,en] of [['read','图解','Explanation'],['basics','读图基础','Basics'],['ask','划词追问','Ask a question']]){
      const b=btn(zh,en,()=>{setTab(mode);if(mode==='ask'){if(!conversation.hasText())conversation.open((part?.raw.reading?.sources?.find(s=>s.kind==='小图图注')?.text||figure?.caption||'').slice(0,3200),selectionTag,'',paperEvidence());ask.scrollIntoView({block:'nearest'})}});b.dataset.view=mode;tabs.append(b);
    }
    tabs.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
      const options=Array.from(tabs.querySelectorAll('[data-view]')),current=options.indexOf(document.activeElement);
      if(current<0)return;
      const i=e.key==='Home'?0:e.key==='End'?options.length-1:(current+(e.key==='ArrowRight'?1:-1)+options.length)%options.length;
      e.preventDefault();options[i].focus();options[i].click();
    });
    tabs.setAttribute('aria-label','读图方式 / Reading modes');
    const lead=notes.querySelector('.frw-notes-top');lead.after(tabs,keys,primer,ask);setTab('read');
    function practiceContext(options){
      const guide=part?.raw.reading;
      const localCaption=guide?.sources?.find(s=>s.kind==='小图图注')?.text;
      const passage=guide?.narrationEn || localCaption || (!part ? figure?.caption : '');
      if(!options.sentence && passage){
        options.sentence=EnglishPractice.sentenceOf(passage,options.text);
        options.caption=!guide?.narrationEn;
      }
      options.scope=selectionTag;options.onAsk=(text,prompt)=>openQuestion(text,prompt);
    }
    const practice=btn('英文跟读','English practice',e=>{
      const options={origin:e.currentTarget};practiceContext(options);EnglishPractice.open(options);
    });
    practice.className='ep-panel-button frw-inline';lead.append(practice);
    const enrichPractice=e=>practiceContext(e.detail);
    document.addEventListener('reader-practice-context',enrichPractice);
    function paperEvidence(row,excerpt){
      const out=[],seen=new Set();
      function put(kind,page,text){
        if(!text||!Number.isInteger(page)||page<1||out.length>=7)return;
        const normalized=text.replace(/\s+/g,' ').trim();if(!normalized||seen.has(normalized))return;
        seen.add(normalized);out.push({kind,page,text:normalized.slice(0,1400)});
      }
      const raw=figure?.raw;if(!raw)return out;
      const record=selectedModel(excerpt||'')?.model.record;
      if(record)put('本文动物资料',record.page,record.text);
      if(row)put('所点表格行',figure.page,row);
      const local=part&&ModelReading.panelPassage(figure.caption,part.raw);
      if(local?.local && local.text)put('小图图注',raw.captionPage||figure.page,local.text);
      put('整图图注',raw.captionPage||figure.page,figure.caption);
      for(const a of raw.questionAims||[])put('研究目的原句',a.page,a.text);
      for(const c of (raw.questionCitations||[]).slice(0,1)){
        if(c.context)put('引文所在句',c.context.page,c.context.text);
        put('参考文献 ['+c.number+']',c.page,c.text.slice(0,650));
      }
      for(const a of raw.authorPassages||[])put('提及本图的正文',a.page,a.text);
      for(const a of part?.raw.reading?.sources||[])if(/正文|小图图注/.test(a.kind))put(a.kind,a.page,a.text);
      return out;
    }
    function openQuestion(excerpt,prompt,row){
      if(!row&&excerpt.trim().length>=4){
        const matches=tableRows.filter(h=>h.entry[0].includes(excerpt.trim()));
        if(matches.length===1)row=matches[0].row;
      }
      setTab('ask');const opened=document.querySelector('.ea-explorer[open]');if(opened)opened.close();
      notes.scrollIntoView({block:'nearest'});conversation.open(excerpt.slice(0,3200),selectionTag,prompt,paperEvidence(row,excerpt));
    }
    const selected=e=>{
      const studio=notes.closest('.frw.st');
      if(studio?.dataset.view==='map')studio.dispatchEvent(new CustomEvent('studio-view',{detail:'read'}));
      openQuestion(e.detail.text,'');
    };
    document.addEventListener('reader-ask-selection',selected);
    function primerEntry(entry){
      const d=el('details','rq-basic');d.append(pair(el('summary'),entry[0],entry[1]),pair(el('p'),entry[2],entry[3]));
      const row=el('div','rq-actions');if(entry[4])row.append(btn('原文 p.'+entry[4],'Source · p.'+entry[4],()=>source(entry[4])));
      row.append(btn('追问这一点','Ask more',()=>openQuestion(ReaderLanguage.choose(entry[2],entry[3]),'')));if(entry.model)ModelReading.details(d,entry.model);d.append(row);primer.append(d);
    }
    function designGuide(){
      if(!figure)return;
      const d=el('details','rq-design');
      d.append(pair(el('summary'),'这项研究是怎样比较的？','Study design'));
      const fields={unit:['研究对象','Study unit'],allocation:['分组方式','Group design'],order:['先后与对照','Sequence and controls'],measure:['怎样测量','Measurement'],comparison:['比较依据','Comparison']};
      const facts=StudyDesignReading.explain(figure.raw,part?.raw);
      for(const key of Object.keys(fields)){
        const group=facts.filter(f=>f.key===key);if(!group.length)continue;
        const section=el('section');section.append(pair(el('h4'),...fields[key]));
        for(const f of group)section.append(pair(el('p'),f.zh,f.en));
        const used=new Set();
        for(const f of group){
          if(!f.source?.page||used.has(f.source.text))continue;
          used.add(f.source.text);
          const pageLabel=' · p.'+f.source.page;
          section.append(PaperSourceNotes.card([{...f.source,zh:'原文',en:'Source'}],'核对原句'+pageLabel,'Read passage'+pageLabel,source));
        }
        d.append(section);
      }
      if(!facts.length||(!facts.some(f=>f.key==='order')&&facts.some(f=>f.key==='allocation'||f.key==='unit'&&!f.en.includes('data points'))))
        d.append(pair(el('p','rq-design-note'),'当前引文未明确干预与观察的先后。可打开方法段核对。','The cited passages do not specify the order of intervention and observation.'));
      if(!facts.length&&figure.page)d.append(btn('打开原文 p.'+figure.page,'Source PDF',()=>source(figure.page)));
      primer.append(d);
    }
    function basics(){
      primer.replaceChildren();
      const P=ReadingPrimer;
      const isChecked=figure?.raw.editorGuide,number=figure?.raw.matchKey;
      let ids=[];
      if(isChecked&&number==='F:2')ids=P.lists[part?.id]||['sham','vehicle','mem','pip','mouse','time'];
      if(isChecked&&number==='F:1')ids=['isolates','genes'];
      for(const id of ids)if(id!=='mouse')primerEntry(P.entries[id]);
      if(!isChecked||ids.includes('mouse'))for(const entry of modelEntries())primerEntry(entry);
      if(!ids.length){
        const captions=part?.raw.reading?.sources||[];
        const caption=captions.find(s=>s.kind==='小图图注')||captions.find(s=>s.en?.startsWith('Shared panel caption'));
        const printed=part?.raw.printedTitle?.trim();
        const specific=caption?.text||printed;
        const raw=specific||figure?.caption;
        if(raw){const desc=pair(el('h4','rq-caption-label'),specific?'本格原文':'原文图注',specific?'Panel caption':'Original caption');primer.append(desc);
          const q=el('blockquote');q.textContent=raw;q.lang=/[\u3400-\u9fff]/u.test(raw)?'zh-CN':'en';primer.append(q);
          if(specific&&figure.caption&&figure.caption.trim()!==raw.trim()){
            const full=el('details','rq-full-caption'),text=el('p');text.dataset.sourceText='';text.textContent=figure.caption;
            full.append(pair(el('summary'),'查看整图图注','Full figure caption'),text);primer.append(full);
          }
          const context=specific&&figure.caption?raw+'\n'+figure.caption:raw;
          primer.append(btn('这张图在比较什么？','Ask about the comparison',()=>openQuestion(context,'这个指标在测什么？它为前面的观察补上哪一类证据？用选段核对比较组与结果。若作者没有交代选择理由，请标明。')));
          if(/treatment|intervention|baseline|exposure|follow.up|endpoint|post.infection/i.test(raw)){
            primer.append(btn('先干预，还是先出现变化？','Check the sequence',()=>openQuestion(raw,'请按选段证据梳理观察、干预、测量的先后。比较的是同一对象前后变化，还是不同组的终点？无法核实的时序请标明。')));
          }
        }else primer.append(pair(el('p'),'当前只有原页。可划选已核对的文字提问。','Only the source page is available.'));
      }
      designGuide();
      if(isChecked&&number==='F:2'&&['b','c'].includes(part?.id)){
        const a=el('a');a.href='https://pmc.ncbi.nlm.nih.gov/articles/PMC7328339/';a.target='_blank';a.rel='noopener noreferrer';
        pair(a,'延伸阅读 · 肺损伤的组织学评价','ATS workshop report');primer.append(a);
      }
    }
    const pathMenu=el('div','rq-path-menu'),menuTitle=pair(el('h4'),'从图上哪里开始？','Explore this panel'),menuList=el('div','rq-paths');
    let long=false;
    const toggleLong=btn('展开完整解读','Full reading',()=>{long=!long;updateLong()});
    pathMenu.append(menuTitle,menuList,toggleLong);tabs.after(pathMenu);pathMenu.hidden=true;
    const chain=el('section','rq-chain');
    pathMenu.before(chain);chain.hidden=true;
    const noteSlot=el('div','rq-paper-notes');chain.before(noteSlot);
    function showThread(){
      const passages=PaperSourceNotes.figurePassages(figure,part);
      noteSlot.replaceChildren();noteSlot.hidden=!passages.length;
      if(passages.length)noteSlot.append(PaperSourceNotes.card(passages,'对读原文','Read source passages',source));
      const step=part?.raw.checkedGuide&&figure?.raw.matchKey==='F:2'&&ReadingPrimer.thread[part.id];
      chain.replaceChildren();chain.hidden=!step;
      if(!step)return;
      const [title,eng,why,target,nextZh,nextEn]=step,entry=ReadingPrimer.entries[why];
      const details=el('details'),summary=pair(el('summary'),title,eng);
      details.append(summary,pair(el('p'),entry[2],entry[3]));
      const refs=el('div','rq-actions');
      refs.append(btn('图注 p.5','Caption',()=>source(5)),btn('正文 p.3','Results',()=>source(3)));
      if(part.id==='b')refs.prepend(btn('A · 感染与治疗的顺序','Study timeline',()=>{ selectPanel('a');setTab('basics');const first=primer.querySelector('.rq-basic');if(first){first.open=true;first.scrollIntoView({block:'nearest'})} }));
      if(['f','g'].includes(part.id))refs.append(btn('方法 p.9','Methods',()=>source(9)));
      details.append(refs);
      const dest=figure.panels.find(p=>p.id===target);
      chain.append(details);
      if(dest){
        const next=btn(target.toUpperCase()+' · '+nextZh,nextEn+' →',()=>{
          selectPanel(target);
          chain.scrollIntoView({block:'nearest'});
          chain.querySelector('summary')?.focus({preventScroll:true});
        });
        next.className='rq-next-panel';chain.append(next);
      }
    }
    function updateLong(){
      notes.classList.toggle('rq-condensed',!pathMenu.hidden&&!long);
      pair(toggleLong,long?'收起完整解读':'展开完整解读',long?'Close full reading':'Full reading');
      toggleLong.setAttribute('aria-expanded',String(long));
    }
    function apply(list){
      const selected=activeHit&&layer.contains(activeHit)&&!callout.hidden?{name:activeHit.getAttribute('aria-label'),left:activeHit.style.left,top:activeHit.style.top}:null;
      layer.replaceChildren();keyList.replaceChildren();menuList.replaceChildren();
      const ordered=[...list].sort((a,b)=>(a.priority??10)-(b.priority??10));
      const named=ordered.filter(s=>s.verified).slice(0,4);
      pathMenu.hidden=!named.length;long=true;updateLong();
      const explained=ordered.filter(s=>!s.entry.lookup);
      keys.hidden=!explained.length;
      pair(keySummary,'点读标注（'+explained.length+'）','Figure labels ('+explained.length+')');
      const ns='http://www.w3.org/2000/svg';
      const strokes=document.createElementNS(ns,'svg');strokes.classList.add('rq-strokes');
      strokes.setAttribute('viewBox','0 0 1000 1000');strokes.setAttribute('preserveAspectRatio','none');layer.append(strokes);
      for(const {entry,x,y,w,h,row,trace,values,color,verified} of ordered){
        const hintEn=entry[1];
        const b=trace?document.createElementNS(ns,'polyline'):el('button','rq-hit');
        if(trace){
          b.setAttribute('points',trace.map(pt=>pt.map(n=>(n*1000).toFixed(2)).join(',')).join(' '));
          b.setAttribute('role','button');b.setAttribute('tabindex','0');b.style.setProperty('--series-color',color);
          b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showTip(b,entry,row,trace[Math.floor(trace.length/2)])}});
          strokes.append(b);
        }else{
          b.type='button';
          if(entry.symbol)b.classList.add('rq-legend-symbol');
          if(entry.chartKey)b.classList.add('rq-legend-key');
          Object.assign(b.style,{left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%'});
          layer.append(b);
        }
        const titleZh=entry[0];
        const name=ReaderLanguage.choose(titleZh,hintEn);b.dataset.nameZh=titleZh;b.dataset.nameEn=hintEn;b.setAttribute('title',name);b.setAttribute('aria-label',name);b.setAttribute('aria-pressed','false');
        if(selected&&selected.name===name&&selected.left===b.style.left&&selected.top===b.style.top){activeHit=b;b.setAttribute('aria-pressed','true');requestAnimationFrame(drawWire)}
        b.onclick=e=>{
          e.stopPropagation();const rect=canvas.getBoundingClientRect();
          if(trace && values && FigureElements.reference(part?.raw.reading?.sources?.find(s=>s.kind==='小图图注')?.text)){
            const x=(e.clientX-rect.left)/rect.width;
            const i=trace.reduce((best,pt,j)=>Math.abs(pt[0]-x)<Math.abs(trace[best][0]-x)?j:best,0);
            const v=values[i],selected=entry.slice();
            const heightZh=v.y==null?'':'，距离相关性约为 '+v.y.toFixed(2),heightEn=v.y==null?'':', with distance correlation about '+v.y.toFixed(2);
            selected[2]='点选处最近的数据点对应 ρ ≈ '+v.x+heightZh+'。'+entry[2];
            selected[3]='The nearest plotted observation is at ρ ≈ '+v.x+heightEn+'. '+entry[3];
            showTip(b,selected,row,trace[i]);return;
          }
          showTip(b,entry,row,trace?[(e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height]:null);
        };
        const choose=()=>{keys.open=false;if(viewport.classList.contains('rq-magnified'))centerHit(b);showTip(b,entry,row,trace?.[Math.floor(trace.length/2)]);b.focus({preventScroll:true})};
        if(!entry.lookup)keyList.append(btn(titleZh,hintEn,choose));
        if(verified&&named.some(s=>s.entry===entry)){
          const jump=btn(entry[0],entry[1],choose);jump.className='rq-path';
          jump.onpointerenter=jump.onfocus=()=>b.classList.add('rq-preview');
          jump.onpointerleave=jump.onblur=()=>b.classList.remove('rq-preview');
          menuList.append(jump);
        }
      }
    }
    function insideImage(box){
      return box && box.width>.001 && box.height>.001 && box.x>=-.001 && box.y>=-.001 &&
        box.x+box.width<1.001 && box.y+box.height<1.001;
    }
    async function paintPDFCrop(page,box,current,capture){
      const result=await session.renderRegion(page,box,{quality:capture?'chart':'slide'});
      if(current!==epoch || result?.mode!=='crop')return false;
      const image=await createImageBitmap(result.blob);
      try{
        if(current!==epoch)return false;
        canvas.width=image.width;canvas.height=image.height;
        canvas.getContext('2d').drawImage(image,0,0);
        return result;
      }finally{image.close()}
    }
    async function render(f,p,ready,mode,src){
      const nextSelection=(f?.id||'')+'/'+(p?.id||'');
      if(nextSelection!==selectionTagKey){keys.open=false;tableRows=[];selectionTagKey=nextSelection;figure=f;part=p;selectionTag=[f?.label,p?.label,'PDF p.'+f?.page].filter(Boolean).join(' · ');
        conversation.clear();setTab('read');basics();showThread();}
      const figureRegion=p&&desk?.figurePanelRegion(f.raw,p.id),pageBox=p&&desk?.pageRegion();
      // The crop and its annotations use the original pixels, independently of display zoom.
      const r=mode==='page'?pageBox:figureRegion;
      const inPreview=insideImage(r);
      const on=Boolean(ready&&p&&src&&r&&(inPreview||insideImage(pageBox)));
      const next=on?JSON.stringify([nextSelection,r,src]):'';
      if(next===key)return;
      let from=null;
      if(on&&inPreview&&!visual.classList.contains('rq-focused')){
        const box=img.getBoundingClientRect();
        from={left:box.left+box.width*r.x,top:box.top+box.height*r.y,width:box.width*r.width,height:box.height*r.height};
        from.bottom=from.top+from.height;
      }
      stage.scrollTop=0;shared.replaceChildren();shared.hidden=true;key=next;const current=++epoch;closeTip();setZoom(false);viewer.hidden=!on;visual.classList.toggle('rq-focused',on);notes.classList.toggle('rq-has-focus',on);
      pointProgress.clear();
      if(!on){apply([]);return}
      pointProgress.begin();
      pair(label,f.label+' · '+PaperUI.panelLabel(p.label,'zh')+'　小图特写',f.label+' · '+PaperUI.panelLabel(p.label,'en')+'　Panel focus');pair(pageButton,'原文 p.'+f.page,'PDF p.'+f.page);
      tickNote.hidden=!p.raw.partialTicks;
      const marks=pageBox?session.chartMarks?.(f.page,pageBox,f.raw.matchKey)||[]:[];
      const capture=marks.some(m=>m.chart||m.trace);
      let fullResolution;
      if(inPreview){
        const W=img.naturalWidth,H=img.naturalHeight;
        canvas.width=Math.max(1,Math.round(W*r.width));canvas.height=Math.max(1,Math.round(H*r.height));
        canvas.getContext('2d').drawImage(img,r.x*W,r.y*H,r.width*W,r.height*H,0,0,canvas.width,canvas.height);
      }else{
        // A manual boundary may extend beyond the detected figure while remaining on the PDF page.
        apply([]);canvas.width=canvas.height=1;
        const painted=fullResolution=await paintPDFCrop(f.page,pageBox,current,capture).catch(()=>false);
        if(current!==epoch)return;
        if(!painted){pointProgress.clear();key='';viewer.hidden=true;visual.classList.remove('rq-focused');notes.classList.remove('rq-has-focus');return}
      }
      sheet.style.setProperty('--rq-ratio',canvas.width/canvas.height);stage.style.setProperty('--rq-original','url("'+src+'")');
      revealCrop(from);
      const checked=p.raw.checkedGuide&&f.raw.matchKey==='F:2';
      const bases=checked?ReadingPrimer.spots[p.id]||[]:[];
      const original=p.raw.region;
      const fixed=bases.map(s=>{
        const r=figureRegion;
        const x=(original.x+s.x*original.width-r.x)/r.width,y=(original.y+s.y*original.height-r.y)/r.height;
        const endX=Math.min(1,x+s.w*original.width/r.width),endY=Math.min(1,y+s.h*original.height/r.height);
        const order=['stain','sham','air','tissue'];const rank=order.indexOf(s.id);return {verified:true,priority:rank<0?10:rank,entry:s.id==='mouse'?(modelEntries()[0]||ReadingPrimer.entries.mouse):ReadingPrimer.entries[s.id],x:Math.max(0,x),y:Math.max(0,y),w:endX-Math.max(0,x),h:endY-Math.max(0,y)};
      }).filter(s=>s.w>.006&&s.h>.006);
      if(!fixed.length&&pageBox&&p.raw.markerBox){
        const marker=p.raw.markerBox,entrySource=p.raw.reading?.sources?.find(s=>s.kind==='小图图注'||s.kind.startsWith('组内共用图注'));
        const x=(marker.x-pageBox.x)/pageBox.width,y=(marker.y-pageBox.y)/pageBox.height;
        if(entrySource&&x>=0&&y>=0&&x<1&&y<1){
          const entry=[PaperUI.panelTitle(p.label,'zh'),PaperUI.panelTitle(p.label,'en'),entrySource.text,entrySource.text,entrySource.page];
          entry.localize=true;
          fixed.push({x,y,w:Math.min(1-x,marker.width/pageBox.width+.012),h:Math.min(1-y,marker.height/pageBox.height+.012),entry,priority:0});
        }
      }
      apply(fixed);
      if(fixed.length)pointProgress.update(fixed.length,false);
      if(inPreview&&pageBox)fullResolution=paintPDFCrop(f.page,pageBox,current,capture).catch(()=>false);
      if(!checked&&pageBox){
        try{
          let words=await session.chartText(f.page,pageBox);
          if(current!==epoch)return;
          const sources=[...(p.raw.reading?.sources||[]),...(f.raw.authorPassages||[]),{text:f.caption,page:f.raw.captionPage||f.page}];
          const quick=items=>{
            if(current!==epoch)return;
            const ready=[];
            for(const w of items.slice(0,90)){
              const entry=w.chart?CartesianPanels.explanation(w,f.page):FigureElements.explain(w,{caption:f.caption,reading:p.raw.reading,page:f.page,words:items,lookupTerm})||
                FigureElements.labelPassage(w.text,sources,findPassage,f.page);
              if(entry&&w.x1>w.x0&&w.y1>w.y0)ready.push({x:w.x0,y:w.y0,w:w.x1-w.x0,h:w.y1-w.y0,entry});
            }
            if(ready.length){apply([...fixed,...ready]);pointProgress.update(fixed.length+ready.length,false)}
          };
          quick(marks.filter(m=>m.chart).concat(words));
          if((f.raw.rasterPlate||words.filter(w=>/\p{L}{2}/u.test(w.text)).length<2)&&histograms&&current===epoch){
            const raster=await histograms.panelLabels(f.page,pageBox,()=>current===epoch,{onLabels:quick}).catch(()=>[]);
            words=words.concat(raster.filter(a=>!words.some(b=>a.text===b.text&&Math.abs(a.x0-b.x0)<.025&&Math.abs(a.y0-b.y0)<.025)));
          }
          if(current!==epoch)return;
          marks.unshift(...words.filter(w=>w.chart));
          words=words.filter(w=>!w.chart);
          const seen=new Set(),hits=[];
          // Join cells only inside a table with a verified units header and aligned rows.
          const table=words.some(w=>/clinical\s*isolates|\bisolates\b/i.test(w.text))&&words.some(w=>/\bMIC\b/.test(w.text));
          function rowFor(word){
            if(!table||word.rotate)return;
            const mid=(word.y0+word.y1)/2;
            const cells=words.filter(w=>!w.rotate&&Math.abs((w.y0+w.y1)/2-mid)<(word.y1-word.y0)*.46).sort((a,b)=>a.x0-b.x0);
            if(cells.length<3||!cells.some(c=>/[a-z]+[-–][a-z]*\d/i.test(c.text))||!cells.some(c=>/^(?:[>≥<≤]\s*)?\d/.test(c.text)))return;
            const headerEnd=words.filter(w=>/isolates|species|genes|MIC/i.test(w.text)&&w.text.length<45).reduce((edge,w)=>Math.max(edge,w.y1),0);
            const head=words.filter(w=>!w.rotate&&w.y0<headerEnd+.014&&w.y1<Math.min(...cells.map(c=>c.y0))&&w.text.length>1&&w.text.length<76).sort((a,b)=>a.x0-b.x0);
            return (head.length?'Headers: '+[...new Set(head.map(w=>w.text))].join(' | ')+'\n':'')+'Row: '+cells.map(c=>c.text).join(' | ');
          }
          words=FigureElements.labels(words,f.caption);
          if(capture){
            const painted=await fullResolution;
            if(current!==epoch)return;
            CartesianPanels.fitInk(marks,canvas,painted?.pixels);
            if(marks.some(m=>m.trace))CartesianPanels.fitInk(words,canvas,painted?.pixels,true);
          }
          if(!marks.some(m=>m.chart?.kind==='legend')){
            await fullResolution;
            if(current!==epoch)return;
            const keys=PrintedLegend.samples(words,canvas,p.raw.axis||'');
            marks.unshift(...keys);
          }
          const sharedKeys=session.chartLegend?.(f.page,f.raw.matchKey)||[];
          if(sharedKeys.length && marks.some(m=>m.trace)){
            shared.hidden=false;
            const heading=pair(el('small'),'共用图例','Shared legend');shared.append(heading);
            for(const item of sharedKeys){
              const entry=FigureElements.explain({text:item.name},{caption:f.caption,reading:p.raw.reading,page:f.page,captionPage:f.raw.captionPage,series:true,estimate:marks.find(m=>m.peak&&m.text===item.name)?.estimate,axis:p.raw.axis});
              const b=btn(item.name,item.name,()=>showTip(b,entry));b.setAttribute('aria-pressed','false');b.className='rq-series-key';
              b.style.setProperty('--series-color',item.color);if(item.dash.length)b.classList.add('rq-dashed');
              shared.append(b);
            }
          }
          const items=marks.concat(words.filter(t=>!marks.some(m=>m.chart && m.chart.kind!=='symbol' && m.text.includes(t.text.trim()) &&
            Math.abs((m.y0+m.y1-t.y0-t.y1)/2)<Math.max(.004,t.y1-t.y0)*.55 && t.x0>=m.x0-.012 && t.x1<=m.x1+.012) && !marks.some(m=>!m.peak&&!m.trace&&m.text===t.text&&Math.abs(m.y0-t.y0)<.022&&t.x0>=m.x0-.006&&t.x1<=m.x1+.006)));
          for(const word of items){
            const t=word.text.trim();if((!word.chart&&!/[\p{L}]{2}|\d+\s*h\b|[µμ]m/u.test(t)&&!/^p\s*[=<>≤≥]\s*0?\.\d+$/i.test(t)&&!(table&&/^[>≥<≤]?\s*\d/.test(t)))||t.length>82||hits.length>=90)continue;
            const id=[t,word.chart?.kind,word.peak?1:word.trace?2:0,word.x0.toFixed(2),word.y0.toFixed(2)].join('|');if(seen.has(id))continue;seen.add(id);
            const x=Math.max(0,word.x0),y=Math.max(0,word.y0),w=Math.min(1,word.x1)-x,h=Math.min(1,word.y1)-y;
            if(w<=0||h<=0)continue;
            const g=p.raw.reading,row=rowFor(word);
            const strainLabel=ModelReading.strains(t).length || f.raw.animalCohorts?.some(c=>c.name.toLowerCase()===t.toLowerCase());
            const model=strainLabel?modelEntries(t)[0]:null;
            let entry=(word.chart&&CartesianPanels.explanation(word,f.page))||model||FigureElements.explain(word,{caption:f.caption,reading:g,page:f.page,captionPage:f.raw.captionPage,words,row,lookupTerm,series:word.series,peak:word.peak,estimate:word.estimate||marks.find(m=>m.peak&&m.text===t)?.estimate,axis:g?.axis||p.raw.axis})||
              (f.raw.rasterPlate && CompositePlate.labelGuide(t,g?.sources,f.page));
            if(!entry){
              if(word.series||!/[\p{L}]{2}/u.test(t))continue;
              entry=FigureElements.labelPassage(t,sources,findPassage,f.page);
              if(!entry&&f.raw.review&&f.raw.rasterPlate)continue;
              if(!entry){entry=FigureElements.unresolved(t,f.page)}
            }
            if(word.trace && word.series){
              entry[0]=entry[0].replace(/^图例 · /,'曲线 · ');entry[1]=entry[1].replace(/^Legend · /,'Curve · ');
            }
            if(word.chart?.kind==='symbol')entry.symbol=true;
            if(word.chart?.kind==='symbol'||word.chart?.kind==='legend')entry.chartKey=true;
            hits.push({x,y,w,h,entry,trace:word.trace,values:word.values,color:word.color,verified:!entry.localize&&!entry.lookup,priority:model?1:word.trace?15:word.peak?5:10,row});
          }
          tableRows=hits.filter(h=>h.row);apply([...fixed,...hits]);
        }catch{/* Previously recognised labels remain usable. */}
      }
      if(current===epoch)pointProgress.update(layer.querySelectorAll('button.rq-hit,polyline[role=button]').length,true);
    }
    let selectionTagKey='';
    function dismissLayer(){
      if(!callout.hidden){const hit=activeHit;closeTip();hit?.focus({preventScroll:true});return}
      if(viewport.classList.contains('rq-magnified')){setZoom(false);zoomButton.focus({preventScroll:true});return}
      goFull();
    }
    stage.addEventListener('click',e=>{
      if(e.target.closest('button,[role=button],.rq-callout'))return;
      if(sheet.contains(e.target)&&pointProgress.capture(e,layer))return;
      dismissLayer();
    });
    const escape=e=>{if(e.key==='Escape'&&!desk.isDrawing()&&!viewer.hidden&&!visual.classList.contains('source-shown')&&!document.querySelector('dialog[open]')&&!e.target.closest('textarea,input')&&!document.querySelector('.local-translation:not([hidden])')){if(e.defaultPrevented)return;e.preventDefault();dismissLayer()}};
    const refreshHitNames=()=>{
      nameStage();
      for(const b of layer.querySelectorAll('[data-name-zh]')){
        const name=ReaderLanguage.choose(b.dataset.nameZh,b.dataset.nameEn);b.setAttribute('title',name);b.setAttribute('aria-label',name);
      }
    };
    document.addEventListener('reader-language-change',refreshHitNames);
    document.addEventListener('keydown',escape);
    return {render,destroy(){EnglishPractice.close();document.removeEventListener('reader-practice-context',enrichPractice);document.removeEventListener('reader-language-change',refreshHitNames);epoch++;conversation.clear();observer.disconnect();document.removeEventListener('reader-ask-selection',selected);document.removeEventListener('keydown',escape)}};
  }
  window.ReadingQuestions={mount};
})();
