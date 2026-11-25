// A long review with detached figure headings and image-only schematic labels.
const assert = require('node:assert/strict');
const { chromium, webkit, devices } = require('playwright-core');

async function reviewFile(page) {
  const figures = [
    ['Copper', 'Glass', 'Copper conducts the sensor current. Glass insulates the housing.'],
    ['Quartz', 'Silicon', 'Quartz sets the reference frequency. Silicon carries the sensing circuit.']
  ];
  const objects = [null, null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  const add = value => (objects.push(value), objects.length);
  const stream = (data, extra = '') => '<< /Length '+data.length+' '+extra+' >>\nstream\n'+data+'\nendstream';
  const text = (x,y,size,font,value) => 'BT /'+font+' '+size+' Tf '+x+' '+y+' Td ('+value+') Tj ET';
  const imageIds = [];
  for (const labels of figures) {
    const jpeg = await page.evaluate(([a,b]) => {
      const c = document.createElement('canvas'); c.width=720; c.height=320;
      const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,720,320);
      g.fillStyle='#263d4f';g.font='bold 48px Arial';g.fillText(a,75,105);g.fillText(b,395,235);
      g.strokeStyle='#679293';g.lineWidth=4;g.beginPath();g.moveTo(245,129);g.lineTo(357,195);g.stroke();
      return c.toDataURL('image/jpeg',.98).split(',')[1];
    }, labels);
    imageIds.push(add(stream(Buffer.from(jpeg,'base64').toString('latin1'),
      '/Type /XObject /Subtype /Image /Width 720 /Height 320 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode')));
  }
  const kids=[];
  for (let pageNumber=1; pageNumber<=46; pageNumber++) {
    const i=pageNumber===2?0:pageNumber===46?1:-1;
    let resources='/Font << /F1 3 0 R /F2 4 0 R >>', commands='';
    if(pageNumber===1)commands=[
      text(55,717,18,'F2','Materials in sensing systems: a scoping review'),
      text(55,640,11,'F1','We summarize material choices for sensing systems.'),
      text(55,572,10,'F1','The previous publication describes its other materials in'),
      text(55,559,10,'F1','Figure 91'),text(55,546,10,'F1','An ordinary paragraph continues the discussion.')
    ].join('\n');
    if(i>=0){
      resources+=' /XObject << /Plate '+imageIds[i]+' 0 R >>';
      commands=['q 432 0 0 192 60 365 cm /Plate Do Q',text(60,346,9,'F2','FIGURE '+(i+1)),
        text(60,333,10,'F1',figures[i][2])].join('\n');
    }
    const body=add(stream(commands));
    kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 550 770] /Resources << '+resources+' >> /Contents '+body+' 0 R >>'));
  }
  objects[0]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[1]='<< /Type /Pages /Count '+kids.length+' /Kids ['+kids.map(n=>n+' 0 R').join(' ')+'] >>';
  let data='%PDF-1.4\n';const offsets=[];
  for(const [i,obj] of objects.entries()){offsets.push(data.length);data+=(i+1)+' 0 obj\n'+obj+'\nendobj\n'}
  const xref=data.length;
  data+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+
    'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return {name:'materials-review.pdf',mimeType:'application/pdf',buffer:Buffer.from(data,'latin1')};
}

(async()=>{
  const url=new URL('?lang=en',process.argv[2]||'http://127.0.0.1:8174/');
  const browser=process.env.READER_BROWSER==='webkit'?await webkit.launch():
    await chromium.launch({channel:process.env.READER_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':'chromium')});
  try {
    let file,spot;
    for(const action of ['direct','early tap','switch while reading']){
      const desktop=action==='direct'&&browser.browserType().name()==='chromium';
      const ctx=await browser.newContext(desktop?{viewport:{width:1440,height:920},hasTouch:true,locale:'en-US'}:{...devices['iPhone 13'],locale:'en-US'});
      let resume;
      const gate=new Promise(resolve=>{resume=resolve});
      try{
        const page=await ctx.newPage();
        if(!file)file=await reviewFile(page);
        const checkDownloads=action==='direct'&&browser.browserType().name()==='chromium';
        const requests=new Set();let serial=false;
        if(checkDownloads){
          let both;
          const paired=new Promise(resolve=>{both=resolve});
          await ctx.route(/\/ocr\/(?:eng\.traineddata\.gz|tesseract-core-lstm\.wasm\.js)$/,async route=>{
            requests.add(new URL(route.request().url()).pathname);
            if(requests.size===2)both();
            let timer;
            await Promise.race([paired,new Promise(resolve=>{timer=setTimeout(()=>{serial=true;resolve()},8000)})]);
            clearTimeout(timer);await route.continue();
          });
        }
        if(action!=='direct')await page.route('**/ocr/tesseract.esm.min.js',async route=>{await gate;await route.continue()});
        await page.addLocatorHandler(page.locator('.gd-layer .gd-skip:visible'),b=>b.tap());
        await page.goto(url.href,{waitUntil:'domcontentloaded'});
        await page.locator('input[id$="-main"]').first().setInputFiles(file);
        const cells=page.locator('.lens-cell[data-figure^="F:"]');
        await cells.nth(1).waitFor({state:'attached',timeout:45000});
        assert.deepEqual(await cells.evaluateAll(els=>els.map(e=>e.dataset.figure.split('@')[1].split(':')[0])),['2','46']);
        const visual=page.locator('.frw-visual');
        const layer=visual.locator('.frw-plate .figure-click-layer');
        const note=visual.locator('.figure-click-note:visible');
        if(action==='direct'){
          const copper=layer.getByRole('button',{name:/^Copper/i}).first();
          await copper.waitFor({timeout:35000});
          if(checkDownloads)assert(requests.size===2&&!serial,'Fetch the dictionary and runtime concurrently');
          spot=await copper.evaluate(b=>({x:(parseFloat(b.style.left)+parseFloat(b.style.width)/2)/100,
            y:(parseFloat(b.style.top)+parseFloat(b.style.height)/2)/100}));
          await copper.tap();
        }else{
          const img=visual.locator('.frw-plate img:visible');
          const status=visual.locator('.figure-point-status[data-state="loading"]:visible').first();
          await status.waitFor();
          await img.scrollIntoViewIfNeeded();
          const rect=await img.boundingBox();
          await img.tap({position:{x:rect.width*spot.x,y:rect.height*spot.y}});
          await status.getByText(/Reading the spot you selected/).waitFor();
          if(action==='switch while reading')await cells.nth(1).tap();
          resume();
        }
        if(action==='switch while reading'){
          const quartz=layer.getByRole('button',{name:/^Quartz/i}).first();
          await quartz.waitFor({timeout:35000});
          assert.equal(await note.count(),0,'A pending tap belongs to its original figure');
          await quartz.tap();
          assert.match(await note.locator('p').innerText(),/Quartz sets the reference frequency/);
        }else{
          await note.waitFor({timeout:35000});
          assert.match(await note.locator('p').innerText(),/Copper conducts the sensor current/);
          if(desktop){
            const dock=await visual.locator('.st-dock').boundingBox(),card=await note.boundingBox();
            assert(dock&&card&&dock.y>=card.y+card.height-1,'Zoom controls leave the explanation and its source link uncovered');
          }
        }
        console.log('Review figure index, detached captions and '+action+' passed');
      }finally{resume();await ctx.close()}
    }
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
