/* Mind map beside the figure: source-sentence version at once, AI version when the reader adds one. */
(() => {
  'use strict';
  const el=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n};
  const ui=(tag,cls,zh,en)=>PaperUI.set(el(tag,cls),zh,en);
  function button(cls,zh,en,fn){const b=ui('button',cls,zh,en);b.type='button';b.addEventListener('click',fn);return b}

  function mount({workbench,model,paper,state,save,select,openPanel,source,thumb}){
    const figures=model.figures.filter(f=>!f.raw?.pageOnly),byId=new Map(figures.map(f=>[f.id,f])),rows=paper.rows||[];
    const raws=figures.map(f=>f.raw);
    const host=el('section','mm');host.setAttribute('aria-label','论文脑图 / Mind map of the paper');workbench.append(host);
    const bar=el('header','mm-bar'),status=el('span','mm-status'),which=el('div','mm-which');
    const title=ui('h2','','论文脑图','Mind map');
    const own=button('','原句版','Source sentences',()=>use(false)),ai=button('','AI 梳理版','AI outline',()=>use(true));
    which.append(own,ai);
    const tidy=button('mm-ai','让 AI 帮我梳理','Let AI organize it',openPanelAI);
    const tools=el('div','mm-tools');
    let view=null,usingAI=!!state.aiMap;
    tools.append(button('','−','−',()=>view?.zoom(.85)),button('','适合','Fit',()=>view?.fit()),button('','＋','+',()=>view?.zoom(1.18)));
    tools.append(button('mm-current','当前图','Current figure',()=>view?.current()));
    bar.append(title,which,status,tidy,tools);host.append(bar);
    const body=el('div','mm-body');host.append(body);

    const question=PaperOutline.claim(model.rootLabel||paper.title||'');
    function localTree(){
      const tree=ReadingMapData.local({rows,figures:raws,question,sections:paper.sections||[]});
      if(model.question&&model.questionEnglish){tree.zh=model.question;tree.en=model.questionEnglish}
      return tree;
    }
    function aiTree(){
      const tree=ReadingMapData.parse(state.aiMap,raws);
      if(!tree.text)tree.text=question;
      return {tree,stats:ReadingMapData.verify(tree,rows)};
    }
    function draw(){
      const has=!!state.aiMap;
      which.hidden=!has;own.setAttribute('aria-pressed',String(!usingAI));ai.setAttribute('aria-pressed',String(usingAI));
      PaperUI.set(tidy,has?'重新梳理':'让 AI 帮我梳理',has?'Organize again':'Let AI organize it');
      if(usingAI&&has){
        const {tree,stats}=aiTree();view.set(tree);
        PaperUI.set(status,stats.ok+' 条在原文中核到'+(stats.miss?'，'+stats.miss+' 条待核对':'')+(stats.none?'，'+stats.none+' 条没有附依据':''),
          stats.ok+' found in the paper'+(stats.miss?', '+stats.miss+' unverified':'')+(stats.none?', '+stats.none+' without a source':''));
      }else{view.set(localTree());PaperUI.set(status,'按正文与图注梳理，点页码核对原句','From the text and captions. Select a page to check the original.')}
    }
    function use(on){usingAI=on&&!!state.aiMap;draw()}
    function openPanelAI(){
      const d=el('dialog','mm-dialog');d.setAttribute('aria-label','AI 梳理 / AI outline');
      const copied=el('small');copied.setAttribute('role','status');
      const prompt=ReadingMapData.prompt({rows,title:paper.title,figures:raws,lang:ReaderLanguage.current});
      const copy=button('primary','复制论文和提示词','Copy paper and prompt',async()=>{
        try{await navigator.clipboard.writeText(prompt);PaperUI.set(copied,'已复制，去粘贴给 AI','Copied. Paste it into your AI chat')}
        catch{area.value=prompt;area.select();PaperUI.set(copied,'浏览器没允许复制，请复制下框全文','Copy was blocked. Copy the text below')}
      });
      const links=el('div','mm-links-row');
      for(const [label,url] of [['豆包','https://www.doubao.com/chat/'],['DeepSeek','https://chat.deepseek.com/'],['Kimi','https://www.kimi.com/'],['ChatGPT','https://chatgpt.com/'],['Claude','https://claude.ai/']]){
        const a=el('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);
      }
      const area=el('textarea');area.rows=10;area.placeholder=ReaderLanguage.choose('把大纲粘贴到这里','Paste your outline here');area.setAttribute('aria-label',area.placeholder);area.value=state.aiMap||'';
      const note=el('small');note.setAttribute('role','status');
      const make=button('primary','生成脑图','Make the map',()=>{
        const tree=ReadingMapData.parse(area.value,raws);
        if(!tree.children.length){PaperUI.set(note,'没有读到列表。请粘贴带「-」或「#」的大纲','No list found. Paste an outline with - or #');return}
        state.aiMap=area.value.slice(0,120000);save();usingAI=true;d.close();draw();
      });
      const steps=el('ol');
      const step=(...nodes)=>{const li=el('li');li.append(...nodes);steps.append(li)};
      step(ui('b','','复制','Copy'),ui('p','','论文正文会连同提示词一起复制。粘贴给 AI 就等于把正文发给那家服务，未发表的稿件请谨慎。','The paper text is copied with the prompt. Pasting it sends the text to that service, so take care with unpublished work.'),copy,copied);
      step(ui('b','','问 AI','Ask an AI'),links);
      step(ui('b','','粘贴回来','Paste the answer'),area,note,make);
      d.append(button('mm-close','关闭','Close',()=>d.close()),ui('h2','','让 AI 梳理，再由原文核对','AI organizes, the paper checks'),
        ui('p','','每条依据都会在这篇论文里逐字查找，查不到的会标「待核对」。','Every quotation is searched for in this paper. Anything not found is marked.'),steps);
      const controller=new AbortController();
      const modelBox=el('section','mm-model'),model=el('select'),modelStatus=el('small');
      const manual=el('details'),manualTitle=ui('summary','','用网页版 AI 或已有大纲','Use a web chat or an existing outline');
      manual.append(manualTitle,steps);d.append(modelBox,manual);
      model.setAttribute('aria-label',ReaderLanguage.choose('梳理模型','Outline model'));
      modelStatus.setAttribute('role','status');
      const run=button('primary','生成并核对脑图','Generate and check map',async()=>{
        run.disabled=true;model.disabled=true;
        PaperUI.set(modelStatus,'正在梳理所选论文…','Organizing this paper…');
        try{
          const result=await ReaderAccess.outline({provider:model.value,language:ReaderLanguage.current,excerpt:ReadingMapData.excerpt(rows)},controller.signal);
          if(!d.open)return;
          area.value=result.outline;manual.open=true;make.click();
        }catch(error){
          if(!controller.signal.aborted){PaperUI.set(modelStatus,'生成未完成，可重试或展开其他方式。','Generation did not finish. Retry or use the other options.');manual.open=true}
        }finally{run.disabled=model.disabled=false}
      });
      modelBox.hidden=true;manual.open=true;
      ReaderAccess.options().then(options=>{
        if(!d.open)return;
        for(const [key,label] of [['deepseek','DeepSeek'],['qwen','Qwen'],['ollama','Ollama'],['chatgpt','ChatGPT']]){
          if(!options.available[key])continue;
          const item=el('option');item.value=key;item.textContent=label;model.append(item);
        }
        if(model.length){
          modelBox.append(ui('p','','点击生成后，将带页码的正文摘录发送给所选模型。','Generate sends page-labelled excerpts to the selected model.'),model,run,modelStatus);
          modelBox.hidden=false;if(!manual.contains(document.activeElement))manual.open=false;
        }
      }).catch(()=>{});
      d.addEventListener('close',()=>{controller.abort();d.remove()});d.addEventListener('click',e=>{if(e.target===d)d.close()});
      workbench.append(d);d.showModal();
    }
    let now='';
    function show(){
      if(!view){
        view=ReadingMapView.mount(body,{
          figure:id=>{select(id);if(matchMedia('(max-width:1000px)').matches)workbench.dispatchEvent(new CustomEvent('studio-view',{detail:'read'}))},name:id=>(byId.get(id)?.label||'').replace(/^Fig(?:ure)?\.?\s*/i,ReaderLanguage.choose('图 ','Figure ')),
          source:(page,quote)=>{
            if(matchMedia('(max-width:1000px)').matches)workbench.dispatchEvent(new CustomEvent('studio-view',{detail:'read'}));
            source(page,quote);
          },panel:(id,letter)=>{openPanel(id,letter);if(matchMedia('(max-width:1000px)').matches)workbench.dispatchEvent(new CustomEvent('studio-view',{detail:'read'}))},thumb,refs:id=>paper.citations?.forFigure(byId.get(id)?.raw||{}).length||0});
        view.mark(now);draw();
      }else view.layout();
    }
    return {show,mark(id){now=id;view?.mark(id)},destroy(){view?.destroy();host.remove()}};
  }
  window.ReadingMap=Object.freeze({mount});
})();
