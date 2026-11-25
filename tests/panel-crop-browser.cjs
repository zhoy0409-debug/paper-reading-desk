// Pass a reader URL, the Abaucin PDF and optionally a directory for the exported slide and preview.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright-core');

async function check(page,url,pdf,output){
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"read":1,"home":1}'));
  const entry=new URL(url);entry.searchParams.set('lang','zh');
  async function open(){
    await page.goto(entry.href);
    await page.locator('input[type=file][id$="-main"]').setInputFiles(pdf);
    await page.locator('.lens-cell').nth(1).click({timeout:90000});
  }
  await open();
  const panel=letter=>page.locator('.frw-panel-tab').filter({hasText:new RegExp('^'+letter+'$')});
  const editor=page.locator('.pc-dialog[open]'),box=editor.locator('.pc-box'),crop=page.locator('.rq-crop:visible');
  const card=page.locator('.basket-card').first();
  const applied=()=>page.evaluate(()=>{
    const k=Object.keys(localStorage).find(n=>/^paper-tree\.v9\.[0-9a-f]{64}$/.test(n));
    const state=JSON.parse(localStorage.getItem(k));
    const [f,p]=JSON.parse(state.queue[0]);
    return state.figures[f].boxes[p]||null;
  });
  async function edit(){
    await crop.click();await editor.locator('.pc-surface:visible').waitFor();
  }
  await panel('E').click();
  await page.locator('.rq-add-slide').click();
  await card.locator('textarea').fill('图 2E 的整肺外观');
  await edit();
  const initial=await box.boundingBox();
  const east=box.locator('[data-edge=e]');
  const grip=await east.boundingBox();
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
  await page.mouse.down();await page.mouse.move(grip.x+grip.width/2+20,grip.y+grip.height/2,{steps:5});await page.mouse.up();
  const resized=await box.boundingBox();
  assert(Math.abs(resized.x-initial.x)<1 && resized.width>initial.width+10);
  await editor.getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await applied(),null);
  await edit();await east.focus();await page.keyboard.press('Shift+ArrowRight');
  await box.focus();await page.keyboard.press('ArrowDown');
  if(output)await page.screenshot({path:path.join(output,'Abaucin-调整裁切.png')});
  await editor.getByRole('button',{name:'应用裁切'}).click();
  const saved=await applied();assert(saved?.width>0);
  assert.match(await page.locator('.rq-focus:visible .rq-focus-bar').innerText(),/2.*E/);
  await card.locator('.basket-thumb[data-ready=true]').waitFor();

  await panel('B').click();
  await card.locator('.basket-crop').click();
  assert.match(await editor.locator('h3').innerText(),/2.*E/);
  await editor.getByRole('button',{name:'查看整页'}).click();
  await editor.locator('.pc-surface:visible').waitFor();
  await editor.getByRole('button',{name:'还原自动边界'}).click();await box.waitFor();
  await page.keyboard.press('Escape');
  assert.deepEqual(await applied(),saved);
  assert.match(await page.locator('.rq-focus:visible .rq-focus-bar').innerText(),/2.*B/);

  await open();
  await card.locator('.basket-thumb[data-ready=true]').waitFor();assert.deepEqual(await applied(),saved);
  assert.equal(await card.locator('textarea').inputValue(),'图 2E 的整肺外观');
  await page.setViewportSize({width:390,height:780});
  await card.locator('.basket-crop').click();
  await box.waitFor();
  const se=await box.locator('[data-edge=se]').boundingBox();
  const touch=await page.context().newCDPSession(page);
  const x=se.x+se.width/2,y=se.y+se.height/2;
  for(const [type,points] of [['touchStart',[{x,y}]],['touchMove',[{x:x-12,y:y-8}]],['touchEnd',[]]]){
    await touch.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  }
  await touch.detach();await editor.getByRole('button',{name:'应用裁切'}).click();
  const mobile=await applied();
  assert(mobile.width<saved.width && mobile.height<saved.height);
  const panelBox=await card.locator('.basket-thumb[data-ready=true]').evaluate(c=>[c.width,c.height]);
  const ready=page.waitForEvent('download',{timeout:60000});
  await page.locator('.basket-export').click();const d=await ready;
  assert.equal(await d.failure(),null);
  if(output)await d.saveAs(path.join(output,'Abaucin-已校正小图.pptx'));
  assert(panelBox.every(n=>n>1));
  if(output){
    await page.setViewportSize({width:1440,height:900});
    await panel('E').click();
    const more=page.locator('.st-more'),report=page.locator('.pd-report');
    for(const group of [more,report]){
      if(!await group.evaluate(node=>node.open))await group.locator(':scope > summary').click();
    }
    const downloaded=page.waitForEvent('download');
    await report.getByRole('button',{name:'保存小图 PNG'}).click();
    await (await downloaded).saveAs(path.join(output,'Abaucin-已校正小图.png'));
  }
  await card.locator('.basket-crop').click();await box.waitFor();
  await editor.getByRole('button',{name:'还原自动边界'}).click();await box.waitFor();
  await editor.getByRole('button',{name:'应用裁切'}).click();assert.equal(await applied(),null);

  await page.setViewportSize({width:1440,height:900});
  await panel('E').click();
  await page.locator('.rq-focus-bar').getByRole('button',{name:'返回整图'}).click();
  await page.locator('.pd-source-crop').click();
  await box.waitFor();
  await editor.getByRole('button',{name:'应用裁切'}).click();
  assert.match(await page.locator('.rq-focus:visible .rq-focus-bar').innerText(),/手选区域/);
  assert.deepEqual(errors,[]);
  console.log('PASS Abaucin 2E: resize, move, cancel, save, basket edit from 2B, reopen, touch, crop export and whole-figure selection.');
}
module.exports={check};
if(require.main===module)(async()=>{
  const b=await chromium.launch({channel:'msedge'});
  try{await check(await b.newPage({viewport:{width:1440,height:900},hasTouch:true}),...process.argv.slice(2));}
  finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
