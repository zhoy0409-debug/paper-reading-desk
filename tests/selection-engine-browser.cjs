// Real uploaded PDF, native selections, shipped Bergamot files and WASM (no model API).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright-core');
const base = new URL(process.argv[2] || 'http://127.0.0.1:8174/read/');
const original = process.env.READER_ORIGINAL_PDF;
const fixture = path.join(__dirname, 'fixtures/translation-selection.pdf');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname,'../dist/vendor/bergamot/models.json'))).enzh;
const sentence = 'The blue light passed through the glass.';
const amount = 'The measured concentration was 0.25 mg/mL (Fig. 2c).';
const structure = /Abaucin comprises three\s+structural moieties[\s\S]{0,115}?phenyl group\s*\(Fig\.\s*3b\)\./i;

// Observe the bytes going into WASM and match replies to their actual RPCs.
function observeWorker() {
  const audit = window.selectionAudit = {starts:0, initialized:0, models:[], completed:0, errors:[]};
  const post = Worker.prototype.postMessage;
  const pending = new WeakMap();
  const timer=window.setTimeout.bind(window);
  window.setTimeout=(fn,ms,...args)=>timer(fn,audit.shortenDeadline && ms===120000 ? 100 : ms,...args);
  Worker.prototype.postMessage = function(message, ...args) {
    if (message?.name === 'initialize') {
      audit.starts++;
      const names = new Map();
      pending.set(this,names);
      this.addEventListener('message',({data})=>{
        const name=names.get(data.id);
        names.delete(data.id);
        if (data.error) audit.errors.push({name, message:data.error.message});
        else if(name==='initialize') audit.initialized++;
        else if(name==='translate') audit.completed++;
      });
    }
    const names = pending.get(this);
    if (names) {
      names.set(message.id,message.name);
      if (message.name==='loadTranslationModel') {
        const b=message.args[1];
        const check=async bytes=>({
          bytes:bytes.byteLength,
          sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('')
        });
        audit.models.push(Promise.all([b.model,b.shortlist,...b.vocabs].map(check)));
      }
      // Hold one real request to reproduce changing selections while work is in flight.
      if (message.name==='translate' && audit.holdNext) {
        audit.holdNext=false;
        audit.release=()=>{delete audit.release;post.call(this,message,...args)};
        return;
      }
      if(message.name==='translate' && audit.stallNext){audit.stallNext=false;return}
    }
    return post.call(this,message,...args);
  };
}

async function openSource(page,pdf) {
  await page.goto(new URL('?lang=en',base).href);
  await page.addLocatorHandler(page.locator('.gd-skip:visible'), b=>b.click());
  await page.locator('input[id$="-main"]').first().setInputFiles(pdf);
  await page.locator('.st-tools .lineActions').waitFor({state:'attached',timeout:120000});
  await page.locator('.st-menu').click();
  await page.locator('.st-tools button').filter({hasText:/Source index|查看原文索引/}).click();
  await page.locator('.pl-excerpt blockquote').first().waitFor();
}

async function selectText(page,pattern) {
  const re = typeof pattern==='string' ? new RegExp(pattern.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g,'\\$&')) : pattern;
  const quotes=page.locator('.pl-excerpt blockquote');
  async function locate(){
    const lines=await quotes.allTextContents(), joined=lines.join('\n'), match=joined.match(re);
    if(!match)return null;
    let offset=0, start, end;
    for(const [i,line] of lines.entries()){
      for(const [which,pos] of [[0,match.index],[1,match.index+match[0].length]]){
        if(pos>=offset && pos<=offset+line.length){
          if(which===0)start=[i,pos-offset];else end=[i,pos-offset];
        }
      }
      offset+=line.length+1;
    }
    return {start,end,text:match[0]};
  }
  let found=await locate();
  while (!found) {
    const more=page.getByRole('button',{name:/继续显示原文|Show more source|More source/i});
    if (!await more.count()) throw Error('Selected text was not found in the uploaded PDF: '+re);
    await more.click();
    found=await locate();
  }
  await quotes.nth(found.start[0]).scrollIntoViewIfNeeded();
  await quotes.evaluateAll((lines,{start,end})=>{
    const range=document.createRange();
    range.setStart(lines[start[0]].firstChild,start[1]);range.setEnd(lines[end[0]].firstChild,end[1]);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  },found);
  await page.locator('.local-translation:visible:not([data-translation-state]) .selection-translate:enabled').waitFor();
  return found.text;
}

