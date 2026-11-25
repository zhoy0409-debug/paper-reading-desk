// Exercise the same actions a first-time reader can take, with no account or model backend.
const assert = require('node:assert/strict');
const { chromium, webkit, devices } = require('playwright-core');

const base = new URL(process.argv[2] || 'http://127.0.0.1:8174/');
const viaReadme = process.argv.includes('--github');
const output = process.env.READER_CAPTURE;
const url = lang => new URL('?lang=' + lang, base).href;

// An unpublished calibration chart with ordinary PDF text, lines and bars.
function calibrationPDF(scan = false) {
  const text = (x, y, value, size = 12) =>
    'BT /F1 ' + size + ' Tf ' + x + ' ' + y + ' Td (' + value.replace(/[\\()]/g, '\\$&') + ') Tj ET';
  const stream = [
    '0.1 0.3 0.5 rg 150 243 45 79 re f 0.4 0.6 0.7 rg 260 243 45 100 re f',
    '0 g 1 w 96 374 m 96 241 l 370 241 l S',
    ...(scan ? [] : [
      text(58, 734, 'Sensor calibration study', 21),
      text(58, 685, 'Results', 15),
      text(58, 660, 'We observed more accurate readings following calibration (Figure 1).'),
      text(145, 221, 'Original'), text(251, 221, 'Adjusted'),
      text(55, 390, 'Accuracy (%)'),
      text(58, 177, 'Figure 1. Sensor accuracy increased from 60% to 75% after calibration.')
    ])
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 550 770] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream'
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, obj] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf)); pdf += (i + 1) + ' 0 obj\n' + obj + '\nendobj\n';
  }
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 6\n0000000000 65535 f \n' +
    offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return {name:scan ? 'no-text.pdf' : 'calibration.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)};
}

async function visibleOnScreen(node) {
  await node.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  return node.evaluate(el => {
    const r = el.getBoundingClientRect();
    const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.max(r.top + 2, Math.min(r.bottom - 2, r.top + 12));
    const onTop = document.elementFromPoint(x, y);
    return r.width > 0 && r.height > 0 && r.right <= innerWidth + 1 &&
      y >= 0 && y < innerHeight && onTop && el.contains(onTop);
  });
}

async function sharedSampleOnPhone(browser, lang) {
  const zh = lang === 'zh';
  const ctx = await browser.newContext({...devices['iPhone 13'],locale:zh?'zh-CN':'en-US'});
  try {
    const page = await ctx.newPage();
    await page.addLocatorHandler(page.locator('.gd-layer .gd-skip:visible'), button => button.tap());
    await page.goto(url(lang)+'&sample=figure-8a',{waitUntil:'domcontentloaded'});
    const axis = page.locator('.rq-hit[aria-label*="Exaggeration factor" i]').first();
    await axis.waitFor({timeout:120000});
    const open = page.getByRole('button',{name:zh?'看图解':'Read explanation',exact:true});
    await open.tap();
    if(output){
      if(zh)await page.locator('.compare-bar h3[lang="zh-CN"]:not([aria-busy="true"]):not([data-translation-retry])').waitFor({timeout:120000});
      await page.getByRole('button',{name:zh?'回到图':'Back to figure',exact:true}).tap();
      await page.screenshot({path:output+'-phone-entry-'+lang+'.png',scale:'css'});
      await open.tap();
    }
    const list = page.locator('.frw-notes .rq-key-list');
    await list.locator('summary').tap();
    await list.getByRole('button',{name:/exaggeration factor/i}).first().tap();
    const tip = page.locator('.rq-callout:visible');
    assert.match(await tip.locator('p').innerText(),zh?/吸引/:/attract/i);
    assert(await visibleOnScreen(tip.locator('h4')),'Phone brings the axis explanation into view');
    const legend = page.locator('.rq-series-key').getByText('MNIST',{exact:true}).first();
    await legend.tap();
    assert.match(await tip.locator('h4').innerText(),/MNIST/);
    assert.match(await tip.locator('p').innerText(),/MNIST|数据集|data\s?set/i);
    await axis.tap();
    assert.match(await tip.locator('h4').innerText(),/exaggeration factor/i);
    assert.match(await tip.locator('p').innerText(),zh?/吸引/:/attract/i);
    assert(await visibleOnScreen(tip.locator('h4')),'Tapping the printed axis restores its explanation');
    if(output) await page.screenshot({path:output+'-phone-axis-'+lang+'.png',scale:'css'});
    console.log('Mobile '+lang+' public sample link, explanation menu, legend and printed axis passed');
  } finally {await ctx.close();}
}

