// Upload an unfamiliar cross-page plate from the shared reader URL.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const base=new URL(process.argv[2]);
function splitPlate(){
  const line=(y,value,font='R')=>'BT /'+font+' 12 Tf 54 '+y+' Td ('+value+') Tj ET';
  const stream=s=>'<< /Length '+s.length+' >>\nstream\n'+s+'\nendstream';
  const content1='q 460 0 0 500 54 130 cm /Plate Do Q\n'+line(105,'Legend on next page');
  const content2=[line(705,'Readings increased under the second condition (Figure 3A).'.replace(/[()]/g,'\\$&')),
    line(240,'Figure 3. Sensor calibration','B'),line(225,'(A) Readings from the two sensors.'.replace(/[()]/g,'\\$&'))].join('\n');
  const page=(n,xobj='')=>'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 780] /Resources << /Font << /R 5 0 R /B 6 0 R >> '+xobj+' >> /Contents '+n+' 0 R >>';
  const pixels='1a4f90ff'.repeat(64)+'>';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    page(8,'/XObject << /Plate 7 0 R >>'),page(9),'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /XObject /Subtype /Image /Width 16 /Height 16 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length '+pixels.length+' >>\nstream\n'+pixels+'\nendstream',
    stream(content1),stream(content2)];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n'});
  const xref=pdf.length;
  pdf+='xref\n0 10\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';
  return {name:'sensor-calibration.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf)};
}
(async()=>{
  const browser=await chromium.launch({channel:process.env.READER_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':'chromium')});
  try{
    const ctx=await browser.newContext();
    const fresh=await ctx.newPage();
    await fresh.goto(new URL('?lang=en',base).href);
    await fresh.addLocatorHandler(fresh.locator('.gd-skip:visible'),button=>button.click());
    await fresh.evaluate(()=>{const api=PaperReadingEvidence;window.PaperReadingEvidence={...api,enrich(...args){const result=api.enrich(...args);window.inspected=args[1];return result}}});
    const file=process.argv[3]||splitPlate();
    await fresh.locator('input[id$="-main"]').first().setInputFiles(file);
    const cells=fresh.locator('.lens-cell[data-figure^="F:"]');
    await cells.first().waitFor({timeout:90000});
    const target=cells.nth(Math.min(2,await cells.count()-1));
    await target.click();await fresh.locator('.st-explain').click();
    await fresh.waitForFunction(()=>document.querySelector('.frw-plate img')?.naturalWidth>0);
    if(!process.argv[3]){
      const figure=await fresh.evaluate(()=>inspected.figures[0]);
      assert.equal(figure.page,1);assert.equal(figure.captionPage,2);assert.equal(figure.mode,'crop');
      assert.equal(figure.title,'Sensor calibration');assert.match(figure.authorPassages[0].text,/Figure 3A/);
    }
    console.log('Cross-page figure, printed title, and article citation passed');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
