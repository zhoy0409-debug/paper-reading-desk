// Run with a reader URL, the "Fast-growing intracellular ..." paper PDF, and optionally a screenshot directory.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright-core');

async function clearAtCenter(locator) {
  return locator.evaluate(node=>{
    const box=node.getBoundingClientRect();
    return node.contains(document.elementFromPoint(box.x+box.width/2, box.y+box.height/2));
  });
}

async function checkWordFrame(hit, vertical) {
  const delta=await hit.evaluate((label, vertical)=>{
    const canvas=document.querySelector('.rq-sheet canvas');
    const image=canvas.getBoundingClientRect(),box=label.getBoundingClientRect();
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const scaleX=canvas.width/image.width,scaleY=canvas.height/image.height;
    // Scan rows across the printed word, transposing the axes for vertical text.
    const x=(vertical?box.top-image.top:box.left-image.left)*(vertical?scaleY:scaleX);
    const y=(vertical?box.left-image.left:box.top-image.top)*(vertical?scaleX:scaleY);
    const w=vertical?box.height*scaleY:box.width*scaleX,h=vertical?box.width*scaleX:box.height*scaleY;
    const bands=[];
    let band=null;
    const first=Math.max(0,Math.floor(x-h*.25)),last=Math.min(vertical?canvas.height:canvas.width,Math.ceil(x+w+h*.25));
    for(let row=Math.max(0,Math.floor(y-h*.55));row<Math.min(vertical?canvas.width:canvas.height,Math.ceil(y+h*1.55));row++){
      let left=last,right=first,total=0,run=0,longest=0;
      for(let col=first;col<last;col++){
        const at=4*(vertical?col*canvas.width+row:row*canvas.width+col);
        if(Math.max(pixels[at],pixels[at+1],pixels[at+2])<130){
          total++;left=Math.min(col,left);right=col;longest=Math.max(longest,++run);
        }else run=0;
      }
      // Separate the nearby solid dimension arrow from the strokes of the text.
      if(total<2||longest>w*.65){band=null;continue}
      if(!band){band={left,right,top:row,bottom:row,count:0};bands.push(band)}
      band.left=Math.min(band.left,left);band.right=Math.max(band.right,right);band.bottom=row;band.count+=total;
    }
    const text=bands.sort((a,b)=>b.count-a.count)[0];
    if(!text)return Infinity;
    return Math.max(Math.abs(text.left-x),Math.abs(text.top-y),Math.abs(x+w-text.right-1),Math.abs(y+h-text.bottom-1))/Math.min(scaleX,scaleY);
  },vertical);
  assert(delta<2,'Printed glyphs differ from their hit rectangle by '+delta+' CSS px');
}

