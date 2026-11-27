// Exercise the upload controls, an interrupted model download, and individual map entries.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium,webkit}=require('playwright-core');
const [url,original,corpus]=process.argv.slice(2);
const bundled=path.resolve(__dirname,'../dist/media/2007.08902.pdf');
const field='select[id$="-field"]';
const nodePaper='.mm-node:not([hidden]) .mm-text';

async function open(browser,pdf,lang,number,configure,prepare,showMap=true){
  const p=await browser.newPage({viewport:{width:1600,height:1000}});
  await configure?.(p);
  await p.goto(new URL('?lang='+lang,url).href);
  await p.addLocatorHandler(p.locator('.gd-skip:visible'),b=>b.click());
  await p.locator(field+' option[value="chemistry"]').waitFor({state:'attached'});
  await prepare?.(p);
  await p.locator('input[id$="-main"]').first().setInputFiles(pdf);
  await p.locator('.lens-cell[data-figure^="F:'+number+'@"]').first().click({timeout:120000});
  if(showMap){
    await p.locator('.st-views [data-view=map]').click();
    await p.locator('[data-map-root]').waitFor();
  }
  return p;
}
async function checkPoint(browser,pdf,protein){
  const p=await open(browser,pdf,protein?'zh':'en',protein?4:8,null,null,false);
  try{
    await p.locator('.st-dock .frw-panel-tab').filter({hasText:protein?/^C$/i:/^A$/i}).click();
    const hit=label=>p.locator('.rq-stage .rq-hit[aria-label*="'+label+'" i]').first();
    const card=p.locator('.rq-callout:visible'),turns=p.locator('.rq-log:visible .rq-turn');
    await hit(protein?'D361A':'Exaggeration factor').click({timeout:60000});
    const answer=await card.locator('p').innerText();
    if(protein){
      assert.match(answer,/第 361 位.*天冬氨酸.*丙氨酸/);assert.match(answer,/第 2 列/);assert.match(answer,/DMSO.*Abaucin/);
      if(process.env.READER_POINT_CAPTURE)await card.screenshot({path:path.join(process.env.READER_POINT_CAPTURE,'图4C-点读.png')});
    }else assert.match(answer,/attraction.*t-SNE|attraction between neighbours/i);
    await card.getByRole('button',{name:protein?'继续追问':'Ask a question',exact:true}).click();
    assert.equal(await turns.count(),1);
    assert.match(await turns.first().innerText(),protein?/DMSO.*Abaucin.*Wild Type/s:/attraction/i);
    if(protein){
      assert.match(await turns.first().innerText(),/p\.6/);
      await p.locator('.rq-provider').selectOption('evidence');
      await p.locator('.rq-ask textarea[maxlength="1200"]').fill('D361A 的字母和数字分别代表什么？');
      await p.locator('.rq-ask').getByRole('button',{name:'发送提问',exact:true}).click();
      assert.equal(await turns.count(),2);
      assert.match(await turns.nth(1).innerText(),/第 361 位.*天冬氨酸.*丙氨酸/);
      if(process.env.READER_POINT_CAPTURE)await p.locator('.rq-log:visible').screenshot({path:path.join(process.env.READER_POINT_CAPTURE,'图4C-追问.png')});
      await p.locator('.rq-tabs [data-view=read]').click();
      await hit('A362D').click();
      const next=await card.locator('p').innerText();
      assert.match(next,/第 362 位.*丙氨酸.*天冬氨酸/);assert.match(next,/第 3 列/);assert.doesNotMatch(next,/361/);
      await card.getByRole('button',{name:'继续追问',exact:true}).click();
      assert.equal(await turns.count(),1);assert.match(await turns.first().innerText(),/A362D/);
      await p.locator('.rq-tabs [data-view=read]').click();await hit('Wild Type').click();
      assert.match(await card.locator('p').innerText(),/野生型.*第 1 列/);
    }
    console.log('PASS',protein?'three different column labels and a typed follow-up on original Figure 4C':'clicked axis and immediate English follow-up on uploaded Figure 8A');
  }finally{await p.close()}
}
async function selection(p,element,term){
  await element.scrollIntoViewIfNeeded();
  await element.evaluate((el,term)=>{
    const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    let node;
    while(node=walk.nextNode()){
      const at=node.textContent.toLowerCase().indexOf(term.toLowerCase());
      if(at<0)continue;
      const range=document.createRange();
      range.setStart(node,at);range.setEnd(node,at+term.length);
      const selection=getSelection();selection.removeAllRanges();selection.addRange(range);return;
    }
    throw Error('Missing term: '+term);
  },term);
  const toolbar=p.locator('.local-translation:visible');
  await toolbar.locator('.selection-translate').click();
  const result=toolbar.locator(':scope > p[lang=zh-CN]');
  await result.waitFor();
  const text=await result.innerText();
  await toolbar.locator('.selection-close').click();
  return text;
}
async function retryOne(browser){
  let failing=true;
  const p=await open(browser,bundled,'en',8,async p=>{
    await p.route('**/vendor/bergamot/models.json',r=>failing?r.abort('failed'):r.continue());
  });
  try{
    assert.equal(await p.evaluate(()=>PaperLanguageText.field),'computing');
    await p.locator('button[data-locale=zh]:visible').first().click();
    const errors=p.locator(nodePaper+'[data-translation-retry=error]');
    await errors.nth(1).waitFor({timeout:45000});
    await p.evaluate(()=>{
      const failed=[...document.querySelectorAll('.mm-node:not([hidden]) .mm-text[data-translation-retry=error]')];
      // Select a figure title, as a reader can do from the figure map.
      const first=failed.find(n=>n.closest('.mm-node').querySelector('.mm-thumb'))||failed[0];
      first.dataset.testTarget='first';
      failed.find(n=>n!==first).dataset.testTarget='second';
      window.beforeRetry=[document.querySelector('[data-map-root]'),document.querySelector('[data-test-target=second] button')];
    });
    failing=false;
    const target=p.locator('[data-test-target=first]');
    const button=target.getByRole('button',{name:'重试此处的中文解读'});
    await button.focus();await button.press('Enter');
    await p.waitForFunction(()=>{
      const n=document.querySelector('[data-test-target=first]');
      return n&&!n.hasAttribute('aria-busy')&&(n.dataset.translationRetry==='error'||n.lang==='zh-CN'&&/[㐀-鿿]/.test(n.textContent));
    },null,{timeout:300000});
    assert.equal(await target.getAttribute('data-translation-retry'),null,'A single retry should produce the Chinese text');
    assert(await p.evaluate(()=>window.beforeRetry[0]===document.querySelector('[data-map-root]')&&
      window.beforeRetry[1]===document.querySelector('[data-test-target=second][data-translation-retry=error] button')));
    console.log('PASS one failed entry recovered after a blocked registry download; the other failed entry and map stayed in place.');
    await p.locator('.st-menu').click();
    await p.locator(field).selectOption('physics');
    await p.reload();await p.locator('.st-views [data-view=map]:visible').waitFor({timeout:90000});
    await p.waitForFunction(()=>window.PaperLanguageText?.field==='physics');
    assert.equal(await p.locator(field).inputValue(),'physics');
    console.log('PASS subject choice restored for this paper.');
  }finally{await p.close()}
}
async function checkOriginal(browser){
  const p=await open(browser,original,'en',2);
  const panel=id=>p.locator('.mm-node:not([hidden])').filter({has:p.getByRole('button',{name:id,exact:true})});
  try{
    assert.equal(await p.evaluate(()=>PaperLanguageText.field),'medicine');
    const sources={};
    for(const id of ['E','F','G','H','I'])sources[id]=await panel(id).locator('.mm-page').getAttribute('title');
    assert.match(sources.E,/^Lung tissue/);assert.doesNotMatch(sources.E,/IL-1|weight changes|ventilation|Source Data/i);
    assert.match(sources.F,/IL-1β \(f\).*IL-6 \(g\).*0\.0001/);assert.equal(sources.G,sources.F);
    assert.match(sources.H,/^Body weight changes/);assert.match(sources.I,/^Minute ventilation/);
    assert.doesNotMatch(sources.I,/ANOVA|Source Data/);
    assert.equal(await selection(p,panel('E').locator('.mm-text'),'vehicle'),'给药载体');
    await p.locator('button[data-locale=zh]:visible').first().click();
    const checks={E:/肺组织/,F:/IL-1β 浓度/,G:/IL-6 浓度/,H:/体重变化/,I:/每分钟通气量/};
    for(const [id,required] of Object.entries(checks)){
      const n=panel(id).locator('.mm-text');await n.locator('..').waitFor();
      await p.waitForFunction(({id,pattern})=>[...document.querySelectorAll('.mm-node:not([hidden])')].some(n=>
        n.querySelector('.mm-fig')?.textContent===id&&RegExp(pattern).test(n.querySelector('.mm-text').textContent)),{id,pattern:required.source},{timeout:120000});
      const text=await n.innerText();
      assert.match(text,/溶媒对照组/);assert.doesNotMatch(text,/车辆|容器|待重试|正在生成/);
      if(id==='E')assert.doesNotMatch(text,/IL-|体重|通气量|ANOVA/);
      if(id==='F')assert.doesNotMatch(text,/IL-6/);if(id==='G')assert.doesNotMatch(text,/IL-1β/);
      if(id!=='E'){const stars=sources[id].match(/(\*+)\s*p\s*</i);if(stars)assert.ok(text.includes(stars[1]+'P < 0.0001'))}
      assert.equal(await panel(id).locator('.mm-page').innerText(),'p.5');
      console.log(id,text);
    }
    await panel('F').locator('.mm-page').focus();await panel('F').locator('.mm-page').press('Enter');
    await p.locator('.compare-sheet img[alt="PDF · p.5"]:visible').waitFor();
    await p.locator('.compare-mark:visible').waitFor({timeout:15000});
  }finally{await p.close()}
}
async function checkPersonal(browser){
  const p=await open(browser,bundled,'en',8,null,async p=>{
    await p.locator(field).selectOption('custom');
    await p.locator('textarea[id$="-terms"]').fill('embedding = 嵌入表示');
    await p.getByRole('button',{name:'Apply glossary'}).click();
  });
  try{
    const source=p.locator(nodePaper).filter({hasText:/embedding/i}).first();
    assert.equal(await selection(p,source,'embedding'),'嵌入表示');
    await p.reload();
    await p.waitForFunction(()=>window.PaperLanguageText?.field?.id==='custom');
    assert.equal(await p.locator('textarea[id$="-terms"]').inputValue(),'embedding = 嵌入表示');
    console.log('PASS personal terminology used for the selection and restored after reopening.');
  }finally{await p.close()}
}
async function checkOtherSubjects(browser){
  for(const [filename,chosen,expected,term,translation] of [
    ['PMC11739939.pdf','auto','chemistry','adsorption','吸附'],
    ['gmd-gpep.pdf','earth','earth','precipitation','降水']
  ]){
    const p=await open(browser,path.join(corpus,filename),'en',1,null,p=>p.locator(field).selectOption(chosen));
    try{
      assert.equal(await p.evaluate(()=>PaperLanguageText.field),expected);
      const source=p.locator(nodePaper).filter({hasText:new RegExp(term,'i')}).first();
      assert.equal(await selection(p,source,term),translation);
      console.log('PASS uploaded',filename,chosen,expected,term,translation);
    }finally{await p.close()}
  }
}
(async()=>{
  const useWebkit=process.env.READER_BROWSER==='webkit';
  const browser=useWebkit?await webkit.launch():await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium'});
  try{
    if(original){await checkPoint(browser,original,true);await checkOriginal(browser)}
    await checkPoint(browser,bundled,false);
    await retryOne(browser);
    await checkPersonal(browser);
    if(corpus)await checkOtherSubjects(browser);
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
