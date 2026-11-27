// node scripts/record-walkthrough.cjs <reader-url> <en|zh> <output-folder>
// Set FFMPEG to the encoder executable and NODE_PATH to playwright-core.
const assert = require('node:assert/strict');
const {once} = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright-core');
const {checkWordFrame} = require('../tests/panel-callout-browser.cjs');

const [base, lang, output] = process.argv.slice(2);
assert(base && ['en','zh'].includes(lang) && output, 'Expected a reader URL, language and output folder');
const en = lang === 'en';
const paper = path.resolve(__dirname, '../dist/media/2007.08902.pdf');
const folder = path.join(output, lang);
const fps = 12;
const stages = JSON.parse(fs.readFileSync(path.resolve(__dirname,'../dist/media/tour/chapters-'+lang+'.json'),'utf8'));
const start = Object.fromEntries(stages.chapters.map(item=>[item.key,item.start]));

async function record() {
  fs.mkdirSync(folder,{recursive:true});
  const browser = await chromium.launch({channel:process.env.READER_BROWSER_CHANNEL || (process.platform==='win32'?'msedge':'chromium')});
  const encoder = spawn(process.env.FFMPEG || 'ffmpeg', ['-y','-loglevel','error','-f','image2pipe','-framerate',String(fps),
    '-i','pipe:0','-an','-c:v','libx264','-threads','3','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',
    '-metadata','artist=a',path.join(output,'tour-'+lang+'.mp4')], {windowsHide:true,stdio:['pipe','ignore','inherit']});
  const done = once(encoder,'close');
  const marks = {};
  let frame = 0;
  try {
    const viewport={width:1792,height:1120};
    const page = await browser.newPage({viewport,deviceScaleFactor:1,locale:en?'en-US':'zh-CN',reducedMotion:'reduce'});
    page.setDefaultTimeout(30000);
    await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"home":1,"read":1,"hint-panel":1,"hint-map":1,"hint-story":1}'));
    await page.addLocatorHandler(page.locator('.gd-layer .gd-skip:visible'),b=>b.click());
    const stage = page.locator('.rq-stage:visible');
    const tabs = page.locator('.st-dock .frw-panel-tab');
    const tab = letter=>tabs.filter({hasText:new RegExp('^'+letter+'$')});
    const basket = page.locator('.slide-basket:visible');
    const cards = basket.locator('.basket-card');
    const view = name=>page.locator('.st-views [data-view='+name+']');
    const snap = ()=>page.screenshot({type:'png',animations:'disabled'});
    async function readyMap(){
      const labels='.mm-node:not([hidden]) .mm-text';
      await page.waitForFunction(selector=>[...document.querySelectorAll(selector)].every(n=>n.textContent.trim()&&!n.hasAttribute('aria-busy')&&!n.dataset.translationRetry),labels,{timeout:120000})
        .catch(async error=>{throw Error('Visible map labels: '+JSON.stringify(await page.locator(labels).allTextContents())+' '+error.message)});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    }
    async function write(image) {
      if (!encoder.stdin.write(image)) await once(encoder.stdin,'drain');
      frame++;
    }
    async function hold(until,name) {
      const image = await snap();
      if (name) {
        marks[name]=frame/fps;
        fs.writeFileSync(path.join(folder,name+'.png'),image);
      }
      while(frame<Math.round(until*fps)) await write(image);
    }
    // Record the real keystrokes and pointer drag within the chapter. The next
    // chapter begins only after its first corresponding screen is ready.
    async function action(until,perform) {
      let finished=false, failure;
      const job=perform().catch(e=>{failure=e}).finally(()=>{finished=true});
      const limit=Math.round(until*fps)-1;
      while(!finished && frame<limit && !failure) await write(await snap());
      await job;
      if(failure) throw failure;
      await hold(until);
    }
    const target=new URL(base);
    target.searchParams.set('lang',lang);
    await page.goto(target.href,{waitUntil:'domcontentloaded'});
    await page.locator('input[id$="-main"]').setInputFiles(paper);
    const figure=page.locator('.lens-cell[data-figure^="F:8@"]').first();
    await figure.click({timeout:120000});
    await tab('A').waitFor({timeout:90000});
    if(!en) await page.locator('.compare-bar h3[lang="zh-CN"]:not([aria-busy="true"]):not([data-translation-retry])').waitFor({timeout:120000});
    await page.evaluate(()=>document.fonts.ready);
    await hold(start.methods,'overview');

    await tab('A').click();
    const fold=page.locator('.frw.st .st-fold');
    if(await fold.getAttribute('aria-expanded')==='true') await fold.click();
    const axis=stage.locator('.rq-hit[aria-label*="Exaggeration factor" i]').first();
    await axis.waitFor();
    await hold(8,'panel');
    await axis.click();
    const note=stage.locator('.rq-callout:visible');
    await note.waitFor();
    assert.match(await note.innerText(),/Exaggeration factor \(ρ\)/i);
    assert.match(await note.innerText(),en?/attraction/i:/吸引/);
    await page.mouse.move(8,8);
    await stage.evaluate(el=>el.scrollTo({top:0,behavior:'instant'}));
    await checkWordFrame(axis,false);
    const box=await axis.boundingBox();
    const tip=await note.locator('p').boundingBox();
    const wire=await stage.locator('.rq-wire path').evaluate(p=>{
      const pt=p.getPointAtLength(0).matrixTransform(p.getScreenCTM());
      return {x:pt.x,y:pt.y};
    });
    const plot=await stage.locator('.rq-sheet canvas').boundingBox(),pane=await stage.boundingBox();
    assert(plot.y>=pane.y-1 && tip.y+tip.height<=pane.y+pane.height+1,'The whole panel and its explanation must fit in the recording');
    assert(box.y>0 && tip.y+tip.height<viewport.height && wire.y>=box.y+box.height-1 && wire.y<box.y+box.height+5);
    assert(Math.abs(wire.x-(box.x+box.width/2))<3);
    await hold(start.export,'axis');
    marks.axisBox=box;

    await page.keyboard.press('Escape');
    await page.locator('.rq-add-slide:visible').click();
    await basket.locator('.basket-thumb[data-ready="true"]').first().waitFor();
    await hold(17.5,'basket');
    const first=en?'Follow the orange curve as the exaggeration factor increases.':'沿橙色曲线观察夸大系数增大时读数的变化。';
    const second=en?'Compare the same range in panel B.':'在小图 B 中比较相同的横坐标范围。';
    await action(19,()=>cards.nth(0).locator('textarea').pressSequentially(first,{delay:35}));
    await tab('B').click();
    await page.locator('.rq-add-slide:visible').click();
    await basket.locator('.basket-thumb[data-ready="true"]').nth(1).waitFor();
    await action(22,()=>cards.nth(1).locator('textarea').pressSequentially(second,{delay:45}));
    const previous=await basket.locator('.basket-name').allTextContents();
    assert.equal(previous.length,2);
    await action(23.5,()=>cards.nth(1).locator('.basket-grip').dragTo(cards.first()));
    assert.deepEqual(await basket.locator('.basket-name').allTextContents(),previous.reverse());
    await hold(start.story,'sorted');

    await view('map').click();
    await page.locator('.mm-node:visible').first().waitFor();
    const mapTitle=page.locator('[data-map-root] .mm-text');
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-map-root] .mm-text,[data-map-branch=aim] .mm-text')].every(n=>!n.hasAttribute('aria-busy')&&!n.dataset.translationRetry),null,{timeout:120000});
    assert.match(await mapTitle.innerText(),en?/How does the balance between attraction and repulsion shape neighbor embeddings\?/i:/吸引力与排斥力之间的平衡如何影响邻域嵌入？/);
    assert((await page.locator('[data-map-branch=aim] .mm-page').evaluateAll(nodes=>nodes.map(n=>n.title))).some(q=>/we study the spectrum of t-SNE embeddings/i.test(q)));
    await page.locator('.mm-width').click();
    const topics=page.locator('[data-map-topic] .mm-dot');
    for(const toggle of await topics.all())if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
    await readyMap();
    await page.getByRole('button',{name:en?'Fit':'适合',exact:true}).click();
    await hold(30,'map');
    await page.locator('.mm-width').click();
    await page.locator('.mm-current').click();
    await readyMap();
    await page.locator('.mm-current').click();
    await hold(start.deck,'map-figure');
    await view('story').click();
    await page.locator('.dk-item').filter({has:page.locator('.dk-panel')}).first().click();
    await page.locator('.dk-frame img').first().waitFor();
    const fields=page.locator('.dk-edit .dk-field textarea');
    await hold(40,'deck');
    const text=en?'Compare the curves across the same horizontal range.':'沿相同的横坐标范围比较两条曲线。';
    await action(44,()=>fields.nth(0).fill(text));
    const speech=en?'The peak shows where this dataset most closely matches the reference layout.':'曲线峰值标出这套数据与参照布局最接近的位置。';
    await action(48,()=>fields.nth(1).fill(speech));
    assert.equal(await fields.nth(1).inputValue(),speech);
    await hold(start.rehearse,'notes');
    await page.getByRole('button',{name:en?'Rehearse':'试讲',exact:true}).click();
    const show=page.getByRole('button',{name:en?'Show notes':'看备注',exact:true});
    await show.waitFor();
    await hold(54,'rehearse');
    await show.click();
    await page.getByText(speech,{exact:true}).filter({visible:true}).first().waitFor();
    await hold(57,'rehearsal-notes');
    await page.keyboard.press('Escape');
    const download=page.waitForEvent('download',{timeout:120000});
    await page.getByRole('button',{name:en?'Export slide deck':'导出整套 PPTX',exact:true}).click();
    assert.match((await download).suggestedFilename(),/\.pptx$/i);
    await page.locator('.dk-message').filter({hasText:en?'Exported':'已导出'}).waitFor();
    await hold(stages.duration,'exported');
    fs.writeFileSync(path.join(folder,'frames.json'),JSON.stringify(marks,null,2));
    encoder.stdin.end();
    assert.equal((await done)[0],0);
    assert.equal(frame,stages.duration*fps);
    console.log(lang,frame+' frames',JSON.stringify(marks));
  } finally {
    encoder.stdin.destroy();
    if(encoder.exitCode==null) encoder.kill();
    await browser.close();
  }
}
record().catch(error=>{console.error(error);process.exitCode=1});