async function run(page, stage, selected) {
  const popup=page.locator('.local-translation:visible');
  await popup.locator('.selection-translate').click();
  const state=stage?'error':'translated';
  await page.waitForFunction(({state,stage})=>{
    const el=document.querySelector('.local-translation:not([hidden])');
    return el?.dataset.translationState===state && (!stage||el.dataset.translationStage===stage);
  },{state,stage},{timeout:200000}).catch(async error=>{
    throw new Error('Expected '+(stage||state)+'; saw '+await popup.innerText(),{cause:error});
  });
  assert.equal(await popup.locator('blockquote').textContent(),selected);
  const output=popup.locator(':scope > p');
  if (stage) {
    assert(await popup.locator('.selection-translate').isEnabled());
    assert.equal(await output.getAttribute('lang'),null);
    console.log('Recovered test stage:',stage, (await output.innerText()).trim());
  } else {
    assert.equal(await output.getAttribute('lang'),'zh-CN');
    assert.notEqual(await output.textContent(),selected);
  }
  return output.textContent();
}
function checkStructure(text) {
  assert.match(text,/Abaucin.*三个结构单元/);
  assert.match(text,/benzoxazine.*piperidine.*trifluoromethyl-phenyl.*基团.*图\s*3b/i);
  assert.doesNotMatch(text,/吡啶|comprises|moieties|73140\d|待核对/);
}

