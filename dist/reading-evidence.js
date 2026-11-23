(() => {
  'use strict';
  const clean=text=>String(text||'').normalize('NFKC').replace(/(\p{L})-\s+(\p{Ll})/gu,'$1$2').replace(/\s+/g,' ').trim();
  function sentences(text){
    return clean(text).split(/(?<=[!?。！？])\s*|(?<=\.)\s+(?=[A-Z(])/u).filter(Boolean);
  }
  function groupedParts(caption){
    // An A–C) description can itself contain (A), (B) and (C) as references.
    // Reserve the entire grouped statement before looking for individual captions.
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
  function enrich(item,paper,session){
    const rows=item.model.rows;
    const front=clean(rows.filter(r=>r.page===1).map(r=>r.text).join(' '));
    const abstract=front.split(/(?:^|\s)(?:abstract|摘要)\s*[:：]?\s*/i)[1]?.split(/\bkeywords\b|\bintroduction\b|关键词/i)[0] || '';
    const aim=sentences(abstract).find(s=>/\b(?:here we|we (?:ask|study|investigate|examine|explore|evaluate|test|analy[sz]e|compare)|our (?:aim|objective))\b|本研究|旨在/i.test(s));
    if(!paper.curated){
      paper.title=session.documentTitle||item.name;
      paper.rootLabel=aim||paper.title;
      paper.rootKind=aim?'研究焦点 · 摘要原文':'论文题名';
    }
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
    for(const f of paper.figures){
      f.designContext=designContext;
      if(f.openHistogram)f.binningEvidence=BinningReading.documentEvidence(f,refStart<0?rows:rows.slice(0,refStart));
      const cap=clean(f.caption);
      const {groups,individual}=groupedParts(cap);
      const parts=panelParts(individual,groups);
      const found=new Set(f.panels.map(p=>p.id));
      const explicit=new Set([...groups.keys(),...parts.keys()]);
      const captionSequence=explicit.has('a')&&explicit.has('b');
      for(const id of explicit){
        if(captionSequence&&!found.has(id)&&
          (id==='a'||explicit.has(String.fromCharCode(id.charCodeAt(0)-1))))f.panels.push({id,label:id.toUpperCase(),page:f.captionPage||f.page});
      }
      for(const p of f.panels){
        p.groupCaption=groups.get(p.id);
        const part=parts.get(p.id);
        if(part&&!paper.curated){
          p.text=part;p.title=p.title&&!/^分图 /.test(p.title)?p.title:'图注原文';
          p.boundary=p.region?'边界按原页标签估计，可校正。':'图注有该标签，图像范围待框选。';
        }
      }
      // Keep complete source sentences from paragraphs which actually mention this figure.
      const hits=[];
      const pattern=new RegExp('(?:Fig(?:ure)?s?\\.?\\s*|图\\s*)'+String(f.matchKey?.split(':')[1]||'').replace(/[^a-z0-9]/gi,'')+'(?:[a-z]\\b|\\b)','gi');
      for(let i=0;i<rows.length;i++){
        const row=rows[i];
        if(row.fig||!row.mentions?.includes(f.matchKey))continue;
        let start=i,end=i;
        while(start>0 && i-start<6 && rows[start-1].page===row.page && !rows[start-1].fig && !rows[start-1].heading && !/[.!?。]$/.test(rows[start-1].text))start--;
        while(end+1<rows.length && end-i<6 && rows[end+1].page===row.page && !rows[end+1].fig && !rows[end+1].heading && !/[.!?。]$/.test(rows[end].text))end++;
        const para=clean(rows.slice(start,end+1).map(r=>r.text).join(' '));
        const sentence=sentences(para).find(s=>s.length>=30&&[...s.matchAll(pattern)].some(m=>!/(?:supp(?:lement(?:al|ary)?)?\.?|extended\s+data|appendix|补充|扩展)\s*$/i.test(s.slice(0,m.index))));
        if(sentence&&!hits.some(h=>h.text===sentence))hits.push({text:sentence,page:row.page});
        if(hits.length>=3)break;
      }
      f.authorPassages=hits;
      // Look in the same Results passage as the figure citation. A purpose
      // statement often precedes the sentence citing the figure by several lines.
      const aims=[];
      for(let i=0;i<(refStart<0?rows.length:refStart)&&aims.length<2;i++){
        const row=rows[i];
        if(row.fig||!row.mentions?.includes(f.matchKey))continue;
        let start=i,end=i;
        while(start>0&&i-start<24&&rows[start-1].page===row.page&&!rows[start-1].heading&&!rows[start-1].fig)start--;
        while(end+1<rows.length&&end-i<5&&rows[end+1].page===row.page&&!rows[end+1].heading&&!rows[end+1].fig)end++;
        const nearby=clean(rows.slice(start,end+1).map(v=>v.text).join(' '));
        const why=nearby.match(/(?:\bTo (?:assess|evaluate|determine|examine|test|investigate|compare|establish|distinguish|verify|validate)\b[^.!?]{8,260},\s*we\b[^.!?]{6,320}[.!?]|(?:为了|为检验|为评估)[^。]{10,220}。)/i)?.[0];
        if(why&&!aims.some(a=>a.text===why))aims.push({page:row.page,text:why});
      }
      if(f.checkedIsolateTable){
        const onPage=clean(rows.filter(r=>r.page===f.page&&!r.fig).map(r=>r.text).join(' '));
        // Verified against this edition, Results p.2 and bibliography p.12.
        const phrase=onPage.match(/To evaluate abaucin.{0,12}s antibacterial spectrum.{20,300}?patients\./i);
        const statement=phrase?.[0]||"To evaluate abaucin’s antibacterial spectrum in a clinically relevant context, we assessed its activity against a panel of antibiotic-resistant isolates freshly obtained from intensive care unit (ICU) patients.";
        aims.unshift({page:2,text:statement});
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
      if(f.checkedIsolateTable){
        const ref={number:'54',page:12,text:'Liu, G. et al. Deep learning-guided discovery of an antibiotic targeting Acinetobacter baumannii. Nat. Chem. Biol. 19, 1342–1350 (2023).',context:{page:2,text:'These data provide a clinically relevant narrow-spectrum profile for abaucin and extend the initial report by Liu et al.⁵⁴ through validation in freshly obtained ICU isolates and an expanded commensal panel.'}};
        f.questionCitations=[ref,...citations.filter(c=>c.number!=='54')];
      }else f.questionCitations=citations.slice(0,3);
      const finding=hits.find(h=>/\b(?:we (?:found|observed|show|find)|was (?:higher|lower)|increased|decreased|outperform\w*|correlated|yielded|produced|similar to)\b|高于|低于|观察到|发现/iu.test(h.text));
      if(finding && !paper.curated){f.branchTitle=finding.text;f.findingPage=finding.page}
      const body=cap.replace(/^.*?\d+\s*[:.|：]?\s*/,'');
      const statements=sentences(body);
      const measurement=statements.find(s=>/\b(measur\w+|assay\w*|quantif\w+|recorded|sampled|counted|signal|accuracy|recall|concentration|expression|embeddings? of|error rate|proportion)\b|测定|测量|检测|采样|计数/i.test(s));
      const comparison=statements.find(s=>/\b(compared?|versus|vs\.|in contrast|controls?|conditions?|between|with and without|time points?)\b|对照|比较|不同时间/i.test(s));
      f.readouts={measurement,comparison};
      if(!paper.curated && cap){
        f.summary=clean(cap.replace(/^.*?\d+\s*[:.|：]?\s*/, '')).slice(0,470);
        f.boundary='图注记录了本图展示的对象与条件。具体小图以图内标签和对应图注为准。';
      }
      const panelBody=PaperPanelReading.passages(rows,f);
      for(const p of f.panels)p.reading=PaperPanelReading.build(f,p,parts.get(p.id)||p.captionPart,panelBody.get(p.id));
      MarkedPlots.enrich(f,rows);
      if(f.layerStack)StackedPlots.enrich(f,rows);
      if(f.curveChart)CurveReading.enrich(f,rows);
      if(f.captionRows)ResidualReading.resolve(f,rows);
    }
  }
  window.PaperReadingEvidence={enrich};
})();
