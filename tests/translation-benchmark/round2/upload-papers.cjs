// Exercise the publisher PDFs from upload through a native selection and the visible result.
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright-core');
const {openSource, selectText} = require('../../selection-engine-browser.cjs');

const [, , base, pdfDirectory, evidenceDirectory] = process.argv;
if (!base || !pdfDirectory || !evidenceDirectory) throw Error('Usage: node upload-papers.cjs READER_URL PDF_DIR EVIDENCE_DIR');
const corpus = fs.readFileSync(path.join(__dirname, 'fresh.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const papers = [
  {name:'pone.0212088', hash:'a96e97b1ad6fa3922c60622701ad655ea4dcc14680bb407991859b94065784b1', ids:['F01','F02']},
  {name:'pclm.0000278', hash:'33135d48fbc585db83ac19d8e10e74a593f450402e58c77a869489e3e3bb6893', ids:['F19','F20']},
  {name:'pmed.1003487', hash:'c5be32456581a7d56c584ca455b6af4229a2eaf1a939c5594cc21a95b68e990f', ids:['F25','F26']}
];

// PDF text may have different line breaks, physical hyphenation and typographic dashes.
function pdfTextPattern(source) {
  const chars = Array.from(source.normalize('NFKC').replace(/\s/g, ''));
  const escaped = chars.map(ch => /[-–—‐]/u.test(ch) ? '[-–—‐]' : ch.replace(/[.*+?^$\x7b\x7d()|[\]\\]/g, '\\$&'));
  return new RegExp(escaped.join('(?:\\s|\\u00ad|[-‐]\\s+)*'), 'iu');
}

async function inspectPaper(browser, paper, results) {
  const filename = path.join(pdfDirectory, paper.name+'.pdf');
  const sha256 = createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  assert.equal(sha256, paper.hash, 'Unexpected publisher PDF for '+paper.name);
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  try {
    await openSource(page, filename, 'zh');
    // Observe the actual text submitted by the UI without supplying a translation.
    await page.evaluate(()=>{
      const load=PaperLanguageText.session;
      PaperLanguageText.session=async()=>{
        const module=await load();
        return {createTranslationSession(options){
          const session=module.createTranslationSession(options);
          window.qaNormalized=session.units.map(unit=>unit.normalized).join(' ');
          return session;
        }};
      };
    });
    const popup = page.locator('.local-translation:visible');
    for (const id of paper.ids) {
      const {source, doi, kind} = corpus.find(row => row.id === id);
      const selected = await selectText(page, pdfTextPattern(source));
      const ref = await page.evaluate(() => getSelection().anchorNode?.parentElement?.closest('.pl-excerpt')?.querySelector('.pl-anchor')?.textContent?.trim());
      assert(ref, 'The selected PDF passage must have its own source location');
      await popup.locator('.selection-translate').click();
      await page.waitForFunction(() => ['partial','translated','error'].includes(document.querySelector('.local-translation:not([hidden])')?.dataset.translationState), null, {timeout:120000});
      assert.equal(await popup.locator('blockquote').textContent(), selected);
      const state = await popup.getAttribute('data-translation-state');
      const normalized = await page.evaluate(()=>window.qaNormalized);
      assert.equal(normalized, source, 'PDF input differs from the publisher text for '+id);
      const body = popup.locator(':scope > p');
      const visible = await body.innerText();
      assert.ok(visible, 'The reader must show a result or actionable reason');
      results.push({id, doi, kind, pdfSha256:sha256, reference:ref, selected, normalized, state, visible});
      fs.writeFileSync(path.join(evidenceDirectory,'uploads.json'), JSON.stringify(results,null,2)+'\n');
      await popup.screenshot({path:path.join(evidenceDirectory,id+'.png')});
      console.log(id, state, ref);
      await popup.locator('.selection-close').click();
    }
  } finally { await page.context().close(); }
}

(async () => {
  fs.mkdirSync(evidenceDirectory, {recursive:true});
  const browser = await chromium.launch({channel:process.env.READER_BROWSER || (process.platform==='win32'?'msedge':'chromium')});
  const results = [];
  try { for (const paper of papers) await inspectPaper(browser,paper,results); }
  finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
