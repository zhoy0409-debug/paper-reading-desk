// Upload the bundled paper and inspect the files a reader can take into a vault.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {chromium,webkit,devices} = require('playwright-core');
const base = process.argv[2] || 'http://127.0.0.1:8192/';
const webkitRun = process.env.READER_BROWSER === 'webkit';
const lang = process.env.OBSIDIAN_LANG || 'en';
const example = path.resolve(__dirname,'../dist/media/2007.08902.pdf');
const note = 'Different datasets peak at different settings.';
const privateNote = 'Check the orange curve with my group.';
const script = 'Compare these two curves before reporting the peak.';

async function check() {
  const engine=webkitRun?webkit:chromium;
  const browser=await engine.launch(webkitRun?{}:{channel:process.env.READER_BROWSER_CHANNEL || (process.platform==='win32'?'msedge':'chromium')});
  try {
    const ctx=await browser.newContext(webkitRun?{...devices['iPhone 13'],locale:'en-US'}:{viewport:{width:1440,height:950},locale:lang==='zh'?'zh-CN':'en-US'});
    const page=await ctx.newPage();
    await page.addInitScript(mockPicker=>{
      // Keep test writes in the browser's own disposable file system.
      if(mockPicker)window.showDirectoryPicker=async()=> (await navigator.storage.getDirectory()).getDirectoryHandle('Test vault',{create:true});
    },!webkitRun);
    await page.addLocatorHandler(page.locator('.gd-layer .gd-skip:visible'),button=>button.click());
    await page.goto(new URL('?lang='+lang,base).href,{waitUntil:'domcontentloaded'});
    await page.locator('input[id$="-main"]').first().setInputFiles(example);
    const figure=page.locator('.lens-cell[data-figure^="F:8@"]').first();
    await figure.waitFor({state:'visible',timeout:120000});
    await figure.click();
    const tabs=page.locator('.st-dock .frw-panel-tab');
    const lens=page.locator('.lens-card textarea');
    await lens.fill(note);
    for(const letter of ['B','A']){
      await tabs.filter({hasText:new RegExp('^'+letter+'$')}).click();
      const add=page.locator('.rq-add-slide:visible');
      await add.click();
    }
    const more=page.locator('.st-more');
    await more.locator(':scope>summary').click();
    const priv=more.locator('details').filter({has:page.locator('textarea[maxlength="6000"]')});
    await priv.locator(':scope>summary').click();
    await priv.locator('textarea').fill(privateNote);
    const report=more.locator('.pd-report');
    if (!await report.locator('textarea').isVisible()) await report.locator(':scope>summary').click();
    await report.locator('textarea').fill(script);
    await priv.getByRole('button',{name:/Obsidian/}).click();
    await page.locator('dialog.obs-dialog .mm-close').click();
    await page.locator('.st-menu').click();
    await page.locator('.st-obsidian').click();
    const dialog=page.locator('dialog.obs-dialog');
    const labels=dialog.locator('input');
    assert.equal(await labels.count(),2);
    const rect=await dialog.boundingBox();
    assert.ok(rect.x>=0 && rect.x+rect.width<=page.viewportSize().width+1);
    const download=dialog.getByRole('button',{name:/下载笔记包|Download note bundle/});
    async function exported() {
      const waiting=page.waitForEvent('download',{timeout:180000});
      await download.click();
      const d=await waiting;assert.match(d.suggestedFilename(),/\.zip$/);
      const bytes=await fs.readFile(await d.path());
      const files=await page.evaluate(async data=>{
        const zip=await JSZip.loadAsync(data,{base64:true}),result={images:[],pdf:'',markdown:'',files:[]};
        for(const [name,entry] of Object.entries(zip.files)){
          if(entry.dir)continue;
          result.files.push(name);
          if(name.endsWith('.md'))result.markdown=await entry.async('string');
          if(name.endsWith('.pdf')){
            const sum=await crypto.subtle.digest('SHA-256',await entry.async('arraybuffer'));
            result.pdf=Array.from(new Uint8Array(sum),v=>v.toString(16).padStart(2,'0')).join('');
          }
          if(/\.(png|jpg)$/.test(name)){
            const blob=await entry.async('blob'),pic=new Image();
            pic.src=URL.createObjectURL(blob);
            try{await pic.decode();result.images.push([name,pic.naturalWidth,pic.naturalHeight]);}finally{URL.revokeObjectURL(pic.src)}
          }
        }
        return result;
      },bytes.toString('base64'));
      return {files,bytes};
    }
    const {files,bytes}=await exported();
    assert.equal(files.pdf,createHash('sha256').update(await fs.readFile(example)).digest('hex'));
    assert(files.images.length>=2&&files.images.every(([,w,h])=>w>10 && h>10));
    assert(files.markdown.includes(note)&&files.markdown.includes(script)&&files.markdown.includes(privateNote));
    const names=files.markdown.split('\n').filter(s=>/^### [12]\. /.test(s));
    assert.match(names[0],/ · B$/);assert.match(names[1],/ · A$/);
    assert.match(files.markdown,/#page=12\b/);
    assert.match(files.markdown,lang==='en'?/## (?:Background|Aims)/:/## 研究(?:背景|目的)/);
    for(const [image] of files.images)assert(files.markdown.includes('./attachments/'+image.split('/').at(-1)));
    if(process.env.OBSIDIAN_OUTPUT)await fs.writeFile(process.env.OBSIDIAN_OUTPUT,bytes);
    if(!webkitRun){
      const choose=dialog.getByRole('button',{name:/选择 Obsidian 库|Choose Obsidian vault/});
      const open=dialog.locator('a[href^="obsidian://open"]');
      await choose.click();await open.waitFor({timeout:120000});
      const target=new URL(await open.getAttribute('href'));
      assert.equal(target.searchParams.get('vault'),'Test vault');
      const first=target.searchParams.get('file');
      async function readVault(file,edit=false){
        return page.evaluate(async({file,edit})=>{
          const root=await (await navigator.storage.getDirectory()).getDirectoryHandle('Test vault');
          const [folder,name]=file.split('/'),dir=await root.getDirectoryHandle(folder);
          const handle=await dir.getFileHandle(name);
          if(edit){const w=await handle.createWritable();await w.write('My edits in Obsidian');await w.close();}
          const media=await dir.getDirectoryHandle('attachments'),assets=[];
          for await(const [name,entry] of media.entries())assets.push([name,(await entry.getFile()).size]);
          return {note:await (await handle.getFile()).text(),assets};
        },{file,edit});
      }
      const vault=await readVault(first);assert.equal(vault.note,files.markdown);assert.equal(vault.assets.length,files.files.length-1);
      await readVault(first,true);
      await choose.click();await open.waitFor({timeout:120000});
      const second=new URL(await open.getAttribute('href')).searchParams.get('file');
      assert.notEqual(first,second);assert.equal((await readVault(first)).note,'My edits in Obsidian');assert.equal((await readVault(second)).note,files.markdown);
      await page.evaluate(()=>{
        // Fail at the final Markdown write, after real attachments have been written.
        const prototype=FileSystemFileHandle.prototype,original=prototype.createWritable;
        prototype.createWritable=function(...args){
          if(this.name.endsWith('.md')){prototype.createWritable=original;throw new DOMException('Test disk full','QuotaExceededError');}
          return original.apply(this,args);
        };
      });
      await choose.click();
      await dialog.getByRole('status').filter({hasText:'Test disk full'}).waitFor({timeout:120000});
      const folders=await page.evaluate(async()=>{
        const root=await (await navigator.storage.getDirectory()).getDirectoryHandle('Test vault');
        const names=[];for await(const name of root.keys())names.push(name);return names;
      });
      assert.deepEqual(folders.sort(),[first.split('/')[0],second.split('/')[0]].sort());
    }
    await labels.nth(0).uncheck();await labels.nth(1).uncheck();
    const light=(await exported()).files;
    assert.equal(light.files.length,1);assert(light.markdown.includes(script));assert(!light.markdown.includes('./attachments/'));
    assert.notEqual(light.files[0].split('/')[0],files.files[0].split('/')[0],'Extracting again preserves previous vault edits');
    const jump=light.markdown.match(/\]\((https?:[^)\s]+[?&]figure=page-only-12[^)\s]*)\)/);
    assert(jump,'A text-only note has a source-page link that can be opened in the reader.');
    const cachedHash=await page.evaluate(async()=>{
      const database=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('paper-tree.v9.files');
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
      });
      try{
        const cached=await new Promise((resolve,reject)=>{
          const request=database.transaction('pdf').objectStore('pdf').get('recent');
          request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });
        const byId=await new Promise((resolve,reject)=>{
          const request=database.transaction('pdf').objectStore('pdf').get(cached.id);
          request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });
        if(!(byId?.bytes instanceof ArrayBuffer))throw Error('Returning to an exported note requires its paper after the recent paper changes.');
        await new Promise((resolve,reject)=>{
          const tx=database.transaction('pdf','readwrite');tx.objectStore('pdf').delete('recent');
          tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error);
        });
        const hash=await crypto.subtle.digest('SHA-256',byId.bytes);
        return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
      }finally{database.close()}
    });
    assert.equal(cachedHash,files.pdf,'A new tab has its own readable copy of the original PDF.');
    const revisit=await ctx.newPage();await revisit.goto(jump[1],{waitUntil:'domcontentloaded'});
    await revisit.locator('.lens-cell[aria-current="true"][data-figure="page-only-12"]').waitFor({state:'attached',timeout:120000});
    assert.equal(await revisit.locator('[data-locale="'+lang+'"]').getAttribute('aria-pressed'),'true');
    if(!webkitRun){
      // Older releases saved a File, which on newer browsers also has a bytes() method.
      // The reader shows the figure while its recent-paper copy is still being saved.
      await revisit.waitForFunction(id=>sessionStorage.getItem('paper-tree.v9.active')===id,new URL(jump[1]).searchParams.get('paper'));
      await revisit.evaluate(async()=>{
        const database=await new Promise((resolve,reject)=>{
          const request=indexedDB.open('paper-tree.v9.files');
          request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
        });
        try{
          await new Promise((resolve,reject)=>{
            const tx=database.transaction('pdf','readwrite'),store=tx.objectStore('pdf'),read=store.get('recent');
            read.onsuccess=()=>{
              const {id,file}=read.result;store.put(new File([file.bytes],file.name,{type:'application/pdf'}),id);
            };
            tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);
          });
        }finally{database.close()}
      });
      await revisit.goto(jump[1],{waitUntil:'domcontentloaded'});
      await revisit.locator('.lens-cell[aria-current="true"][data-figure="page-only-12"]').waitFor({state:'attached',timeout:120000});
    }
    console.log('PASS '+engine.name()+' '+lang+' upload, Markdown, selected order, PDF page, image pixels, personal notes, optional attachments'+(webkitRun?'':', vault write and edit preservation'));
  }finally{await browser.close()}
}
check().catch(e=>{console.error(e);process.exitCode=1});
