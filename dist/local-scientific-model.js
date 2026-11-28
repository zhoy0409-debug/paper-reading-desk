import {digestHex,stageError,verifiedWeights,openWeightStore,clearWeightStore,runtimeStorage} from './translation-weight-cache.js';

const assets=new URL('./vendor/local-mt/',import.meta.url);
const manifestDigest='74c5edbe446acf74680b9daead5ec7213a23e18d0db2c24e5be08ef709f72f20';
const preference='reading-desk.selection-engine.bae6e591';
const receipt=preference+'.saved';
let memoryMode,entry,serial=Promise.resolve(),idle,downloadConfirmed=false;
const memo=new Map();
export function selectionMode(){
  try{return localStorage.getItem(preference)||memoryMode||'choose'}catch{return memoryMode||'choose'}
}
export function setSelectionMode(mode){
  if(!['choose','quick','local'].includes(mode))throw new TypeError('Unknown selection translation mode');
  memoryMode=mode;
  downloadConfirmed=mode==='local';
  try{localStorage.setItem(preference,mode)}catch{/* The choice still applies to this tab. */}
}
function progress(detail){document.dispatchEvent(new CustomEvent('local-scientific-progress',{detail}))}
async function openModel(signal){
  if(!globalThis.isSecureContext||(!globalThis.caches&&!globalThis.indexedDB)||!globalThis.crypto?.subtle)
    throw stageError('storage','A secure context with persistent model storage is required');
  let manifest,cache;
  try{
    const response=await fetch(new URL('hy-mt3-q4.json',assets),{signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const raw=await response.arrayBuffer();
    if(await digestHex(raw)!==manifestDigest)throw stageError('integrity','Incorrect translation manifest SHA-256');
    manifest=JSON.parse(new TextDecoder().decode(raw));
  }catch(cause){throw cause.stage||signal.aborted?cause:stageError('download','Could not read the translation manifest',cause)}
  try{cache=await openWeightStore()}catch(cause){throw stageError('storage','Model storage is unavailable',cause)}
  let weights;
  try{
    weights=await verifiedWeights(manifest,{cache,signal,onProgress:progress,onMissing(bytes){
      let previouslySaved=false;
      try{previouslySaved=localStorage.getItem(receipt)==='1'}catch{/* Session-only preference. */}
      if(!bytes&&previouslySaved&&!downloadConfirmed){
        setSelectionMode('choose');
        throw stageError('consent','The browser cleared this model. Confirm before downloading it again.');
      }
    }});
    downloadConfirmed=false;
    try{localStorage.setItem(receipt,'1')}catch{/* Storage may be session-only. */}
  }catch(error){cache.close?.();throw error}
  let runtime;
  try{
    signal.throwIfAborted();progress({phase:'worker',bytes:manifest.bytes,total:manifest.bytes});
    const {Wllama,CacheManager}=await import('./vendor/local-mt/wllama-4.0.0.js');
    const wasm=new URL('wllama-4.0.0.wasm',assets).href;
    const gpu=await navigator.gpu?.requestAdapter().catch(()=>null);
    const useGPU=!!gpu&&!gpu.info?.isFallbackAdapter;
    const start=async useGPU=>{
      runtime=new Wllama({default:wasm},{cacheManager:new CacheManager([runtimeStorage(cache)])});
      runtime.setCompat({wasm:new URL('wllama-4.0.0-compat.wasm',assets).href});
      await runtime.loadModel([weights],{n_ctx:4096,n_batch:256,n_threads:4,n_gpu_layers:useGPU?999:0,
        n_parallel:1,warmup:false,reasoning:false,rpc_workers:0});
    };
    try{await start(useGPU)}catch(cause){
      if(!useGPU||signal.aborted)throw cause;
      console.warn('Local translation GPU initialization failed; trying CPU.',cause);
      await runtime.exit().catch(()=>{});await start(false);
    }
    signal.throwIfAborted();return {runtime,cache};
  }catch(cause){
    if(runtime)await runtime.exit().catch(()=>{});
    cache.close?.();
    throw signal.aborted?signal.reason:stageError('worker','Local translation runtime could not initialize',cause);
  }
}
function releaseEngine(){
  clearTimeout(idle);
  const old=entry;entry=null;
  if(!old)return Promise.resolve();
  old.controller.abort();
  return old.promise.then(async({runtime,cache})=>{try{await runtime.exit()}finally{cache.close?.()}},()=>{});
}
export async function clearScientificWeights(){
  await releaseEngine();memo.clear();
  await clearWeightStore();
  try{localStorage.removeItem(receipt)}catch{/* No persistent receipt. */}
}
async function modelFor(signal){
  clearTimeout(idle);signal.throwIfAborted();
  if(!entry){
    const controller=new AbortController();
    const current={controller,readers:0,ready:false};
    current.promise=openModel(controller.signal).then(r=>{current.ready=true;return r},error=>{
      if(entry===current)entry=null;throw error;
    });
    entry=current;
  }
  const current=entry;current.readers++;
  let rejectAbort;
  const aborted=new Promise((_,reject)=>{rejectAbort=reject});
  function onAbort(){
    if(!current.ready&&current.readers===1&&entry===current)void releaseEngine();
    rejectAbort(signal.reason);
  }
  signal.addEventListener('abort',onAbort,{once:true});
  try{return await Promise.race([current.promise,aborted])}
  finally{signal.removeEventListener('abort',onAbort);current.readers--}
}

function translationPrompt(source,from,context,terms,correction){
  const lang=from==='zh'?'英语':'简体中文';
  const directions= '将以下文本翻译为'+lang+'，注意只需要输出翻译后的结果，不要额外解释：';
  const glossary=terms.map(t=>t.original+' = '+t.value).join('\n');
  // A long paragraph must not displace a paper-defined term or a requested correction.
  const evidence=[correction,glossary,context].filter(Boolean).join('\n').slice(0,1400);
  return evidence?'【背景信息】\n'+evidence+'\n\n请结合背景信息将以下文本翻译为'+lang+'。\n\n【待翻译文本】\n'+source:directions+'\n\n'+source;
}
export async function scientificText(source,from,{context='',terms=[],signal,correction=''}){
  if(selectionMode()!=='local')throw stageError('model','Model download requires the reader’s confirmation');
  const prompt=translationPrompt(source,from,context,terms,correction);
  const key=JSON.stringify([from,prompt]);
  signal.throwIfAborted();
  if(memo.has(key))return memo.get(key);
  const {runtime}=await modelFor(signal);
  async function generate(){
    signal.throwIfAborted();if(memo.has(key))return memo.get(key);
    clearTimeout(idle);
    const timeout=AbortSignal.timeout(150000);
    const stop=AbortSignal.any([signal,timeout]);
    try{
      const response=await runtime.createChatCompletion({messages:[{role:'user',content:prompt}],temperature:0,seed:42,
        max_tokens:Math.min(2500,Math.max(110,Math.ceil(source.length*1.6))),stream:false,abortSignal:stop});
      stop.throwIfAborted();
      const answer=response.choices?.[0],text=answer?.message?.content?.trim();
      if(!text)throw stageError('empty','Local model returned no translation');
      if(answer.finish_reason!=='stop')throw stageError('validation','Model output ended before completion');
      memo.set(key,text);if(memo.size>128)memo.delete(memo.keys().next().value);
      return text;
    }catch(cause){
      if(signal.aborted)throw signal.reason;
      if(timeout.aborted)throw stageError('timeout','Local scientific translation timed out',cause);
      if(!cause.stage)void releaseEngine().catch(e=>console.warn('Local translation worker cleanup',e));
      throw cause;
    }finally{
      clearTimeout(idle);idle=setTimeout(()=>{void releaseEngine().catch(e=>console.warn('Local translation worker cleanup',e))},300000);
    }
  }
  const result=serial.then(generate);serial=result.catch(()=>{});return result;
}
