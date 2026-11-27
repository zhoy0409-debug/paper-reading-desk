// Exercise real caption, body and mind-map links using the original PDFs.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const path=require('node:path');
const [url,neuron,review]=process.argv.slice(2);
const cases=[
  {file:neuron,figure:3,picture:6,caption:7,title:'Transcriptional profiling of NSPCs',panel:'A'},
  {file:review,figure:4,picture:7,caption:7,title:'The SDF-1/CXCR4 axis',body:/central role of the SDF-1\/CXCR4 axis/i}
];
async function check(browser,sample){
  const page=await browser.newPage({viewport:{width:1560,height:1020}});
  try{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(new URL('?lang=en',url).href);
    await page.addLocatorHandler(page.locator('.gd-skip:visible'),b=>b.click());
    await page.locator('input[id$="-main"]').first().setInputFiles(path.resolve(sample.file));
    const card=page.locator('.lens-cell[data-figure^="F:'+sample.figure+'@"]');
    await card.click({timeout:90000});
    await page.waitForFunction(()=>document.querySelector('.frw-plate img')?.naturalWidth>0);
    assert.match(await page.locator('.compare-selection').innerText(),new RegExp('p\\.'+sample.picture+'$'));
    await page.locator('.st-explain').click();
    const passage=page.locator('.rq-paper-notes .rq-source-note');
    await passage.locator('summary').click();
    const quote=passage.locator('blockquote');
    assert((await quote.innerText()).includes(sample.title));
    assert.equal(Number(await quote.getAttribute('data-page')),sample.caption);
    async function original(n){
      await page.locator('.compare-sheet img[alt="PDF · p.'+n+'"]:visible').waitFor();
      await page.locator('.compare-mark:visible').waitFor({timeout:8000});
      assert.equal(await page.locator('.compare-status').innerText(),'Matching source line');
    }
    const locate=passage.getByRole('button',{name:'Locate in PDF',exact:true});
    await locate.click();await original(sample.caption);
    await page.locator('.rq-source-back:visible').click();
    await passage.getByRole('button',{name:'Next passage',exact:true}).click();
    const body=await quote.innerText(),pageNumber=Number(await quote.getAttribute('data-page'));
    const cited=new RegExp('(?:Fig(?:ure)?s?\\.?\\s*)'+sample.figure+'(?:[A-Za-z]|\\b)','i');
    assert.match(body,cited);if(sample.body)assert.match(body,sample.body);
    await locate.click();await original(pageNumber);
    await page.locator('.rq-source-back:visible').click();
    await page.locator('.st-views [data-view=map]').click();
    const fit=page.locator('.mm-tools').getByRole('button',{name:'Fit',exact:true});
    await fit.click();
    const mapRows=page.locator('.mm-node:visible');
    const aim=page.locator('[data-map-role="'+(sample.panel?'aim':'reviewAim')+'"]:visible .mm-page').first();
    const found=mapRows.filter({has:page.locator('.mm-role',{hasText:/Authors say|Measurement|Joint figure reference/})}).locator('button.mm-page');
    const target=found.filter({hasNotText:'Unverified'});
    const same=await target.evaluateAll((els,s)=>els.findIndex(el=>el.title===s),body);
    assert(same>=0,'The current figure should have the same verified body passage on its map');
    for(const link of [aim,target.nth(same)]){
      const n=Number((await link.innerText()).replace(/^p\./,''));
      assert(n>0&&(await link.getAttribute('title')).length>24);
      await link.focus();await link.press('Enter');await original(n);
    }
    if(sample.panel){
      const button=mapRows.getByRole('button',{name:sample.panel,exact:true}).first();
      await button.focus();await button.press('Enter');
      await page.locator('.st-views [data-view=read]').click();
      await page.locator('.st-dock [data-panel="'+sample.panel.toLowerCase()+'"][aria-pressed=true]').waitFor();
    }
    assert.deepEqual(errors,[]);
    console.log('Figure '+sample.figure+', artwork p.'+sample.picture+', caption p.'+sample.caption+
      ', linked body p.'+pageNumber+', map objective and result located on the original pages.');
  }finally{await page.close()}
}
(async()=>{
  if(!cases.every(s=>s.file))throw Error('Pass READER_URL NEURON_PDF REVIEW_PDF');
  const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium'});
  try{for(const sample of cases)await check(browser,sample)}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
