(() => {
  'use strict';
  const clean=text=>String(text||'').normalize('NFKC').replace(/[-‐‑]\s+(?=treated\b)/gi,'-').replace(/(\p{L})-\s+(\p{Ll})/gu,'$1$2').replace(/\s+/g,' ').trim();
  function sentences(text){
    return clean(text).split(/(?<=[!?。！？])\s*|(?<=\.)\s+(?=[A-Z(])/u).filter(Boolean);
  }
  function groupedParts(caption){
    // An A–C) description can itself contain (A), (B) and (C) as references.
    // Reserve the entire grouped statement before looking for individual captions.
    const capitals=[...caption.matchAll(/(?:^|(?<=[.:;。；：])\s*)\(?([A-T])(?:\s*[-–—]\s*([A-T]))?\)?\s+(?=[A-Z(\d])/g)];
    const ordered=new Map(),shared=new Map();
    let next=65;
    for(const [i,m] of capitals.entries()){
      const first=m[1].charCodeAt(0),last=(m[2]||m[1]).charCodeAt(0);
      if(first!==next||last<first)break;
      const text=clean(caption.slice(m.index+m[0].length,capitals[i+1]?.index));
      if(!text)break;
      for(let n=first;n<=last;n++){
        const id=String.fromCharCode(n).toLowerCase();
        if(last>first)shared.set(id,{label:m[1]+'–'+m[2],text});
        else ordered.set(id,text);
      }
      next=last+1;
    }
    if(next>=67&&ordered.size+shared.size===next-65&&capitals.length===ordered.size+new Set([...shared.values()].map(v=>v.label)).size)
      return {groups:shared,explicit:ordered,individual:caption};
    const headers=[...caption.matchAll(/(?:^|[.:;。；：]\s*)\(?([a-z])(?:\)?\s*([-–—]|and|和|,|、)\s*\(?([a-z]))?\)\s*(?=[\p{L}\d])/giu)];
    const groups=new Map(), masked=caption.split('');
    for(const [i,h] of headers.entries()){
      if(!h[3])continue;
      const a=h[1].toLowerCase(),b=h[3].toLowerCase(),range=/[-–—]/.test(h[2]);
      if(b<=a)continue;
      const ids=range?Array.from({length:b.charCodeAt(0)-a.charCodeAt(0)+1},(_,n)=>String.fromCharCode(a.charCodeAt(0)+n)):[a,b];
      const end=headers[i+1]?.index??caption.length;
      const text=clean(caption.slice(h.index+h[0].length,end));
      const label=range?(a+'–'+b).toUpperCase():ids.join(', ').toUpperCase();
      if(text)for(const id of ids)groups.set(id,{label,text});
      masked.fill(' ',h.index,end);
      masked[h.index]='.';
    }
    // A bare-letter caption can name two intervening panels in one sentence,
    // e.g. “Signals for red (c) and blue (d) were measured.” Keep that sentence shared.
    const bare=[...caption.matchAll(/(?:^|[.。；;:：]\s*)([a-z])\s+(?=[A-Z\p{Script=Han}])/gu)].map(m=>m[1]);
    if(bare[0]==='a'&&bare[1]==='b'){
      for(const m of masked.join('').matchAll(/(?:^|(?<=[.。]))\s*[^.。]*?\([a-z]\)[^.。]*[.。]/g)){
        const ids=[...new Set([...m[0].matchAll(/\(([a-z])\)/g)].map(p=>p[1]))];
        if(ids.length<2||ids.some(id=>bare.includes(id)||groups.has(id)))continue;
        const group={label:ids.join(', ').toUpperCase(),text:clean(m[0])};
        for(const id of ids)groups.set(id,group);
        masked.fill(' ',m.index,m.index+m[0].length);masked[m.index+m[0].length-1]='.';
      }
    }
    return {groups,individual:masked.join('')};
  }
  function panelParts(caption,groups){
    const after=[...caption.matchAll(/(?<!\bas )\bin\s*\(\s*([a-z])\s*\)(?=[,.;]|$)/gi)];
    if(after.length>=2&&after.every((m,i)=>m[1].toLowerCase()===String.fromCharCode(97+i))&&after.slice(1).every((m,i)=>/^\s*[,;]/.test(caption.slice(after[i].index+after[i][0].length,m.index)))){
      const parts=new Map();
      for(const [i,m] of after.entries()){
        const start=i?after[i-1].index+after[i-1][0].length:0;
        const clause=caption.slice(start,m.index+m[0].length).replace(/^[,;]\s*(?:(?:as well as|and)\s+)?/i,'');
        parts.set(m[1].toLowerCase(),(i?clause:clause.split(/(?<=\.)\s+(?=[A-Z])/).at(-1)).trim());
      }
      return parts;
    }
    const bare=[...caption.matchAll(/(?:^|[.。；;:：]\s*)([a-z])\s+(?=[A-Z\p{Script=Han}])/gu)];
    const ids=new Set([...bare.map(m=>m[1]),...groups.keys()]);
    const hasSeries=bare.length>=2&&bare[0][1]==='a'&&bare.every((m,i)=>!i||m[1]>bare[i-1][1])&&
      [...ids].sort().every((id,i)=>id===String.fromCharCode(97+i));
    const tokens=hasSeries?bare:[...caption.matchAll(/(?:^|[.。;:]\s*|\s)\(([a-z])\)\s*|(?:^|[.;:。；：]\s*)([a-z])(?:[),、]\s+|\.\s+(?=[A-Z]))/gi)]
      .filter(m=>!(m[0].startsWith('.')&&/^\.[a-z]\./i.test(m[0])&&/\b[a-z]$/i.test(caption.slice(0,m.index))));
    const parts=new Map();
    for(let i=0;i<tokens.length;i++){
      const t=tokens[i], id=(t[1]||t[2]).toLowerCase();
      if(parts.has(id) || (t.index>0 && /(?:as in|same as|panels?|see|and|and in)\s*$/i.test(caption.slice(0,t.index))))continue;
      const next=tokens.slice(i+1).find(n=>!/(?:as in|same as|panels?|see|and|and in)\s*$/i.test(caption.slice(0,n.index)));
      const part=clean(caption.slice(t.index+t[0].length,next?.index??caption.length).split(/\([a-z]\s*(?:[-–—,]|and\b)\s*[a-z](?:\s*,\s*[a-z])*\)/i)[0]);
      if(part.length>4&&!/^(?:and\b|[–—-]|和|、)/i.test(part)&& !/(?:\([a-z]\)\s*(?:and|or|[–—-])\s*)$/i.test(caption.slice(0,t.index)))parts.set(id,part);
    }
    return parts;
  }
  // A PDF text stream may splice the next caption into a body paragraph.
  // Check against the headings actually printed on that page before citing the sentence.
  function bodySentenceCheck(figures){
    const compact=s=>clean(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
    const starts=new Map();
    for(const f of figures){
      const cap=compact(f.caption),page=f.captionPage||f.page;
      if(cap.length<22)continue;
      if(!starts.has(page))starts.set(page,[]);
      starts.get(page).push(cap.slice(0,32));
    }
    return (sentence,page)=>{
      const headings=starts.get(page);
      if(!headings)return true;
      const text=compact(sentence);
      return !headings.some(h=>text.includes(h));
    };
  }
  function enrich(item,paper,session){
    const rows=item.model.rows;
    const front=clean(rows.filter(r=>r.page===1).map(r=>r.text).join(' '));
    const abstract=front.split(/(?:^|\s)(?:abstract|摘要)\s*[:：]?\s*/i)[1]?.split(/\bkeywords\b|\bintroduction\b|关键词/i)[0] || '';
    paper.title=(session.documentTitle||item.name||paper.title||'').replace(/\.pdf$/i,'').trim();
    const checked=paper.curated?{zh:paper.question,en:paper.questionEnglish,supportPatterns:paper.questionSources}:undefined;
    paper.centralQuestion=ReadingMapData.paperQuestion({rows,title:paper.title,review:PaperFigureContext.isReview(rows),checked,titleConfirmed:!!session.documentTitle});
    paper.rootLabel=paper.centralQuestion.text;
    paper.rootKind='核心科学问题';
    paper.question=paper.centralQuestion.zh||paper.centralQuestion.text;
    paper.questionEnglish=paper.centralQuestion.en||'';
    const arxiv=PaperFigureContext.arxivID(front);
    const imprint=front.split(/\babstract\b|摘要/i)[0];
    const doi=imprint.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/|\bdoi\s*:\s*)(10\.\d{4,9}\/[-.\w();/:]+)/i);
    paper.identifier=arxiv?'arxiv:'+arxiv.replace(/v\d+$/,''):doi?'doi:'+doi[1].replace(/[.,;]+$/,'').toLowerCase():'';
    paper.publicUrl=arxiv?'https://arxiv.org/pdf/'+arxiv:doi?'https://doi.org/'+doi[1].replace(/[.,;]+$/,''):'';
    const refStart=rows.findIndex(r=>/^(?:references|bibliography|参考文献)$/i.test(clean(r.text)));
    const back=refStart<0?[]:rows.slice(refStart+1);
    const end=back.findIndex(r=>/^(?:appendix\b|supplementary (?:information|materials)|supporting information|附录)/i.test(clean(r.text)));
    paper.bibliography=clean((end<0?back:back.slice(0,end)).map(r=>r.text).join(' ')).slice(0,130000);
    const numberedRefs=new Map();
    let ref=null;
    for(const r of (end<0?back:back.slice(0,end))){
      const line=clean(r.text),m=line.match(/^(?:\[(\d{1,3})\]|(\d{1,3})\.)\s+(.+)/);
      if(m){ref={number:m[1]||m[2],page:r.page,text:m[3]};numberedRefs.set(ref.number,ref)}
      else if(ref&&line&&!r.heading&&ref.text.length<650)ref.text+=' '+line;
    }
    const designContext=StudyDesignReading.studyContext(abstract);
    const bodySentence=bodySentenceCheck(paper.figures);
    for(const f of paper.figures){
      f.designContext=designContext;
      if(f.openHistogram)f.binningEvidence=BinningReading.documentEvidence(f,refStart<0?rows:rows.slice(0,refStart));
      const cap=clean(f.caption);
      const {groups,individual,explicit:markedParts}=groupedParts(cap);
      const parts=markedParts||panelParts(individual,groups);
      // Printed runs also cover captions with no punctuation between panels and
      // lower-case pairs such as “b, c”. Preserve the entire paragraph for selection.
      const sections=globalThis.CaptionFlow?.panelSections(cap);
      for(const [id,s] of sections||[]){
        if(s.ids.length>1){
          parts.delete(id);
          groups.set(id,{label:s.ids.join(', ').toUpperCase(),text:s.text,specific:s.specific});
        }
        else if(!groups.has(id))parts.set(id,s.text);
      }
      const found=new Set(f.panels.map(p=>p.id));
      const explicit=new Set([...groups.keys(),...parts.keys()]);
      const captionSequence=explicit.has('a')&&explicit.has('b');
      for(const id of explicit){
        if(captionSequence&&!found.has(id)&&
          (id==='a'||explicit.has(String.fromCharCode(id.charCodeAt(0)-1))))f.panels.push({id,label:id.toUpperCase(),page:f.captionPage||f.page});
      }
      if(f.panels.length>found.size&&f.panels.every(p=>/^[a-z]$/.test(p.id)))f.panels.sort((a,b)=>a.id.localeCompare(b.id));
      for(const p of f.panels){
        p.groupCaption=groups.get(p.id);
        const part=parts.get(p.id);
        if(p.groupCaption)p.captionPart=undefined;
        else if(part)p.captionPart=part;
        if(part&&!paper.curated){
          p.text=part;p.title=p.title&&!/^分图 /.test(p.title)?p.title:'图注原文';
          p.boundary=p.region?'边界按原页标签估计，可校正。':'图注有该标签，图像范围待框选。';
        }
      }
      // Keep complete source sentences from paragraphs which actually mention this figure.
      const direct=[],joint=[],seenText=new Set();
      const linked=s=>window.PaperLiterature.figureMentions(s).includes(f.matchKey);
      for(let i=0;i<(refStart<0?rows.length:refStart);i++){
        const row=rows[i];
        if(row.fig||!row.mentions?.includes(f.matchKey))continue;
        for(const s of PaperPanelReading.sourceSentences(rows,i)){
          if(s.length<30||seenText.has(s)||!linked(s)||!bodySentence(s,row.page))continue;
          seenText.add(s);
          const ids=PaperLiterature.figureMentions(s).filter(k=>/^F:(?:S|ED)?\d+$/.test(k));
          if(ids.length>1){if(joint.length<3)joint.push({text:s,page:row.page,shared:ids})}
          else direct.push({text:s,page:row.page});
        }
        if(direct.length>=3)break;
      }
      const hits=[...direct,...joint].slice(0,3);
      f.authorPassages=hits;
      // Look in the same Results passage as the figure citation. A purpose
      // statement often precedes the sentence citing the figure by several lines.
      const aims=[];
      for(let i=0;i<(refStart<0?rows.length:refStart)&&aims.length<2;i++){
        const row=rows[i];
        if(row.fig||!row.mentions?.includes(f.matchKey))continue;
        let start=i,end=i;
        while(start>0&&i-start<8&&rows[start-1].page===row.page&&!rows[start-1].heading&&!rows[start-1].fig&&
          !rows[start-1].mentions?.some(key=>key.startsWith('F:')&&key.replace(/(?<=\d)[A-Z]$/,'')!==f.matchKey))start--;
        while(end+1<rows.length&&end-i<5&&rows[end+1].page===row.page&&!rows[end+1].heading&&!rows[end+1].fig)end++;
        const statements=sentences(rows.slice(start,end+1).map(v=>v.text).join(' ')).filter(s=>bodySentence(s,row.page));
        const cited=statements.findIndex(linked);
        if(cited<0)continue;
        const nearby=statements.slice(Math.max(0,cited-1),cited+1).join(' ');
        const why=nearby.match(/(?:\bTo (?:assess|evaluate|determine|examine|test|investigate|compare|establish|distinguish|verify|validate)\b[^.!?]{8,260},\s*we\b[^.!?]{6,320}[.!?]|(?:为了|为检验|为评估)[^。]{10,220}。)/i)?.[0];
        if(why&&!aims.some(a=>a.text===why))aims.push({page:row.page,text:why});
      }
      if(f.checkedIsolateTable){
        const onPage=clean(rows.filter(r=>r.page===f.page&&!r.fig).map(r=>r.text).join(' '));
        // Verified against this edition, Results p.2 and bibliography p.12.
        const phrase=onPage.match(/To evaluate abaucin.{0,12}s antibacterial spectrum.{20,300}?patients\./i);
        if(phrase)aims.unshift({page:f.page,text:phrase[0]});
      }
      f.questionAims=aims.slice(0,2);
      const citations=[];
      const contexts=[...aims,...hits,...sentences(cap).map(text=>({text,page:f.captionPage||f.page}))];
      for(const h of contexts){
        // Accept bracketed bibliographic numbers, explicit superscripts and named references.
        const nums=new Set();
        for(const m of h.text.matchAll(/\[([\d\s,–-]{1,30})\]|\bet al\.\s*(\d{1,3})(?!\d)|([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,3})/g)){
          const group=m[1]||m[2]||m[3].normalize('NFKC');
          for(const token of group.split(',')){
            const range=token.trim().match(/^(\d{1,3})(?:\s*[–-]\s*(\d{1,3}))?$/);
            if(!range)continue;
            const lo=Number(range[1]),hi=Number(range[2]||lo);
            if(hi<lo||hi-lo>20)continue;
            for(let n=lo;n<=hi;n++)nums.add(String(n));
          }
        }
        for(const n of nums){
          const ref=numberedRefs.get(n);
          if(ref&&!citations.some(c=>c.number===ref.number))citations.push({...ref,context:h});
        }
      }
      f.questionCitations=citations.slice(0,3);
      const finding=hits.find(h=>/\b(?:we (?:found|observed|show|find)|was (?:higher|lower)|increased|decreased|outperform\w*|correlated|yielded|produced|similar to)\b|高于|低于|观察到|发现/iu.test(h.text));
      if(finding && !paper.curated){f.branchTitle=finding.text;f.findingPage=finding.page}
      const body=cap.replace(/^.*?\d+\s*[:.|：]?\s*/,'');
      const statements=sentences(body);
      const measurement=statements.find(s=>/\b(measur\w+|assay\w*|quantif\w+|recorded|sampled|counted|signal|accuracy|recall|concentration|expression|embeddings? of|error rate|proportion)\b|测定|测量|检测|采样|计数/i.test(s));
      const comparison=statements.find(s=>/\b(compared?|versus|vs\.|in contrast|controls?|conditions?|between|with and without|time points?)\b|对照|比较|不同时间/i.test(s));
      f.readouts={measurement,comparison};
      if(!paper.curated && cap){
        f.summary=clean(cap.replace(/^.*?\d+\s*[:.|：]?\s*/, '')).slice(0,470);
        f.boundary='';
      }
      const panelBody=PaperPanelReading.passages(rows,f,bodySentence);
      for(const p of f.panels)p.reading=PaperPanelReading.build(f,p,parts.get(p.id)||p.captionPart,panelBody.get(p.id));
      MarkedPlots.enrich(f,rows);
      if(f.layerStack)StackedPlots.enrich(f,rows);
      if(f.curveChart)CurveReading.enrich(f,rows);
      if(f.captionRows)ResidualReading.resolve(f,rows);
    }
  }
  window.PaperReadingEvidence={enrich};
})();