async function verify(browser) {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const requests=[], responses=[], errors=[];
  let navigation=0, fault=process.argv.includes('--healthy')?'':'registry';
  await page.addInitScript(observeWorker);
  page.on('framenavigated',f=>{if(f===page.mainFrame())navigation++});
  page.on('console',msg=>{
    if(msg.type()==='error' && msg.text().includes('[Reading Desk · selection'))
      errors.push(msg.args().at(-1).evaluate(e=>({stage:e.stage,stack:e.stack,cause:e.cause?.stack})));
  });
  page.on('request',r=>{if(r.url().includes('/bergamot/'))requests.push(new URL(r.url()).pathname)});
  page.on('response',r=>{if(r.url().includes('/bergamot/'))responses.push([new URL(r.url()).pathname,r.status()])});
  const registryUrl=new URL('vendor/bergamot/models.json',base).href;
  const vocab=path.basename(manifest.srcvocab.name);
  if (fault) {
    await page.route(registryUrl,async route=>{
      if (fault==='registry') return route.abort('failed');
      if (fault==='manifest') {
        const response=await route.fetch();
        const data=await response.json();delete data.enzh.shortlist;
        return route.fulfill({response,json:data});
      }
      return route.continue();
    });
    await page.route('**/bergamot-translator-worker.wasm',route=>fault==='wasm'
      ? route.fulfill({contentType:'application/wasm',body:Buffer.from('not WASM')}) : route.continue());
    await page.route('**/'+vocab,route=>fault==='file' ? route.fulfill({status:503,body:'Interrupted'})
      : fault==='digest' ? route.fulfill({body:Buffer.from('corrupt transfer')}) : route.continue());
  }
  await openSource(page,fixture);
  const word=await selectText(page,'water');
  const keep=await page.locator('.pl-excerpt blockquote').first().elementHandle();
  const opened=navigation;
  if(fault) {
    for(const [scenario,stage] of [['registry','download'],['manifest','model'],['wasm','worker'],['file','download'],['digest','integrity']]) {
      fault=scenario;await run(page,stage,word);
    }
    fault='';
  }
  assert.equal(await run(page,null,word),'水');
  assert(await keep.evaluate(el=>el.isConnected));
  assert.equal(navigation,opened,'Retry must leave the current paper open');
  const requestCount=part=>requests.filter(url=>url.endsWith('/'+path.basename(manifest[part].name))).length;
  const expectedRetries=process.argv.includes('--healthy')?1:3;
  assert.equal(requestCount('srcvocab'),expectedRetries);
  for(const part of ['model','shortlist','trgvocab']) assert.equal(requestCount(part),1,part+' refetched');
  const expectedInit=expectedRetries===1?1:2;
  const audit=await page.evaluate(async()=>{
    const a=window.selectionAudit;
    return {starts:a.starts,initialized:a.initialized,model:await a.models[0],loads:a.models.length,completed:a.completed};
  });
  assert.equal(audit.starts,expectedInit);assert.equal(audit.initialized,1);assert.equal(audit.loads,1);
  for(const [i,part] of ['model','shortlist','srcvocab','trgvocab'].entries()) {
    assert(audit.model[i].bytes>0);assert.equal(audit.model[i].sha256,manifest[part].expectedSha256Hash);
    const pathname=new URL(manifest[part].name,base).pathname;
    assert(responses.some(([p,status])=>p===pathname&&status===200),pathname);
  }
  assert(responses.some(([p,status])=>p===new URL(registryUrl).pathname && status===200));
  if(expectedRetries>1){
    const logged=await Promise.all(errors);
    for(const stage of ['download','worker','integrity'])assert(logged.some(e=>e.stage===stage&&e.stack&&e.cause),stage);
  }
  console.log('PASS',JSON.stringify({worker:audit,srcvocabRequests:expectedRetries,navigationsDuringRetry:navigation-opened,word:'水'}));
  for(const [input,check] of [
    [sentence,t=>assert.match(t,/蓝光.*玻璃/)],
    [amount,t=>assert.match(t,/0\.25\s*mg\/mL.*图\s*2c/)],
    [structure,checkStructure]
  ]) {
    await page.locator('.selection-close:visible').click();
    const source=await selectText(page,input), result=await run(page,null,source);
    check(result); console.log('PASS selection:',source,'=>',result);
  }
  await page.locator('.selection-close:visible').click();
  await selectText(page,sentence);
  await page.evaluate(()=>{selectionAudit.holdNext=true});
  await page.locator('.selection-translate:visible').click();
  await page.waitForFunction(()=>typeof selectionAudit.release==='function');
  await selectText(page,amount);
  await page.locator('.selection-translate:visible').click();
  await page.evaluate(()=>selectionAudit.release());
  const result=page.locator('.local-translation[data-translation-state=translated] > p');
  await result.waitFor();
  assert.match(await result.textContent(),/0\.25\s*mg\/mL.*图\s*2c/);
  assert.equal(await page.locator('.local-translation blockquote').textContent(),amount);
  assert.equal(await page.evaluate(()=>selectionAudit.starts),expectedInit);
  console.log('PASS two overlapping native selections share the Worker; only the latest updates the popup.');
  if(expectedRetries>1){
    await page.locator('.selection-close:visible').click();
    const stalled=await selectText(page,'water');
    await page.evaluate(()=>{selectionAudit.shortenDeadline=true;selectionAudit.stallNext=true});
    await run(page,'timeout',stalled);
    await page.evaluate(()=>{selectionAudit.shortenDeadline=false});
    assert.equal(await run(page,null,stalled),'水');
    assert.equal(await page.evaluate(()=>selectionAudit.starts),expectedInit+1);
    assert.equal(requestCount('model'),1);assert.equal(requestCount('srcvocab'),expectedRetries);
    console.log('PASS a stalled translation reached its deadline; retry replaced that Worker and reused the verified model files.');
  }
  await page.close();
  if(original){
    const article=await browser.newPage({viewport:{width:1440,height:1000}});
    await openSource(article,original);
    const source=await selectText(article,structure);
    const actual=await run(article,null,source);checkStructure(actual);
    const ref=article.locator('.pl-excerpt').filter({hasText:/Abaucin comprises three/i}).first().locator('.pl-anchor');
    console.log('PASS original PDF:',await ref.innerText(),JSON.stringify(source),'=>',actual);
    if(process.env.READER_TRANSLATION_CAPTURE)await article.locator('.local-translation').screenshot({path:process.env.READER_TRANSLATION_CAPTURE});
    await article.close();
  }
}
(async()=>{
  const browser=process.env.READER_BROWSER==='webkit' ? await webkit.launch()
    : await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium'});
  try{await verify(browser)}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