async function test(browser, mobile, scan = false, unsupportedLayout = false) {
  const lang = mobile ? 'zh' : 'en';
  const ctx = await browser.newContext(mobile ? {...devices['iPhone 13'],locale:'zh-CN'} :
    {viewport:{width:1440,height:900},locale:'en-US'});
  const errors = [];
  ctx.on('page', pg => pg.on('pageerror', e => errors.push(e.message)));
  let page = await ctx.newPage();
  try {
    if (viaReadme && !scan) {
      await page.goto('https://github.com/zhoy0409-debug/paper-reading-desk',{waitUntil:'domcontentloaded'});
      const link = page.locator('.markdown-body a').filter({hasText:mobile?/^打开中文阅读器$/:/^Open the reader$/}).first();
      assert.equal(await link.getAttribute('href'), url(lang));
      const landing = Promise.race([ctx.waitForEvent('page'),page.waitForURL(url(lang)).then(()=>page)]);
      await link.click(); page = await landing;
    } else {
      await page.goto(url(lang),{waitUntil:'domcontentloaded'});
    }
    await page.waitForURL(url(lang));
    const writes = [];
    await page.route('**/*', route => {
      const request = route.request();
      if (!['GET','HEAD','OPTIONS'].includes(request.method())) {writes.push(request.method());return route.abort();}
      return route.continue();
    });
    await page.addLocatorHandler(page.locator('.gd-layer .gd-skip:visible'), b => b.click());
    const picker = page.locator('input[id$="-main"]').first();
    let file;
    if (mobile) file = calibrationPDF(scan);
    else {
      // Read the very same public PDF distributed by the site and use the ordinary file picker.
      const paper = await page.request.get(new URL('media/2007.08902.pdf', base).href);
      assert.equal(paper.status(),200);
      file = {name:'public-embedding-paper.pdf',mimeType:'application/pdf',buffer:await paper.body()};
    }
    if(unsupportedLayout){
      await picker.waitFor({state:'attached'});
      await page.evaluate(()=>{
        window.CartesianPanels={...window.CartesianPanels,findPlots(){throw Error('Test unsupported plot layout')}};
      });
    }
    await picker.setInputFiles(file);
    const action = mobile ? 'tap' : 'click';
    const open = page.getByRole('button',{name:mobile?'看图解':'Read explanation',exact:true});
    await open.waitFor({timeout:100000});
    await page.locator('.frw-visual .frw-plate img:visible, .frw-visual .rq-sheet canvas:visible').first().waitFor({timeout:35000});
    // Dismiss the first-use tour as a reader can. Later checks must not depend on seeing a tour.
    if (await page.locator('.gd-card').isVisible()) await page.keyboard.press('Escape');
    await open[action]();
    const reading = page.locator('.frw-explain');
    const tab = page.locator('.rq-tabs [data-view="read"]');
    assert.equal(await tab.getAttribute('aria-pressed'),'true');
    if (mobile) {
      const target = scan ? reading.locator('strong').first() : reading.getByText(/15 个百分点/);
      await target.waitFor({timeout:20000});
      if (scan) assert.match(await reading.innerText(),/只识别到 PDF 原页/);
      assert(await visibleOnScreen(target),'The actual explanation is on screen');
      const back = page.getByRole('button',{name:/回到图/});
      await back.tap(); assert(await visibleOnScreen(open),'Return lands beside the same figure');
      if (!scan) {
        await open.tap(); const source = reading.getByRole('button',{name:/出处 p\.1/}).first();
        await source.tap(); await page.locator('.compare-pdf:visible').waitFor();
        await open.tap();assert(await visibleOnScreen(target));
      }
    } else {
      const fig = page.locator('.lens-cell[data-figure^="F:8@"]').first();
      await fig.click();
      await page.locator('.st-dock .frw-panel-tab').filter({hasText:/^A$/}).click();
      await page.locator('.st-fold').click(); assert(await page.locator('.frw.st-wide').count());
      await open.click(); assert.equal(await page.locator('.frw.st-wide').count(),0);
      const labels = page.locator('.frw-notes .rq-key-list');
      await labels.locator('summary').click();
      const axis = labels.getByRole('button',{name:/exaggeration factor/i}).first();
      await axis.click();
      const tip = page.locator('.rq-callout:visible');
      assert.match(await tip.locator('h4').innerText(),/exaggeration factor/i);
      assert.match(await tip.locator('p').innerText(),/attract/i);
      assert(await visibleOnScreen(tip.locator('h4')),'Selected label opens its own explanation');
      await page.locator('.rq-tabs button[data-view="basics"]').click();
      await open.click();assert.equal(await tab.getAttribute('aria-pressed'),'true');
    }
    if (output && !unsupportedLayout) await page.screenshot({path:output+'-'+(scan?'page':lang)+'.png'});
    assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    const description=unsupportedLayout?'caption and source when cropping fails':scan?'page without captions':mobile?'ordinary upload and source':'public PDF upload, panel and axis';
    console.log((mobile?'Mobile':'Desktop')+' '+lang+' '+description+' passed '+page.url());
  } catch (error) {
    console.error(lang,scan?'page':'figure',page.url(),await page.title(),
      await page.locator('body').innerText({timeout:3500}).then(s=>s.slice(0,260)).catch(()=>''),errors);
    const action=page.locator('.st-explain');
    if(await action.count())console.error('Figure control',await action.evaluate(el=>{
      const r=el.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+12;
      return {top:r.top,left:r.left,width:r.width,height:r.height,window:[innerWidth,innerHeight],
        covering:document.elementFromPoint(x,y)?.outerHTML.slice(0,190)};
    }));
    throw error;
  } finally {await ctx.close();}
}

(async()=>{
  const channel=process.env.READER_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':'chromium');
  const phoneOnly=process.env.READER_BROWSER==='webkit';
  const browser=phoneOnly?await webkit.launch():await chromium.launch({channel});
  try {
    await test(browser,true);
    if(!phoneOnly)await test(browser,false);
    await test(browser,true,true);
    if(!phoneOnly)await test(browser,true,false,true);
    for(const lang of ['zh','en'])await sharedSampleOnPhone(browser,lang);
  }
  finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