async function check(page, base, pdf, screenshots) {
  const errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"read":1,"home":1}'));
  const url=new URL(base);
  url.searchParams.set('lang','zh');
  await page.goto(url.href);
  await page.locator('input[type=file][id$="-main"]').setInputFiles(pdf);
  await page.locator('.lens-cell').first().click({timeout:90000});
  const tabs=page.locator('.st-dock .frw-panel-tab');
  const panel=letter=>tabs.filter({hasText:new RegExp('^'+letter+'$')});
  const stage=page.locator('.rq-stage:visible');
  const x=stage.locator('.rq-hit[aria-label^="x:6048" i]');
  const y=stage.locator('.rq-hit[aria-label^=\"y:6048\" i]');
  const tip=stage.locator('.rq-callout:visible');
  const follow=tip.getByRole('button',{name:'继续追问'});
  await panel('D').click();
  await x.click({timeout:60000});
  async function checkTip() {
    await page.waitForFunction(()=>document.querySelector('.rq-callout:not([hidden]) h4')?.innerText?.includes('6048'));
    // Wait for the reveal transition; locator.click() alone would automatically scroll and mask the defect.
    await page.waitForFunction(()=>{
      const card=document.querySelector('.rq-callout:not([hidden])');
      const text=card?.querySelector('p'),btn=card?.querySelector('.rq-actions button:last-child');
      if(!text||!btn)return false;
      const r=text.getBoundingClientRect(),b=btn.getBoundingClientRect();
      return text.contains(document.elementFromPoint(r.left+5,r.top+10)) &&
        btn.contains(document.elementFromPoint(b.left+b.width/2,b.top+b.height/2));
    },{},{timeout:7000});
    await tip.evaluate(node=>Promise.all(node.getAnimations().map(a=>a.finished.catch(()=>{}))));
  }
  async function separated(){
    const view=await stage.boundingBox();
    const nav=await page.locator('.rq-focused>.st-dock').boundingBox();
    assert(nav && nav.y>=view.y+view.height-1,'the panel switcher overlays the reading area');
    const locator=await page.locator('.rq-focused>.frw-viewport').boundingBox();
    if(locator)assert(locator.y>=view.y+view.height-1,'the overview covers the reading area');
  }
  await checkTip();await separated();await checkWordFrame(x,false);await checkWordFrame(y,true);
  assert.match(await tip.locator('p').innerText(),/904 µm.*宽度/);
  if(screenshots)await page.screenshot({path:path.join(screenshots,'桌面-图1D.png')});
  await page.keyboard.press('Escape');
  assert.equal(await tip.count(),0);
  await x.focus();await page.keyboard.press('Enter');await checkTip();
  await follow.click();
  assert(await page.locator('.rq-ask:visible').count());
  await page.locator('.rq-tabs button[data-view=read]').click();

  await page.setViewportSize({width:1200,height:650});
  await page.locator('.rq-add-slide').click();
  await page.locator('.slide-basket:visible').waitFor();
  await page.locator('.rq-zoom').click();
  assert.equal(await page.locator('.rq-zoom').getAttribute('aria-pressed'),'true');
  await x.click();
  await checkTip();await separated();
  await checkWordFrame(x,false);
  await stage.focus();await page.keyboard.press('Home');
  await page.waitForFunction(()=>document.querySelector('.rq-stage').scrollTop<2);
  const bounds=await stage.boundingBox();
  await page.mouse.move(bounds.x+8,bounds.y+bounds.height/2);
  await page.mouse.wheel(0,1300);
  await page.waitForFunction(()=>document.querySelector('.rq-stage').scrollTop>20);
  assert(await clearAtCenter(follow),'the last action must accept a real click after scrolling');
  const attached=await page.locator('.rq-wire path').evaluate(p=>{
    if(!p.getAttribute('d'))return false;
    const end=p.getPointAtLength(p.getTotalLength()).matrixTransform(p.getScreenCTM());
    return Math.abs(end.y-document.querySelector('.rq-callout').getBoundingClientRect().top)<2;
  });
  assert(attached,'the connector endpoint drifts when scrolling');
  if(screenshots)await page.screenshot({path:path.join(screenshots,'矮窗口-放大与汇报篮.png')});
  await page.locator('.rq-zoom').click();
  await panel('C').click();
  await panel('D').click();
  assert.equal(await tip.count(),0);
  await page.locator('.rq-focus-bar').getByRole('button',{name:'返回整图'}).click();
  assert.equal(await stage.count(),0);

  await panel('D').click();
  await page.locator('.rq-crop').click();
  const edit=page.locator('.pc-dialog[open]');
  await edit.locator('.pc-handle[data-edge=w]').focus();
  await page.keyboard.press('Shift+ArrowLeft');
  await edit.locator('.pc-apply').click();
  await y.click();await checkWordFrame(y,true);
  await page.setViewportSize({width:390,height:780});
  await panel('D').click();
  await x.click();await checkTip();await separated();await checkWordFrame(x,false);
  if(screenshots)await page.screenshot({path:path.join(screenshots,'手机-图1D.png')});
  await follow.click();
  assert(await page.locator('.rq-ask:visible').count());
  assert.deepEqual(errors,[]);
}
module.exports={check};
if(require.main===module)(async()=>{
  const browser=await chromium.launch({channel:'msedge'});
  try {
    const page=await browser.newPage({viewport:{width:1536,height:795}});
    await check(page,...process.argv.slice(2));
    console.log('PASS Fig. 1D: native hit tests, scroll and connector, basket, zoom, keyboard, switching panels, phone and follow-up.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
