// Run the normal consent, cache and translation path with the real pinned weights.
// A local weight file changes transport only, so CI can reuse one verified download.
const assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const {createServer}=require('node:http');
const {chromium,webkit}=require('playwright-core');
const {openSource,selectText}=require('./selection-engine-browser.cjs');
const [url,output,corpus,papers]=process.argv.slice(2);
const weights=process.env.LOCAL_TRANSLATION_GGUF;
const faults=process.env.LOCAL_TRANSLATION_FAULTS==='1';
const modelOrigins=['https://modelscope.cn','https://huggingface.co'];
const results={browser:process.env.READER_BROWSER||'chrome',weightTransport:weights?'verified local file':'publisher CDN',rows:[],requests:[],externalPosts:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(results,null,2)+'\n');
async function main(){
  let server,browser,mirror,fault=faults?'interrupt':'none';
  try{
    if(weights){
      const size=fs.statSync(weights).size;assert.equal(size,1348432160);
      server=createServer((req,res)=>{
        const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
        const start=range?Number(range[1]):0,end=range&&range[2]?Number(range[2]):size-1;
        res.setHeader('Access-Control-Allow-Origin','*');
        res.setHeader('Access-Control-Expose-Headers','Content-Range');
        if(fault==='unavailable'){res.writeHead(503);res.end();return}
        if(range){res.statusCode=206;res.setHeader('Content-Range','bytes '+start+'-'+end+'/'+size)}
        if(fault==='interrupt'){
          fault='unavailable';
          // A truncated, otherwise genuine response leaves two verified chunks.
          const partialEnd=2*8388608+32768-1;res.setHeader('Content-Length',partialEnd+1);
          fs.createReadStream(weights,{start:0,end:partialEnd}).pipe(res);return;
        }
        res.setHeader('Content-Length',end-start+1);
        const file=fs.createReadStream(weights,{start,end});res.on('close',()=>file.destroy());file.pipe(res);
      });
      await new Promise((resolve,reject)=>{server.on('error',reject);server.listen(0,'127.0.0.1',resolve)});
      mirror='http://127.0.0.1:'+server.address().port+'/weights';
    }
    const browserName=results.browser;
    browser=browserName==='webkit'?await webkit.launch():await chromium.launch({channel:browserName});
    results.browserVersion=browser.version();
    const context=await browser.newContext({viewport:{width:1280,height:850},serviceWorkers:'block'});
    await context.addInitScript(()=>{
      window.localPaperEvidence=[];
      window.localEngineErrors=[];
      const original=console.error.bind(console);
      console.error=(...args)=>{
        for(const arg of args){
          if(!arg?.stage)continue;
          const chain=[];
          for(let e=arg;e&&chain.length<6;e=e.cause)chain.push({message:String(e.message||e),stack:e.stack});
          window.localEngineErrors.push(chain);
        }
        return original(...args);
      };
      document.addEventListener('reader-local-translation-context',e=>{
        window.localPaperEvidence.push({source:e.detail.source,context:e.detail.context||''});
      });
    });
    if(mirror&&browserName==='webkit'){
      // Playwright WebKit cannot fulfill a route with 307. Only redirect the two
      // weight URLs; native fetch still streams, hashes and persists real bytes.
      await context.addInitScript(({hosts,mirror})=>{
        const nativeFetch=window.fetch.bind(window);
        window.fetch=(input,options)=>{
          const u=new URL(input instanceof Request?input.url:input,location.href);
          return nativeFetch(hosts.includes(u.origin)&&u.pathname.endsWith('.gguf')?mirror:input,options);
        };
      },{hosts:modelOrigins,mirror});
    }else if(mirror)await context.route(u=>modelOrigins.includes(u.origin),async route=>{
      results.requests.push(route.request().headers().range||'complete');
      // Redirect rather than fulfilling a 1.35 GB body in Playwright memory.
      return route.fulfill({status:307,headers:{Location:mirror,'Access-Control-Allow-Origin':'*'}});
    });
    const page=await context.newPage();
    page.on('request',r=>{
      const origin=new URL(r.url()).origin;
      if((!weights&&modelOrigins.includes(origin))||(browserName==='webkit'&&r.url()===mirror))
        results.requests.push(r.headers().range||'complete');
      if(r.method()==='POST'&&origin!==new URL(url).origin)results.externalPosts.push(origin);
    });
    page.on('pageerror',err=>console.error(err.message));
    const fixture=path.join(__dirname,'fixtures','translation-selection.pdf');
    await openSource(page,fixture,'zh');await selectText(page,'water');
    const popup=page.locator('.local-translation:visible');
    assert.equal(results.requests.length,0);
    assert.match(await popup.locator('.selection-model-choice').innerText(),/1.35 GB/);
    if(process.env.LOCAL_TRANSLATION_CONSENT_SCREEN)await popup.screenshot({path:process.env.LOCAL_TRANSLATION_CONSENT_SCREEN});
    const cold=Date.now();await popup.locator('.selection-download-local').click();
    const finished=async()=>{
      await page.waitForFunction(()=>['translated','partial','error'].includes(document.querySelector('.local-translation:not([hidden])')?.dataset.translationState),null,{timeout:1200000});
      const state=await popup.getAttribute('data-translation-state');
      if(state==='error'){
        results.engineErrors=await page.evaluate(()=>window.localEngineErrors);
        throw new Error(await popup.innerText());
      }
      return popup.locator(':scope > p').innerText();
    };
    if(faults){
      assert.ok(mirror,'Fault injection requires a verified local weight file');
      await page.waitForFunction(()=>document.querySelector('.local-translation')?.dataset.translationStage==='download',null,{timeout:90000});
      assert.match(await popup.locator('blockquote').textContent(),/water/);
      results.interruptedRange=results.requests.at(-1);
      assert.match(results.interruptedRange,/^bytes=16777216-/);
      assert.ok(await popup.locator('.selection-use-quick').isVisible());
      fault='none';await popup.locator('.selection-translate').click();
    }
    results.firstText=await finished();results.coldMs=Date.now()-cold;
    if(faults){results.resumedRange=results.requests.at(-1);assert.equal(results.resumedRange,results.interruptedRange)}
    results.firstPaperContext=await page.evaluate(()=>window.localPaperEvidence);
    assert.ok(results.firstPaperContext.some(r=>r.source==='water'&&r.context),'First-use choice lost the selected paper');
    save();
    assert.match(results.firstText,/水/);
    assert.ok(results.requests.length>=1);
    if(process.env.LOCAL_TRANSLATION_SCREEN)await popup.screenshot({path:process.env.LOCAL_TRANSLATION_SCREEN});
    const before=results.requests.length;
    if(corpus){
      const inputs=fs.readFileSync(corpus,'utf8').trim().split(/\r?\n/).map(JSON.parse);
      const documents=papers?JSON.parse(fs.readFileSync(papers,'utf8')):{};
      await page.evaluate(async docs=>{
        const {indexPaperContext}=await import('./translation-context.js');
        window.indexedSources=new Map(Object.entries(docs).map(([doi,doc])=>[doi,indexPaperContext(doc.rows,doc.title,
          PaperSourceNotes.lookupFor([{key:'body',rows:doc.rows}]))]));
      },documents);
      for(const input of inputs){
        const record=await page.evaluate(async r=>{
          const start=performance.now(),{createTranslationSession}=await PaperLanguageText.session();
          const paperContext=window.indexedSources.get(r.doi)?.(r.source)||'';
          const session=createTranslationSession({source:r.source,from:r.from||'en',field:r.field||'auto',paperContext});
          await session.run();
          const units=session.units.map(u=>({id:u.id,status:u.status,source:u.source,text:u.text,engine:u.engine,
            validation:u.validation||{status:'failed',issues:[]},attempts:u.attempts,error:u.error?.message}));
          return {id:r.id,ms:Math.round(performance.now()-start),units,text:units.map(u=>u.text).join(' '),
            status:units.every(u=>u.status==='translated')?'translated':units.some(u=>u.status==='translated')?'partial':units.some(u=>u.text)?'review':'failed',
            paperContext};
        },input);
        results.rows.push(record);save();console.log(input.id,record.status,record.ms);
      }
    }
    await openSource(page,fixture,'zh');await selectText(page,'water');
    assert.equal(await popup.locator('.selection-model-choice').isVisible(),false);
    const warm=Date.now();await popup.locator('.selection-translate').click();
    results.reloadedText=await finished();results.reloadMs=Date.now()-warm;
    assert.match(results.reloadedText,/水/);
    assert.equal(results.requests.length,before,'Reopening the reader fetched model weights again');
    if(faults){
      await page.evaluate(async()=>{
        const {weightCacheName}=await import('./translation-weight-cache.js');
        const cache=await caches.open(weightCacheName);
        const key=(await cache.keys()).find(r=>r.url.endsWith('/1'));
        await cache.put(key,new Response('broken chunk'));
      });
      await openSource(page,fixture,'zh');await selectText(page,'water');
      await popup.locator('.selection-translate').click();assert.match(await finished(),/水/);
      assert.deepEqual(results.requests.slice(before),['bytes=8388608-16777215']);
      results.corruptionRepair=results.requests.at(-1);
    }
    assert.deepEqual(results.externalPosts,[]);
    console.log('PASS first-use consent, true local inference, persisted choice and verified weight reuse',results.coldMs,results.reloadMs);
  }finally{if(browser)await browser.close();if(server)server.close();save()}
}
main().catch(e=>{results.error=String(e);save();console.error(e);process.exitCode=1});
