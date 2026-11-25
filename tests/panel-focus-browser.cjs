// Run against the reader with playwright-core, Edge and the Abaucin paper PDF.
const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');

async function check(page, base, pdf) {
  await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"read":1,"home":1}'));
  const entry=new URL(base);entry.searchParams.set('lang','zh');
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error=>errors.push(error.message));
  await page.goto(entry.href);
  await page.locator('input[type=file][id$="-main"]').setInputFiles(pdf);
  const figure = page.locator('.lens-cell').nth(1);
  await figure.waitFor({timeout:90000});
  await figure.click();
  const preview = page.locator('.pd-open-preview');
  const tabs = page.locator('.frw-panel-tab');
  const panel = letter=>tabs.filter({hasText:new RegExp('^'+letter+'$')});
  const focus = page.locator('.rq-focus:visible');
  const report = page.locator('.pd-report');
  const summary = report.locator(':scope > summary');
  const callout = page.locator('.rq-callout:visible');
  const canvas = focus.locator('.rq-sheet canvas');
  async function point(x,y) {
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x+box.width*x,box.y+box.height*y);
  }
  await page.locator('.st-more > summary').click();
  await summary.click();
  await page.locator('.st-dock .frw-toolbar button').filter({hasText:/^\+$/}).click();
  await page.locator('button[data-printed-panel=e]').click();
  assert.match(await focus.locator('.rq-focus-bar').innerText(),/2.*E/);
  for (const [x,y,title] of [[.48,.19,/CRAB/],[.18,.27,/vehicle/],[.40,.27,/abaucin/],[.57,.27,/美罗培南/],[.79,.27,/哌拉西林/],[.18,.50,/第一张/],[.39,.50,/第二张/],[.58,.50,/第三张/],[.80,.50,/第四张/],[.50,.71,/尺子/]]) {
    await point(x,y);
    assert.match(await callout.locator('h4').innerText(),title);
  }
  await point(.5,.90);
  assert.equal(await callout.count(),0);
  await canvas.waitFor();
  await panel('B').click();
  await focus.locator('.rq-hit[aria-label*="sham" i]').first().click();
  assert.match(await callout.innerText(),/假处理|sham/i);
  await panel('E').click();

  await report.locator('.pd-extra-tools > summary').click();
  const correct = report.getByRole('button',{name:'重新框选边界',exact:true});
  await correct.click();
  await page.locator('.pd-drawing:visible').waitFor();
  assert.equal(await focus.count(),0);
  await report.getByRole('button',{name:'取消框选'}).click();
  await canvas.waitFor();
  await correct.click();
  await summary.click();
  await canvas.waitFor();
  assert.equal(await page.locator('.pd-drawing').count(),0);
  await summary.click();
  await correct.click();
  await preview.click();
  await canvas.waitFor();
  assert.equal(await page.locator('.pd-drawing').count(),0);
  await report.getByRole('button',{name:'从原页框选'}).click();
  await preview.waitFor({timeout:20000});
  await preview.focus();
  await page.keyboard.press('Enter');
  await canvas.waitFor();
  await report.getByRole('button',{name:'从原页框选'}).click();
  await preview.waitFor();
  await correct.click();
  const boundary=page.locator('.pd-drawing .pd-box').first();
  await boundary.scrollIntoViewIfNeeded();
  const b=await boundary.boundingBox();
  // Extend the right edge onto the source page, beyond the detected figure.
  await page.mouse.move(b.x+1,b.y+1);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width+5,b.y+b.height-1,{steps:6});
  await page.mouse.up();
  await canvas.waitFor();
  await page.waitForFunction(()=>document.querySelector('.rq-sheet canvas').width>100);
  await point(.50,.71);
  assert.match(await callout.locator('h4').innerText(),/尺子/);
  await report.getByRole('button',{name:'撤销边界'}).click();
  await canvas.waitFor();
  await point(.50,.71);
  assert.match(await callout.locator('h4').innerText(),/尺子/);
  await callout.getByRole('button',{name:'英文跟读'}).click();
  assert.match(await page.locator('.english-practice[open] .ep-sentence p').innerText(),/ruler/i);
  await page.keyboard.press('Escape');
  await focus.getByRole('button',{name:'返回整图'}).click();
  await page.locator('.frw-viewport:visible').waitFor();
  await page.locator('.compare-bar').getByRole('button',{name:'PDF 原页'}).click();
  await panel('E').click();
  await canvas.waitFor();
  await page.locator('[data-locale=en]').click();
  await page.setViewportSize({width:390,height:800});
  await point(.50,.71);
  assert.match(await callout.locator('h4').innerText(),/ruler/i);
  await page.keyboard.press('Escape');
  assert.equal(await callout.count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS real PDF, zoomed whole figure, open report, ten 2E targets, 2B, crop cancellation, preview, source page, English practice and mobile.');
}
module.exports={check};
if(require.main===module)(async()=>{
  const [url,pdf]=process.argv.slice(2);
  assert.ok(url && pdf,'Usage: node tests/panel-focus-browser.cjs READER_URL PAPER_PDF');
  const browser=await chromium.launch({channel:'msedge'});
  try{await check(await browser.newPage({viewport:{width:1400,height:920}}),url,pdf);}
  finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
