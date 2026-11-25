/* A run of consecutive printed panel headings identifies caption prose in reading order. */
(() => {
  'use strict';
  function headings(text) {
    const parenthetical=/(?:^|\s)\(([A-Z])(?:\s*([–—,-])\s*([A-Z]))?\)\s+(?=[A-Z\d])/g;
    const bare=/(?:^|[.;:|]\s*)([a-z])(?:\s*([–—,-])\s*([a-z]))?\s+(?=[A-Z\d])/g;
    for(const pattern of [parenthetical,bare]){
      const out=[];let next=97;
      for(const m of text.matchAll(pattern)){
        const a=m[1].toLowerCase().charCodeAt(0),b=m[3]?.toLowerCase().charCodeAt(0)??a;
        if(a!==next||b<a||(m[2]===','&&b!==a+1))continue;
        const ids=Array.from({length:b-a+1},(_,i)=>String.fromCharCode(a+i));
        out.push({ids,at:m.index+m[0].indexOf(pattern===parenthetical?'(':m[1]),end:m.index+m[0].length});
        next=b+1;
      }
      if(out.length>=2)return out;
    }
    return [];
  }

  function panelSections(text){
    const marks=headings(text),out=new Map();
    for(const [i,m] of marks.entries()){
      const section=text.slice(m.end,marks[i+1]?.at??text.length).trim();
      for(const id of m.ids)out.set(id,{text:section,ids:m.ids});
    }
    return out;
  }

  function nextPage(cap,lines,view) {
    if(cap.anchor.endY<view.height*.69)return;
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
