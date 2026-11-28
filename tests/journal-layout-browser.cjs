// Minimal printed layouts distilled from failures in the public journal corpus.
const assert = require('node:assert/strict');
const {deflateSync} = require('node:zlib');
const {chromium} = require('playwright-core');

function sample(appendix='', raster=null) {
  const objects = [null,null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  const add = data => objects.push(data);
  const stream = (s, extra='') => '<< /Length '+s.length+' '+extra+' >>\nstream\n'+s+'\nendstream';
  const pixels = (raster ? deflateSync(Buffer.from(raster.pixels)).toString('hex') : '14314c8e'.repeat(128))+'>';
  const filter = raster ? '[/ASCIIHexDecode /FlateDecode]' : '/ASCIIHexDecode';
  const picture = add(stream(pixels,'/Type /XObject /Subtype /Image /Width '+(raster?.width||32)+' /Height '+(raster?.height||16)+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter '+filter));
  const text = (x,y,s,size=10,font='R') => 'BT /'+font+' '+size+' Tf '+x+' '+y+' Td ('+s+') Tj ET';
  const plate = (bottom,height) => 'q 454 0 0 '+height+' 54 '+bottom+' cm /Plate Do Q';
  const oldFont=add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
  const repeated='The distribution of the samples was recorded at every site.';
  const result='As shown in Figure 1, all three sampling sites lie along the river.';
  const draft=add(stream([text(50,525,repeated),text(50,509,'The discarded measurements in Figure 1 came from a prior draft.'),
    text(50,492,result)].join('\n'),'/Type /XObject /Subtype /Form /BBox [0 0 40 20] /Resources << /Font << /R '+oldFont+' 0 R >> >>'));
  const pages = raster ? [[
    plate(120,540),'q 1 g 50 632 460 18 re f Q',
    text(54,104,'Fig. 1 | Survey sites. A Ridge. B Hill. C Bay. D Brook. E, F Gauges. G Basin. H East. I West.',9)
  ]] : appendix ? [
    ...Array.from({length:43},(_,i)=>[text(54,715,'Study observations on manuscript page '+(i+1)+'.')]),
    [text(54,732,'Figure legends',14,'B'),
      text(54,684,'Fig. 1 The distribution of mountain',12,'B'),text(54,661,'sampling sites',12,'B'),
      text(54,638,'(A) The higher sampling sites are indicated by circles.'.replace(/[()]/g,'\\$&'),12),
      text(54,520,'Fig. 2 Seasonal river temperatures',12,'B'),
      text(54,497,'Measurements were repeated in three seasons.',12)],
    [plate(90,595)],
    ...(appendix==='missing'?[]:[[plate(90,595),...(appendix==='conflict'?[text(54,730,'Fig. 7',11,'B')]:[])]])
  ] : [
    [text(54,725,repeated,12),text(54,685,result),'/Draft Do',
     text(54,708,'The conditions at each of the three sites were comparable.',12),
     plate(250,300),text(54,235,'Figure 1 Sample collection sites.',9,'B')],
    [text(54,680,'Figura 2: Estimativas regionais.'),plate(500,175),
     text(54,420,'Figure 3. Southern sites.'),plate(215,200)],
    [plate(140,540),text(54,119,'Figure 4 |',9,'B'),text(102,119,'Legend on next page.',9)],
    [text(75,730,'We estimated changes over time according to',12),
     text(54,715,'Figure 9. The results were compared across regions.',12),
     text(54,550,'Figure 4. Seasonal soil temperatures.',9,'B'),
     plate(140,185),text(54,123,'Figure 5. Mean surface temperatures.',9,'B')],
    [text(54,705,'List of illustrations',15),text(54,555,'Figure 6. Atmospheric pressure.',9,'B')],
    [plate(245,355),text(54,230,'Figure 6. Atmospheric pressure.',9,'B')]
  ];
  const ids=pages.map(lines=>{
    const content=add(stream(lines.join('\n')));
    return add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 780] /Resources << /Font << /R 3 0 R /B 4 0 R >> /XObject << /Plate '+picture+' 0 R /Draft '+draft+' 0 R >> >> /Contents '+content+' 0 R >>');
  });
  objects[0]='<< /Type /Catalog /Pages 2 0 R >>';
  objects[1]='<< /Type /Pages /Kids ['+ids.map(i=>i+' 0 R').join(' ')+'] /Count '+ids.length+' >>';
  let pdf='%PDF-1.4\n';
  const offsets=objects.map((o,i)=>{const start=pdf.length;pdf+=(i+1)+' 0 obj\n'+o+'\nendobj\n';return start;});
  const xref=pdf.length;
  pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+
    'trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return {name:'field-observations'+appendix+'.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)};
}

