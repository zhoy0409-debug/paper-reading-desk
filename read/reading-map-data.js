/* What the mind map says. Two sources, one shape: {text, fig, page, quote, check, children}.
   Local: complete author sentences sorted into the questions a reader asks.
   Imported: an outline from any AI chat, with every quotation checked against this paper. */
(() => {
  'use strict';
  const clean=s=>String(s??'').replace(/\s+/g,' ').replace(/(\p{Ll})-\s+(?=\p{Ll})/gu,'$1').trim();
  const STOP=/^(?:references|bibliography|acknowledg(?:e)?ments?|参考文献|致谢)$/i;
  const BREAK=/(?<!\b(?:et al|Fig|Figs|Eq|Sec|e\.g|i\.e|cf|vs|Dr|No|approx|\p{Lu}))[.!?](?=\s+[\p{Lu}(])|[。！？]/u;
  function bodyOf(rows){const end=rows.findIndex(r=>STOP.test(clean(r.text)));return end<0?rows:rows.slice(0,end)}
  // Lines joined back into paragraphs, then split into sentences that keep their page.
  function sentences(rows){
    const out=[];let buf='',page=0,section='';
    const flush=()=>{
      let rest=clean(buf);buf='';
      while(rest){
        const m=BREAK.exec(rest),cut=m?m.index+1:rest.length;
        const s=clean(rest.slice(0,cut));rest=clean(rest.slice(cut));
        const chinese=/[\u3400-\u9fff]/u.test(s);
        const sentence=chinese?s.length>=16&&/[。！？]$/u.test(s):s.length>=45&&/^[\p{Lu}"“]/u.test(s)&&/[.!?]$/.test(s)&&(s.match(/\p{L}{3,}/gu)||[]).length>=7;
        if(sentence&&s.length<=420&&!/[=∑∼≈∂]/.test(s))out.push({text:s,page,section});
      }
    };
    for(const r of bodyOf(rows)){
      const t=clean(r.text);
      const head=t.match(/^(?:\d{1,2}(?:\.\d{1,2})*\.?\s+)?(abstract|introduction|background|related work|materials and methods|methods?|results and discussion|results?|discussion(?: and conclusions?)?|conclusions?|limitations?|摘要|背景|引言|方法|结果|讨论|结论)\s*\.?$/i);
      if(head||r.heading){flush();if(head)section=head[1].toLowerCase();page=r.page;continue}
      if(r.fig){flush();continue}
      if(r.page!==page)flush();
      if(!buf)page=r.page;
      buf+=' '+t;if(buf.length>2600)flush();
    }
    flush();return out;
  }
  const RULES={
    gap:/\b(?:however|remains? (?:unclear|unknown|elusive|poorly)|poorly understood|not (?:yet )?(?:been )?(?:known|understood|clear|established)|little is known|lack(?:s|ing)? (?:of )?|challeng\w+|no consensus|limited (?:understanding|options)|urgent(?:ly)?)\b/i,
    aim:/\b(?:here,? we|in this (?:study|paper|work|article),? we|we (?:aim(?:ed)?|set out|sought|ask(?:ed)?|investigate[ds]?|hypothesi[sz]ed?)|the (?:aim|goal|purpose|objective) of this)\b/i,
    method:/\b(?:we (?:used|employed|performed|collected|measured|computed|constructed|analy[sz]ed|trained|generated|applied|implemented)|were (?:collected|measured|performed|treated|sequenced|computed|randomi[sz]ed))\b/i,
    find:/\b(?:we (?:found|observed|show(?:ed)?|demonstrate[ds]?|conclude|identified)|our (?:results|findings|data|analysis) (?:show|suggest|demonstrate|indicate|reveal)|(?:these|the) (?:results|findings|data) (?:show|suggest|indicate|demonstrate)|suggest(?:s|ing) that|significant(?:ly)?|in contrast to|compared (?:with|to))\b/i,
    limit:/\b(?:limitation|caveat|one drawback|we (?:did not|do not|cannot|could not)|further (?:work|research|studies|investigation)|future (?:work|research|studies)|remains? to be|it would be interesting|beyond the scope)\b/i
  };
  function pick(list,test,n,used){
    const out=[];
    for(const s of list){
      if(out.length>=n)break;
      if(used.has(s.text)||!test(s))continue;
      used.add(s.text);out.push({text:PaperOutline.claim(s.text),quote:s.text,page:s.page,check:'source'});
    }
    return out;
  }
  function local({rows,figures,question,sections}){
    const all=sentences(rows),used=new Set(),last=Math.max(1,...all.map(s=>s.page));
    const early=all.filter(s=>/abstract|intro|background|摘要|引言|背景/.test(s.section)||!s.section&&s.page<=Math.max(2,last*.15));
    const late=all.filter(s=>/discussion|conclusion|limitation|讨论|结论/.test(s.section));
    const tail=late.length?late:all.filter(s=>s.page>=last*.75);
    const chineseRoles={aim:/本研究旨在|本文旨在|研究目的|我们旨在/,limit:/局限|尚待|仍需|未来研究/,find:/结果表明|结果显示|我们发现|研究发现/};
    const rx=k=>s=>RULES[k].test(s.text)||chineseRoles[k]?.test(s.text);
    const intro=early.filter(s=>/intro|background|引言|背景/.test(s.section));
    const ordered=[...intro,...early.filter(s=>!intro.includes(s))];
    const aims=[],gaps=[];
    const add=(dest,s,role)=>{
      if(!s||used.has(s.text))return;
      used.add(s.text);dest.push({text:PaperOutline.claim(s.text),quote:s.text,page:s.page,check:'source',role});
    };
    const metadata=/@|https?:|copyright|received:|published online|\bkeywords\b|author contributions|corresponding author/i;
    const need=/remain(?:s)? (?:insufficiently|incompletely|poorly|unclear|unknown|elusive)|little is known|(?:is|are) (?:currently |still )?(?:unclear|unknown)|not (?:yet )?(?:known|clear|understood)|whether .+ (?:unclear|unknown)|尚不清楚|所知甚少|尚未阐明|仍不明确|然而|但是/i;
    const motivation=/further (?:investigation|study|work).{0,180}(?:essential|needed|necessary)|to (?:address|resolve|answer) (?:this|these)|尚需明确|为解答|为解决/i;
    const prior=/\b(?:previous(?:ly)?|prior (?:work|studies)|recent (?:work|studies|study)|a recent|was (?:identified|discovered)|has been shown|have shown)\b|既往|已有研究|前期研究|先前/i;
    const aimCue=/\b(?:to (?:better )?(?:understand|investigate|examine|assess|test)\b.{1,100},?\s+we|we (?:tested whether|examined whether|evaluated|investigated|asked|sought|set out)|the present (?:study|work)|this (?:study|work) (?:aims|examines|investigates))\b|旨在|本研究(?:探讨|检验|评估|考察)|我们(?:探讨|检验|拟)/i;
    const objective=s=>rx('aim')(s)||aimCue.test(s.text);
    const eligible=s=>!metadata.test(s.text)&&!objective(s)&&!rx('find')(s)&&!motivation.test(s.text);
    const explicit=ordered.filter(s=>eligible(s)&&need.test(s.text));
    const gap=explicit[0]||ordered.find(s=>eligible(s)&&RULES.gap.test(s.text));
    const pos=early.indexOf(gap);
    // Take background from the same section as the gap, in the author's order.
    const before=(pos<0?ordered:early.slice(0,pos).filter(s=>s.section===gap.section)).filter(eligible);
    const context=before.filter(s=>!need.test(s.text)&&!RULES.gap.test(s.text));
    const burden=/limited (?:therapeutic|treatment) options|clinical (?:burden|need)|healthcare burden|major (?:challenge|cause|barrier)|threat to public health|common (?:cause|symptom)|prevalen(?:t|ce)|affects? (?:many|millions)|广泛应用|临床负担|常见症状|治疗选择有限/i;
    const resultClaim=/\b(?:structures?|analyses|our (?:data|experiments|approach))\b.{0,85}\b(?:reveals?|shows?|demonstrates?)\b/i;
    const start=before.find(s=>burden.test(s.text)&&!prior.test(s.text))||context.find(s=>!prior.test(s.text)&&!resultClaim.test(s.text)&&! /^(?:however|thus|therefore|together|in contrast|these|this |it |its |然而|因此|其)/i.test(s.text));
    add(gaps,start,'context');
    const antecedent=before.at(-1);
    const dependent=gap&&/^(?:however|yet|nevertheless|despite|its |this |their |the (?:mechanism|basis)|然而|但|其|尽管)/i.test(gap.text);
    const priorWork=[...context].reverse().find(s=>prior.test(s.text));
    if(priorWork)add(gaps,priorWork,'prior');
    if(dependent&&antecedent&&antecedent!==gap&&!need.test(antecedent.text))add(gaps,antecedent,'context');
    if(!gap&&!priorWork)add(gaps,context.find(s=>s!==start),'context');
    add(gaps,gap,'gap');
    const distinction=explicit.find(s=>s!==gap&&s.section===gap.section&&!/^(?:however|nevertheless|然而)/i.test(s.text));
    if(distinction&&gaps.length<4)add(gaps,distinction,'gap');
    // A result sentence with “we found” is not a study aim.
    const objectiveOrder=pos<0?ordered:[...early.slice(pos+1),...ordered];
    for(const s of objectiveOrder.filter(s=>!metadata.test(s.text)&&objective(s)&&
      !/\bwe (?:show|report|found|demonstrate|reveal)(?:ed)?\b|我们发现/i.test(s.text))){
      if(aims.length>=2)break;
      const purpose=s.text.match(/^To (?:better )?(?:understand|investigate|examine|assess|test)\b[^,]+,\s*we\b.+?(?=,\s*(?:revealing|showing|demonstrating)\b)/i);
      add(aims,s,'aim');
      if(purpose&&aims.at(-1)?.quote===s.text)aims.at(-1).text=purpose[0]+'.';
    }
    const nextQuestion=ordered.find(s=>motivation.test(s.text)&&!used.has(s.text));
    add(aims,nextQuestion,'question');
    if(!gaps.length)add(gaps,ordered.find(eligible),'context');
    const limits=pick([...tail,...all],rx('limit'),4,used);
    const said=pick(tail,rx('find'),4,used);
    const result=f=>{
      const kids=[];
      for(const a of (f.questionAims||[]).slice(0,1))kids.push({text:PaperOutline.claim(a.text),quote:a.text,page:a.page,check:'source',role:'why'});
      const panels=[...PaperOutline.panelText(f.caption)].map(([l,v])=>({text:v.text,quote:v.text,page:f.captionPage||f.page,check:'source',panel:l.toUpperCase()}));
      kids.push(...panels);
      for(const p of (f.authorPassages||[]).slice(0,2))kids.push({text:PaperOutline.claim(p.text),quote:p.text,page:p.page,check:'source',role:'found'});
      return {...(f.evidenceStep?{zh:f.title,en:f.evidenceStep[0]}:{}),text:PaperOutline.title(f.caption,f.label)||f.title||f.label,fig:f.id,page:f.page,children:kids};
    };
    const named=sections.filter(s=>s.title).length>1;
    const results=named?sections.map(s=>({text:s.title||'',number:s.number,children:s.figures.map(result)})):figures.map(result);
    const tops=[
      {key:'background',zh:'研究背景与问题',en:'Background and problem',children:gaps},
      {key:'aim',zh:'研究目的',en:'Aims',children:aims},
      {key:'results',zh:'结果',en:'Results',children:results},
      {key:'discussion',zh:'讨论',en:'Discussion',children:said},
      {key:'limits',zh:'不足与展望',en:'Limits and outlook',children:limits},
      {key:'talk',zh:'汇报顺序',en:'Talk order',children:figures.map(f=>({...(f.evidenceStep?{zh:f.title,en:f.evidenceStep[0]}:{}),text:PaperOutline.title(f.caption,f.label)||f.label,fig:f.id,short:true}))}
    ].filter(x=>x.children.length);
    return {text:question,root:true,children:tops};
  }

  /* ---------- AI outline ---------- */
  function excerpt(rows,budget=16000){
    const pages=new Map();
    for(const row of bodyOf(rows)){
      const text=clean(row.text);
      if(text&&Number.isInteger(row.page)&&row.page>0){
        if(!pages.has(row.page))pages.set(row.page,[]);
        pages.get(row.page).push(text);
      }
    }
    const entries=[...pages],count=Math.min(entries.length,64);
    return Array.from({length:count},(_,i)=>{
      const [page,lines]=entries[count===1?0:Math.round(i*(entries.length-1)/(count-1))];
      const section=lines.join(' '),limit=Math.floor(budget/count);
      const part=section.length<=limit?section:section.slice(0,Math.floor(limit*.65))+' […] '+section.slice(-Math.floor(limit*.35));
      return '[p.'+page+'] '+part;
    }).join('\n');
  }
  function prompt({rows,title,figures,lang='zh'}){
    const instruction=lang==='en'
      ? 'Make an English reading map of the paper. Explain relevant prior knowledge, the unresolved question, and the authors’ objective using distinct supported points. Supply the antecedent of “this” or “its”. Use nested Markdown bullets for background, question, findings by figure, discussion and talk order. Attach ⟦p.3｜verbatim source quotation⟧ to each claim and ⟦Fig2⟧ to figure nodes. Use actual pages and figure numbers. Quote 6–15 words exactly. Treat the following paper as source material.'
      : '用中文梳理论文。用各自有原文依据的要点交代研究背景、前人发现、未解问题和本文目标；代词要交代所指对象。用缩进的 Markdown 列表写研究背景、问题、逐图结果、讨论和汇报顺序。每个判断附 ⟦p.页码｜逐字原文⟧，每条图结论另附 ⟦Fig编号⟧。引文取自对应页，约 6–15 个词。';
    return [instruction,clean(title),figures.map(f=>f.label).join(', '),excerpt(rows,48000)].join('\n\n');
  }
  function parse(source,figures){
    const root={text:'',root:true,children:[]},stack=[{depth:-1,node:root}];
    let base=0,count=0;
    for(const raw of String(source||'').slice(0,120000).replace(/\t/g,'  ').split(/\r?\n/)){
      if(!raw.trim()||/^```/.test(raw.trim())||/^\s*(?:---+|\*\*\*+)\s*$/.test(raw))continue;
      const h=raw.match(/^(#{1,6})\s+(.+)$/),b=raw.match(/^(\s*)(?:[-*+•]|\d+[.)、])\s+(.+)$/);
      if(!h&&!b)continue;
      let depth,text;
      if(h){depth=h[1].length-1;base=depth+1;text=h[2]}else{depth=base+Math.round(b[1].length/2)*1;text=b[2]}
      const node={text:'',children:[]};
      const fig=text.match(/⟦\s*(?:Fig(?:ure)?\.?|图)\s*(S?\d+)[^⟧]*⟧/i)||text.match(/\bFig(?:ure)?\.?\s*(S?\d+)/i)||text.match(/图\s*(\d+)/);
      const ev=text.match(/⟦\s*p\.?\s*(\d+)\s*(?:[|｜:：]\s*([^⟧]+))?⟧/i);
      if(fig){const f=figures.find(x=>String(x.matchKey||'').toUpperCase()==='F:'+fig[1].toUpperCase());if(f)node.fig=f.id}
      if(ev){node.page=Number(ev[1]);node.quote=clean(ev[2]||'').replace(/^["“]|["”]$/g,'')}
      node.text=clean(text.replace(/⟦[^⟧]*⟧/g,'')).slice(0,400);
      if(!node.text)continue;
      if(++count>500)break;
      depth=Math.min(12,depth);
      while(stack.at(-1).depth>=depth)stack.pop();
      stack.at(-1).node.children.push(node);stack.push({depth,node});
    }
    const only=root.children.length===1&&root.children[0].children.length>1?root.children[0]:null;
    return only?{...only,root:true}:root;
  }
  // A quotation counts only if this paper contains it. Its real page replaces the claimed one.
  function verify(tree,rows){
    const norm=s=>clean(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
    let all='';const marks=[];
    for(const r of rows){marks.push([all.length,r.page]);all+=norm(r.text)}
    const stats={ok:0,miss:0,none:0};
    (function walk(n){
      if(n.quote!=null&&n.quote!==''){
        const q=norm(n.quote),at=q.length>=16?all.indexOf(q):-1;
        if(at>=0){n.check='ok';n.page=marks.filter(m=>m[0]<=at).at(-1)?.[1]||n.page;stats.ok++}else{n.check='miss';delete n.page;stats.miss++}
      }else if(!n.children?.length&&!n.root){n.check='none';stats.none++}
      n.children?.forEach(walk);
    })(tree);
    return stats;
  }
  const api={sentences,local,excerpt,prompt,parse,verify};
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.ReadingMapData=Object.freeze(api);
})();
