// Exercise the same public paper, PDF artwork and axis used for the README cover.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright-core');
const {checkWordFrame} = require('./panel-callout-browser.cjs');

async function check(page, url) {
  await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"read":1,"home":1,"hint-panel":1}'));
  await page.goto(url);
  const sample = path.resolve(__dirname, '../dist/media/2007.08902.pdf');
  await page.locator('input[id$="-main"]').setInputFiles(sample);
  await page.locator('.lens-cell[data-figure^="F:8@"]').first().click({timeout:90000});
  await page.locator('.st-dock .frw-panel-tab').filter({hasText:/^A$/}).click();
  const axis = page.locator('.rq-hit[aria-label*="Exaggeration factor" i]').first();
  async function inspect() {
    await axis.click();
    const note = page.locator('.rq-callout:visible');
    assert.match(await note.innerText(),/Exaggeration factor \(ρ\)/i);
    await checkWordFrame(axis,false);
    const offset = await axis.evaluate(label=>{
      const wire = document.querySelector('.rq-wire path');
      const start = wire.getPointAtLength(0).matrixTransform(wire.getScreenCTM());
      return start.y-label.getBoundingClientRect().bottom;
    });
    assert(offset>=0 && offset<5,'Connector must start below the printed label');
  }
  await inspect();
  const zoom = page.locator('.rq-zoom:visible');
  await zoom.click();
  await inspect();
  await zoom.click();
  await page.locator('.rq-crop:visible').click();
  const editor = page.locator('.pc-dialog[open]');
  await editor.locator('.pc-handle[data-edge=w]').focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await editor.locator('.pc-apply').click();
  await inspect();
}
(async()=>{
  const browser = await chromium.launch({channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1512,height:1120}});
    await check(page,process.argv[2]);
    console.log('PASS public cover axis: glyph bounds and connector at normal size, zoomed and after editing the crop.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
