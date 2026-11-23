(() => {
  'use strict';
  const cx=t=>(t.x0+t.x1)/2, cy=t=>(t.y0+t.y1)/2;
  const number=t=>Number(t.text.trim().replace('−','-'));
  const isNumber=t=>/^[+−-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t.text.trim());
  const rect=(b,v,p=0)=>({x:(b.x0-p)/v.width,y:(b.y0-p)/v.height,width:(b.x1-b.x0+2*p)/v.width,height:(b.y1-b.y0+2*p)/v.height});
  function atom(caption){
    const mark=caption.match(/\bvertical\s+(?:lines?|spikes?|stems?)\s*(?:[:–—-]|(?:represent|show|indicate)s?)\s*(?:the\s+)?(?:posterior\s+)?(?:probability\s+(?:lumps?|mass(?:es)?)|point\s+mass(?:es)?)\s+at\s+([\p{L}]\w*)\s*=\s*([−+-]?\d+(?:\.\d+)?)/iu);
    if(!mark||!/\bposterior\b/i.test(caption)||!/\bright\s+(?:y[- ]?)?axis\b/i.test(caption))return null;
    return {symbol:mark[1],at:Number(mark[2].replace('−','-')),table:caption.match(/\bTable\s+(\d+)\b/i)?.[1]};
  }
  function measure(spec,p,words,marks,view){
    const xt=p.ticks,s=xt[0].size, start=xt[0],end=xt.at(-1),span=cx(end)-cx(start);
    const printed=xt.find(t=>number(t)===spec.at);
    const base=p.scale.find(t=>number(t)===0);
    if(!printed||!base)return {...spec};
    const x=cx(printed),baseline=cy(base);
    const nearby=words.filter(t=>isNumber(t)&&t.x0>cx(end)&&t.x0<cx(end)+s*5);
    const origins=nearby.filter(t=>number(t)===0&&Math.abs(cy(t)-baseline)<s*1.4);
    if(origins.length!==1)return {...spec};
    const zero=origins[0],ticks=[zero];
    const aligned=nearby.filter(t=>Math.abs(t.x0-zero.x0)<s*.5&&cy(t)<cy(zero)-s&&cy(t)>cy(zero)-span*1.7).sort((a,b)=>cy(b)-cy(a));
    for(const t of aligned){
      if(number(t)<=number(ticks.at(-1))||number(t)>1)break;
      ticks.push(t);if(number(t)===1)break;
    }
    const one=ticks.at(-1),height=cy(zero)-cy(one);
    if(ticks.length<3||number(one)!==1||ticks.some(t=>Math.abs((cy(zero)-cy(t))/height-number(t))>.025))return {...spec};
    const rightBox=rect({x0:zero.x0-s*2.5,x1:Math.max(...ticks.map(t=>t.x1)),y0:one.y0,y1:zero.y1},view);
    const stems=marks.filter(m=>m.stroke&&Math.abs(cx(m)-x)<s*.55&&Math.abs(m.y1-cy(zero))<s*.7&&m.y0<cy(zero)-s&&m.y0>=cy(one)-s);
    if(stems.length!==1)return {...spec,rightBox};
    const top=stems[0].y0,estimate=(cy(zero)-top)/height;
    if(estimate<0||estimate>1)return {...spec,rightBox};
    return {...spec,estimate,guide:rect({x0:x,x1:zero.x0,y0:top-s*.25,y1:top+s*.25},view),rightBox};
  }

  // Read a three-regime probability table only when group headings, variable,
  // signed superscripts and the numeric row all identify the same cell.
  function readTables(words,page,view){
    const rows=[];
    for(const t of [...words].sort((a,b)=>a.base-b.base||cx(a)-cx(b))){
      const r=rows.at(-1);
      if(r&&Math.abs(t.base-r[0].base)<1)r.push(t);else rows.push([t]);
    }
    for(const row of rows)row.sort((a,b)=>cx(a)-cx(b));
    const result=[];
    rows.forEach((title,i)=>{
      const name=title.map(t=>t.text.trim()).join(' ').match(/^Table\s+(\d+)\s*[.:]?\s+Posterior probabilit(?:y|ies)\b/i);
      if(!name)return;
      const start=rows.findIndex((r,j)=>j>i&&r[0].base-title[0].base<title[0].size*6&&r.every(t=>/^[\p{L}]\s*=\s*[\d,.]+$/u.test(t.text.trim())));
      if(start<0)return;
      const groups=rows[start].map(t=>{
        const [k,v]=t.text.trim().split(/\s*=\s*/);return {k,v:Number(v.replaceAll(',','')),x:cx(t)};
      });
      const signs=rows[start+1],heads=rows[start+2];
      if(!signs||!heads||groups.length*3!==signs.length||heads.length!==signs.length+1||
        !groups.every(g=>g.k===groups[0].k)||heads[0].base-rows[start][0].base>title[0].size*2.5)return;
      const variable=heads[0].text.trim(),cols=heads.slice(1);
      if(!/^[\p{L}]\w*$/u.test(variable)||!cols.every(t=>t.text===cols[0].text&&/^[\p{L}]$/u.test(t.text)))return;
      const signsAt=signs.map(t=>t.text.trim().replace('−','-'));
      if(!signs.every((t,j)=>t.base<cols[j].base&&t.x0>=cols[j].x0&&Math.abs(t.x0-cols[j].x1)<cols[j].size*.5))return;
      if(!groups.every((g,j)=>new Set(signsAt.slice(j*3,j*3+3)).size===3&&
        signsAt.slice(j*3,j*3+3).every(k=>['+','0','-'].includes(k))&&g.x>cx(cols[3*j])&&g.x<cx(cols[3*j+2])))return;
      const values=[];
      for(const r of rows.slice(start+3)){
        if(r.length!==heads.length||!r.every(isNumber)||r.some((t,j)=>Math.abs(cx(t)-cx(heads[j]))>heads[j].size*.95))break;
        for(const [j,g] of groups.entries()){
          const offset=3*j,triplet=r.slice(offset+1,offset+4).map(number);
          if(triplet.some(v=>v<0||v>1)||Math.abs(triplet.reduce((a,b)=>a+b,0)-1)>.021)continue;
          const value=r[offset+1+signsAt.slice(offset,offset+3).indexOf('0')];
          values.push({variable,setting:number(r[0]),group:g.k,groupValue:g.v,printed:value.text.trim(),region:rect(value,view,2)});
        }
      }
      if(values.length)result.push({id:name[1],page,values});
    });
    return result;
  }
  function attach(figures,tables){
    for(const f of figures)for(const c of f.openHistogram?.cells||[]){
      const d=c.dual;
      if(!d?.table||d.at!==0||!c.conditions)continue;
      const candidates=tables.filter(t=>t.id===d.table);
      if(candidates.length!==1)continue;
      const t=candidates[0],values=t.values.filter(v=>v.variable===d.symbol&&Object.keys(c.conditions).length===2&&
        Number(c.conditions[v.variable])===v.setting&&Number(c.conditions[v.group])===v.groupValue);
      if(values.length===1)d.reported={page:t.page,printed:values[0].printed,region:values[0].region};
    }
  }
  function explicitSides(text){
    const assignments=[];
    // Keep each explicit attribution in its own panel, including clauses
    // joined by a comma. A right axis alone gives no meaning to its values.
    const clauses=text.replace(/^(?:fig(?:ure)?\.?)\s*[a-z]?\d+\s*[:.|-]?\s*/i,'').split(/(?<=[.!?])\s+(?=[A-Z])|[,;]|\s+and\s+(?=[^(),;.]{1,80}\((?:left|right)\b)/i);
    let panel='';
    for(const part of clauses){
      const clause=part.trim();
      const marker=[...clause.matchAll(/\bpanel\s*\(([a-z])\)/gi)].at(-1);
      if(marker)panel=marker[1].toUpperCase();
      const match=clause.match(/(?:^|\.\s+)(?:the\s+)?([\p{L}][\p{L}\s-]{0,64}?)\s+(?:uses?|reads?\s+off|(?:is|are)\s+(?:plotted|shown|read)\s+(?:on|against|using))\s+(?:the\s+)?(right|left)(?:[- ]hand)?\s+(?:y[- ]?)?axis\b/iu);
      if(match)assignments.push({panel,what:match[1].trim(),side:match[2].toLowerCase()});
      else{
        const named=clause.match(/^(?:the\s+)?([^():;.!?]{2,104}?)\s*\((left|right)(?:[- ]hand)?\s+(?:y[- ]?)?axis\)(?=\s*(?:$|[.:]))/i);
        if(named)assignments.push({panel,what:named[1].trim(),side:named[2].toLowerCase()});
      }
    }
    return assignments.filter(a=>assignments.filter(b=>b.panel===a.panel).length===2&&assignments.some(b=>b.panel===a.panel&&b.side!==a.side));
  }
  function describe(what){
    const known={likelihood:'似然', 'all other curves':'其余各条曲线',density:'密度',frequency:'频数',temperature:'温度',pressure:'压力'};
    if(known[what.toLowerCase()])return known[what.toLowerCase()];
    const level=what.match(/^(?:level of (?:the )?)?([a-z][\w-]*) index$/i);
    if(level)return level[1]+' 指数的水平';
    const complement=what.match(/^(?:the )?complement to 1 of the smoothed ([\w-]+) index$/i);
    if(complement)return '1 减去平滑后的 '+complement[1]+' 指数';
    return what;
  }
  window.DualAxis={atom,measure,readTables,attach,explicitSides,describe};
})();
