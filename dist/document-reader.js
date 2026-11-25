(function () {
  'use strict';
  const base = new URL('./vendor/pdf/', document.currentScript.src);
  const MB = 1024 * 1024;
  let library;
  function limit(value, fallback, max) { return Math.max(1, Math.min(max, Number(value) || fallback)); }
  function context(options) {
    const list = [], warnings = [];
    const maxRecords = limit(options.maxRecords, 1500, 4500), maxChars = limit(options.maxChars, 180000, 520000);
    let size = 0, clipped = false;
    return { records:list, warnings, get full() { return clipped || size >= maxChars || list.length >= maxRecords; },
      add(location, text, metadata) {
        const str = text.trim();
        if (!str) return;
        if (list.length >= maxRecords || size >= maxChars) { clipped = true; return; }
        const selected = str.slice(0,maxChars-size);
        size += selected.length;
        if (selected.length !== str.length) clipped = true;
        list.push({location,text:selected,...metadata});
      }
    };
  }
  async function pageText(page) {
    if (typeof globalThis.ReadableStream?.prototype[Symbol.asyncIterator] === 'function')
      return page.getTextContent();
    // Older WebKit supports reading a stream but cannot iterate it with for-await.
    const reader = page.streamTextContent().getReader();
    const text = {items:[], styles:Object.create(null), lang:null};
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) return text;
        text.lang ??= value.lang;
        Object.assign(text.styles, value.styles);
        text.items.push(...value.items);
      }
    } finally { reader.releaseLock(); }
  }
  async function openPdf(file) {
    const [buffer,pdfjs] = await Promise.all([file.arrayBuffer(),library ||= import(new URL('pdf.min.mjs?build=5.6.205-legacy',base).href).catch(e=>{library=null;throw e})]);
    if(!/%PDF-\d/.test(new TextDecoder('latin1').decode(buffer.slice(0,1024))))throw Error('没有找到 PDF 文件头。');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs?build=5.6.205-legacy',base).href;
    const task = pdfjs.getDocument({data:new Uint8Array(buffer),
      cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,
      standardFontDataUrl:new URL('standard_fonts/',base).href,wasmUrl:new URL('wasm/',base).href,useWasm:false,
      isEvalSupported:false,disableFontFace:true,useSystemFonts:false,
      enableXfa:false,stopAtErrors:false});
    const textCache=new Map();
    let retained=0,closed=false;
    async function text(page){
      const n=page.pageNumber;
      if(textCache.has(n))return textCache.get(n);
      const data=await pageText(page);
      if(!closed && !textCache.has(n) && data.items.length<=6500){
        while(textCache.size && retained+data.items.length>36000){
          const oldest=textCache.keys().next().value;retained-=textCache.get(oldest).items.length;textCache.delete(oldest);
        }
        textCache.set(n,data);retained+=data.items.length;
      }
      return data;
    }
    return {task,pdfjs,text,async destroy(){if(closed)return;closed=true;textCache.clear();await task.destroy().catch(()=>{})}};
  }
  async function readPdf(file, ctx, options) {
    const source=await openPdf(file);
    try {
      const pdf = await source.task.promise;
      let pagesRead = 0,lastReport=0;
      const empty = [], failed = [];
      for (let n=1; n <= Math.min(pdf.numPages,80) && !ctx.full; n++) {
        pagesRead = n;
        let page;
        try {
          page = await pdf.getPage(n);
          const data = await source.text(page);
          let line = '', prev, prevWidth=0, idx=0;
          function emit() { if (line.trim()) ctx.add('第 '+n+' 页 · 文字段 '+(++idx),line,{page:n}); line=''; }
          for (const x of data.items) {
            if (typeof x.str !== 'string') continue;
            if (ctx.full) break;
            const xform=x.transform||[];
            if (prev && line && xform.length===6 && prev.length===6 &&
                Math.abs(xform[5]-prev[5]) > Math.max(2, Math.abs(xform[3])*.35)) emit();
            if (x.str) line += (line && !/\s$/.test(line) && !/^\s/.test(x.str) &&
              prev && xform[4]-(prev[4]+prevWidth)>Math.max(.7,Math.abs(xform[3])*.09) ? ' ' : '') + x.str;
            prev=xform;prevWidth=x.width||0;
            if(x.hasEOL) emit();
          }
          if (line) emit();
          if (!idx) empty.push(n);
        } catch (_) { failed.push(n); }
        finally { if(page) page.cleanup(); }
        const now=performance.now();
        if(options.onProgress&&(n===1||now-lastReport>=160)){
          options.onProgress(n,Math.min(pdf.numPages,80));lastReport=now;
        }
      }
      if (empty.length) ctx.warnings.push('未提取到文字的页：'+empty.join('、')+'。扫描、图片中的文字和图形本身暂不识别。');
      if (failed.length) ctx.warnings.push('无法读取的页：'+failed.join('、')+'。其他页仍可用。');
      if (pagesRead < pdf.numPages || ctx.full) ctx.warnings.push('此预览只整理了前 '+pagesRead+' 页中可读取的部分，不代表全文。');
      if(options.keepPdf)ctx.pdfSource=source;
      return ['PDF 共 '+pdf.numPages+' 页','已检查前 '+pagesRead+' 页的文字层'];
    } catch (e) {
      if (e?.name === 'PasswordException') throw new Error('这个 PDF 有密码保护。可改用你已有的未加密副本。');
      throw new Error('无法读取这个 PDF。请确认文件可以正常打开，或试用可复制文字的版本。');
    } finally { if(!ctx.pdfSource)await source.destroy(); }
  }
  function docEntry(data) {
    const dv = new DataView(data), length = data.byteLength, bytes = new Uint8Array(data);
    if (length < 22) throw Error('无法读取：文件不是完整的 Word DOCX。');
    const u16 = n=>dv.getUint16(n,true), u32=n=>dv.getUint32(n,true);
    let end=-1;
    for(let n=length-22;n>=Math.max(0,length-65557);n--) {
      if(u32(n)===0x06054b50 && n+22+u16(n+20)===length) {end=n;break;}
    }
    if(end<0 || u16(end+4)||u16(end+6)) throw Error('无法读取这个 DOCX 文件包。');
    const count=u16(end+10), central=u32(end+16), cdEnd=central+u32(end+12);
    if(count>10000 || cdEnd>end || central>cdEnd) throw Error('DOCX 文件包超出预览范围。');
    let at=central;
    for(let i=0;i<count;i++){
      if(at+46>cdEnd || u32(at)!==0x02014b50) break;
      const fn=u16(at+28), extra=u16(at+30), comment=u16(at+32);
      const next=at+46+fn+extra+comment;
      if(next>cdEnd) break;
      const name=new TextDecoder().decode(bytes.subarray(at+46,at+46+fn));
      if(name==='word/document.xml'){
        const flags=u16(at+8), method=u16(at+10), used=u32(at+20), expected=u32(at+24), pos=u32(at+42);
        if(flags&1) throw Error('这个 DOCX 有密码保护。');
        if(expected>12*MB || used>12*MB || pos+30>central || u32(pos)!==0x04034b50)
          throw Error('DOCX 正文超过预览范围，或文件已损坏。');
        const begin=pos+30+u16(pos+26)+u16(pos+28);
        if(begin+used>central || (method!==0 && method!==8))
          throw Error('不支持这个 DOCX 的打包格式。');
        return {part:bytes.subarray(begin,begin+used),method,expected};
      }
      at=next;
    }
    throw Error('未找到 DOCX 的正文。旧版 .doc 请另存为 .docx 或导出 PDF。');
  }
  async function inflate(entry) {
    if (entry.method===0) {
      if(entry.part.length!==entry.expected) throw Error('DOCX 正文不完整。');
      return entry.part;
    }
    if(typeof DecompressionStream!=='function') throw Error('当前浏览器不能读取 DOCX。试用新版浏览器或导出 PDF。');
    const reader = new Blob([entry.part]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const out=new Uint8Array(entry.expected);
    let n=0;
    try {
      while(true) {
        const v=await reader.read(); if(v.done) break;
        if(n+v.value.length>out.length) throw Error('DOCX 解压大小与文件记录不符。');
        out.set(v.value,n); n+=v.value.length;
      }
    } finally { await reader.cancel().catch(()=>{}); }
    if(n!==out.length) throw Error('DOCX 正文不完整。');
    return out;
  }
  async function readWord(file,ctx) {
    const bytes=await inflate(docEntry(await file.arrayBuffer()));
    const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw Error('不支持包含外部实体声明的 Word 文件。');
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.getElementsByTagName('parsererror').length) throw Error('Word 正文格式有误。');
    const ns=doc.documentElement.namespaceURI;
    if(!/wordprocessingml/.test(ns||'')) throw Error('无法读取这个 Word 正文格式。');
    const p=doc.getElementsByTagNameNS(ns,'p');
    let examined=0;
    for(let i=0; i<p.length && !ctx.full; i++) {
      examined=i+1;
      const tokens=[...p[i].getElementsByTagNameNS(ns,'t')].filter(t=>{
        let parent=t.parentElement;
        for(;parent && parent!==p[i];parent=parent.parentElement) {
          if(['del','moveFrom','p'].includes(parent.localName)) return false;
        }
        return parent===p[i];
      });
      const str=tokens.map(t=>t.textContent).join('');
      const style=p[i].getElementsByTagNameNS(ns,'pStyle')[0]?.getAttributeNS(ns,'val')||'';
      ctx.add('正文段落 '+(i+1),str,{heading:/^(?:heading|title|标题)[ _-]*\d*$/i.test(style)});
    }
    if(examined<p.length||ctx.full) ctx.warnings.push('正文只提取到第 '+examined+' 段附近。');
    ctx.warnings.push('仅提取 Word 正文中的文字，不读取嵌入图片、批注或未接受的删除内容。');
    return ['Word 文档 · DOCX','已检查 '+examined+' 个正文段落'];
  }
  async function read(file, options={}) {
    if(!file || !Number.isFinite(file.size)|| file.size<1) throw Error('文件是空的。');
    const ext=(file.name||'').split('.').pop().toLowerCase();
    if(ext==='tif' || ext==='tiff') {
      if(!window.PaperStoryTiff) throw Error('当前环境还未载入 TIFF 预览。');
      return window.PaperStoryTiff.read(file);
    }
    const maxSize=ext==='pdf'?64:35;
    if(file.size>maxSize*MB)throw Error('此格式的本地读取上限为 '+maxSize+' MiB，可选相关章节的副本。');
    const ctx=context(options);
    let facts;
    if(ext==='pdf') facts=await readPdf(file,ctx,options);
    else if(ext==='docx') facts=await readWord(file,ctx);
    else if(ext==='doc') throw Error('旧版 .doc 暂不支持，另存为 .docx 或 PDF 后即可读取。');
    else if(ext==='txt') {
      (await file.text()).split(/\r?\n/).some((line,i)=>{
        if(ctx.full) return true;
        ctx.add('第 '+(i+1)+' 行',line); return false;
      });
      if(ctx.full) ctx.warnings.push('长文本只显示了前一部分。');
      facts=['TXT 文本'];
    } else throw Error('当前可读取 PDF、DOCX 或 TXT 的文字。');
    if(!ctx.records.length) ctx.warnings.push('没有可定位的正文文字。不会根据文件名生成解读。');
    return {facts,warnings:ctx.warnings,records:ctx.records,...(ctx.pdfSource?{pdfSource:ctx.pdfSource}:{})};
  }
  window.PaperStoryDocuments={read,pageText,openPdf};
})();
