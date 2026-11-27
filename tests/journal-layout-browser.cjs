// Minimal printed layouts distilled from failures in the public journal corpus.
const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');

function sample() {
  const objects = [null,null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  const add = data => objects.push(data);
  const stream = (s, extra='') => '<< /Length '+s.length+' '+extra+' >>\nstream\n'+s+'\nendstream';
  const pixels = '14314c8e'.repeat(128)+'>';
  const picture = add(stream(pixels,'/Type /XObject /Subtype /Image /Width 32 /Height 16 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode'));
  const text = (x,y,s,size=10,font='R') => 'BT /'+font+' '+size+' Tf '+x+' '+y+' Td ('+s+') Tj ET';
  const plate = (bottom,height) => 'q 454 0 0 '+height+' 54 '+bottom+' cm /Plate Do Q';
  const oldFont=add('<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>');
  const repeated='The distribution of the samples was recorded at every site.';
  const result='As shown in Figure 1, all three sampling sites lie along the river.';
  const draft=add(stream([text(50,525,repeated),text(50,509,'The discarded measurements in Figure 1 came from a prior draft.'),
    text(50,492,result)].join('\n'),'/Type /XObject /Subtype /Form /BBox [0 0 40 20] /Resources << /Font << /R '+oldFont+' 0 R >> >>'));
  const pages = [
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
  return {name:'field-observations.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)};
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
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
