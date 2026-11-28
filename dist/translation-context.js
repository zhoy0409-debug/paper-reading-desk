// Use only text from the active paper. The precision API has its own separately
// previewed payload; this surrounding material is for the on-device model.
const normalize=s=>String(s||'').replace(/\s+/g,' ').trim();
const tokens=s=>(s.toLowerCase().match(/[a-z][a-z-]{3,}/g)||[])
  .filter(w=>! /^(?:these|those|which|that|were|with|from|this|have|more|than|using|used|figure|table|study|results|also|each|between)$/.test(w));
const instruments={trawl:'拖网',net:'网',probe:'探针',sensor:'传感器',chamber:'室',scanner:'扫描仪',sampler:'采样器',telescope:'望远镜'};
export function indexPaperContext(rows,title='',lookup=()=>[]){
  const passages=rows.filter(r=>r.text&&!r.heading&&r.section!=='references').map(r=>normalize(r.text)).filter(Boolean);
  const documents=new Map();
  passages.forEach((p,i)=>{
    for(const token of new Set(tokens(p))){
      if(!documents.has(token))documents.set(token,[]);
      documents.get(token).push(i);
    }
  });
  return function evidence(source,page){
    const text=normalize(source);
    const definitions=[];
    // Repeated sampling labels ("X per X") can be equipment names defined only
    // in the methods. Carry the printed head noun into the translation prompt.
    for(const hit of text.matchAll(/\b([a-z][a-z-]{2,})\s+(?:per|by)\s+\1\b/gi)){
      const label=hit[1].toLowerCase(),records=documents.get(label)||[];
      const heads=new Set();
      for(const id of records)for(const pair of passages[id].matchAll(/\b([A-Za-z][a-z-]+)\s+(trawl|net|probe|sensor|chamber|scanner|sampler|telescope)s?\b/gi))
        if(pair[1].toLowerCase()===label)heads.add(pair[2].toLowerCase());
      if(heads.has('trawl'))heads.delete('net');
      if(heads.size===1){const head=[...heads][0];definitions.push(hit[1]+' = '+hit[1]+' '+head+'（'+instruments[head]+'）')}
    }
    for(const short of new Set(text.match(/\b[A-Z][A-Z\d-]{1,12}s?\b/g)||[])){
      const other=short.endsWith('s')?short.slice(0,-1):short+'s';
      const options=[...lookup(short,page),...lookup(other,page)];
      const choices=new Map(options.map(o=>[o.full.toLowerCase().replace(/s$/,''),o.full]));
      if(choices.size===1)definitions.push(short+' = '+choices.values().next().value);
      if(definitions.length===8)break;
    }
    const scores=new Map();
    for(const t of new Set(tokens(text))){
      const hit=documents.get(t);
      if(!hit||hit.length>Math.max(8,passages.length*.16))continue;
      for(const id of hit)scores.set(id,(scores.get(id)||0)+1/Math.sqrt(hit.length));
    }
    const ranked=[...scores].sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
    let near='',related='';
    for(const [id] of ranked){
      const passage=passages[id],at=passage.indexOf(text);
      if(at>=0){
        if(!near){
          const before=passage.slice(0,at).trim().split(/(?<=[.!?])\s+/).at(-1)||'';
          const after=passage.slice(at+text.length).trim().split(/(?<=[.!?])\s+/)[0]||'';
          // A word or phrase needs the intact sentence it was selected from.
          const embedded=(before&&!/[.!?]$/.test(before))||(!/[.!?]$/.test(text)&&after);
          near=[before.length<=420?before:'',embedded?text:'',after.length<=420?after:''].filter(Boolean).join(' ');
        }
      }else if(!related&&passage.length>=30&&!text.includes(passage)){
        const candidate=passage.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s=>s.length>=24);
        const words=new Set(tokens(text));
        candidate.sort((a,b)=>tokens(b).filter(t=>words.has(t)).length-tokens(a).filter(t=>words.has(t)).length);
        if(candidate[0]&&tokens(candidate[0]).some(t=>words.has(t)))related=candidate[0].slice(0,460);
      }
      if(near&&related)break;
    }
    return [normalize(title).slice(0,200),...definitions,near,related].filter(Boolean).join('\n').slice(0,1300);
  };
}
