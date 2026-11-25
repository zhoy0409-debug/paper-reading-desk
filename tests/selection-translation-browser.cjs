// Pass a local copy of the Abaucin paper. Exercise the same selection toolbar used by readers.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');

async function check(page,url,pdf){
  await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"read":1,"home":1,"hint-panel":1}'));
  await page.goto(url);
  await page.locator('input[id$="-main"]').setInputFiles(pdf);
  await page.locator('.lens-cell[data-figure^="F:4@"]').first().click({timeout:90000});
  await page.locator('.st-dock .frw-panel-tab').filter({hasText:/^C$/i}).click();
  await page.locator('button[data-view="basics"]').click();
  const caption=page.locator('.rq-caption-label:visible + blockquote');
  const popup=page.locator('.local-translation:visible');
  const button=popup.locator('.selection-translate');
  async function select(pattern){
    await caption.scrollIntoViewIfNeeded();
    return caption.evaluate((n,source)=>{
      const text=n.firstChild;
      const match=text.textContent.match(new RegExp(source));
      if(!match)throw Error('Missing selection in original caption');
      const range=document.createRange();
      range.setStart(text,match.index);range.setEnd(text,match.index+match[0].length);
      getSelection().removeAllRanges();getSelection().addRange(range);return match[0];
    },pattern);
  }
  const original=await select('Scanning electron microscopy[\\s\\S]*?abaucin treatment\\.?');
  await button.click();await popup.getByRole('button',{name:/已翻译/}).waitFor({timeout:90000});
  const output=popup.locator(':scope > p');
  const zh=await output.innerText();
  for(const pattern of [/扫描电子显微镜/,/SEM/,/野生型/,/A\.\s*baylyi/,/LolDF/,/突变株/,/abaucin/,/未经/])assert.match(zh,pattern);
  assert(!zh.includes('Scanning electron microscopy'));
  await popup.locator('summary').click();assert.equal(await popup.locator('blockquote').innerText(),original);
  await popup.locator('.selection-close').click();
  await select('abaucin');
  await button.click();await popup.getByRole('button',{name:/保留原名/}).waitFor();
  assert.equal(await output.innerText(),'abaucin');await popup.locator('.selection-close').click();

  // A failed model download or an unchanged English response must leave a usable retry action.
  await page.evaluate(()=>{window.testTranslate=PaperLanguageText.translate;PaperLanguageText.translate=async text=>text});
  await select('and the corresponding');
  await button.click();await popup.getByRole('button',{name:/重试翻译/}).waitFor();
  assert(await button.isEnabled());assert.doesNotMatch(await button.innerText(),/已翻译/);
  await page.evaluate(()=>{PaperLanguageText.translate=window.testTranslate;delete window.testTranslate});
  await button.click();
  await popup.getByRole('button',{name:/已翻译/}).waitFor({timeout:90000});
  assert.match(await output.innerText(),/[\u3400-\u9fff]/);
  console.log('PASS original caption, source comparison, proper name and retry using the on-device model.');
}
(async()=>{const b=await chromium.launch({channel:'msedge'});try{await check(await b.newPage({viewport:{width:1600,height:1000}}),...process.argv.slice(2))}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
