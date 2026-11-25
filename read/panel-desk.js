(() => {
  'use strict';
  const full={x:0,y:0,width:1,height:1};
  const transform=(r,b)=>({x:b.x+r.x*b.width,y:b.y+r.y*b.height,width:r.width*b.width,height:r.height*b.height});
  const relative=(r,b)=>({x:(r.x-b.x)/b.width,y:(r.y-b.y)/b.height,width:r.width/b.width,height:r.height/b.height});
  const clip=n=>Math.max(0,Math.min(1,n));
  const key=(f,p)=>JSON.stringify([f,p||'']);
  const newRecord=page=>({coordinatePage:page,boxes:{},extra:[],shared:[],sentences:{}});
  // A crop is expressed in page coordinates. If a new scan moves the image,
  // keep old manual work on the PDF page on which the reader drew it.
  function restorePageBindings(paper,state,initial,link){
    const saved=state.figures||{};
    for(const f of [...paper.figures]){
      if(!f.captionPage||f.captionPage===f.page)continue;
      const oldPage=f.captionPage,oldId='saved-'+oldPage+'-'+f.id,rec=saved[f.id];
      if(rec&&(rec.coordinatePage??oldPage)===oldPage){
        const history=state.undo?.[f.id]||[];
        if(Object.keys(rec.boxes||{}).length||rec.extra?.length||rec.shared?.length||Object.keys(rec.labels||{}).length||history.length){
          saved[oldId]={...rec,coordinatePage:oldPage};
          if(history.length){state.undo[oldId]=history;delete state.undo[f.id]}
          for(const [k,value] of Object.entries(state.notes||{})){
            const [fid,pid]=JSON.parse(k);
            if(fid===f.id)state.notes[key(oldId,pid)]=value;
          }
          state.queue=(state.queue||[]).map(k=>{
            const [fid,pid]=JSON.parse(k);return fid===f.id?key(oldId,pid):k;
          });
          saved[f.id]={...newRecord(f.page),sentences:{...rec.sentences}};
        }else rec.coordinatePage=f.page;
      }
      const legacy=saved[oldId];
      if(!legacy)continue;
      const ids=new Set(Object.keys(legacy.boxes||{}));
      for(const entry of state.undo?.[oldId]||[])for(const id of Object.keys(entry.bounds?.boxes||{}))ids.add(id);
      const panels=f.panels.filter(p=>ids.has(p.id)).map(p=>({id:p.id,label:p.label,page:oldPage}));
      paper.figures.push({id:oldId,label:'旧页选区 / Saved crop',title:f.label+' · 第 '+oldPage+' 页保存的选区 / Saved on p.'+oldPage,
        page:oldPage,pageOnly:true,panels,references:[]});
      if(initial.figure===f.id&&(link?.page===oldPage||legacy.extra?.some(p=>p.id===initial.panel)&&!link)){
        initial.figure=oldId;initial.page=oldPage;
      }
    }
  }
  function mount(ctx,ui){
    const {paper,session,file,id,state}=ctx,{plate,img,notes}=ui;
    state.figures ||= {};state.queue ||= [];state.notes ||= {};
    let fig=null,active='',basis=full,ready=false,tool='',drag=null,pending=false,legendGroup='',layoutDraft=null;
    const history=state.undo ||= {};
    const el=(tag,label,cls)=>{const n=document.createElement(tag);if(label)n.textContent=label;if(cls)n.className=cls;return n};
    const button=(label,fn)=>{const n=PaperUI.set(el('button'),label);n.type='button';n.onclick=fn;return n};
    const holder=el('div','','pd-desk');
    const preview=el('canvas');preview.setAttribute('aria-label','所选小图裁切预览');
    const previewButton=button('',()=>{if(active)ui.openPreview(active)});previewButton.className='pd-open-preview';
    PaperUI.set(previewButton,'打开小图特写','Open panel close-up');previewButton.prepend(preview);previewButton.hidden=true;
    const rawPreview=el('canvas');
    const numbering=el('fieldset','','pd-numbering'),numberTitle=el('legend');
    PaperUI.set(numberTitle,'小图编号 · 本篇汇报','Panel labels · this paper');numbering.append(numberTitle);
    const mode=el('select');mode.setAttribute('aria-label','小图编号 / Panel labels');
    for(const [value,label] of [['keep','保留原编号，不再加字 / Keep printed labels'],['replace','去除原编号，重新编号 / Replace printed labels']]){
      const opt=el('option',label);opt.value=value;mode.append(opt);
    }
    mode.value=state.numbering==='replace'?'replace':'keep';numbering.append(mode);
    const labelTools=el('div','','pd-label-tools'),custom=el('input');custom.maxLength=12;
    const customLabel=PaperUI.set(el('label'),'新编号','New label');customLabel.append(custom);
    const mark=button('标出或调整旧编号',editPrinted),clear=button('裁切内没有旧编号',()=>{
      const cfg=labelEdits();delete cfg.regions;cfg.noLabelIn={...boxFor(fig,active)};save();refresh();
    });
    PaperUI.set(mark,'标出或调整旧编号','Mark or adjust old label');PaperUI.set(clear,'裁切内没有旧编号','No label in crop');
    const labelStatus=el('small');labelTools.append(customLabel,mark,clear,labelStatus);numbering.append(labelTools);
    mode.onchange=()=>{state.numbering=mode.value;save();refresh()};
    custom.oninput=()=>{labelEdits().label=custom.value;save();refresh()};
    const previewLabel=el('strong'),msg=el('p','','pd-status');msg.setAttribute('role','status');
    const toolbar=el('div','','pd-tools'),sharedList=el('div','','pd-shared');
    const edit=button('校正边界',()=>arm('panel'));
    const newPanel=button('手动框选小图',()=>arm('new'));
    const legend=button('框选共用图例／坐标轴／标尺',()=>arm('shared'));
    const undo=button('撤销边界',undoLast);
    const sourceMode=button('从原页框选',()=>{tool='';ui.togglePage()});
    const cancel=button('取消框选',()=>{stop();refresh()});
    const name=el('input');name.placeholder='图内标签 / Panel label';name.maxLength=60;name.setAttribute('aria-label','新区域名称');
    const moreTools=el('details','','pd-extra-tools'),moreTitle=el('summary');
    PaperUI.set(moreTitle,'其他框选工具','More selection tools');
    const moreBody=el('div','','pd-tools');moreBody.append(newPanel,legend);
    moreTools.append(moreTitle,moreBody);
    toolbar.append(edit,undo,sourceMode,moreTools,cancel,name);
    const caption=el('textarea');caption.rows=2;caption.maxLength=480;caption.setAttribute('aria-label','可导出的讲解一句话 / Slide narration');
    const captionLabel=PaperUI.set(el('label'),'讲解一句话');captionLabel.append(caption);
    function addCurrent() {
      if (!fig || !active || !boxFor(fig, active)) return;
      const k = key(fig.id, active);
      if (state.queue.includes(k)) return;
      state.queue.push(k);
      ReadingLineNotes.add(state, fig.id, active);
      save(); refresh(); basket.reveal(k); changed();
    }
    const add=button('加入汇报',addCurrent);add.className='pd-add-slide';
    const focusAdd=button('加入汇报',addCurrent);focusAdd.className='rq-add-slide';
    const targetInfo=el('div','','pd-slide-target'),targetThumb=el('img'),targetName=el('strong');
    targetThumb.alt='';targetInfo.append(targetThumb,targetName);
    const exportButton=button('导出 PPTX',exportPpt);exportButton.className='pd-export';
    const png=button('保存小图 PNG',async()=>{
      if(!active||png.disabled)return;
      const p=rawPanel(),f=fig,b=boxFor(f,p.id),recipe=outputPlan(f,p,b);
      png.disabled=true;
      try{
        const pic=await PaperPanelLabels.rendered(session,f,b,recipe),link=el('a'),url=URL.createObjectURL(pic.blob);
        link.href=url;link.download=(f.label+'-'+(recipe?.label||p.label)).replace(/[\\/:*?"<>|]/g,'_')+'.png';
        link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
      }catch(e){msg.textContent=e.message}finally{refresh()}
    });
    PaperUI.set(png,'保存小图 PNG','Save panel PNG');
    const manage=el('details');manage.append(PaperUI.set(el('summary'),'私人笔记与来源'));
    const noteLabel=PaperUI.set(el('label'),'私人笔记／未核实推断 · 仅本机');const note=el('textarea');note.rows=2;note.maxLength=6000;noteLabel.append(note);
    const urlLabel=PaperUI.set(el('label'),'公开原文链接（选填）');const pub=el('input');pub.type='url';pub.placeholder='https://…';urlLabel.append(pub);
    const saveNode=button('保存到私人图谱',async()=>{try{await PaperShelf.save(id,file,paper);PaperUI.set(msg,'已保存论文、读图位置和笔记，可从私人图谱重开。')}catch{PaperUI.set(msg,'保存失败，请检查浏览器存储空间。')}});
    manage.append(noteLabel,urlLabel);
    const report=el('details','','pd-report'),reportTitle=el('summary'),reportBody=el('div','','pd-report-body');
    PaperUI.set(reportTitle,'裁切与汇报','Crop & present');
    reportBody.append(targetInfo,toolbar,numbering,sharedList,captionLabel,add,png,exportButton);
    report.append(reportTitle,reportBody);report.addEventListener('toggle',()=>{if(!report.open && tool)stop();refresh()});
    caption.placeholder='写下这一小图支持的一句话 / Add an evidence-based takeaway';
    holder.append(previewLabel,previewButton,ui.explain,ui.boundary,ui.more,report,manage,saveNode,msg);
    notes.append(holder);
    const overlay=el('div','','pd-overlay');plate.append(overlay);
    const basket = SlideBasket.mount(ui.workbench, {
      describe, session, exportPpt,
      move(k, to) {
        const from = state.queue.indexOf(k);
        if (from < 0 || to < 0 || to >= state.queue.length || from === to) return;
        state.queue.splice(from, 1); state.queue.splice(to, 0, k);
        save(); refresh();
      },
      remove(k) {
        dropSlide(k);
        save(); refresh(); changed();
      },
      edit(k, text) {
        const [fid, pid] = JSON.parse(k);
        if (state.figures[fid]) state.figures[fid].sentences[pid] = text;
        ReadingLineNotes.edited(state, fid, pid);
        if (fig?.id === fid && active === pid) caption.value = text;
        save(); changed();
      }
    });
    function changed() { ui.workbench.dispatchEvent(new Event('reading-basket-change')); }
    function dropSlide(k) {
      const [fid, pid] = JSON.parse(k);
      ReadingLineNotes.removed(state, fid, pid);
      state.queue = state.queue.filter(item => item !== k);
    }
    // The figure's one-line reading changed, or was sent to a queued panel.
    function syncLine(fid, fill) {
      const target = fill && ReadingLineNotes.add(state, fid, fill) ? fill : ReadingLineNotes.follow(state, fid);
      if (!target) return;
      const k = key(fid, target), text = describe(k).sentence;
      basket.setNote(k, text);
      if (fig?.id === fid && active === target) caption.value = text;
    }
    function describe(k) {
      const [fid, pid] = JSON.parse(k), figure = paper.figures.find(f => f.id === fid);
      const panel = figure && panelsFor(figure).find(p => p.id === pid);
      const box = panel && boxFor(figure, pid);
      const rec = figure && record(figure);
      const label = panel?.sourcePanel || panel?.label || pid;
      return {
        figure, id:pid, label, name:(figure?.label || fid) + ' · ' + label, box,
        recipe:box ? outputPlan(figure, panel, box) : null,
        shared:[...(rec?.shared || []), ...(panel?.gridShared || []), ...(rec?.gridLegends?.[panel?.gridGroup] || [])],
        sentence:rec?.sentences[pid] ?? defaultText(figure, panel), publicUrl:state.publicUrl ?? paper.publicUrl
      };
    }
    function save(){try{PaperShelf.persist(id,state);return true}catch{PaperUI.set(msg,'浏览器未能保存读图状态，请检查本地存储。');return false}}
    function record(f){return state.figures[f.id] ||= newRecord(f.page)}
    function originalBox(f){return f.verifiedRegion||f.pageBox||full}
    function boxFor(f,pid){
      const rec=record(f);if(rec.boxes[pid])return rec.boxes[pid];
      const p=f.panels.find(p=>p.id===pid);return p?.region&&f.mode!=='page'?transform(p.region,originalBox(f)):
        p?.region&&f.verifiedRegion?transform(p.region,originalBox(f)):null;
    }
    function panelsFor(f){
      const rec=record(f);
      return [...f.panels,...rec.extra.map(p=>{
        if(p.gridKey)return p;
        const box=rec.boxes[p.id],matches=box?f.panels.filter(o=>{
          const m=o.markerBox,pt=m?{x:m.x+m.width/2,y:m.y+m.height/2}:o.titleAnchor;
          return pt&&pt.x>=box.x&&pt.x<=box.x+box.width&&pt.y>=box.y&&pt.y<=box.y+box.height;
        }):[];
        if(matches.length===1){
          const source=matches[0];return {...p,sourcePanel:source.label,printedTitle:source.printedTitle,reading:source.reading,markerBox:source.markerBox};
        }
        return {...p,reading:PaperPanelReading.build(f,p,'',null)};
      })];
    }
    function rawPanel(){return fig&&panelsFor(fig).find(p=>p.id===active)}
    function labelEdits(){const labels=record(fig).labels||={};return labels[active]||={}}
    function outputPlan(f,p,b){
      const i=state.queue.indexOf(key(f.id,p.id));
      return PaperPanelLabels.plan(mode.value,b,f,p,record(f).labels?.[p.id],i<0?state.queue.length:i);
    }
    async function editPrinted(){
      const f=fig,p=rawPanel(),box=boxFor(f,p.id);mark.disabled=true;
      try{
        const pic=await session.renderRegion(f.page,box,{quality:'slide'});
        if(pic.mode!=='crop')throw Error('请重新框选小图。 / Check the crop.');
        const bitmap=await createImageBitmap(pic.blob);
        try{
          if(!holder.isConnected||fig!==f||active!==p.id||mode.value!=='replace')return;
          const current=boxFor(f,p.id);
          if(!current||['x','y','width','height'].some(k=>current[k]!==box[k]))return;
          const source=el('canvas');source.width=bitmap.width;source.height=bitmap.height;source.getContext('2d').drawImage(bitmap,0,0);
          PaperPanelLabels.editMask(holder,source,outputPlan(f,p,box).masks,regions=>{
            const cfg=labelEdits();cfg.regions=regions.map(r=>PaperPanelLabels.onPage(r,box));cfg.forBox={...box};delete cfg.noLabelIn;save();refresh();
          });
        }finally{bitmap.close()}
      }catch(e){msg.textContent=e.message}finally{mark.disabled=false}
    }
    function snapshot(){
      const stack=history[fig.id] ||= [],{boxes,extra,shared,gridLegends={},gridLayouts={}}=record(fig);
      stack.push({bounds:structuredClone({boxes,extra,shared,gridLegends,gridLayouts}),active});if(stack.length>12)stack.shift();
    }
    function undoLast(){const last=history[fig?.id]?.pop();if(!last)return;
      Object.assign(record(fig),last.bounds);
      const existing=new Set(panelsFor(fig).map(p=>p.id));
      state.queue=state.queue.filter(k=>{const [fid,pid]=JSON.parse(k);return fid!==fig.id||existing.has(pid)});
      stop();ui.syncPanels(last.active);save();PaperUI.set(msg,'已撤销上一次边界修改。')}
    function stop(){drag=null;tool='';legendGroup='';layoutDraft=null;overlay.classList.remove('pd-drawing');name.value='';}
    function arm(kind){
      if(!ready)return;ui.showFigure();stop();tool=kind;overlay.classList.add('pd-drawing');
      name.value=kind==='shared'?'共用图例':'';
      refresh();if(kind!=='panel')name.focus();
      PaperUI.set(msg,'在左侧原图上，从区域一角拖至对角；框内保留需要的标签和标尺。');
    }
    function place(box,cls,label){
      const r=relative(box,basis),n=el('span',label,cls);
      Object.assign(n.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.width*100+'%',height:r.height*100+'%'});overlay.append(n);
    }
    function outlines(){
      overlay.replaceChildren();if(!ready||!fig)return;
      if(active){const b=boxFor(fig,active);if(b)place(b,'pd-box','')}
      for(const s of record(fig).shared)place(s.box,'pd-box pd-common','');
      if(drag)place(transform(rect(drag.from,drag.to),basis),'pd-box pd-live','');
    }
    function rect(a,b){return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)}}
    function point(e){const r=img.getBoundingClientRect();return {x:clip((e.clientX-r.left)/r.width),y:clip((e.clientY-r.top)/r.height)}}
    overlay.onpointerdown=e=>{if(!tool||e.button!==0)return;e.preventDefault();e.stopPropagation();overlay.setPointerCapture(e.pointerId);const p=point(e);drag={from:p,to:p,id:e.pointerId}};
    overlay.onpointermove=e=>{if(drag?.id!==e.pointerId)return;drag.to=point(e);outlines();const r=rect(drag.from,drag.to);if(r.width>.005&&r.height>.005)previewCrop(transform(r,basis))};
    overlay.onpointercancel=()=>{drag=null;refresh()};
    overlay.onpointerup=e=>{
      if(drag?.id!==e.pointerId)return;
      const local=rect(drag.from,point(e)),surface=img.getBoundingClientRect();
      const b=transform(local,basis);drag=null;
      if(local.width*surface.width<4||local.height*surface.height<4){PaperUI.set(msg,'区域过小，请放大原图再框选。','Zoom the figure and draw a larger selection.');outlines();return}
      if(tool==='grid'){
        const b0=relative(b,layoutDraft.parent);
        if(b0.x<-.001||b0.y<-.001||b0.x+b0.width>1.001||b0.y+b0.height>1.001){
          PaperUI.set(msg,'请在当前图像范围内框选，或从手动页重新定位。','Draw inside the current figure or select a manual PDF page.');outlines();return;
        }
      }
      const r=record(fig);snapshot();let next=active;
      if(tool==='grid'){
        (r.gridLayouts ||= {})[layoutDraft.id]={box:b,rows:layoutDraft.rows,cols:layoutDraft.cols};
        (state.histogramLayoutMode ||= {})[fig.id]='manual';
      }else if(tool==='shared'){
        const region={id:crypto.randomUUID(),label:name.value.trim()||'共用区域',box:b};
        if(legendGroup)((r.gridLegends ||= {})[legendGroup] ||= []).push(region);
        else r.shared.push(region);
      }
      else{
        if(tool==='new'){next='manual-'+crypto.randomUUID();r.extra.push({id:next,label:name.value.trim()||'手选区域 '+(r.extra.length+1),title:'手动框选',page:fig.page})}
        r.boxes[next]=b;
      }
      stop();ui.syncPanels(next);save();PaperUI.set(msg,'已记录原页坐标。');
    };
    function defaultText(f,p){
      const reading=p?.reading, text=reading?.narration||'';
      if(window.ReaderLanguage?.current!=='en'||!/[\u3400-\u9fff]/.test(text))return text;
      return reading.narrationEn||reading.rows?.find(r=>r.zh===text&&r.enText)?.enText||'';
    }
    document.addEventListener('reader-language-change',refresh);
    function previewCrop(box){
      previewButton.hidden=preview.hidden=true;if(!ready||!box)return;
      const r=relative(box,basis);
      if(r.x<-.001||r.y<-.001||r.x+r.width>1.001||r.y+r.height>1.001){previewLabel.textContent+=' · 请切换原页查看完整区域';return}
      const w=r.width*img.naturalWidth,h=r.height*img.naturalHeight;
      const scale=Math.min(1,850/w,420/h);
      rawPreview.width=Math.max(1,Math.round(w*scale));rawPreview.height=Math.max(1,Math.round(h*scale));
      rawPreview.getContext('2d').drawImage(img,r.x*img.naturalWidth,r.y*img.naturalHeight,w,h,0,0,rawPreview.width,rawPreview.height);
      const p=rawPanel(),surface=PaperPanelLabels.draw(rawPreview,p&&!drag?outputPlan(fig,p,box):null);
      preview.width=surface.width;preview.height=surface.height;preview.getContext('2d').drawImage(surface,0,0);preview.hidden=false;previewButton.hidden=false;
    }
    function refresh(){
      if(!fig)return;
      const p=rawPanel(),b=active&&boxFor(fig,active),r=record(fig);
      const readFirst=p?.reading?.kind==='checked'||p?.reading?.kind==='axis'||!!window.HistogramEvidence?.scope(fig,p);
      const before=readFirst?previewLabel:ui.boundary;
      if(ui.explain.nextSibling!==before)holder.insertBefore(ui.explain,before);
      const savedManual=Boolean(r.boxes[active]);
      const recipe=p&&b?outputPlan(fig,p,b):null;
      labelTools.hidden=!recipe;
      if(recipe){
        custom.placeholder=PaperPanelLabels.letters(state.queue.includes(key(fig.id,active))?state.queue.indexOf(key(fig.id,active)):state.queue.length);
        if(document.activeElement!==custom)custom.value=r.labels?.[active]?.label||'';
        PaperUI.set(labelStatus,recipe.known?'预览与导出使用同一编号。':'需标出旧编号，或确认它在裁切范围外。',recipe.known?'Preview and export use the same label.':'Mark the old label or confirm it is outside the crop.');
      }
      png.hidden=!p;png.disabled=!ready||!b||recipe?.known===false;
      const previewTitle=p?'小图 '+p.label+' · '+(b?(savedManual?'手动边界':'自动边界 · 待核对'):'待框选'):'整图 · 选择小图或手动框选';
      PaperUI.set(previewLabel,previewTitle,p?'Panel '+p.label+' · '+(b?(savedManual?'manual bounds':'estimated bounds'):'draw bounds'):undefined);
      previewCrop(b);outlines();undo.disabled=!history[fig.id]?.length;
      if(report.open){
        PaperUI.set(targetName,p?fig.label+' · '+(p.sourcePanel||p.label)+' · 原图第 '+fig.page+' 页':'请先选择或框出汇报小图',p?'Slide source · PDF p.'+fig.page:'Select or draw a panel');
        targetThumb.hidden=preview.hidden||!p;
        if(!targetThumb.hidden){
          const thumb=el('canvas'),factor=96/Math.max(preview.width,preview.height);thumb.width=Math.max(1,Math.round(factor*preview.width));thumb.height=Math.max(1,Math.round(factor*preview.height));
          thumb.getContext('2d').drawImage(preview,0,0,thumb.width,thumb.height);targetThumb.src=thumb.toDataURL();
        }
      }
      edit.disabled=!ready||!active;legend.disabled=newPanel.disabled=sourceMode.disabled=!ready;
      cancel.hidden=!tool;name.hidden=!['new','shared'].includes(tool);
      PaperUI.set(sourceMode,ui.pageMode()?'返回整图范围':'从原页框选');
      sharedList.replaceChildren();
      for(const s of r.shared)sharedList.append(button(s.label+' ×',()=>{snapshot();r.shared=r.shared.filter(v=>v!==s);save();refresh()}));
      captionLabel.hidden=!p;caption.value=r.sentences[active]??defaultText(fig,p);
      const selected = state.queue.includes(key(fig.id, active));
      for (const control of [focusAdd, add]) {
        control.disabled = !b || selected;
        PaperUI.set(control, selected ? '已加入汇报' : '加入汇报', selected ? 'Added to slides' : 'Add to slides');
      }
      note.value=state.notes[key(fig.id,active)]||'';pub.value=state.publicUrl??paper.publicUrl??'';
      basket.sync(state.queue,pending);
      exportButton.disabled=!state.queue.length||pending;
    }
    caption.oninput=()=>{if(fig&&active){record(fig).sentences[active]=caption.value;ReadingLineNotes.edited(state,fig.id,active);basket.setNote(key(fig.id,active),caption.value);save();changed()}};
    note.oninput=()=>{state.notes[key(fig.id,active)]=note.value;save()};
    pub.onchange=()=>{try{const raw=pub.value.trim();if(raw&&!['http:','https:'].includes(new URL(raw).protocol))throw Error();state.publicUrl=raw;save()}catch{PaperUI.set(msg,'来源链接需为完整的 HTTP 或 HTTPS 地址。');pub.value=state.publicUrl??paper.publicUrl??''}};
    async function exportPpt(){
      if(pending || !state.queue.length)return;
      pending=true;exportButton.disabled=true;basket.sync(state.queue,true);basket.message('');
      PaperUI.set(msg,'正在从原 PDF 裁图并生成 PPTX…');
      try {
        const items = state.queue.map(describe);
        for (const item of items) {
          if (!item.box) throw Error(ReaderLanguage.choose('请移除或重新框选缺少边界的小图：','Remove or redraw the missing crop: ') + item.name);
          if (item.recipe && !item.recipe.known) throw Error(item.name + ReaderLanguage.choose('：请在编号设置中标出旧编号。', ': locate the printed label in panel label settings.'));
        }
        await PaperTalk.build({paper,session,fileId:id,items});
        PaperUI.set(msg,'已导出 '+items.length+' 张独立小图。',items.length+' independent panels exported.');
        basket.message(ReaderLanguage.choose('已导出','Exported'));
      } catch(e) { PaperUI.set(msg,e.message || '导出未完成。'); basket.message(msg.textContent); }
      finally { pending=false;refresh(); }
    }
    function gridQueued(gridKey){
      const p=record(fig).extra.find(q=>q.gridKey===gridKey);
      return !!p&&state.queue.includes(key(fig.id,p.id));
    }
    function queueGrid(gridKey,label,parent,crop,shared,gridGroup,sentence,gridKind){
      const rec=record(fig);
      let p=rec.extra.find(q=>q.gridKey===gridKey);
      if(!p){
        snapshot();
        const gridShared=shared.map(s=>({kind:s.kind,label:s.label,box:transform(s.rect,parent)}));
        p={id:'manual-'+crypto.randomUUID(),label,page:fig.page,gridKey,gridShared,gridGroup,gridKind,gridParent:active};
        rec.extra.push(p);rec.boxes[p.id]=transform(crop,parent);
        if(sentence)rec.sentences[p.id]=sentence;
      }
      const k=key(fig.id,p.id);if(!state.queue.includes(k))state.queue.push(k);
      save();ui.listPanels();refresh();
    }
    function drawGridLegend(group){
      if(!ready)return;
      report.open=true;arm('shared');legendGroup=group;
      PaperUI.set(msg,'请框选当前组共用的原图图例。','Draw around the legend shared by this group.');
    }
    function gridLegends(group,parent){
      return (record(fig).gridLegends?.[group]||[]).map(s=>({kind:'legend',label:s.label,rect:relative(s.box,parent)}));
    }
    function drawLayout(id,parent,rows,cols){
      if(!ready)return;
      report.open=true;arm('grid');layoutDraft={id,parent,rows,cols};
      PaperUI.set(msg,'在原图拖出整组小图的外框。','Drag around the entire grid of plots.');
    }
    function gridLayout(id,parent){
      const layout=record(fig).gridLayouts?.[id];
      if(!layout||![layout.rows,layout.cols].every(n=>Number.isInteger(n)&&n>=1&&n<=32)||layout.rows*layout.cols>120||layout.rows*layout.cols<2||!layout.box?.width||!layout.box?.height)return null;
      return {rows:layout.rows,cols:layout.cols,rect:relative(layout.box,parent)};
    }
    return {focusAdd,syncLine,slideName:(fid,pid)=>describe(key(fid,pid)).name,destroy(){document.removeEventListener('reader-language-change',refresh);basket.destroy()},panelsFor,save,gridQueued,queueGrid,drawGridLegend,gridLegends,drawLayout,gridLayout,reset(){ready=false;stop();refresh()},select(f,p){if(fig!==f||active!==p)stop();fig=f;active=p||'';refresh()},
      image(mode){basis=mode==='figure'?originalBox(fig):full;ready=true;refresh()},
      spot(f,p,zoom,pageMode){state.spot={figure:f.id,panel:p||'',page:f.page,zoom,pageMode};save()},
      figurePanelRegion(f,id){
        const box=boxFor(f,id);
        return box?relative(box,originalBox(f)):null;
      },
      region(){const box=fig&&active&&boxFor(fig,active);return box?relative(box,basis):null},
      pageRegion(){return fig&&active?boxFor(fig,active):null},
      isDrawing:()=>!!tool,cancelDrawing(){if(tool){stop();refresh()}}};
  }
  window.PaperPanelDesk={mount,restorePageBindings};
})();
