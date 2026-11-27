// Upload original papers. READER_MAP_CORPUS can point to the downloaded journal-layout PDFs.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright-core');
const [url,neuron,review,abaucin]=process.argv.slice(2);
const samples=[
  {file:path.resolve(__dirname,'../dist/media/2007.08902.pdf'),title:'Attraction-Repulsion Spectrum in Neighbor Embeddings',
    aim:/We study the spectrum of t-SNE embeddings/i,aimPage:2,figure:8,question:/balance between attraction and repulsion.*neighbor embeddings\?/i,zh:/吸引力与排斥力之间的平衡如何影响邻域嵌入？/},
  {file:neuron,title:'ILC2 instructs neural stem and progenitor cells to potentiate neurorepair after stroke',
    aim:/we investigated the role of ILC2s in immune adaptation/i,aimPage:4,figure:3,question:/ILC2.*neural stem and progenitor cells.*neurorepair after stroke\?/i,zh:/ILC2.*神经干细胞和祖细胞.*卒中.*神经修复？/},
  {file:review,title:'Targeting chemokine signaling networks for therapeutics in skeletal disorders',
    aim:/this review synthesizes current insights/i,aimPage:1,figure:4,review:true,question:/targeting chemokine signaling networks to treat skeletal disorders\?/i,zh:/趋化因子信号网络.*骨骼疾病.*依据？/},
  {file:abaucin,title:'Conformational hijacking of lipoprotein transporter LolDF enables precision antimicrobial activity against Acinetobacter baumannii',
    aim:/abaucin|LolDF/i,figure:1,question:/abaucin.*LolDF.*A\. baumannii.*E\. coli.*susceptible\?/i,zh:/Abaucin.*LolDF.*鲍曼不动杆菌.*受测大肠杆菌.*？/}
].filter(s=>s.file);
if(process.env.READER_MAP_CORPUS){
  const corpus=[
    ['PMC11634064',/pharyngeal neuronal mechanisms.*sour taste.*Drosophila melanogaster\?/i],
    ['PMC11704610',/single-cell RNA sequencing algorithms.*single-molecule RNA imaging.*estimating changes in transcriptional noise\?/i],
    ['PMC11660854',/effect.*active break intervention.*nonspecific low back pain among young people\?/i],
    ['aps-beam',/用虚源法.*广义抛物光束的近场传输？/,'zh'],
    ['PMC11686177',/polymer membrane.*improve hole extraction and ion blocking.*solar cells\?/i],
    ['PMC8692484',/optical coherence tomography.*monitor.*ablation/i],
    ['PMC8692591',/activity patterns.*predict changes in glycemic control.*prediabetes\?/i]
  ];
  for(const [id,question,lang='en'] of corpus){
    samples.push({file:path.join(process.env.READER_MAP_CORPUS,id+'.pdf'),figure:1,question,lang,corpus:id});
  }
}

