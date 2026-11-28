/* A run of consecutive printed panel headings identifies caption prose in reading order. */
(() => {
  'use strict';
  // Some journals put the panel letters after the measurements in one shared
  // sentence, between two runs of ordinary headings. Its boundary is the
  // beginning of that sentence, not the position of the first parenthesis.
  function inlineGroups(text){
    const out=[];
    const stops=/(?:[.!?。！？](?=\s|$)|$)/gu;
    let start=0;
    for(const end of text.matchAll(stops)){
      if(end[0]==='.'&&/(?:\b[A-Z]|\b[Ff]igs?|\bet al)$/.test(text.slice(start,end.index)))continue;
      const sentence=text.slice(start,end.index+end[0].length),at=start+sentence.length-sentence.trimStart().length;
      start=end.index+end[0].length;
      const refs=[...sentence.matchAll(/\(([a-z])\)/gi)];
      if(refs.length<2||/^\s*\([a-z]/i.test(sentence)||/\b(?:see|as in|shown in|panels?|figs?\.)\s*\([a-z]\)/i.test(sentence))continue;
      const ids=refs.map(m=>m[1].toLowerCase());
      if(!ids.every((id,i)=>!i||id.charCodeAt(0)===ids[i-1].charCodeAt(0)+1))continue;
      out.push({ids,at,end:at});
    }
    return out;
  }

  function headings(text) {
    const parenthetical=/(?:^|\s)\(([A-Z])(?:\s*([–—,-])\s*([A-Z]))?\)\s+(?=[A-Z\d])/g;
    const bare=/(?:^|[.;:|]\s*)([a-z])(?:\s*([–—,-])\s*([a-z]))?\s+(?=[A-Z\d])/g;
    const inline=inlineGroups(text);
    let best=[];
    for(const pattern of [parenthetical,bare]){
      const candidates=[];
      for(const m of text.matchAll(pattern)){
        const a=m[1].toLowerCase().charCodeAt(0),b=m[3]?.toLowerCase().charCodeAt(0)??a;
        if(b<a||(m[2]===','&&b!==a+1))continue;
        const ids=Array.from({length:b-a+1},(_,i)=>String.fromCharCode(a+i));
        candidates.push({ids,at:m.index+m[0].indexOf(pattern===parenthetical?'(':m[1]),end:m.index+m[0].length});
      }
      const out=[];let next=97;
      const explicit=new Set(candidates.flatMap(c=>c.ids));
      const shared=inline.filter(c=>c.ids.every(id=>!explicit.has(id)));
      for(const candidate of candidates.concat(shared).sort((a,b)=>a.at-b.at)){
        const first=candidate.ids[0].charCodeAt(0);
        const smallGap=first===next+1&&out.length>=2&&pattern===bare&&candidate.at!==candidate.end&&explicit.has(String.fromCharCode(first+1));
        if(first!==next&&!smallGap)continue;
        out.push(candidate);next=candidate.ids.at(-1).charCodeAt(0)+1;
      }
      if(out.length>=2&&out.length>best.length)best=out;
    }
    return best;
  }

  function panelSections(text){
    const marks=headings(text),out=new Map();
    for(const [i,m] of marks.entries()){
      let section=text.slice(m.end,marks[i+1]?.at??text.length).trim();
      // Shared reporting notes remain in the full figure caption.
      if(i===marks.length-1){
        section=section.split(/(?<=[.!?])\s+(?=(?:Statistical significance was (?:evaluated|assessed|determined)|(?:All )?Data (?:are|were) (?:presented|shown|expressed) as|Source data (?:are|is) provided)\b)/i)[0];
      }
      if(!section)continue;
      // Only separate a pair when each measured quantity has its own letter.
      // Keep the shared sentence verbatim for the source link.
      const pair=m.at===m.end&&m.ids.length===2&&section.match(/^(.*?\b(?:concentrations?|levels?|expression|signals?|intensit(?:y|ies)|values?) (?:of |for )?)([\w\p{L}./−–-]+)\s*\(([a-z])\)\s+and\s+([\w\p{L}./−–-]+)\s*\(([a-z])\)([\s\S]*)$/iu);
      for(const id of m.ids){
        const specific=pair&&pair[3].toLowerCase()===m.ids[0]&&pair[5].toLowerCase()===m.ids[1]
          ?pair[1]+(id===m.ids[0]?pair[2]:pair[4])+pair[6]:undefined;
        out.set(id,{text:section,ids:m.ids,specific});
      }
    }
    return out;
  }

  function nextPage(cap,lines,view,read=line=>line.text) {
    if(cap.anchor.endY<view.height*.69)return;
    if(cap.inLegendSection){
      const column=lines.filter(l=>Math.abs(l.x0-cap.line.x0)<cap.line.size&&Math.abs(l.size-cap.line.size)<cap.line.size*.15);
      const first=column[0];
      if(!first||first.y0>view.height*.22||first.font!==cap.lastFont)return;
      const parts=[];
      for(const line of column){
        if(/^(?:(?:Fig(?:ure)?\.?|Table)\s*\d+\b|(?:References|Supplementary information|Editorial summary|Acknowledg(?:e)?ments)\s*$)/i.test(line.text)||
          parts.length&&line.base-parts.at(-1).base>line.size*2.5)break;
        if(parts.length&&line.font!==cap.lastFont&&line.text.trim().split(/\s+/).length<=5&&/^[\p{Lu}][\p{L}\s-]+$/u.test(line.text))break;
        parts.push(line);
      }
      return parts.map(read).join(' ');
    }
    const last=headings(cap.caption).at(-1)?.ids.at(-1);
    if(!last||last==='z')return;
    const next=String.fromCharCode(last.charCodeAt(0)+1);
    const mark=new RegExp('^\\('+next+'(?:\\s*[-–—,]\\s*[a-z])?\\)\\s+','i');
    const start=lines.find(l=>l.y0<view.height*.19&&Math.abs(l.x0-cap.line.x0)<cap.line.size&&
      Math.abs(l.size-cap.line.size)<cap.line.size*.23&&mark.test(l.text));
    if(!start)return;
    const column=lines.filter(l=>l.base>=start.base&&Math.abs(l.x0-start.x0)<start.size*.86);
    const parts=[];
    for(const line of column){
      if(Math.abs(line.size-start.size)>start.size*.15||parts.length&&line.base-parts.at(-1).base>start.size*1.8||
        /^(?:Fig(?:ure)?\.?|Table)\s*\d+\s*[.:|]/i.test(line.text)||parts.length>=90)break;
      parts.push(line);
    }
    return parts.map(l=>l.text).join(' ');
  }
  const api={headings,panelSections,nextPage};
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.CaptionFlow=api;
})();