// A publisher banner covers the first row. The lower left plots are lettered
// before G, a map spanning two rows to their right.
async function printedPanelFixture(page) {
  const raster=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=454;canvas.height=540;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='white';ctx.fillRect(0,0,454,540);
    ctx.fillStyle='black';ctx.font='bold 16px Arial';
    for(const [label,x,y] of [['A',8,24],['B',160,24],['C',320,24],['D',8,167],['E',8,269],
      ['F',58,269],['G',110,167],['H',8,375],['I',200,375]])ctx.fillText(label,x,y);
    ctx.fillStyle='#555';
    for(const rect of [[15,40,120,90],[170,40,120,116],[329,40,110,90],[15,178,80,55],
      [12,280,38,56],[62,280,35,56],[125,180,314,159],[15,395,156,125],[210,395,229,125]])ctx.fillRect(...rect);
    ctx.fillStyle='white';ctx.fillRect(125,254,314,2);
    const rgba=ctx.getImageData(0,0,454,540).data;
    return {width:454,height:540,pixels:Array.from({length:454*540},(_,i)=>rgba[i*4])};
  });
  return sample('',raster);
}

(async()=>{
  const browser=await chromium.launch({channel:process.env.READER_BROWSER_CHANNEL || (process.platform==='win32'?'msedge':'chromium')});
  try {
    const p=await browser.newPage();
    await p.goto(new URL('?lang=en',process.argv[2]).href);
    await p.addLocatorHandler(p.locator('.gd-skip:visible'),b=>b.click());
    await p.evaluate(()=>{
      const api=PaperReadingEvidence;
      window.PaperReadingEvidence={...api,enrich(...args){const result=api.enrich(...args);window.checkedFigures=args[1].figures;
        window.checkedRows=args[0].model.rows;window.checkedSession=args[2];return result;}};
    });
    await p.locator('input[id$="-main"]').first().setInputFiles(sample());
    await p.waitForFunction(()=>window.checkedFigures,null,{timeout:45000});
    const figures=await p.evaluate(()=>checkedFigures.map(f=>({n:f.matchKey,id:f.id,title:f.title,pg:f.page,cp:f.captionPage,rect:f.pageBox})));
    assert.deepEqual(figures.map(f=>f.n),['F:1','F:2','F:3','F:4','F:5','F:6']);
    assert.match(figures[0].title,/^Sample collection/);
    const citation=await p.evaluate(async()=>{
      const actual=checkedFigures[0].authorPassages.find(p=>p.text.includes('along the river'));
      return {hidden:checkedRows.some(r=>r.text.includes('discarded measurements')),
        rect:actual&&await checkedSession.locateExcerpt(actual.page,actual.text)};
    });
    assert.equal(citation.hidden,false);
    assert(citation.rect&&Math.abs((1-citation.rect.y)*780-693)<6,'Highlight the printed paragraph, not text clipped out of the placed figure');
    for(const [index,top,height] of [[1,105,175],[2,365,200]]){
      const f=figures[index];assert(f.rect);
      assert(Math.abs(f.rect.y*780-top)<4 && Math.abs(f.rect.height*780-height)<5,JSON.stringify(f));
    }
    assert.deepEqual([figures[3].pg,figures[3].cp,figures[4].pg],[3,4,4]);
    assert.deepEqual([figures[5].pg,figures[5].cp],[6,6]);
    assert(figures[5].rect);assert.match(figures[5].id,/^F:6@5:/);
    const target=figures[1];
    await p.locator('.lens-cell[data-figure="'+target.id+'"]').first().click();
    await p.locator('.st-explain').first().click();
    assert.match(await p.locator('.frw-notes').first().innerText(),/Estimativas regionais/);
    console.log('Unpunctuated headings, Portuguese captions, top captions, numbered page pointers and wrapped references passed.');
    for(const ending of ['complete','missing','conflict']){
      const fresh=await browser.newPage();
      try{
        await fresh.goto(new URL('?lang=en',process.argv[2]).href);
        await fresh.addLocatorHandler(fresh.locator('.gd-skip:visible'),b=>b.click());
        await fresh.evaluate(()=>{
          const api=PaperReadingEvidence;
          window.PaperReadingEvidence={...api,enrich(...args){
            const out=api.enrich(...args);window.tailFigures=args[1].figures;return out;
          }};
        });
        await fresh.locator('input[id$="-main"]').first().setInputFiles(sample(ending));
        await fresh.waitForFunction(()=>window.tailFigures,null,{timeout:45000});
        const rows=await fresh.evaluate(()=>tailFigures.map(f=>[f.matchKey,f.title,f.page,f.captionPage,!!f.pageBox]));
        assert.deepEqual(rows.map(r=>r.slice(0,2)),[['F:1','The distribution of mountain sampling sites'],['F:2','Seasonal river temperatures']]);
        assert.deepEqual(rows.map(r=>r.slice(2)),ending==='complete'?[[45,44,true],[46,44,true]]:[[44,44,false],[44,44,false]]);
      }finally{await fresh.close()}
    }
    console.log('End legends beyond page 42: complete series linked, incomplete and conflicting series kept on their source pages.');
    const panelPage=await browser.newPage();
    try{
      await panelPage.goto(new URL('?lang=en',process.argv[2]).href);
      await panelPage.addLocatorHandler(panelPage.locator('.gd-skip:visible'),b=>b.click());
      await panelPage.evaluate(()=>{
        const mount=FigureReadingWorkbench.mount;
        window.testPaints=0;
        FigureReadingWorkbench.mount=(host,options)=>mount(host,{...options,async renderFigure(...args){
          const original=await options.renderFigure(...args);
          if(++window.testPaints!==1)return original;
          // Valid file signature, incomplete image: exercise the browser's decode error.
          return {...original,blob:new Blob([Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])],{type:'image/png'})};
        }});
        const api=PaperReadingEvidence;
        window.PaperReadingEvidence={...api,enrich(...args){
          const result=api.enrich(...args);window.riverFigure=args[1].figures[0];return result;
        }};
      });
      const file=await printedPanelFixture(panelPage);
      await panelPage.locator('input[id$="-main"]').first().setInputFiles(file);
      await panelPage.waitForFunction(()=>window.riverFigure,null,{timeout:45000});
      await panelPage.locator('.frw-placeholder button:visible').click({timeout:15000});
      await panelPage.waitForFunction(()=>window.testPaints>=2&&document.querySelector('.frw-plate img')?.naturalWidth>0);
      const panels=await panelPage.evaluate(()=>{
        const {pageBox,panels}=riverFigure;
        return panels.map(({id,region})=>({id,region,pageBox}));
      });
      assert.deepEqual(panels.map(p=>p.id),[...'abcdefghi']);
      assert(panels.every(p=>p.region),'All printed letters must open a crop');
      const g=panels.find(p=>p.id==='g');
      function inside(x,y){
        const bx=((54+x)/600-g.pageBox.x)/g.pageBox.width;
        const by=((120+y)/780-g.pageBox.y)/g.pageBox.height;
        return bx>=g.region.x&&bx<g.region.x+g.region.width&&by>=g.region.y&&by<g.region.y+g.region.height;
      }
      assert(inside(130,190)&&inside(431,333),'G must include the lower right corner of the map');
      assert(!inside(65,265)&&!inside(202,371),'Neighbouring plots must stay outside G');
    }finally{await panelPage.close()}
    console.log('Retry after a decode error, A–I raster letters under a publisher banner and the full two-row map passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
