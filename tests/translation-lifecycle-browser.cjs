const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright-core');
const url=process.argv[2],duration=Number(process.env.SOAK_SECONDS||3)*1000;
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({channel:process.env.READER_BROWSER||'chromium'});
  const page=await browser.newPage({serviceWorkers:'block'});
  try{
    await page.addInitScript(()=>{
      window.workerStats={starts:0,ends:0};const Native=Worker,timer=setTimeout;
      window.Worker=class extends Native{
        constructor(...args){super(...args);this.translation=String(args[0]).includes('translator-worker.js');if(this.translation)workerStats.starts++}
        terminate(){if(this.translation)workerStats.ends++;return super.terminate()}
      };
      window.setTimeout=(fn,ms,...args)=>timer(fn,ms===300000&&window.fastIdle?150:ms,...args);
    });
    await page.goto(url+'?lang=en');
    const one=text=>page.evaluate(async text=>{const lib=await PaperLanguageText.session();
      const s=lib.createTranslationSession({source:text,from:'en'});await s.run();
      return {status:s.units[0].status,stage:s.units[0].error?.stage,text:s.units[0].text}},text);
    assert.equal((await one('Light crossed the room.')).status,'translated');
    const worker=page.workers().find(w=>w.url().includes('translator-worker.js'));
    assert.ok(worker,'expected a running Bergamot Worker');
    // Drop its next real RPC response, then raise an uncaught exception inside that
    // Worker. A page route cannot reliably intercept a dedicated worker's entry script.
    await worker.evaluate(()=>{
      self.postMessage=()=>setTimeout(()=>{throw new Error('Intentional worker crash')},0);
    });
    const broken=await one('Water remained clear.');assert.equal(broken.status,'failed');assert.equal(broken.stage,'worker');
    assert.equal((await one('Water remained clear.')).status,'translated');
    const started=Date.now();let count=0;
    while(Date.now()-started<duration){
      const result=await one('The temperature was '+(16+(count++%37))+'.');
      assert.equal(result.status,'translated');
      await pause(duration>10000?900:60);
    }
    const before=await page.evaluate(()=>({...workerStats}));assert.equal(before.starts,2);
    await page.evaluate(()=>{window.fastIdle=true});
    await one('The light reached the screen.');
    await page.waitForFunction(n=>workerStats.ends>n,before.ends);
    await one('A mirror reflected the beam.');
    const after=await page.evaluate(()=>({...workerStats}));assert.equal(after.starts,3);
    const result={readingSeconds:(Date.now()-started)/1000,selections:count,crashRecovered:true,stage:broken.stage,beforeIdle:before,afterIdle:after,
      idleTest:'Five-minute timer accelerated only for idle teardown'};
    if(process.env.SOAK_RESULT)fs.writeFileSync(process.env.SOAK_RESULT,JSON.stringify(result,null,2));
    console.log('PASS',JSON.stringify(result));
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
