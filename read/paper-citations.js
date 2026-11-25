/* Bring the reference list back to the sentence that cites it.
   Numbered and author–year papers. An ambiguous match is left unlinked. */
(() => {
  'use strict';
  const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
  const fold=s=>clean(s).normalize('NFKD').replace(/[̀-ͯ¨´`]/g,'').toLowerCase();
  const YEAR=/\b((?:19|20)\d{2})([a-z])?\b/g;
  const END=/^(?:appendix\b|supplementary (?:information|materials?)|supporting information|附录)/i;
  const START=/^(?:references|bibliography|literature cited|references and notes|参考文献)$/i;
  const years=s=>[...s.matchAll(YEAR)].map(m=>m[1]+(m[2]||''));
  const NUMBERED=/^(?:\[(\d{1,3})\]|(\d{1,3})\.)\s+(.+)/;

  function list(rows){
    const at=rows.findIndex(r=>START.test(clean(r.text)));
    if(at<0)return [];
    const after=rows.slice(at+1),end=after.findIndex(r=>END.test(clean(r.text)));
    const back=(end<0?after:after.slice(0,end)).filter(r=>clean(r.text)&&!/^\d{1,4}$/.test(clean(r.text)));
    const entries=[];let now=null;
    const numbered=back.filter(r=>NUMBERED.test(clean(r.text))).length>=3;
    for(const r of back){
      const text=clean(r.text),m=numbered&&text.match(NUMBERED);
      let fresh=false;
      if(numbered)fresh=!!m;
      else{
        const done=now&&/(?:\.|\d{4}[a-z]?\)?|[\w/]{6,})$/.test(now.text)&&years(now.text).length&&/[.)]$/.test(now.text);
        const opens=/^(?:(?:van|von|de|der|den|di|da|la|le|el)\s+)*\p{Lu}[\p{L}'’.\-]*(?:[\s,]|$)/u.test(text);
        fresh=!now||done&&opens;
      }
      if(fresh){now={number:m?Number(m[1]||m[2]):0,text:m?m[3]:text,page:r.page};entries.push(now)}
      else if(now&&now.text.length<900)now.text+=(/-$/.test(now.text)&&/^\p{Ll}/u.test(text)?'':' ')+text;
    }
    return entries.filter(e=>e.text.length>20).map((e,i)=>{
      e.text=e.text.replace(/(\p{Ll})-\s+(?=\p{Ll})/gu,'$1');
      const doi=e.text.match(/\b10\.\d{4,9}\/[^\s"<>]+/);
      const arxiv=e.text.match(/arxiv[^\d]{0,16}(\d{4}\.\d{4,5})/i);
      return {id:'r'+i,...e,years:new Set(years(e.text)),...parts(e.text),
        url:doi?'https://doi.org/'+doi[0].replace(/[.,;)]+$/,''):arxiv?'https://arxiv.org/abs/'+arxiv[1]:''};
    });
  }
  // Authors, title and the rest. Falls back to the whole entry.
  function parts(text){
    const t=text.replace(/\s*\(((?:19|20)\d{2}[a-z]?)\)\.?/,' ($1). ');
    const cuts=[...t.matchAll(/(?<!\b\p{Lu})(?<!\bvol)(?<!\bpp)(?<!\bno)[.?!]\s+(?=["“\p{Lu}\p{N}])/gu)].map(m=>m.index+m[0].length);
    const seg=[];let from=0;for(const c of [...cuts,t.length]){seg.push(clean(t.slice(from,c)));from=c}
    if(/^\((?:19|20)\d{2}[a-z]?\)\.?$/.test(seg[1]||''))seg[0]+=' '+seg.splice(1,1)[0];
    const title=seg.slice(1).find(s=>s.length>14&&!/^(?:In |Proceedings|Advances in|arXiv|https?:|doi)/i.test(s));
    if(!title)return {authors:seg[0]?.slice(0,160)||'',title:'',venue:''};
    const rest=seg.slice(seg.indexOf(title)+1).join(' ');
    return {authors:seg[0].replace(/\s*\((?:19|20)\d{2}[a-z]?\)\.?/,'').replace(/[.]$/,''),title:title.replace(/[.]$/,''),venue:rest.replace(/[.]$/,'')};
  }

  const NAME="(?:(?:van|von|de|der|den|di|da|la|le|el)\\s+)*\\p{Lu}[\\p{L}'’\\-¨´]+";
  const WHO=NAME+"(?:\\s+et\\s+al\\.?|(?:,\\s*"+NAME+")*,?\\s+(?:and|&)\\s+"+NAME+")?";
  function mentions(text){
    const found=[];
    const add=(index,raw,who,year,number)=>found.push({index,length:raw.length,raw,who,year,number});
    for(const m of text.matchAll(/\[(\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)\]/g)){
      const numbers=[];
      for(const part of m[1].split(',')){
        const [a,b]=part.split(/[–-]/).map(Number);
        for(let n=a;n<=(b||a)&&n-a<20;n++)numbers.push(n);
      }
      add(m.index,m[0],'', '',numbers);
    }
    const narrative=new RegExp('('+WHO+')\\s*\\(((?:19|20)\\d{2}[a-z]?)(?:,\\s*[^()]{0,30})?\\)','gu');
    for(const m of text.matchAll(narrative))add(m.index,m[0],m[1],m[2]);
    const inside=new RegExp('('+WHO+'),?\\s+((?:19|20)\\d{2}[a-z]?(?:,\\s*(?:19|20)\\d{2}[a-z]?)*)','gu');
    for(const g of text.matchAll(/\([^()]*(?:19|20)\d{2}[a-z]?[^()]*\)/g)){
      for(const m of g[0].matchAll(inside))for(const y of m[2].split(/,\s*/))add(g.index+m.index,m[0],m[1],y);
    }
    return found.sort((a,b)=>a.index-b.index);
  }
  function names(who){
    return fold(who).replace(/\bet al\.?/,'').split(/,|\band\b|&/).map(s=>s.trim()).filter(Boolean);
  }
  function resolve(entries,m){
    if(m.number)return entries.filter(e=>m.number.includes(e.number));
    const want=names(m.who);
    const scored=entries.filter(e=>e.years.has(m.year)||/[a-z]$/.test(m.year)&&e.years.has(m.year.slice(0,4))&&![...e.years].some(y=>/[a-z]$/.test(y))).map(e=>{
      const head=fold(e.authors||e.text.slice(0,200));
      const spots=want.map(n=>{const at=head.search(new RegExp('(?:^|[^\\p{L}])'+n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![\\p{L}])','u'));return at});
      return {e,ok:spots.every(x=>x>=0),at:spots[0],people:head.split(/,|\band\b|&/).length};
    }).filter(x=>x.ok);
    if(scored.length<2)return scored.map(x=>x.e);
    // "X and Y" names every author; "X et al." names the first of several.
    const two=want.length>1,etal=/et\s+al/i.test(m.who);
    const fit=scored.filter(x=>two?x.people===want.length:etal?x.people>2:x.people===1);
    const pool=fit.length?fit:scored,first=Math.min(...pool.map(x=>x.at));
    const best=pool.filter(x=>x.at<=first+18);
    return best.length===1?[best[0].e]:[];
  }

  function build(rows){
    const entries=list(rows||[]);
    const at=(rows||[]).findIndex(r=>START.test(clean(r.text)));
    const body=at<0?rows||[]:rows.slice(0,at);
    function find(text){
      const out=[];
      for(const m of mentions(text))for(const entry of resolve(entries,m))out.push({...m,entry});
      return out;
    }
    const sentence=(text,index)=>{
      const before=text.slice(0,index),after=text.slice(index);
      const s=Math.max(...[...before.matchAll(/[.!?]\s+(?=\p{Lu})/gu)].filter(m=>!/(?:et al|Fig|e\.g|i\.e|cf)$/.test(before.slice(0,m.index))).map(m=>m.index+m[0].length),0);
      const stop=[...after.matchAll(/[.!?](?=\s+\p{Lu}|\s*$)/gu)].find(m=>!/(?:et al|Fig|e\.g|i\.e|cf)$/.test(after.slice(0,m.index)));
      return clean(text.slice(s,index+(stop?stop.index+1:after.length))).slice(0,520);
    };
    // Paragraphs that mention this figure, joined from their lines.
    function paragraphs(key){
      const out=[],used=new Set();
      body.forEach((row,i)=>{
        if(row.fig||!row.mentions?.includes(key)||used.has(i))return;
        let a=i,b=i;
        const same=(x,y)=>rows[x]&&rows[y]&&rows[x].page===rows[y].page&&!rows[x].fig&&!rows[x].heading;
        while(a>0&&i-a<9&&same(a-1,i)&&!/[.!?]$/.test(rows[a-1].text))a--;
        while(b+1<body.length&&b-i<9&&same(b+1,i)&&!/[.!?]$/.test(rows[b].text))b++;
        for(let n=a;n<=b;n++)used.add(n);
        out.push({text:clean(rows.slice(a,b+1).map(r=>r.text).join(' ').replace(/(\p{Ll})-\s+(?=\p{Ll})/gu,'$1')),page:row.page});
      });
      return out.slice(0,10);
    }
    function forFigure(f){
      const groups=new Map();
      const add=(text,page,where)=>{
        for(const hit of find(text)){
          const g=groups.get(hit.entry.id)||{entry:hit.entry,uses:[]};
          const quote=sentence(text,hit.index);
          if(g.uses.length<3&&!g.uses.some(u=>u.quote===quote))g.uses.push({quote,page,where});
          groups.set(hit.entry.id,g);
        }
      };
      add(clean(f.caption),f.captionPage||f.page,'caption');
      for(const p of f.authorPassages||[])add(clean(p.text),p.page,'mention');
      for(const p of f.questionAims||[])add(clean(p.text),p.page,'aim');
      for(const p of paragraphs(f.matchKey))add(p.text,p.page,'near');
      return [...groups.values()];
    }
    return {entries,find,forFigure};
  }
  const api={build,mentions,list,resolve};
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.PaperCitations=api;
})();
