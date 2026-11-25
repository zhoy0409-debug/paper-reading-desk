// Run with a local copy of the Abaucin paper and an empty browser profile.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright-core');

async function check(page, url, pdf, output) {
  await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"read":1,"home":1}'));
  const entry=new URL(url);entry.searchParams.set('lang','zh');
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const loadPaper = async () => {
    await page.goto(entry.href);
    await page.locator('input[type=file][id$="-main"]').setInputFiles(pdf);
    await page.locator('.lens-cell').nth(1).waitFor({timeout:90000});
  };
  await loadPaper();
  await page.locator('.lens-cell').nth(1).click();
  const dock = page.locator('.slide-basket');
  const names = () => dock.locator('.basket-name').allTextContents();
  const cards = dock.locator('.basket-card');
  const tabs = page.locator('.frw-panel-tab');
  const focus = page.locator('.rq-focus:visible');
  const add = focus.locator('.rq-add-slide');
  const notes = {
    B:'从左到右比较五组的肺切片。下排放大了上排方框内的区域。',
    C:'纵轴是肺损伤评分。柱与散点分别展示组间差异及各组内的观测值。',
    E:'先看整肺照片。下方的标尺给四组外观提供了共同的尺寸参照。'
  };
  assert.equal(await dock.isVisible(), false);
  for (const [i, letter] of ['B','E','C'].entries()) {
    await tabs.filter({hasText:new RegExp('^'+letter+'$')}).click();
    await focus.locator('.rq-sheet canvas').waitFor();
    if (letter !== 'C') {
      const hit = focus.locator(letter === 'B' ? '.rq-hit[aria-label*="sham" i]' : '.rq-hit[aria-label*="尺"]');
      await hit.first().click();
      assert.match(await page.locator('.rq-callout:visible h4').innerText(),letter === 'B' ? /假处理|sham/i : /尺/);
    }
    await add.click();
    assert.equal(await add.isDisabled(), true);
    assert.equal(await cards.count(), i+1);
    await cards.nth(i).locator('textarea').fill(notes[letter]);
  }
  await dock.locator('.basket-thumb[data-ready="true"]').nth(2).waitFor();
  const compact = dock.locator('.basket-toggle');
  await compact.click(); assert.equal(await cards.first().isVisible(), false); await compact.click();
  await cards.nth(1).locator('.basket-grip').dragTo(cards.first());
  const expected = ['E','B','C'].map(l => 'Fig. 2 · '+l);
  assert.deepEqual(await names(),expected);
  await cards.first().locator('.basket-grip').press('ArrowRight');
  await cards.nth(1).locator('.basket-grip').press('ArrowLeft');
  assert.deepEqual(await names(),expected);
  await page.locator('[data-locale=en]').click();
  assert.equal(await dock.locator('.basket-export').innerText(),'Export selected figures');
  assert.equal(await cards.first().locator('textarea').inputValue(),notes.E);
  await page.setViewportSize({width:390,height:800});
  const rect = await dock.boundingBox();
  assert.ok(rect.x>=0 && rect.x+rect.width<=391);
  await compact.click(); await compact.click();
  await page.setViewportSize({width:1400,height:910});
  await page.locator('[data-locale=zh]').click();
  await loadPaper();
  await cards.nth(2).waitFor();
  assert.deepEqual(await names(),expected);
  for (const [i, letter] of ['E','B','C'].entries()) {
    assert.equal(await cards.nth(i).locator('textarea').inputValue(),notes[letter]);
  }
  await cards.nth(2).locator('.basket-remove').click();
  assert.equal(await cards.count(),2);
  await tabs.filter({hasText:/^C$/}).click();
  await add.click();
  assert.deepEqual(await names(),expected);
  assert.equal(await cards.nth(2).locator('textarea').inputValue(),notes.C);
  await tabs.filter({hasText:/^E$/}).click();
  await focus.locator('.rq-hit[aria-label*="尺"]').first().click();
  if (output) {
    await dock.locator('.basket-thumb[data-ready="true"]').nth(2).waitFor();
    await focus.locator('canvas').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(output,'Abaucin-汇报篮.png')});
  }
  const downloading=page.waitForEvent('download',{timeout:60000});
  await dock.locator('.basket-export').click();
  const download=await downloading;
  assert.equal(await download.failure(),null);
  if (output) await download.saveAs(path.join(output,'Abaucin-汇报篮.pptx'));
  await dock.locator('.basket-status').filter({hasText:'已导出'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS original Abaucin PDF: 2B sham, 2E ruler; add B/E/C, notes, pointer and keyboard reorder, bilingual controls, mobile width, reopen, remove/re-add and export E/B/C.');
}
module.exports={check};
if (require.main===module) (async()=>{
  const [url,pdf,output]=process.argv.slice(2);
  assert.ok(url && pdf,'Expected reader URL and original PDF path');
  const browser=await chromium.launch({channel:'msedge'});
  try { await check(await browser.newPage({viewport:{width:1400,height:910}}),url,pdf,output); }
  finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
