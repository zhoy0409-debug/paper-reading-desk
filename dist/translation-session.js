import {normalizeSelection,selectionTranslation,translatePassage} from './scientific-translation.js?rev=pdfwords';
import {fieldTerms,resolveField} from './discipline-glossary.js?rev=evidence2';
import {validateScientific} from './translation-facts.js?rev=evidence2';
import {needsAlignment,checkAlignment} from './translation-alignment.js';

// The source is kept verbatim. Only the copy submitted to an engine is normalized.
export function selectionUnits(source){
  const parts=[];
  let start=0;
  const push=end=>{const s=source.slice(start,end).trim();if(s)parts.push(s);start=end};
  for(const match of source.matchAll(/[。！？!?]+[”’")）]*|\.+[”’")）]*(?=\s|$)|\r?\n[ \t]*\r?\n/g)){
    const end=match.index+match[0].length,head=source.slice(start,end);
    if(/\b(?:[A-Z]|Dr|Mr|Mrs|Ms|Fig[s]?|Eq[s]?|Ref[s]?|Tab|vs|et al|i\.e|e\.g|cf|approx|No|Vol|Suppl)\.$/.test(head))continue;
    push(end);
  }
  push(source.length);
  return parts;
}
const memo=new Map(),pending=new Map();
const maxResults=256;
let sequence=0;
function remember(key,result){
  memo.delete(key);memo.set(key,result);
  if(memo.size>maxResults)memo.delete(memo.keys().next().value);
}
function useful(text,source,from){
  return typeof text==='string'&&text.trim()!==source.trim()&&(from==='en'?/\p{Script=Han}/u.test(text):/[A-Za-z]{2}/.test(text));
}
function inspect(source,text,from,terms){
  return validateScientific(source,text,{from,terms:from==='en'?terms:[]});
}
function inContext(source,from){
  return from==='en'?/^(?:(?:in|for|with|of) )?(?:it|its|they|their|these|this|that|those|such|the former|the latter)\b/i.test(source):/^(?:这些|它们|其|该|上述|前者|后者)/u.test(source);
}
async function localUnit(unit,from,field,context,translator){
  const source=unit.normalized,terms=fieldTerms(source,field,context);
  let text='',name=false,fragmented=false,warning;
  try{
    const result=await selectionTranslation(source,from,translator,{field,context,onFragmentRecovery:()=>{fragmented=true}});
    text=result.text;name=result.name;
  }catch(error){
    if(error.stage!=='validation')throw error;
    text=error.candidate?.text||'';warning=error;
  }
  if(name)return {text,terms,name,validation:{status:'name',issues:[]},status:'translated'};
  if(!useful(text,source,from))throw warning||Object.assign(new Error('No target-language text'),{stage:'empty'});
  let validation=inspect(source,text,from,terms);
  // Term masking can improve a name yet break the surrounding measurement or
  // comparison. Try the untouched sentence once before resorting to clause alignment.
  if(from==='en'&&validation.status==='review'){
    try{
      const direct=await translator(source,from);
      if(direct!==text&&useful(direct,source,from)){
        const check=inspect(source,direct,from,terms);
        if(check.status==='checked'){
          const legacy=await translatePassage(source,from,async()=>direct,{field});
          if(!legacy.issues?.some(code=>code==='facts'||code==='target')){
            text=direct;validation=check;fragmented=false;warning=null;
            if(legacy.issues?.includes('terms')&&!check.issues.length)
              check.issues.push({code:'term',severity:'advisory'});
          }
        }
      }
    }catch(cause){if(cause.name==='AbortError')throw cause;warning??=cause}
  }
  // When a pronoun opens the sentence, supply the preceding selected sentence to
  // the local model. Accept only an independently checkable target after the intact
  // boundary. Keep the ordinary translation on a lost marker or unavailable context.
  if(unit.previous&&inContext(source,from)){
    let marker='793861';while((unit.previous+source).includes(marker))marker+='7';
    try{
      const contextual=await translator(unit.previous+' '+marker+' '+source,from);
      const chunks=contextual.split(marker);
      if(chunks.length===2&&useful(chunks[1],source,from)){
        const after=chunks[1].trim().replace(/^[，。,:：;\s]+/u,'');
        const check=inspect(source,after,from,terms);
        if(check.status==='checked'&&!warning){text=after;validation=check}
      }
    }catch(cause){if(cause.stage!=='validation')warning??=cause}
  }
  // Preserve the grammatical subject on each side of an explicit contrast. Recheck both
  // translations before joining them. This recovery is limited to one attempt.
  const contrast=from==='en'&&source.match(/^(.+?),\s*(whereas|while|but)\s+(.+)$/i);
  if(contrast&&validation.issues.some(i=>['direction','group','negation'].includes(i.code))){
    const halves=[contrast[1],contrast[3]];
    try{
      const translations=[];
      for(const half of halves){
        const t=await translator(half,from);
        if(inspect(half,t,from,fieldTerms(half,field,context)).status!=='checked')break;
        translations.push(t.trim().replace(/[.,。，]+$/u,''));
      }
      if(translations.length===2){
        const candidate=translations.join(contrast[2].toLowerCase()==='but'?'，但':'，而')+'。';
        const check=inspect(source,candidate,from,terms);
        if(check.status==='checked'){text=candidate;validation=check;warning=null;fragmented=false}
      }
    }catch(cause){warning??=cause}
  }
  if(warning?.reason==='facts'&&!validation.issues.some(i=>i.severity==='severe'))
    validation.issues.push({code:'source-check',severity:'advisory',detail:warning.message});
  if(warning?.reason==='terms'&&!validation.issues.some(i=>i.code.includes('term')))
    validation.issues.push({code:'term',severity:'advisory'});
  if(fragmented)validation.issues.push({code:'fragmented-prose',severity:'advisory'});
  if(inContext(source,from)&&context&&context!==source)
    validation.issues.push({code:'referent',severity:'advisory'});
  if(validation.issues.length)validation.status='review';
  return {text,terms,validation,status:validation.status==='checked'?'translated':'review',error:warning};
}
function guarded(translator,signal){
  const guard=fn=>async(...args)=>{
    signal.throwIfAborted();const result=await fn(...args);signal.throwIfAborted();return result;
  };
  const fn=guard(translator);fn.original=translator;
  if(translator.withTerms)fn.withTerms=guard(translator.withTerms);
  return fn;
}
function quick(unit,from,field,context,engine,signal){
  // Injected engines never share results with the shipped translator. Caches hold no
  // credentials and live only in the current document.
  if(engine)return localUnit(unit,from,field,context,guarded(engine.translate,signal));
  const key=JSON.stringify(['bergamot-shipped-0418','unit-v3',from,field?.key??field,unit.source,unit.normalized,context,inContext(unit.source,from)?unit.previous:'']);
  if(memo.has(key))return Promise.resolve(memo.get(key));
  let entry=pending.get(key);
  if(!entry){
    const controller=new AbortController();
    const work=localUnit(unit,from,field,context,guarded(globalThis.PaperLanguageText.translate,controller.signal));
    entry={work,controller,readers:0};pending.set(key,entry);
    work.then(r=>{if(!controller.signal.aborted&&r.status==='translated')remember(key,r)},()=>{})
      .finally(()=>{if(pending.get(key)===entry)pending.delete(key)});
  }
  entry.readers++;
  function release(){
    if(--entry.readers===0&&signal.aborted){
      entry.controller.abort();if(pending.get(key)===entry)pending.delete(key);
    }
  }
  signal.addEventListener('abort',release,{once:true});
  return entry.work.finally(()=>{signal.removeEventListener('abort',release);if(!signal.aborted)release()});
}
export function createTranslationSession({source,from='en',field='auto',context='',engine,paperWordForms,onUpdate=()=>{}}){
  const sid=++sequence,parts=selectionUnits(source),profile=resolveField(field,context||source);
  const units=parts.map((original,index)=>({id:sid+'-'+index,source:original,normalized:normalizeSelection(original,paperWordForms),
    previous:parts[index-1]||'',text:'',status:'pending',engine:engine?.id||'bergamot',validation:null,error:null,attempts:0,terms:[]}));
  let generation=0,busy=false,controller;
  function cancel(){
    generation++;busy=false;controller?.abort();controller=null;
    for(const u of units)if(u.status==='translating')u.status='pending';
    onUpdate(units);
  }
  async function run({ids}={}){
    if(busy)return;
    const token=++generation;busy=true;controller=new AbortController();
    try{
      for(const [i,u] of units.entries()){
        if(token!==generation)break;
        if(u.status==='translated'||(ids&&!ids.includes(u.id)))continue;
        u.status='translating';u.attempts++;u.error=null;onUpdate(units);
        const nearby=[parts[i-1],u.source,parts[i+1]].filter(Boolean).join(' ');
        // Only an ambiguous short term or a demonstrative needs neighboring text.
        const hint=u.normalized.length<24||inContext(u.normalized,from)?(context||nearby):u.normalized;
        try{
          const result=await quick(u,from,profile,hint,engine,controller.signal);
          if(token!==generation)break;
          Object.assign(u,result);
        }catch(error){
          if(token!==generation)break;
          Object.assign(u,{error,status:u.text?'review':'failed'});
        }
        onUpdate(units);
      }
    }finally{if(token===generation){busy=false;controller=null;onUpdate(units)}}
  }
  function precisionRequest(provider,includeContext=false){
    const unresolved=units.filter(u=>u.status!=='translated');
    const chosen=unresolved.length?unresolved:units;
    const terms=new Map();
    for(const u of chosen)for(const t of fieldTerms(u.normalized,profile,context||source))
      if(terms.size<150&&t.original.length<=250&&t.value.length<=250)terms.set(t.original,t.value);
    return {provider,consent:true,message:{target:from==='en'?'zh':'en',field:profile?.id||profile,
      units:chosen.map(u=>({id:u.id,text:u.source})),context:includeContext?source:'',terms:[...terms]}};
  }
  async function refine(body,send){
    if(busy||body.consent!==true)return;
    const expected=precisionRequest(body.provider,!!body.message.context);
    if(JSON.stringify(body)!==JSON.stringify(expected))throw new Error('Selection changed. Preview it again.');
    const token=++generation;busy=true;controller=new AbortController();
    try{
      const result=await send(body,controller.signal);
      if(token!==generation)return;
      const values=result?.translations;
      if(!Array.isArray(values)||values.length!==body.message.units.length||
        values.some((v,i)=>v?.id!==body.message.units[i].id||typeof v.text!=='string'||!v.text.trim()||v.text.length>32000))
        throw new Error('服务返回的句子编号或内容不完整 / Incomplete translation response');
      for(const v of values){
        const u=units.find(m=>m.id===v.id),terms=fieldTerms(u.normalized,profile,context||source);
        u.attempts++;
        const check=inspect(u.normalized,v.text,from,terms);
        // Do not overwrite a previously usable result with an echo or a damaged model response.
        if(!useful(v.text,u.normalized,from)||(u.status==='translated'&&check.issues.length)){
          u.refineError='精译未通过核对 / Refined text failed checks';continue;
        }
        if(check.issues.length)check.status='review';
        Object.assign(u,{text:v.text.trim(),engine:body.provider,validation:check,terms,
          status:check.status==='checked'?'translated':'review',error:null,name:false,refineError:null});
      }
    }finally{if(token===generation){busy=false;controller=null;onUpdate(units)}}
  }
  // This optional check needs the opposite-direction model. It must not delay
  // ordinary reading or silently download the additional model on slow networks.
  async function compareBack(){
    if(busy||from!=='en')return;
    const token=++generation;busy=true;controller=new AbortController();
    const translator=guarded(engine?.translate||globalThis.PaperLanguageText.translate,controller.signal);
    try{
      for(const u of units){
        if(token!==generation)break;
        if(!u.text||u.backTranslation||u.name||!needsAlignment(u.source))continue;
        const back=await translator(u.text,'zh');if(token!==generation)break;
        const issue=checkAlignment(u.normalized,back);u.backTranslation=back;
        if(issue){u.validation={status:'review',issues:[...(u.validation?.issues||[]),issue]};u.status='review'}
        onUpdate(units);
      }
    }finally{if(token===generation){busy=false;controller=null;onUpdate(units)}}
  }
  return {units,run,cancel,precisionRequest,refine,compareBack,
    get canCompare(){return from==='en'&&units.some(u=>u.text&&!u.name&&needsAlignment(u.source))},
    get busy(){return busy},profile,from};
}
