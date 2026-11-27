/* Localize a reader-facing excerpt. Verbatim sources stay in the source pane. */
(() => {
  'use strict';
  const base=new URL('.',document.currentScript.src);
  let engine,labelStartup;
  // Give the first interactive image a head start on the much larger translation model.
  function prioritizeLabels(ready){
    if(engine||labelStartup)return;
    let timer;
    const deadline=new Promise(resolve=>{timer=setTimeout(resolve,12000)});
    labelStartup=Promise.race([ready.catch(()=>{}),deadline]).finally(()=>{clearTimeout(timer);labelStartup=null});
  }
  const cache=new Map(),ready=new Map(),bindings=new WeakMap();
  async function translate(text,from) {
    if(!engine&&labelStartup)await labelStartup;
    if(!engine){
      engine=import(new URL('vendor/bergamot/translator.js',base)).then(({BatchTranslator})=>
        new BatchTranslator({registryUrl:new URL('vendor/bergamot/models.json',base).href,workers:1,downloadTimeout:150000,cacheSize:0,useNativeIntGemm:false}));
      const active=engine;active.catch(()=>{if(engine===active)engine=null});
    }
    const translator=await engine;
    return (await translator.translate({from,to:from==='en'?'zh':'en',text,html:false})).target.text;
  }
  // Translate the prose in one piece. Restore each protected span only if its
  // placeholder survives exactly once. Some models lose inline HTML alignment.
  translate.withTerms=async(parts)=>{
    const source=parts.map(p=>typeof p==='string'?p:p.original).join('');
    const terms=[];let start=731401;
    while(source.includes(String(start).slice(0,4)))start+=10000;
    const masked=parts.map(p=>{
      if(typeof p==='string')return p;
      const id=String(start+terms.length);terms.push([id,p.value]);return ' '+id+' ';
    }).join('');
    if(!terms.length)return null;
    let result=await translate(masked,'en');
    for(const [id,value] of terms){
      const pattern=new RegExp('(?<!\\d)'+id+'(?!\\d)','g');
      if((result.match(pattern)||[]).length!==1)return null;
      result=result.replace(pattern,()=>value);
    }
    return result;
  };
  function chinese(source) {
    if(!cache.has(source)){
      const job=import(new URL('scientific-translation.js?rev=reader-0415g',base)).then(async({mapChinese})=>{
        if(!han.test(source))return mapChinese(source,translate);
        const parts=source.split(/([\u3400-\u9fff]+)/u);
        return (await Promise.all(parts.map(part=>englishPassage.test(part)?mapChinese(part,translate):part))).join('');
      }).then(value=>value.replace(/(?:近邻|邻居)\s*嵌入/g,'邻域嵌入').replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/gu,'$1'));
      cache.set(source,job);
      job.then(value=>{
        ready.set(source,value);if(ready.size>256)ready.delete(ready.keys().next().value);
      },()=>{});
      job.catch(()=>{if(cache.get(source)===job)cache.delete(source)});
      if(cache.size>256)cache.delete(cache.keys().next().value);
    }
    return cache.get(source);
  }
  const han=/[\u3400-\u9fff]/u;
  const englishPassage=/\b[A-Za-z][\w-]*(?:\s+[A-Za-z][\w-]*){2,}/;
  function needsText(text){return han.test(text)?englishPassage.test(text):/[A-Za-z]/.test(text)}
  function identifier(text){
    if(/^(?:Fig(?:ure)?\.?|Tab(?:le)?\.?)\s*S?\d+[a-z]?$/i.test(text))return text.replace(/^(?:Fig(?:ure)?\.?)/i,'图').replace(/^Tab(?:le)?\.?/i,'表');
    if(/^(?:[A-Z]{1,8}[A-Z\d_./-]*|[a-zA-Z]\d[\w./-]*)$/.test(text))return '标记 '+text;
    return '';
  }
  function refresh(el) {
    const binding=bindings.get(el);
    if(!binding)return;
    const {source}=binding;
    clearTimeout(binding.timer);
    delete el.dataset.translationRetry;delete el.dataset.sourcePending;
    const revision=binding.revision=(binding.revision||0)+1;
    const current=()=>bindings.get(el)===binding&&binding.revision===revision;
    if(ReaderLanguage.current==='en'||!needsText(source)||identifier(source)){
      el.textContent=ReaderLanguage.current==='zh'?(identifier(source)||source):source;el.lang=ReaderLanguage.current==='zh'?'zh-CN':'en';el.removeAttribute('aria-busy');return;
    }
    if(ready.has(source)){el.textContent=ready.get(source);el.lang='zh-CN';el.removeAttribute('aria-busy');return;}
    el.lang=binding.showSource?'en':'zh-CN';el.textContent=binding.showSource?source:'正在生成中文…';el.setAttribute('aria-busy','true');
    if(binding.showSource)el.dataset.sourcePending='原文 · 正在译为中文';
    binding.timer=setTimeout(()=>{if(current()&&el.isConnected)el.dataset.translationRetry='slow'},45000);
    chinese(source).then(value=>{
      if(current()&&ReaderLanguage.current==='zh'&&el.isConnected){
        delete el.dataset.translationRetry;delete el.dataset.sourcePending;
        el.textContent=value;el.lang=/[\u3400-\u9fff]/u.test(value)?'zh-CN':'en';
      }
    }).catch(()=>{if(current()&&ReaderLanguage.current==='zh'){
      el.textContent=binding.showSource?source:'中文解读待重试';el.dataset.translationRetry='error';
      if(binding.showSource)el.dataset.sourcePending='原文 · 中文待重试';
    }}).finally(()=>{
      if(current()){clearTimeout(binding.timer);el.removeAttribute('aria-busy')}
    });
  }
  function bind(el,source,{showSource=false}={}) {
    if(!el||!source)return el;
    clear(el);el.textContent=ReaderLanguage.current==='zh'&&needsText(source)?identifier(source)||ready.get(source)||(showSource?source:'正在生成中文…'):source;delete el.dataset.sourceText;
    bindings.set(el,{source,showSource});el.dataset.paperTranslation='';
    queueMicrotask(()=>{if(el.isConnected&&bindings.get(el)?.source===source)refresh(el)});
    return el;
  }
  function clear(el){
    clearTimeout(bindings.get(el)?.timer);bindings.delete(el);
    delete el.dataset.translationRetry;delete el.dataset.paperTranslation;delete el.dataset.sourcePending;el.removeAttribute('aria-busy');
  }
  function retry(){
    const pending=[...document.querySelectorAll('[data-paper-translation]')].filter(el=>el.hasAttribute('aria-busy')||el.hasAttribute('data-translation-retry'));
    if(!pending.length)return;
    const old=engine;engine=null;
    for(const el of pending)cache.delete(bindings.get(el)?.source);
    for(const el of pending)refresh(el);
    old?.then(v=>v.delete()).catch(()=>{});
  }
  addEventListener('online',()=>{if(document.querySelector('[data-translation-retry]'))retry()});
  document.addEventListener('reader-language-change',()=>document.querySelectorAll('[data-paper-translation]').forEach(el=>{
    if(ReaderLanguage.current==='en')el.lang='en';
    refresh(el);
  }));
  // A discarded document releases its dedicated translation worker. Starting
  // another asynchronous teardown in pagehide can interrupt an active batch.
  window.PaperLanguageText={bind,clear,translate,chinese,retry,prioritizeLabels};
})();
