const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const base=process.argv[2],channel=process.env.READER_BROWSER||'chromium';
(async()=>{
  const browser=await chromium.launch({channel});
  const context=await browser.newContext(),page=await context.newPage(),requests=[];
  page.on('request',r=>{if(/\.(?:bin|spm)$/.test(r.url()))requests.push(new URL(r.url()).pathname.split('/').pop())});
  async function open(){
    await page.goto(new URL('?lang=en',base).href);
    await page.evaluate(async()=>{await PaperLanguageText.science();await PaperLanguageText.session()});
  }
  const translate=text=>page.evaluate(async text=>{
    const {createTranslationSession}=await PaperLanguageText.session();
    const s=createTranslationSession({source:text,from:'en'});await s.run();
    return s.units.map(u=>({text:u.text,status:u.status,stage:u.error?.stage}));
  },text);
  try{
    await open();await context.setOffline(true);
    assert.equal((await translate('water'))[0].status,'failed');
    await context.setOffline(false);
    assert.equal((await translate('water'))[0].text,'水');
    const manifest=await page.evaluate(async()=>await (await fetch('vendor/bergamot/models.json')).json());
    const name=manifest.enzh.srcvocab.name.split('/').pop();
    await page.evaluate(async name=>{
      localStorage.setItem('qa-reading-note','keep');
      const db=await caches.open('reading-desk-translation-models-v1');
      const key=(await db.keys()).find(k=>new URL(k.url).pathname.endsWith('/'+name));
      if(!key)throw Error('verified vocabulary was not cached');
      await db.put(key,new Response('damaged only this copy'));
    },name);
    await open();requests.length=0;
    assert.equal((await translate('water'))[0].text,'水');
    assert.deepEqual(requests,[name]);
    await open();await context.setOffline(true);
    assert.match((await translate('The water cooled gradually.'))[0].text,/水/);
    assert.equal(requests.length,1);
    await context.setOffline(false);
    await page.evaluate(async()=>{
      const other=await caches.open('qa-unrelated');await other.put('/note',new Response('keep'));
      await PaperLanguageText.clearModelCache();
      if((await caches.keys()).some(k=>k.startsWith('reading-desk-translation-')))throw Error('cache was not cleared');
      if(await (await other.match('/note')).text()!=='keep'||localStorage.getItem('qa-reading-note')!=='keep')throw Error('unrelated data changed');
    });
    console.log('PASS virgin offline failure, recovery, one corrupt persisted vocabulary re-fetched, warm offline re-entry and isolated cache clearing');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
