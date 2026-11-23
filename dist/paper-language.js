/* Localize a reader-facing excerpt. Verbatim sources stay in the source pane. */
(() => {
  'use strict';
  const base=new URL('.',document.currentScript.src);
  let engine;
  const cache=new Map(),bindings=new WeakMap();
  async function translate(text,from) {
    if(!engine){
      engine=import(new URL('vendor/bergamot/translator.js',base)).then(({BatchTranslator})=>
        new BatchTranslator({registryUrl:new URL('vendor/bergamot/models.json',base).href,workers:1,cacheSize:0,useNativeIntGemm:false}));
      engine.catch(()=>{engine=null});
    }
    const translator=await engine;
    return (await translator.translate({from,to:from==='en'?'zh':'en',text,html:false})).target.text;
  }
  function chinese(source) {
    if(!cache.has(source)){
      const job=import(new URL('scientific-translation.js?rev=import-021',base)).then(async({translatePassage})=>{
        const result=await translatePassage(source,'en',translate);
        return result.text;
      });
      cache.set(source,job);
      job.catch(()=>cache.delete(source));
      if(cache.size>256)cache.delete(cache.keys().next().value);
    }
    return cache.get(source);
  }
  function refresh(el) {
    const binding=bindings.get(el);
    if(!binding)return;
    const {source}=binding;
    if(ReaderLanguage.current==='en'||!source.match(/[A-Za-z]{3}/)||/[\u3400-\u9fff]/u.test(source)){
      el.textContent=source;el.removeAttribute('aria-busy');return;
    }
    el.setAttribute('aria-busy','true');
    chinese(source).then(value=>{
      if(bindings.get(el)===binding&&ReaderLanguage.current==='zh'&&el.isConnected){
        el.textContent=value;el.lang=/[\u3400-\u9fff]/u.test(value)?'zh-CN':'en';
      }
    }).catch(()=>{}).finally(()=>{if(bindings.get(el)===binding)el.removeAttribute('aria-busy')});
  }
  function bind(el,source) {
    if(!el||!source)return el;
    el.textContent=source;delete el.dataset.sourceText;
    bindings.set(el,{source});el.dataset.paperTranslation='';
    if(ReaderLanguage.current==='zh')queueMicrotask(()=>{if(el.isConnected)refresh(el)});
    return el;
  }
  function clear(el){bindings.delete(el);delete el.dataset.paperTranslation;el.removeAttribute('aria-busy')}
  document.addEventListener('reader-language-change',()=>document.querySelectorAll('[data-paper-translation]').forEach(el=>{
    if(ReaderLanguage.current==='en')el.lang='en';
    refresh(el);
  }));
  addEventListener('pagehide',e=>{if(!e.persisted){engine?.then(v=>v.delete()).catch(()=>{});engine=null;cache.clear()}});
  window.PaperLanguageText={bind,clear,translate};
})();
