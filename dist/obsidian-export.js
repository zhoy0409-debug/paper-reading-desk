/* A reading note and its local attachments, shared by the vault and ZIP exports. */
(() => {
  'use strict';
  const plain = value => String(value ?? '').trim();
  const say = (lang, zh, en) => lang === 'zh' ? zh : en;
  function stem(title) {
    const clean = title.normalize('NFC').replace(/[\u0000-\u001f\u007f<>:"/\\|?*#^[\]%]+/g, ' ').replace(/\s+/g,' ').trim();
    const name = Array.from(clean).slice(0,52).join('').replace(/^[. ]+|[. ]+$/g,'') || 'Paper';
    return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? 'Paper '+name : name;
  }
  // Source text is literal. Keep any Markdown the reader wrote in their own notes.
  function literal(text) {
    return plain(text).replace(/\s+/g,' ').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/([\\\x60*_[\]|~$])/g,'\\$1');
  }
  function webLink(label, target) {
    try {
      const url = new URL(target);
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        return '['+label+']('+url.href.replace(/\(/g,'%28').replace(/\)/g,'%29')+')';
      }
    } catch {}
    return '';
  }
  function groupedNotes(state) {
    const groups = new Map();
    for (const [key,text] of Object.entries(state.notes || {})) {
      if (!plain(text)) continue;
      let parts;
      try { parts = JSON.parse(key); } catch { continue; }
      if (!Array.isArray(parts) || typeof parts[0] !== 'string') continue;
      const [figure,panel] = parts;
      if (!groups.has(figure)) groups.set(figure,[]);
      groups.get(figure).push({panel,text});
    }
    return groups;
  }
  async function build(ctx, options, progress, signal) {
    const {paper,file,id,state,desk,session} = ctx;
    const {lang,includePdf,includeImages} = options;
    const t = (zh,en) => say(lang,zh,en);
    const title = plain(paper.title) || plain(file.name).replace(/\.pdf$/i,'') || t('论文笔记','Paper notes');
    const folder = stem(title), note = folder+'.md', assets = [];
    const prefix = id.slice(0,12), pdfName = 'paper-'+prefix+'.pdf';
    const back = (fig,panel,page) => PaperShelf.link(id,fig||'',panel||'',page||1);
    function pageLink(page) {
      if (!Number.isInteger(page) || page < 1) return '';
      const label = t('PDF 第 '+page+' 页','PDF p.'+page);
      return includePdf ? '['+label+'](./attachments/'+pdfName+'#page='+page+')' : webLink(label,back('page-only-'+page,'',page));
    }
    const source = webLink(t('出版来源','Publication'),state.publicUrl ?? paper.publicUrl);
    const links = [source, includePdf ? '['+t('论文 PDF','Paper PDF')+'](./attachments/'+pdfName+')' : '', webLink(t('回到文献精读','Open in Reading Desk'),back())];
    const lines = ['# '+literal(title), '', links.filter(Boolean).join(' · ')];
    if (includePdf) assets.push({name:pdfName,blob:file});
    const addText = (heading,text) => { if (plain(text)) lines.push('', '**'+heading+'**', '', plain(text)); };
    const notes = groupedNotes(state);
    const queue = (state.queue || []).map(key => ({key,item:desk.describe(key,lang)}));
    const basketKeys = new Set(queue.map(entry => entry.key));
    function figureLabel(figure) {
      const label = plain(figure.label) || figure.id;
      return lang === 'zh' ? label.replace(/^Fig(?:ure)?\.?\s*/i,'图 ') : label.replace(/^图\s*/,'Figure ');
    }
    progress(t('正在整理背景与目的…','Preparing the background and aims…'));
    for (const branch of ctx.overview()) {
      lines.push('', '## '+literal(lang === 'zh' ? branch.zh : branch.en));
      for (const node of branch.children) {
        signal.throwIfAborted();
        const original = plain(node.text || node.quote);
        let words = (lang === 'zh' ? node.zh : node.en) || original;
        if (lang === 'zh' && !node.zh && /[A-Za-z]/.test(words)) {
          try { words = await PaperLanguageText.chinese(original) || original; } catch { /* Keep the source sentence with its page. */ }
          if (!/[\u3400-\u9fff]/u.test(words)) words = '原文 · '+original;
        }
        if (words) lines.push('', '- '+literal(words)+' '+pageLink(node.page));
      }
    }
    const figureLines = [];
    for (const figure of paper.figures || []) {
      const myLine = state.lens?.[figure.id]?.say;
      const comments = notes.get(figure.id) || [];
      const scripts = Object.entries(state.figures?.[figure.id]?.sentences || {}).filter(([panel,text]) =>
        plain(text) && !basketKeys.has(JSON.stringify([figure.id,panel])));
      if (figure.pageOnly && !myLine && !comments.length && !scripts.length) continue;
      figureLines.push('', '### '+literal(figureLabel(figure)), '', pageLink(figure.page));
      if (figure.caption) {
        const citation = figure.captionPage && figure.captionPage !== figure.page ? ' '+pageLink(figure.captionPage) : '';
        figureLines.push('', '**'+t('原文图注','Original caption')+'**'+citation, '', '> '+literal(figure.caption));
      }
      if (plain(myLine)) figureLines.push('', '**'+t('我的一句话','My takeaway')+'**', '', plain(myLine));
      const panelName = panel => panel ? literal(desk.describe(JSON.stringify([figure.id,panel]),lang).label || panel)+' · ' : '';
      for (const {panel,text} of comments) figureLines.push('', '**'+panelName(panel)+t('我的笔记','My note')+'**', '', plain(text));
      for (const [panel,text] of scripts) figureLines.push('', '**'+panelName(panel)+t('讲解','Speaking note')+'**', '', plain(text));
    }
    if (figureLines.length) lines.push('', '## '+t('逐图笔记','Figure notes'), ...figureLines);
    if (queue.length) lines.push('', '## '+t('汇报篮','Selected panels'));
    let number = 0;
    for (const {item} of queue) {
      signal.throwIfAborted();
      number++;
      if (!item.figure) throw Error(t('请在汇报篮中核对失去来源的小图。','Check the panel with a missing source in the slide basket.'));
      const {figure,recipe} = item;
      const name = figureLabel(figure)+' · '+item.label;
      lines.push('', '### '+number+'. '+literal(name), '', pageLink(figure.page)+' · '+webLink(t('读小图','Read panel'),back(figure.id,item.id,figure.page)));
      if (includeImages) {
        progress(t('正在保存小图 ','Saving panel ')+number+' / '+queue.length);
        if (!item.box || (recipe && !recipe.known)) throw Error(name+' · '+t('请先在阅读器里核对裁切和编号。','Check the crop and panel label in the reader.'));
        const parts = [item,...(item.shared || [])];
        for (const [index,part] of parts.entries()) {
          signal.throwIfAborted();
          const pic = await PaperPanelLabels.rendered(session,figure,part.box,part.recipe);
          const extension = pic.blob.type === 'image/jpeg' ? 'jpg' : 'png';
          const fileName = prefix+'-panel-'+number+(index?'-key-'+index:'')+'.'+extension;
          assets.push({name:fileName,blob:pic.blob});
          if (index) lines.push('',literal(part.label));
          lines.push('', '!['+literal(index ? part.label : name)+'](./attachments/'+fileName+')');
        }
      }
      const edited=state.figures?.[figure.id]?.sentences?.[item.id] !== undefined;
      addText(t('讲解','Speaking note'),edited ? item.sentence : literal(item.sentence));
    }
    signal.throwIfAborted();
    return {folder,note,markdown:lines.join('\n').trimEnd()+'\n',assets};
  }
  async function archive(pack,folderName) {
    const zip = new JSZip(), folder = zip.folder(folderName);
    for (const asset of pack.assets) folder.file('attachments/'+asset.name,asset.blob);
    folder.file(pack.note,pack.markdown);
    return zip.generateAsync({type:'blob',compression:'STORE'});
  }
  async function newFolder(root,stemName) {
    for (let n=1;;n++) {
      const name = n === 1 ? stemName : stemName+' ('+n+')';
      try { await root.getDirectoryHandle(name); }
      catch (error) {
        if (error.name === 'TypeMismatchError') continue;
        if (error.name !== 'NotFoundError') throw error;
        return root.getDirectoryHandle(name,{create:true});
      }
    }
  }
  async function saveVault(root,pack,signal) {
    async function write() {
      signal.throwIfAborted();
      const dir = await newFolder(root,pack.folder), created = [[root,dir.name]];
      async function put(parent,name,data) {
        signal.throwIfAborted();
        const handle = await parent.getFileHandle(name,{create:true});
        created.push([parent,name]);
        const stream = await handle.createWritable();
        try { await stream.write(data); await stream.close(); }
        catch (error) { await stream.abort().catch(()=>{}); throw error; }
      }
      try {
        if (pack.assets.length) {
          const media = await dir.getDirectoryHandle('attachments',{create:true});
          created.push([dir,'attachments']);
          for (const asset of pack.assets) await put(media,asset.name,asset.blob);
        }
        // Publish the note only after its last attachment has been written.
        await put(dir,pack.note,pack.markdown);
        return dir.name+'/'+pack.note;
      } catch (error) {
        for (const [parent,name] of created.reverse()) await parent.removeEntry(name).catch(()=>{});
        throw error;
      }
    }
    return navigator.locks ? navigator.locks.request('reading-desk-obsidian-export',write) : write();
  }
  function open(ctx) {
    const dialog = document.createElement('dialog');
    dialog.className = 'mm-dialog obs-dialog';
    const lang = ReaderLanguage.current;
    const t = (zh,en) => say(lang,zh,en);
    const element = (tag,value) => { const n=document.createElement(tag);n.textContent=value;return n; };
    const title = element('h2',t('导出到 Obsidian','Export to Obsidian'));
    title.id='obs-export-title';dialog.setAttribute('aria-labelledby',title.id);
    const close = element('button',t('关闭','Close'));
    close.className='mm-close';close.onclick=()=>dialog.close();
    const lead = element('p',t('把背景、目的、图注和自己的笔记存成一篇 Markdown 笔记。','Keep the background, aims, captions and your own notes in one Markdown note.'));
    const options = element('div','');options.className='obs-options';
    function option(label) {
      const row=element('label',''),input=document.createElement('input');
      input.type='checkbox';input.checked=true;row.append(input,element('span',label));options.append(row);return input;
    }
    const pdf=option(t('附上原文 PDF，可按页回看','Include the PDF with page links'));
    const count=ctx.state.queue?.length||0;
    const images=count?option(t('附上汇报篮的 '+count+' 张小图','Include '+count+' selected panel'+(count===1?'':'s'))):null;
    const controls=element('div','');controls.className='obs-actions';
    const status=element('p','');status.setAttribute('role','status');status.className='obs-status';
    const result=element('a','');result.hidden=true;
    const share=element('button',t('分享笔记包…','Share note bundle…'));share.type='button';share.hidden=true;
    let busy=false,downloadUrl='',shareFile=null;
    const controller=new AbortController();
    function resetResult() {
      if(downloadUrl){URL.revokeObjectURL(downloadUrl);downloadUrl=''}
      result.hidden=true;result.removeAttribute('href');result.removeAttribute('download');status.textContent='';
      share.hidden=true;shareFile=null;
    }
    function working(on) {
      busy=on;options.querySelectorAll('input').forEach(input=>input.disabled=on);
      controls.querySelectorAll('button').forEach(button=>button.disabled=on);
    }
    async function run(direct) {
      if(busy)return;
      resetResult();working(true);
      try {
        const root=direct?await window.showDirectoryPicker({id:'reading-desk-obsidian',mode:'readwrite'}):null;
        const pack=await build(ctx,{lang,includePdf:pdf.checked,includeImages:!!images?.checked},s=>status.textContent=s,controller.signal);
        const cached=await PaperShelf.keepForNote(ctx.id,ctx.file).then(()=>true,()=>false);
        controller.signal.throwIfAborted();
        if(root){
          status.textContent=t('正在写入笔记库…','Writing to the vault…');
          const path=await saveVault(root,pack,controller.signal);
          result.href='obsidian://open?vault='+encodeURIComponent(root.name)+'&file='+encodeURIComponent(path);
          result.textContent=t('在 Obsidian 打开笔记','Open note in Obsidian');
          status.textContent=t('已保存到 ','Saved to ')+root.name+' / '+path;
          result.hidden=false;
        }else{
          status.textContent=t('正在打包…','Creating the ZIP…');
          // ZIP importers cannot inspect an existing vault for a conflicting folder.
          const folderName=pack.folder+' ('+new Date().toISOString().slice(0,10)+' '+crypto.randomUUID().slice(0,8)+')';
          const blob=await archive(pack,folderName);
          controller.signal.throwIfAborted();
          downloadUrl=URL.createObjectURL(blob);result.href=downloadUrl;result.download=folderName+'.zip';
          result.textContent=t('重新下载笔记包','Download the ZIP again');result.hidden=false;result.click();
          if(typeof navigator.canShare==='function' && typeof navigator.share==='function'){
            const file=new File([blob],result.download,{type:'application/zip'});
            try{if(navigator.canShare({files:[file]})){shareFile=file;share.hidden=false;}}catch{/* The download link remains available. */}
          }
          status.textContent=t('把下载的 ZIP 解压到 Obsidian 库中，打开里面的 .md 笔记。','Extract the downloaded ZIP into your Obsidian vault and open the .md note.');
        }
        if(!cached)status.append(t(' 此浏览器未能保留原文。下次从笔记回到阅读器时，请重新选择这份 PDF。',' This browser could not keep a local copy. Select the original PDF when reopening a reader link.'));
      }catch(error){
        if(error.name==='AbortError')status.textContent=t('已取消。','Canceled.');
        else if(['SecurityError','NotAllowedError'].includes(error.name))status.textContent=t('可以重新选择允许写入的库，或下载笔记包。','Choose a writable vault or download the note bundle.');
        else status.textContent=plain(error.message)||t('导出未完成，请重试。','Export could not finish. Try again.');
      }finally{working(false)}
    }
    const canPick=window.isSecureContext&&typeof window.showDirectoryPicker==='function';
    function action(label,direct,primary) {
      const button=element('button',label);button.type='button';if(primary)button.className='primary';
      button.onclick=()=>run(direct);controls.append(button);
    }
    if(canPick)action(t('选择 Obsidian 库','Choose Obsidian vault'),true,true);
    action(t('下载笔记包','Download note bundle'),false,!canPick);
    const hint=element('small',canPick?t('选择库的根文件夹，或下载后解压到库中。','Choose the root folder of your vault, or download and extract the ZIP into it.'):
      t('下载后解压到 Obsidian 库中。','Download and extract the ZIP into your Obsidian vault.'));
    share.onclick=async()=>{
      if(!shareFile)return;
      try{await navigator.share({files:[shareFile]});}
      catch(error){if(error.name!=='AbortError')status.textContent=t('可通过下载链接保存同一份笔记包。','Use the download link to save the same note bundle.');}
    };
    options.onchange=resetResult;
    dialog.append(close,title,lead,options,controls,hint,status,result,share);
    dialog.addEventListener('close',()=>{controller.abort();resetResult();dialog.remove();ctx.restoreFocus?.()},{once:true});
    ctx.host.append(dialog);dialog.showModal();
    return dialog;
  }
  globalThis.ReadingObsidian = Object.freeze({open});
})();
