const {chromium}=require('playwright-core'),fs=require('node:fs');
const [base,dest]=process.argv.slice(2);
(async()=>{
  const b=await chromium.launch({channel:'msedge'});const context=await b.newContext();
  const logs=[],stats={};const page=await context.newPage();
  const url=new URL('?lang=en',base).href;
  page.on('request',r=>{if(/[.]bin|[.]spm/.test(r.url()))logs.push(new URL(r.url()).pathname.split('/').pop())});
  async function prep(){await page.goto(url);await page.evaluate(async()=>{await PaperLanguageText.science();if(PaperLanguageText.session)await PaperLanguageText.session()})}
  async function translate(text){
    return page.evaluate(async text=>{const start=performance.now();try{
      const m=await PaperLanguageText.science();
      const out=await m.selectionTranslation(text,'en',PaperLanguageText.translate);return {ok:true,ms:Math.round(performance.now()-start),text:out.text}
    }catch(e){return {ok:false,ms:Math.round(performance.now()-start),stage:e.stage,message:e.message}}},text)
  }
  try{
    await prep();const cd=await context.newCDPSession(page);await cd.send('Network.enable');
    await cd.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:4*1024*1024,uploadThroughput:1024*1024});
    stats.slow=await translate('Blue light entered the glass.');stats.slowRequests=logs.slice();
    await cd.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await prep();await context.setOffline(true);stats.warmRestartOffline=await translate('The water cooled gradually.');
    await context.setOffline(false);stats.recovered=await translate('The water cooled gradually.');
    stats.cacheStorage=await page.evaluate(()=>caches.keys());
    console.log(stats);fs.writeFileSync(dest,JSON.stringify(stats,null,2));
  }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
