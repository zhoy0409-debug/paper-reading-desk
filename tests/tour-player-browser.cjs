// Exercise the shipped video and sidecar captions in a browser with H.264 playback.
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const base=new URL(process.argv[2]);
const tour=base.pathname.endsWith('/read/')?new URL('media/tour/',base):base;
async function check(browser,lang,viewport){
  const page=await browser.newPage({viewport});
  try{
    await page.goto(new URL('?lang='+lang+'#export',tour).href);
    await page.waitForFunction(()=>document.querySelector('#film')?.readyState>=2);
    const film=page.locator('#film'),caption=page.locator('#current-caption'),toggle=page.locator('#captions');
    const geometry=await film.evaluate(v=>[v.videoWidth,v.videoHeight,v.duration]);
    assert.deepEqual(geometry,[1792,1120,60]);
    await page.waitForFunction(()=>document.querySelector('#film').currentTime>=16);
    for(const [second,text] of [[12,/ρ/],[16,lang==='zh'?/汇报篮/:/basket/i],[26,lang==='zh'?/核心科学问题/:/central scientific question/i]]){
      await film.evaluate((v,t)=>{v.pause();v.currentTime=t;},second);
      await page.waitForFunction(pattern=>new RegExp(pattern,'i').test(document.querySelector('#current-caption').textContent),text.source);
      const video=await film.boundingBox(),words=await caption.boundingBox();
      assert(words.y>=video.y+video.height-1,'Captions overlap the recorded interface');
    }
    await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');
    assert.equal(await caption.textContent(),'');
    await toggle.click();await page.waitForFunction(()=>document.querySelector('#current-caption').textContent.length>0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(new URL(await page.locator('#open-reader').getAttribute('href'),tour).searchParams.get('lang'),lang);
    console.log(lang,viewport.width+'px: checked decoded video, chapters, caption text and clearance.');
  }finally{await page.close()}
}
(async()=>{
  const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium'});
  try{await check(browser,'zh',{width:1440,height:900});await check(browser,'en',{width:390,height:844})}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
