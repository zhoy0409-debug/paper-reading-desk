/* Carry a figure's one-line reading into its slide note, and back on request.
   A note the reader typed is never overwritten. */
(() => {
  'use strict';
  const MAX=480;
  const parse=k=>{try{const [f,p]=JSON.parse(k);return {figure:f,panel:p}}catch{return {}}};
  const note=(state,f,p)=>state.figures?.[f]?.sentences?.[p];
  const line=(state,f)=>(state.lens?.[f]?.say||'').trim().slice(0,MAX);
  const queued=(state,f)=>(state.queue||[]).map(parse).filter(k=>k.figure===f).map(k=>k.panel);
  const free=(state,f,p)=>note(state,f,p)===undefined;
  const used=(state,f)=>queued(state,f).some(p=>(note(state,f,p)||'').trim()===line(state,f));
  // The note still holds exactly the text this module put there.
  function linked(state,f){
    const e=state.lens?.[f];
    return e?.noteOn&&queued(state,f).includes(e.noteOn)&&note(state,f,e.noteOn)===e.noteText?e.noteOn:'';
  }
  function put(state,f,p){
    const e=state.lens[f],text=line(state,f);
    const sentences=state.figures[f].sentences||={};
    if(text){sentences[p]=text;e.noteText=text}else{delete sentences[p];delete e.noteText}
    e.noteOn=p;
  }
  function unlink(state,f){const e=state.lens?.[f];if(e){delete e.noteOn;delete e.noteText}}
  // One figure line fills one panel's note, so it is not repeated across slides.
  function add(state,f,p){
    if(!line(state,f)||!state.figures?.[f]||!free(state,f,p)||linked(state,f)||used(state,f))return false;
    put(state,f,p);return true;
  }
  function follow(state,f){
    const p=linked(state,f);
    if(!p){unlink(state,f);return ''}
    put(state,f,p);return p;
  }
  function edited(state,f,p){if(state.lens?.[f]?.noteOn===p)unlink(state,f)}
  function removed(state,f,p){
    const e=state.lens?.[f];
    if(e?.noteOn!==p)return;
    if(note(state,f,p)===e.noteText)delete state.figures?.[f]?.sentences?.[p];
    unlink(state,f);
  }
  // What the reader can do for this figure now.
  function offer(state,f){
    const at=linked(state,f),text=line(state,f),panels=queued(state,f);
    if(at)return text?{kind:'synced',panel:at}:{kind:'none'};
    if(text){if(used(state,f))return {kind:'none'};const p=panels.find(p=>free(state,f,p));return p?{kind:'fill',panel:p}:{kind:'none'}}
    const p=panels.find(p=>(note(state,f,p)||'').trim());
    return p?{kind:'take',panel:p,text:note(state,f,p).trim()}:{kind:'none'};
  }
  const api=Object.freeze({add,follow,edited,removed,offer,MAX});
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.ReadingLineNotes=api;
})();
