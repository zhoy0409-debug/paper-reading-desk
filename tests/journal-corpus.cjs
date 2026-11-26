// Audit the normal upload and reading workflow against independent publisher references.
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {chromium} = require('playwright-core');
const manifest = require('./fixtures/journal-layouts.json');

const [base, directory, reportFile, ...options] = process.argv.slice(2);
if (!base || !directory || !reportFile) throw Error('Usage: node journal-corpus.cjs READER_URL PDF_DIRECTORY RESULT.json [--strict] [PDF_ID ...]');
const ids = options.filter(arg => arg !== '--strict');
if (ids.some(id => !manifest.papers.some(p => p.id === id))) throw Error('Unknown corpus ID');
const papers = manifest.papers.filter(p => !ids.length || ids.includes(p.id));
const norm = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function headingMatches(title, prefixes) {
  const text = norm(title);
  return prefixes.some(prefix => text.startsWith(prefix) ||
    (text.length >= 8 && prefix.startsWith(text) && /[.:：。]$/.test(title.trim())));
}

function covers(estimated, truth) {
  if (!estimated) return false;
  const {x, y, width, height} = estimated;
  const [left, top, w, h] = truth;
  const commonWidth = Math.max(0, Math.min(x + width, left + w) - Math.max(x, left));
  const commonHeight = Math.max(0, Math.min(y + height, top + h) - Math.max(y, top));
  const shared = commonWidth * commonHeight;
  return shared >= .88 * w * h && shared >= .49 * width * height;
}

async function audit(browser, ref) {
  const file = path.resolve(directory, ref.id + '.pdf');
  if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== ref.sha256) throw Error('PDF fingerprint mismatch');
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('?lang=en', base).href, {waitUntil: 'domcontentloaded'});
    await page.addLocatorHandler(page.locator('.gd-layer .gd-skip:visible'), action => action.click());
    await page.evaluate(() => {
      const api = window.PaperReadingEvidence;
      window.PaperReadingEvidence = {...api, enrich(...args) {
        const result = api.enrich(...args);
        window.corpusModel = args[1];
        return result;
      }};
    });
    await page.locator('input[id$="-main"]').first().setInputFiles(file);
    await page.waitForFunction(() => window.corpusModel, null, {timeout: 100000});
    const figures = await page.evaluate(() => corpusModel.figures.filter(f => /^F:\d+$/.test(f.matchKey)).map(f => ({
      key: f.id, label: f.label, number: f.matchKey.slice(2), page: f.page, captionPage: f.captionPage,
      title: f.title, box: f.pageBox, caption: f.caption
    })));
    const expected = new Set(ref.figures.map(f => f.n));
    const extra = figures.filter(f => !expected.has(f.number)).map(f => f.number);
    const duplicate = figures.filter((f,i) => figures.some((g,j) => j<i && g.number===f.number)).map(f => f.number);
    const checks = [];
    for (const target of ref.figures) {
      const actual = figures.find(f => f.number === target.n);
      const row = {number: target.n, found: !!actual, mode: actual ? (actual.box?'crop':'page') : null,
        pages: actual ? [actual.page,actual.captionPage] : null,
        heading: target.starts.length ? headingMatches(actual?.title || '', target.starts) : null,
        captionPage: target.cp ? actual?.captionPage === target.cp : null,
        imagePage: target.image ? actual?.page === target.image.page : null,
        crop: target.image ? actual?.page === target.image.page && covers(actual?.box,target.image.box) : null,
        reading: false};
      checks.push(row);
      if (!actual) continue;
      const tile = page.locator('.lens-cell[data-figure="'+actual.key+'"]').first();
      await tile.click({timeout:8000});
      await page.locator('.st-explain').first().click({timeout:8000});
      await page.waitForFunction(({key,label}) => {
        const image = document.querySelector('.frw-plate img');
        return document.querySelector('.lens-cell[aria-current=true]')?.dataset.figure===key &&
          image?.naturalWidth>0 && image.alt.startsWith(label+' ·');
      }, actual, {timeout:12000});
      const notes = await page.locator('.frw-notes').first().innerText();
      // Check *visible* evidence after the button press. Prefer the independent
      // publisher text; also record when the UI correctly shows its own source.
      const shown = norm(notes);
      row.reading = target.starts.some(s => shown.includes(s));
      row.opened = shown.includes(norm(actual.caption).slice(0,26)) || shown.includes(norm(actual.title).slice(0,26));
      if (!row.reading && process.env.CORPUS_TRACE) console.log(ref.id,target.n,notes.slice(0,650));
    }
    return {id:ref.id, journal:ref.journal, subset:ref.subset, extra, duplicate, errors, checks};
  } finally { await context.close(); }
}

(async () => {
  const browser = await chromium.launch({channel:process.env.READER_BROWSER_CHANNEL || (process.platform==='win32'?'msedge':'chromium')});
  const results = [];
  const pending = [...papers];
  async function run() {
    while (pending.length) {
      const ref = pending.shift();
      try {results.push(await audit(browser,ref));}
      catch (e) {results.push({id:ref.id,error:String(e)});}
      console.log(ref.id, results.find(r => r.id===ref.id).error || 'checked');
    }
  }
  try {await Promise.all([run(),run()]);} finally {await browser.close();}
  results.sort((a,b) => a.id.localeCompare(b.id));
  const counts = {};
  for (const key of ['found','heading','captionPage','imagePage','crop','reading']) {
    const values = results.flatMap(r => r.checks || []).map(c => c[key]).filter(x => typeof x==='boolean');
    counts[key] = [values.filter(Boolean).length,values.length];
  }
  const total = key => results.reduce((n,r) => n+(r[key]?.length || 0),0);
  const summary = {papers:results.length, numbered:counts, extra:total('extra'), duplicates:total('duplicate'), pageErrors:total('errors')};
  fs.writeFileSync(reportFile, JSON.stringify({summary,results},null,2)+'\n');
  console.log(summary);
  if (results.some(r => r.error || r.errors?.length) ||
    options.includes('--strict') && (summary.extra || summary.duplicates || Object.values(counts).some(([a,b]) => a!==b))) process.exitCode=1;
})().catch(e => {console.error(e);process.exitCode=1;});
