/* The paper's own structure: sections, the figures each one discusses, and what the caption says about each panel.
   Only complete author sentences are used. A panel the caption does not describe stays a bare letter. */
(() => {
  'use strict';
  const clean=s=>String(s??'').replace(/\s+/g,' ').replace(/(\p{Ll})-\s+(?=\p{Ll})/gu,'$1').trim();
  const NUMBER=/^(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+(\p{Lu}[^!?]{2,88})$/u;
  const KNOWN=/^(?:abstract|introduction|background|related work|methods?|materials and methods|results?|results and discussion|discussion|conclusions?|摘要|引言|背景|方法|结果|讨论|结论)$/i;
  const STOP=/^(?:references|bibliography|acknowledg(?:e)?ments?|参考文献|致谢)$/i;

  function headings(rows){
    const out=[];let major=0;
    for(let i=0;i<rows.length;i++){
      const text=clean(rows[i].text);
      if(STOP.test(text))break;
      const m=text.match(NUMBER);
      if(m&&!rows[i].fig&&text.split(' ').length<=14&&!/[.:,;]$/.test(text)&&!/[=∑∼≈]/.test(text)){
        const level=m[1].split('.').length,top=Number(m[1].split('.')[0]);
        // Section numbers only move forward one at a time, which rules out lists and table rows.
        if(top===major||top===major+1&&level===1){major=top;out.push({at:i,level,number:m[1],title:m[2]});continue}
      }
      if(KNOWN.test(text)||rows[i].heading&&text.length<80)out.push({at:i,level:1,number:'',title:text});
    }
    const numbered=out.filter(h=>h.number);
    return numbered.filter(h=>h.level===1).length>=2?numbered:out;
  }
  function sections(rows,figures){
    const heads=headings(rows);
    const end=rows.findIndex(r=>STOP.test(clean(r.text))),body=end<0?rows:rows.slice(0,end);
    function under(level){
      const groups=[];let last=null;
      for(const f of figures){
        const hits=body.map((r,i)=>!r.fig&&r.mentions?.includes(f.matchKey)?i:-1).filter(i=>i>=0);
        // A paper previews its figures in the introduction. The section that discusses a figure comes after.
        const home=i=>heads.filter(h=>h.level<=level&&h.at<=i).at(-1);
        const shown=rows.findIndex(r=>r.fig===f.matchKey),near=i=>shown<0?i:Math.abs(i-shown);
        const ranked=[...hits].sort((a,b)=>near(a)-near(b)).map(home).filter(Boolean);
        let at=ranked.find(h=>!/^(?:introduction|abstract|引言|摘要)$/i.test(h.title))||ranked[0]||null;
        // Figures are numbered in reading order, so their sections never step back.
        if(at&&last&&at.at<last.at)at=last;
        at=at||last;last=at;
        let g=groups.find(x=>x.head===at);
        if(!g){g={head:at,title:at?at.title:'',number:at?at.number:'',figures:[]};groups.push(g)}
        g.figures.push(f);
      }
      return groups;
    }
    const top=under(1);
    const real=top.filter(g=>g.head);
    let groups=top;
    if(real.length<2||Math.max(...real.map(g=>g.figures.length))>Math.max(6,figures.length*.6)){
      const deep=under(2);if(deep.filter(g=>g.head).length>real.length)groups=deep;
    }
    if(groups.filter(g=>g.head).length<2)return [{title:'',number:'',figures:[...figures]}];
    const order=new Map(figures.map((f,i)=>[f,i]));
    return groups.map(({title,number,figures})=>({title,number,figures})).sort((a,b)=>order.get(a.figures[0])-order.get(b.figures[0]));
  }

  // "(a) Text. (b–d) Text." or "a, Text. b, Text." → letter → complete sentence.
  function panelText(caption){
    const text=clean(caption),found=new Map();
    const flow=globalThis.CaptionFlow?.panelSections(text);
    if(flow?.size){
      for(const [id,s] of flow)found.set(id,{text:s.text,specific:s.specific,shared:s.ids.length>1?s.ids:null});
    }
    const mark=/(?:^|(?<=[.;:,]\s)|(?<=\s))\(([a-z])(?:\s*[–-]\s*([a-z])|((?:\s*,\s*[a-z])+))?\)\s*(?=\S)/gi;
    let marks=[...text.matchAll(mark)].map(m=>({at:m.index,end:m.index+m[0].length,from:m[1],to:m[2],more:m[3]}));
    if(marks.length<1||marks[0].from.toLowerCase()!=='a'&&marks.length<2)marks=marks.filter(m=>m.from.toLowerCase()==='a'||marks.length>1);
    if(!marks.length){
      marks=[...text.matchAll(/(?:^|[.;]\s+)([a-z])(?:\s*[–-]\s*([a-z]))?(?:,\s+|\s*[|:]\s*|\s+)(?=\p{Lu}[\p{L}]{2,})/gu)]
        .map(m=>({at:m.index,end:m.index+m[0].length,from:m[1],to:m[2]}));
      if(marks[0]?.from!=='a')marks=[];
    }
    // A label opens a description only at the start of a sentence or clause.
    marks=marks.filter(m=>m.at===0||/[.;:,|]\s*$/.test(text.slice(0,m.at))||/^[.;]/.test(text.slice(m.at)));
    marks.forEach((m,i)=>{
      const raw=text.slice(m.end,marks[i+1]?.at??text.length);
      const sentence=clean(raw.match(/^.*?[.!?](?=\s+\p{Lu}|\s*$)/u)?.[0]||raw).replace(/[\s,;.]+$/,'').replace(/\s+and$/i,'');
      const words=sentence.match(/\p{L}{2,}/gu)||[];
      // A reference such as "shown in (b) and" is not a description.
      if(words.length<2||/^\p{Ll}/u.test(sentence)&&words.length<4)return;
      const a=m.from.toLowerCase().charCodeAt(0),b=m.to?m.to.toLowerCase().charCodeAt(0):a,letters=[];
      for(let c=a;c<=b&&c-a<26;c++)letters.push(String.fromCharCode(c));
      for(const x of m.more?.match(/[a-z]/gi)||[])letters.push(x.toLowerCase());
      for(const l of letters)if(!found.has(l))found.set(l,{text:sentence,shared:letters.length>1?letters:null});
    });
    return found;
  }
  // The caption's opening sentence names the figure.
  function title(caption,label){
    let s=clean(caption).replace(new RegExp('^'+String(label||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*[.:|]?\\s*','i'),'').replace(/^(?:Fig(?:ure)?\.?\s*S?\d+)\s*[.:|]?\s*/i,'');
    s=s.split(/\s*\(a\)\s|\s+a,\s+(?=\p{Lu})/u)[0];
    return clean(s.match(/^.*?[.!?](?=\s+\p{Lu}|\s*$)/u)?.[0]||s).replace(/[.]$/,'').slice(0,160);
  }
  // Drop the throat-clearing before a claim so the translation starts at the point.
  function claim(text){
    const s=clean(text).replace(/^(?:Here|In this (?:paper|work|study|article|report)|In summary|Overall|Together|Taken together)\s*,?\s*/i,'')
      .replace(/^(?:we|our results?|these (?:results|data)|this (?:paper|study|work))\s+(?:(?:also|further|empirically|therefore|then|have)\s+)*(?:show(?:s|ed|n)?|demonstrate[sd]?|find|found|report(?:ed|s)?|reveal(?:ed|s)?)\s+(?:that\s+)?/i,'');
    return s.charAt(0).toUpperCase()+s.slice(1);
  }
  const api={headings,sections,panelText,title,claim};
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.PaperOutline=Object.freeze(api);
})();