async function check(browser,sample){
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(new URL('?lang='+(sample.lang||'en'),url).href);
    await page.addLocatorHandler(page.locator('.gd-skip:visible'),b=>b.click());
    await page.locator('input[id$="-main"]').first().setInputFiles(sample.file);
    await page.locator('.lens-cell[data-figure^="F:'+sample.figure+'@"]').first().click({timeout:120000});
    await page.locator('.st-views [data-view=map]').click();
    const root=page.locator('[data-map-root] .mm-text');
    await root.waitFor();
    const original=await root.innerText();
    assert.match(original,sample.question);
    if(sample.corpus){
      const title=await page.locator('.st-crumbs .st-paper').innerText();
      if(sample.lang==='zh')assert.equal(title,'虚源法研究广义抛物光束的近场传输');
      const source=page.locator('[data-map-root] .mm-page').first();
      await source.focus();await source.press('Enter');
      await page.locator('.compare-mark:visible').waitFor({timeout:15000});
      assert.deepEqual(errors,[]);
      console.log(JSON.stringify({paper:sample.corpus,question:original,source:await source.textContent()}));
      return;
    }
    assert.equal((await page.locator('.st-crumbs .st-paper').innerText()).replace(/[‐‑–—]/g,'-'),sample.title);
    assert.notEqual(original,sample.title);
    const coreLinks=page.locator('[data-map-root] .mm-page');
    assert(await coreLinks.count(),'Central question needs a source');
    if(sample.file===abaucin){
      const links=await coreLinks.allTextContents();
      assert(links.includes('p.2'),'The species comparison needs its comparative passage');
      const comparison=coreLinks.filter({hasText:'p.2'});
      await comparison.focus();await comparison.press('Enter');
      await page.locator('.compare-sheet img[alt="PDF · p.2"]:visible').waitFor();
      await page.locator('.compare-mark:visible').waitFor();
    }
    const purpose=page.locator('[data-map-branch=aim] button.mm-page');
    const quotes=await purpose.evaluateAll(items=>items.map(b=>b.title));
    const i=quotes.findIndex(s=>sample.aim.test(s));
    assert(i!==-1,'Aim not found: '+JSON.stringify(quotes));
    if(sample.file===abaucin){
      assert(quotes.some(s=>/potency and selectivity/i.test(s)),'Clinical activity and selectivity need their own objective');
      assert(quotes.some(s=>/define the mechanism/i.test(s)),'The mechanism needs its own objective');
    }
    const source=purpose.nth(i);
    const sourcePage=Number((await source.innerText()).replace(/^p\./,''));
    assert(sourcePage>0);
    if(sample.aimPage)assert.equal(sourcePage,sample.aimPage);
    const aims=await page.locator('[data-map-branch=aim] .mm-text').allTextContents();
    assert(!aims.some(s=>s===original||/\b(?:we empirically show that|we report that)\b/i.test(s)));
    assert.equal(await page.locator('.mm-d1[data-map-branch=results] .mm-text').innerText(),sample.review?'Review topics and figures':'Results');
    const topics=await page.locator('[data-map-branch=results] .mm-thumb').count();
    assert(topics>=sample.figure);
    if(sample.figure===8)assert.match(await page.locator('.mm-on .mm-text').first().innerText(),/^Distance correlations? between UMAP\/FA2 and t-SNE[.]?$/i);
    await page.locator('.mm-width').click();
    assert.equal(await page.locator('.frw.st.mm-wide .mm-width').getAttribute('aria-pressed'),'true');
    const expand=page.locator('.mm-expand'),visible=page.locator('.mm-node:not([hidden])');
    const initial=await visible.count();
    await expand.click();
    assert((await visible.count())>initial);
    assert.equal(await page.locator('.mm-dot[aria-expanded=false]').count(),0);
    await expand.click();
    assert.equal(await visible.count(),initial);
    await source.focus();await source.press('Enter');
    await page.locator('.compare-sheet img[alt="PDF · p.'+sourcePage+'"]:visible').waitFor();
    await page.locator('.compare-mark:visible').waitFor({timeout:10000});
    assert.equal(await page.locator('.compare-status').innerText(),'Matching source line');
    assert.equal(await page.locator('.mm-width').getAttribute('aria-pressed'),'false');
    const toChinese=page.locator('button[data-locale="zh"]:visible').first();
    await toChinese.click();
    await page.waitForFunction(()=>
      [...document.querySelectorAll('[data-map-root] .mm-text,[data-map-branch=aim] .mm-text')].every(n=>!n.hasAttribute('aria-busy')&&!n.dataset.translationRetry&&/[\u3400-\u9fff]/u.test(n.textContent)),{},{timeout:90000}).catch(async error=>{
      const visible=await page.locator('[data-map-root] .mm-text,[data-map-branch=aim] .mm-text').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent,lang:n.lang,retry:n.dataset.translationRetry})));
      throw Error(sample.title+' — '+JSON.stringify(visible)+' — '+error.message);
    });
    const zh=await root.innerText();
    assert.match(zh,sample.zh);
    if(sample.file===abaucin){
      await page.waitForFunction(()=>/LolDF 的构象.*鲍曼不动杆菌/.test(document.querySelector('.st-crumbs .st-paper')?.textContent||''),null,{timeout:30000});
      assert(await page.locator('.mm-d1[data-map-branch=discussion]').count(),'The paper discusses how its mechanism differs from earlier work');
    }
    const zhAims=await page.locator('[data-map-branch=aim] .mm-text').allTextContents();
    assert(!zhAims.includes(zh));
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({title:sample.title,question:original,zh,aimPage:sourcePage,aims:zhAims,figures:topics}));
  }finally{await page.close()}
}
(async()=>{
  const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium'});
  try{for(const sample of samples)await check(browser,sample)}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
