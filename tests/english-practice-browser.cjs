// Run against a served dist/ with playwright-core and Edge available.
const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');

async function check(base) {
  const browser = await chromium.launch({channel:'msedge'});
  try {
    const page = await browser.newPage();
    await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"read":1,"home":1}'));
    const url = new URL(base);
    url.search = 'lang=zh&practice=abaucin';
    await page.goto(url.href);
    const card = page.locator('.english-practice[open]');
    await card.getByRole('button', {name:'听作者念 abaucin'}).waitFor();
    await card.locator('.ep-viva summary').click();
    assert.match(await card.locator('.ep-viva').innerText(), /narrow-spectrum/);
    await card.locator('#ep-text').fill('histogram');
    assert.equal(await card.locator('.ep-viva').isVisible(), false);
    assert.match(await card.locator('.ep-sources a').getAttribute('href'), /dictionary\/histogram$/);
    await page.keyboard.press('Escape');

    url.search = 'lang=en&sample=figure-8a';
    await page.goto(url.href);
    const axis = page.locator('.rq-hit[aria-label*="Exaggeration factor"]').first();
    await axis.waitFor({timeout:100000});
    await axis.click();
    await page.locator('.rq-callout').getByRole('button', {name:'English practice'}).click();
    assert.match(await card.locator('.ep-scope').innerText(), /8.*A/);
    assert.match(await card.locator('.ep-sentence p').innerText(), /t-SNE/);
    await card.getByRole('button', {name:'Explore background & rehearse'}).click();
    const draft = await page.locator('.rq-ask textarea').evaluateAll(fields=>fields.map(f=>f.value));
    assert.ok(draft.some(value=>value.includes('one likely audience question')));
    assert.ok(draft.some(value=>value.includes('t-SNE')));
    console.log('PASS drug pronunciation sources, term changes, panel-specific English and viva context');
  } finally {
    await browser.close();
  }
}

check(process.argv[2] || 'http://localhost:8000/').catch(error=>{console.error(error);process.exitCode=1;});
