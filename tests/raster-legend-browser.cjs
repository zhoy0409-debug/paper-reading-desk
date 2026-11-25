// Original test chart with a raster-only legend in tests/fixtures. No selectable legend text.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const path=require('node:path');
const [url,output]=process.argv.slice(2);
async function verify(page,lang,file){
  const entry=new URL(url);entry.searchParams.set('lang',lang);
  await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"home":1,"read":1}'));
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(entry.href);
  await page.locator('input[type=file][id$="-main"]').setInputFiles(path.join(__dirname,'fixtures',file+'.pdf'));
  await page.locator('.lens-cell').first().click({timeout:60000});
  const image=page.locator('.frw-visual .frw-plate>img').first();
  const layer=page.locator('.frw-visual .figure-click-layer');
  const note=page.locator('.frw-visual .figure-click-note');
  await layer.locator('button').first().waitFor({timeout:60000});
  // Find each coloured square and the dark word alongside it on the original bitmap.
  const anchors=await image.evaluate(img=>{
    const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
    const g=c.getContext('2d');g.drawImage(img,0,0);
    const {width:w,height:h}=c,data=g.getImageData(0,0,w,h).data;
    return ['red','blue'].map(colour=>{
      const xs=[],ys=[];
      // The two samples precede the bars in both versions of the original chart.
      for(let y=0;y<h;y++){
        const before=xs.length;
        for(let x=0;x<w;x++){
          const i=4*(y*w+x),r=data[i],g=data[i+1],b=data[i+2];
          if(colour==='red'?r>g*2&&r>b*2:b>g*1.5&&b>r*2){xs.push(x);ys.push(y)}
        }
        if(before&&xs.length===before)break;
      }
      const lo=Math.min(...xs),hi=Math.max(...xs),t=Math.min(...ys),b=Math.max(...ys);
      const ink=[];
      for(let y=t;y<=b;y++)for(let x=hi+2;x<w*.96;x++){const i=4*(y*w+x);if(Math.max(...data.subarray(i,i+3))<105)ink.push(x)}
      return [[(lo+hi+1)/(2*w),(t+b+1)/(2*h)],[(Math.min(...ink)+Math.max(...ink)+1)/(2*w),(t+b+1)/(2*h)]];
    });
  });
  for(const [index,name] of ['Control','Intervention'].entries())for(const [kind,[x,y]] of anchors[index].entries()){
    await image.scrollIntoViewIfNeeded();const b=await image.boundingBox();
    const point={x:b.x+x*b.width,y:b.y+y*b.height};
    const target=await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest('button')?.title,point);
    const role=lang==='zh'?['图例符号','图例'][kind]:['Legend symbol','Legend'][kind];
    assert.equal(target,role+' · '+name);await page.mouse.click(point.x,point.y);
    assert.match(await note.locator('p').innerText(),lang==='zh'?[ /红色方块.*对照组/,/蓝色方块.*干预/ ][index]:[ /red square.*reference group/i,/blue square.*study intervention/i ][index]);
  }
  if(output)await page.screenshot({path:path.join(output,file+'-'+lang+'.png')});
  assert.deepEqual(errors,[]);console.log('PASS',lang,file,': both printed squares and group names at original bitmap coordinates');
}
(async()=>{const b=await chromium.launch({channel:'msedge'});try{
  for(const file of ['raster-legend','fully-scanned-legend'])for(const lang of ['zh','en']){const p=await b.newPage({viewport:{width:1500,height:950}});await verify(p,lang,file);await p.close()}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
