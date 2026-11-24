(function (global) {
  'use strict';
  const css = `
.ea{margin:0;padding:20px clamp(15px,3cqi,34px) 19px;background:#f5f3ee;border-bottom:1px solid #dedad1;position:relative}
.ea .ea-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.ea .ea-head h3{font-size:15px;letter-spacing:.03em;color:#32303b;font-weight:730}.ea .ea-head span{font-size:12px;color:#5d5766}
.ea-canvas{position:relative;isolation:isolate;display:grid;grid-template-columns:minmax(0,1fr) minmax(145px,.85fr) minmax(0,1fr);align-items:stretch;gap:10px clamp(25px,5cqi,65px);border:1px solid #dfdad3;border-radius:17px;background:radial-gradient(ellipse at 50% 45%,#ebf1ee,transparent 61%),#fbfaf7;padding:17px clamp(12px,3cqi,30px);overflow:hidden}
.ea-lines{position:absolute;inset:0;height:100%;width:100%;z-index:-1;pointer-events:none}.ea-lines path{stroke:#93a79e;stroke-width:1.2;fill:none;opacity:.75}.ea-lines path.ea-selected{stroke:#3c6352;stroke-width:2.6;opacity:1}
.ea-root,.ea .ea-node{display:grid;align-content:center;gap:3px;text-align:left;border:1px solid #ced8d3;border-radius:10px;background:#fffcfa;padding:10px 12px;min-width:0;overflow-wrap:anywhere}
.ea-root{background:#32453d;color:#fffdf9;box-shadow:0 5px 22px #30453c1a;border-color:#32453d;min-height:72px;align-self:center;grid-column:2;grid-row:1 / span 2}
.ea-root small,.ea-node small{font-size:11px;font-weight:700;letter-spacing:.06em}.ea-root strong{font-size:15px;line-height:1.35}
.ea-nodes{display:contents}
.ea .ea-node{grid-row:var(--ea-row);grid-column:var(--ea-col);min-height:61px;font-size:13px;line-height:1.33;color:#37323f;transition:background .16s,border-color .16s,box-shadow .16s}
.ea-node small{color:#456456}.ea .ea-node:hover{border-color:#698d7d;background:#f0f6f3}
.ea .ea-node[aria-pressed=true]{background:#e7f0eb;border-color:#587e6d;box-shadow:0 2px 8px #3c635214,inset 3px 0 #587e6d}
.ea .ea-node strong{font-size:13px;font-weight:690;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.ea .ea-toggle{border:0;background:transparent;color:#395247;text-decoration:underline;text-underline-offset:4px;min-height:44px;padding:0 4px;font-size:12px}
.ea .ea-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:12px;color:#5d5766}
.ea .ea-foot button{min-height:44px;padding:5px 12px;background:#fffefa;border:1px solid #ced8d3;border-radius:8px;color:#2f4e40;font-size:13px;white-space:nowrap}

.ea .ea-language-loading,.ea .ea-language-retry{display:none}
.ea:has(.ea-canvas [aria-busy=true]):not(:has(.ea-canvas [data-translation-retry])) .ea-language-loading{display:inline}
.ea:has(.ea-canvas [data-translation-retry]) .ea-language-retry{display:inline-flex;align-items:center;border:0;background:transparent;color:inherit;text-decoration:underline;text-underline-offset:.2em}
@container(max-width:650px){.ea-canvas{grid-template-columns:1fr;gap:13px;padding:12px}.ea-root{min-height:48px;grid-column:auto;grid-row:auto}.ea-nodes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ea .ea-node{grid-row:auto;grid-column:auto;min-height:55px}.ea .ea-foot{align-items:flex-start}.ea{padding-block:13px}}
@media(prefers-reduced-motion:reduce){.ea .ea-node{transition:none}}
`;
  const svgNS = 'http://www.w3.org/2000/svg';
  function inPaperOrder(figures){
    function key(f){
      const m=(f.raw?.matchKey||f.matchKey||'').match(/^F:(S|ED)?(\d+)([a-z]?)$/i)||
        (f.label||'').match(/^(?:Fig(?:ure)?\.?|图)\s*(S|ED)?(\d+)([a-z]?)$/i);
      return m?[m[1]?1:0,m[1]||'',Number(m[2]),m[3]||'']:[2,'',f.page||Infinity,''];
    }
    return [...figures].sort((a,b)=>{const x=key(a),y=key(b);return x[0]-y[0]||x[1].localeCompare(y[1])||x[2]-y[2]||x[3].localeCompare(y[3])||(a.page||0)-(b.page||0)});
  }
  function mount(host, opts) {
    const doc = host.ownerDocument;
    const el = (tag, val, cls) => {
      const node = doc.createElement(tag);
      if (cls) node.className = cls;
      if (val) node.textContent = val;
      return node;
    };
    const section = el('section', '', 'ea');
    section.setAttribute('aria-label', '论文图谱');
    const head = el('div', '', 'ea-head'), title = el('h3', '论文图谱');
    const toggle = el('button', '', 'ea-toggle');
    PaperUI.set(title,'论文图谱');
    toggle.type = 'button';
    const coverage=el('span','','ea-coverage');coverage.setAttribute('role','status');
    const explore=el('button','','ea-explore');explore.type='button';explore.setAttribute('aria-haspopup','dialog');
    PaperUI.set(explore,'展开探索','Explore map');head.append(title,coverage);
    const loading=el('span','正在生成中文导读…','ea-language-loading');loading.setAttribute('role','status');
    const retry=el('button','重新加载中文导读','ea-language-retry');retry.type='button';retry.onclick=()=>PaperLanguageText.retry();
    head.append(loading,retry,toggle,explore);
    const dialog=el('dialog','','ea-explorer');dialog.setAttribute('aria-label','篇内图谱探索 / Explore evidence map');
    const canvas = el('div', '', 'ea-canvas');
    const svg = doc.createElementNS(svgNS, 'svg');
    svg.setAttribute('class','ea-lines'); svg.setAttribute('aria-hidden','true');
    const root = el('div', '', 'ea-root');
    const tag = el('small'), topic = el('strong'), fullTopic=el('details');
    fullTopic.append(PaperUI.set(el('summary'),'读完整摘录','Full excerpt'),el('p'));
    root.append(tag, topic, fullTopic);
    const nodes = el('div', '', 'ea-nodes');
    canvas.append(svg, root, nodes);
    const foot = el('div', '', 'ea-foot');
    const description = el('span');
    const detail = el('button','查看所选原图 ↓');
    PaperUI.set(detail,'查看所选原图 ↓');
    detail.type = 'button';
    let goToFigure=false, returnToExplorer=false;
    function inspect(){returnToExplorer=dialog.open;if(dialog.open){goToFigure=true;dialog.close()}else opts.onDetail()}
    detail.addEventListener('click', inspect);
    foot.append(description, detail);
    section.append(el('style',css),head,canvas,foot,dialog);
    explore.onclick=()=>{
      if(dialog.open){dialog.close();return}
      dialog.append(head,canvas,foot);dialog.showModal();
      PaperUI.set(explore,'返回工作台','Back to reader');explore.focus({preventScroll:true});requestAnimationFrame(edges);
    };
    dialog.addEventListener('close',()=>{
      section.insertBefore(head,dialog);section.insertBefore(canvas,dialog);section.insertBefore(foot,dialog);
      PaperUI.set(explore,'展开探索','Explore map');requestAnimationFrame(edges);
      if(goToFigure){goToFigure=false;opts.onDetail()}else explore.focus({preventScroll:true});
    });
    host.append(section);
    let model = {figures:[]}, active = '', openId='', panelId='', expanded = false, keys = new Map();
    const limit = 4;
    function edges() {
      if (!keys.size) return;
      const box = canvas.getBoundingClientRect(), b = root.getBoundingClientRect();
      const vertical = getComputedStyle(canvas).gridTemplateColumns.trim().split(/\s+/).length < 2;
      svg.replaceChildren();
      for (const [id, node] of keys) {
        const c = node.getBoundingClientRect();
        const goesLeft = c.right < b.left;
        const x = (vertical ? (b.left + b.right)/2 : (goesLeft?b.left:b.right))-box.left;
        const y = (vertical ? b.bottom : (b.top + b.bottom)/2)-box.top;
        const endX = (vertical ? (c.left + c.right)/2 : (goesLeft?c.right:c.left))-box.left;
        const endY = (vertical ? c.top : (c.top + c.bottom)/2)-box.top;
        const p = doc.createElementNS(svgNS,'path');
        const midX = x+(endX-x)*.54, midY = y+(endY-y)*.52;
        p.setAttribute('d',vertical?`M ${x} ${y} C ${x} ${midY}, ${endX} ${midY}, ${endX} ${endY}`:`M ${x} ${y} C ${midX} ${y}, ${midX} ${endY}, ${endX} ${endY}`);
        p.dataset.figure=id;p.setAttribute('pathLength','1');
        if(id===active)p.setAttribute('class','ea-selected');
        svg.append(p);
      }
    }
    const observer = typeof ResizeObserver==='function' ? new ResizeObserver(edges) : null;
    observer?.observe(canvas);
    function render() {
      section.hidden = !model.figures.length;
      PaperUI.set(tag,model.question ? '研究问题' : model.rootKind || '这篇论文');
      const rootText=model.question || model.rootLabel || '论文图件';
      if(model.questionEnglish){PaperLanguageText.clear(topic);PaperUI.set(topic,model.question,model.questionEnglish);}
      else PaperLanguageText.bind(topic,rootText);
      topic.removeAttribute('title');
      fullTopic.hidden=Math.max(rootText.length,(model.questionEnglish||"").length)<=135;
      if(model.questionEnglish){PaperLanguageText.clear(fullTopic.lastChild);PaperUI.set(fullTopic.lastChild,model.question,model.questionEnglish);}
      else PaperLanguageText.bind(fullTopic.lastChild,rootText);
      const located=model.figures.filter(f=>!f.raw.pageOnly);
      const short=model.figures.length<=5, all=short||expanded;
      const sourceOrder=model.figures;
      toggle.hidden = short;
      toggle.setAttribute('aria-expanded', String(expanded));
      PaperUI.set(toggle,expanded ? '收起图件' : `展开全部 ${model.figures.length} 个图件`, expanded?'Show fewer':`All ${model.figures.length} figures`);
      const position=sourceOrder.findIndex(f=>f.id===active);
      const start=all||position<limit?0:Math.min(position,sourceOrder.length-limit);
      const keepMain=located.length<=5&&located.some(f=>f.id===active);
      const visible=all?sourceOrder:keepMain?located:sourceOrder.slice(start,start+limit);
      const manual=model.figures.filter(f=>f.raw.pageOnly).length;
      const count=model.figures.length-manual, shown=visible.length;
      PaperUI.set(coverage,'已定位 '+count+' 个图件'+(manual?' · 手动页 '+manual:'')+' · 当前列出 '+shown,
        count+' located'+(manual?' + '+manual+' manual pages':'')+' · '+shown+' shown');
      PaperUI.set(description,all?'按原文图号顺读。':'按原文图号顺读 · 当前 '+visible[0]?.label+' – '+visible.at(-1)?.label,
        all?'In the paper’s figure order.':'In the paper’s figure order · '+(start+1)+'–'+(start+visible.length)+' of '+count);
      description.hidden=all;
      const oldFocus=[...keys].find(([,node])=>node===doc.activeElement)?.[0];
      nodes.replaceChildren(); keys = new Map();
      canvas.style.setProperty('--map-rows',String(Math.ceil(visible.length/2)));
      for (const [index,f] of visible.entries()) {
        const button = el('button', '', 'ea-node');
        const branch=el('div','','ea-branch');
        branch.style.setProperty('--branch-row',String(1+Math.floor(index/2)));
        branch.style.setProperty('--branch-column',index%2?'3':'1');
        if(f.raw.evidenceStep)button.dataset.evidenceKind=({'F:1':'susceptibility','F:2':'animal','F:3':'structure','F:4':'binding','F:5':'transfer'})[f.raw.matchKey]||'';
        button.type='button'; button.setAttribute('aria-pressed', String(f.id===active));
        const previewPath=value=>{for(const line of svg.children)line.classList.toggle('ea-preview',value&&line.dataset.figure===f.id)};
        button.onpointerenter=button.onfocus=()=>previewPath(true);
        button.onpointerleave=button.onblur=()=>previewPath(false);
        button.setAttribute('aria-expanded',String(f.id===openId));
        const branchTitle=el('strong');
        if(f.raw.evidenceStep)PaperUI.set(branchTitle,f.title,f.raw.evidenceStep[0]);
        else PaperLanguageText.bind(branchTitle,f.branchTitle||f.raw.title||f.title||f.label);
        const meta=el('small');
        const figNumber=(f.label||'').replace(/^Fig(?:ure)?\.?\s*/i,'图 ');
        meta.append(PaperUI.set(el('span'),figNumber+(f.page?' · 第 '+f.page+' 页':''),f.label+(f.page?' · p.'+f.page:'')));
        if(!f.raw.evidenceStep){
          const roles=[[/\bvalidat(?:e[sd]?|ion)\b/i,'方法验证','Validation'],[/\b(?:associat(?:ed|ion)|correlat(?:ed|ion))\b/i,'关联分析','Association'],[/\b(?:pipeline|workflow)\b/i,'方法流程','Workflow'],[/\b(?:quantification|quantifying|measurement)\b/i,'定量测量','Quantification'],[/\bcompar(?:ison|ing)\b/i,'对比分析','Comparison']];
          const role=roles.find(([re])=>re.test(f.raw.title||f.title));
          if(role){meta.append(document.createTextNode(' · '),PaperUI.set(el('span'),role[1],role[2]));}
        }
        button.append(meta,branchTitle);
        button.addEventListener('click',()=>{
          openId=openId===f.id?'':f.id;
          opts.onFigure(f.id); render();opts.remember?.({openId,expanded});
        });
        branch.append(button);nodes.append(branch);keys.set(f.id,button);
        if(f.id===openId){
          const group=el('div','','ea-leaves');group.setAttribute('role','group');
          group.setAttribute('aria-label','图中小图 / Figure panels');
          const attribution=el('small','','ea-attribution');
          if(f.branchTitle)PaperUI.set(attribution,'作者表述 · 正文 p.'+(f.raw.findingPage||f.page),'Author statement');
          else if(f.raw.pageOnly)PaperUI.set(attribution,'原页手动定位','Manually selected page');
          else if(f.raw.editorGuide)PaperUI.set(attribution,'整理者导读','Reader’s guide');
          else PaperUI.set(attribution,'来源 · 原文图注','Source · figure caption');
          group.append(attribution);
          if(f.raw.evidenceStep)group.append(PaperUI.set(el('p','','ea-step-reading'),f.raw.evidenceStep[1],f.raw.evidenceStep[2]));
          const groupName=el('small');PaperUI.set(groupName,f.panels.length?'图中小图':'图内未定位到独立小图。');group.append(groupName);
          const choices=el('div','','ea-panel-choices');
          for(const part of f.panels){
            const leaf=el('button','','ea-leaf');leaf.type='button';leaf.dataset.panel=part.id;
            leaf.setAttribute('aria-pressed',String(part.id===panelId));
            const guide=part.raw?.reading, label=guide?.title;
            const passage=guide?.sources?.find(s=>s.kind==='小图图注'||s.kind.startsWith('组内共用图注'))?.text;
            const ownLabel=part.raw?.printedTitle;
            leaf.append(el('b',part.label));
            if(label || passage || ownLabel){
              const body=el('span','','ea-panel-topic');
              if(label&&/[\u3400-\u9fff]/u.test(label[0])) PaperUI.set(body,label[0],label[1]);
              else if(label)PaperLanguageText.bind(body,label[0]||label[1]);
              else {
                const excerpt=ownLabel||passage;
                PaperLanguageText.bind(body,excerpt.split(/(?<=[.!?])\s+(?=[A-Z])/)[0]);

              }
              leaf.append(body);
            }
            leaf.setAttribute('aria-label','小图 / Panel '+part.label);

            leaf.onclick=()=>{opts.onPanel(part.id);inspect()};
            choices.append(leaf);
          }
          group.append(choices);branch.append(group);
        }
      }
      if(oldFocus) (keys.get(oldFocus)||toggle).focus({preventScroll:true});
      edges();
    }
    toggle.addEventListener('click',()=>{expanded=!expanded;render();opts.remember?.({openId,expanded});});
    return {
      setModel(next){
        model={...next,figures:inPaperOrder(next.figures)};
        const prior=opts.restore?.()||{};
        openId=model.figures.some(f=>f.id===prior.openId)?prior.openId:'';
        expanded=prior.expanded===true;active='';panelId='';render();
      },
      first(){return model.figures[0]?.id;},
      returnToSelection(){
        if(!active)return;
        openId=active;render();opts.remember?.({openId,expanded});
        if(returnToExplorer&&!dialog.open)explore.click();
        const selected=nodes.querySelector('.ea-leaf[aria-pressed="true"]')||keys.get(active);
        selected?.scrollIntoView({block:'center',inline:'nearest'});selected?.focus({preventScroll:true});
      },
      selectPanel(id){
        panelId=id||'';
        for(const b of nodes.querySelectorAll('.ea-leaf'))b.setAttribute('aria-pressed',String(b.dataset.panel===panelId));
      },
      syncPanels(){if(openId)render();},
      select(id){
        const prior=keys.get(active); if(prior)prior.setAttribute('aria-pressed','false');
        active=id;
        if(openId && openId!==id)openId=id;
        if(!keys.has(id)||openId)render();
        keys.get(id)?.setAttribute('aria-pressed','true'); edges();
      },
      destroy(){observer?.disconnect();section.remove();}
    };
  }
  global.EvidenceAtlas = Object.freeze({mount,inPaperOrder});
})(globalThis);
