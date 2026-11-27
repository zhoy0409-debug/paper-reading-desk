/* Localize a reader-facing excerpt. Verbatim sources stay in the source pane. */
(() => {
  'use strict';
  const base=new URL('.',document.currentScript.src);
  let engine,labelStartup,idleTimer,outstanding=0,field='auto';
  function loadModule(file){
    let pending,attempt=0;
    return ()=>{
      if(!pending){
        const url=new URL(file,base);
        if(attempt)url.searchParams.set('retry',attempt);
        pending=import(url).catch(cause=>{
          pending=null;attempt++;
          throw Object.assign(new Error('Could not load '+url.pathname,{cause}),{stage:'download'});
        });
      }
      return pending;
    };
  }
  const glossary=loadModule('discipline-glossary.js?rev=quality1');
  const science=loadModule('scientific-translation.js?rev=quality1');
  const session=loadModule('translation-session.js?rev=quality1');
  const runtime=loadModule('vendor/bergamot/translator.js?rev=quality1');
  let runtimeCache;
  function enableRuntimeCache(){
    if(!runtimeCache&&navigator.serviceWorker&&window.isSecureContext)
      runtimeCache=navigator.serviceWorker.register(new URL('translation-runtime-cache.js',base),{scope:base.href,updateViaCache:'none'}).catch(()=>null);
  }
  async function clearModelCache(){
    const lib=await runtime();await lib.clearModelCache();
    if(globalThis.caches)await caches.delete('reading-desk-translation-runtime-v1');
  }
  const logged=new WeakSet();
  function report(error,context){
    if(error instanceof Error){
      if(logged.has(error))return;
      logged.add(error);
    }
    console.error('[Reading Desk · '+context+' · '+(error?.stage||'translate')+']',error);
  }
  // Give the first interactive image a head start on the much larger translation model.
  function prioritizeLabels(ready){
    if(engine||labelStartup)return;
    let timer;
    const deadline=new Promise(resolve=>{timer=setTimeout(resolve,12000)});
    labelStartup=Promise.race([ready.catch(()=>{}),deadline]).finally(()=>{clearTimeout(timer);labelStartup=null});
  }
  const cache=new Map(),ready=new Map(),bindings=new WeakMap();
  const retryMessages=new Map();
  function downloadProgress(url,bytes,finished){
    document.dispatchEvent(new CustomEvent('translation-download',{detail:{url,bytes,finished}}));
    if(!retryMessages.size||!url.includes('model.enzh.'))return;
    const mb=Math.floor(bytes/1048576);
    const text=finished?'正在翻译此处…':mb?'正在下载中文翻译模型 · 已接收 '+mb+' MiB':'正在下载中文翻译模型…';
    for(const message of retryMessages.values())if(message.textContent!==text)message.textContent=text;
  }
  async function translate(text,from,priority=0) {
    if(!engine&&labelStartup&&priority>=0)await labelStartup;
    if(!engine){
      enableRuntimeCache();
      engine=runtime().then(async({BatchTranslator})=>{
        const model=new BatchTranslator({registryUrl:new URL('vendor/bergamot/models.json',base).href,workers:1,batchSize:4,downloadTimeout:150000,cacheSize:0,useNativeIntGemm:false});
        model.backing.onprogress=downloadProgress;
        await model.backing.registry;
        return model;
      });
      const active=engine;active.catch(()=>{if(engine===active)engine=null});
    }
    clearTimeout(idleTimer);outstanding++;
    const current=engine;
    try{
      const translator=await current;
      const response=await translator.translate({from,to:from==='en'?'zh':'en',text,html:false,priority});
      if(typeof response?.target?.text!=='string'||!response.target.text.trim())
        throw Object.assign(new Error('Bergamot returned no translation'),{stage:'empty'});
      return response.target.text;
    }finally{
      outstanding--;
      if(!outstanding&&engine===current)idleTimer=setTimeout(()=>{
        if(outstanding||engine!==current)return;
        engine=null;current.then(model=>model.delete()).catch(e=>report(e,'worker cleanup'));
      },300000);
    }
  }
  // Translate the prose in one piece. Restore each protected span only if its
  // placeholder survives exactly once. Some models lose inline HTML alignment.
  async function withTerms(parts,priority=0){
    const source=parts.map(p=>typeof p==='string'?p:p.original).join('');
    const terms=[];let start=731401;
    while(source.includes(String(start).slice(0,4)))start+=10000;
    const masked=parts.map(p=>{
      if(typeof p==='string')return p;
      const id=String(start+terms.length);terms.push([id,p.value]);return ' '+id+' ';
    }).join('');
    if(!terms.length)return null;
    let result=await translate(masked,'en',priority);
    if(parts.some(p=>typeof p==='string'&&/[a-z]{2}/i.test(p))&&!han.test(result))return null;
    for(const [id,value] of terms){
      const pattern=new RegExp('(?<!\\d)'+id+'(?!\\d)','g');
      if((result.match(pattern)||[]).length!==1)return null;
      result=result.replace(pattern,()=>value);
    }
    return result;
  }
  translate.withTerms=withTerms;
  const urgent=Object.assign((text,from,priority=-1)=>translate(text,from,priority),{withTerms:(parts,priority=-1)=>withTerms(parts,priority)});
  const keyFor=(source,profile=field)=>(profile.key??profile)+'\n'+source;
  function chinese(source,retry=false,profile=field) {
    const key=keyFor(source,profile);
    if(ready.has(key))return Promise.resolve(ready.get(key));
    if(retry||!cache.has(key)){
      const translator=retry?urgent:translate;
      const job=science().then(async({mapChinese,sentences})=>{
        if(!han.test(source)){
          const segments=sentences(source);
          if(segments.length===1)return mapChinese(source,translator,{field:profile});
          const text=[];let firstFailure,completed=0;
          for(const [i,segment] of segments.entries()){
            try{text.push(await chinese(segment,retry,profile));completed++}
            catch(error){firstFailure??=error;text.push('〔第 '+(i+1)+' 句待重试〕')}
          }
          if(firstFailure)throw Object.assign(new Error('Map passage is incomplete',{cause:firstFailure}),{
            stage:firstFailure.stage,partial:completed?text.join(' '):'',source
          });
          return text.join(' ');
        }
        const parts=source.split(/([\u3400-\u9fff]+)/u);
        return (await Promise.all(parts.map(part=>englishPassage.test(part)?mapChinese(part,translator,{field:profile}):part))).join('');
      }).then(value=>value.replace(/(?:近邻|邻居)\s*嵌入/g,'邻域嵌入').replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/gu,'$1'));
      cache.set(key,job);
      job.then(value=>{
        if(cache.get(key)!==job)return;
        ready.set(key,value);if(ready.size>256)ready.delete(ready.keys().next().value);
      },()=>{});
      job.catch(()=>{if(cache.get(key)===job)cache.delete(key)});
      if(cache.size>256)cache.delete(cache.keys().next().value);
      return job;
    }
    return cache.get(key);
  }
  const han=/[\u3400-\u9fff]/u;
  const englishPassage=/\b[A-Za-z][\w-]*(?:\s+[A-Za-z][\w-]*){2,}/;
  function needsText(text){return han.test(text)?englishPassage.test(text):/[A-Za-z]/.test(text)}
  function identifier(text){
    if(/^(?:Fig(?:ure)?\.?|Tab(?:le)?\.?)\s*S?\d+[a-z]?$/i.test(text))return text.replace(/^(?:Fig(?:ure)?\.?)/i,'图').replace(/^Tab(?:le)?\.?/i,'表');
    if(/^(?:[A-Z]{1,8}[A-Z\d_./-]*|[a-zA-Z]\d[\w./-]*)$/.test(text))return '标记 '+text;
    return '';
  }
  function retryControl(el,binding,state){
    el.dataset.translationRetry=state;
    if(el.matches('option')||binding.button?.isConnected)return;
    const b=document.createElement('button');b.type='button';b.className='paper-translation-retry';
    b.textContent='重试此处';b.setAttribute('aria-label','重试此处的中文解读');
    b.title='只重新翻译这一段';b.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();retry(el);
    });
    const interactive=el.closest('button,a,summary,label');
    if(interactive)interactive.after(b);else el.append(b);
    binding.button=b;
  }
  function refresh(el,again=false) {
    const binding=bindings.get(el);
    if(!binding)return;
    if(binding.partialTitle&&el.title===binding.source){el.removeAttribute('title');binding.partialTitle=false}
    const {source}=binding;
    clearTimeout(binding.timer);
    retryMessages.delete(el);
    if(binding.button&&document.activeElement===binding.button){el.tabIndex=-1;el.focus({preventScroll:true})}
    binding.button?.remove();binding.button=null;
    delete el.dataset.translationRetry;delete el.dataset.sourcePending;
    const revision=binding.revision=(binding.revision||0)+1;
    const current=()=>bindings.get(el)===binding&&binding.revision===revision;
    if(ReaderLanguage.current==='en'||!needsText(source)||identifier(source)){
      el.textContent=ReaderLanguage.current==='zh'?(identifier(source)||source):source;el.lang=ReaderLanguage.current==='zh'?'zh-CN':'en';el.removeAttribute('aria-busy');return;
    }
    if(ready.has(keyFor(source))){el.textContent=ready.get(keyFor(source));el.lang='zh-CN';el.removeAttribute('aria-busy');return;}
    el.lang=binding.showSource?'en':'zh-CN';el.textContent=binding.showSource?source:again?'正在重试…':'正在生成中文…';el.setAttribute('aria-busy','true');
    if(again&&!binding.showSource&&!el.matches('option')){
      const message=document.createElement('span');message.textContent='正在重试…';
      el.replaceChildren(message);retryMessages.set(el,message);
    }
    if(binding.showSource)el.dataset.sourcePending='原文 · 正在译为中文';
    binding.timer=setTimeout(()=>{if(current()&&el.isConnected)retryControl(el,binding,'slow')},45000);
    chinese(source,again).then(value=>{
      if(current()&&ReaderLanguage.current==='zh'&&el.isConnected){
        binding.button?.remove();binding.button=null;
        delete el.dataset.translationRetry;delete el.dataset.sourcePending;
        el.textContent=value;el.lang=/[\u3400-\u9fff]/u.test(value)?'zh-CN':'en';
      }
    }).catch(error=>{if(current()&&el.isConnected&&ReaderLanguage.current==='zh'){
      report(error,'paper');
      binding.button?.remove();binding.button=null;
      el.textContent=error.partial||(binding.showSource||el.matches('option')?source:'');
      if(error.partial&&!el.title){el.title=source;binding.partialTitle=true}
      retryControl(el,binding,'error');
      if(binding.showSource)el.dataset.sourcePending='原文 · 中文待重试';
    }}).finally(()=>{
      if(current()){clearTimeout(binding.timer);retryMessages.delete(el);el.removeAttribute('aria-busy')}
    });
  }
  function bind(el,source,{showSource=false}={}) {
    if(!el||!source)return el;
    clear(el);el.textContent=ReaderLanguage.current==='zh'&&needsText(source)?identifier(source)||ready.get(keyFor(source))||(showSource?source:'正在生成中文…'):source;delete el.dataset.sourceText;
    bindings.set(el,{source,showSource});el.dataset.paperTranslation='';
    queueMicrotask(()=>{if(el.isConnected&&bindings.get(el)?.source===source)refresh(el)});
    return el;
  }
  function clear(el){
    const binding=bindings.get(el);clearTimeout(binding?.timer);binding?.button?.remove();bindings.delete(el);
    if(binding?.partialTitle&&el.title===binding.source)el.removeAttribute('title');
    retryMessages.delete(el);
    delete el.dataset.translationRetry;delete el.dataset.paperTranslation;delete el.dataset.sourcePending;el.removeAttribute('aria-busy');
  }
  function retry(target){
    if(target){if(bindings.has(target)&&target.hasAttribute('data-translation-retry'))refresh(target,true);return}
    document.querySelectorAll('[data-translation-retry]').forEach(el=>retry(el));
  }
  function setField(next){
    if((field.key??field)===(next.key??next))return;
    field=next;document.querySelectorAll('[data-paper-translation]').forEach(el=>refresh(el));
    document.dispatchEvent(new Event('paper-field-change'));
  }
  document.addEventListener('reader-language-change',()=>document.querySelectorAll('[data-paper-translation]').forEach(el=>{
    if(ReaderLanguage.current==='en')el.lang='en';
    refresh(el);
  }));
  // A discarded document releases its dedicated translation worker. Starting
  // another asynchronous teardown in pagehide can interrupt an active batch.
  window.PaperLanguageText={bind,clear,translate:urgent,report,chinese,retry,prioritizeLabels,glossary,science,session,clearModelCache,setField,get field(){return field}};
})();
