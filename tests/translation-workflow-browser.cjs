// Native PDF upload / source selection, the real shipped WASM and deterministic
// faults. Only the failing sentence and the external paid provider are injected.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium,webkit}=require('playwright-core');
const {openSource,selectText}=require('./selection-engine-browser.cjs');
const base=process.argv[2],captures=process.env.TRANSLATION_SCREENSHOTS;
const lang=process.env.READER_BROWSER||'chromium';
const lines=['The blue light passed through the glass.','Water remained clear.','The second sensor failed.',
  'The surface was smooth.','The final temperature was stable.','The measured concentration was 0.25 mg/mL (Fig. 2c).',
  'The standard error of the mean (SEM) was reported.',
  'Poly(vinyl acetate) (PVAc) was weighed.',
  'Only intervals with at least k observations were retained.',
  'Group A received 7 mg and group B received 11 mg.'];
function fixture(title,rows){
  const lit=s=>s.replace(/[\\()]/g,a=>'\\'+a);
  const content='BT /F1 12 Tf 55 760 Td '+[title,...rows].map(s=>'('+lit(s)+') Tj').join(' 0 -22 Td ')+' ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream'];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((v,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+v+'\nendobj\n'});
  const start=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')+
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';
  return {name:title+'.pdf',mimeType:'application/pdf',buffer:Buffer.from(pdf,'ascii')};
}
async function main(){
  const browser=lang==='webkit'?await webkit.launch():await chromium.launch({channel:lang});
  const context=await browser.newContext({viewport:{width:1200,height:850},serviceWorkers:'block'});
  const page=await context.newPage(),popup=page.locator('.local-translation:visible'),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let sequence=0,breakRegistry=true;
  async function capture(label){if(captures){fs.mkdirSync(captures,{recursive:true});await page.screenshot({path:path.join(captures,String(++sequence).padStart(2,'0')+'-'+label+'.png')})}}
  const wait=state=>page.waitForFunction(s=>document.querySelector('.local-translation:not([hidden])')?.dataset.translationState===s,state,{timeout:65000})
    .catch(async cause=>{throw new Error('Expected '+state+'; saw '+await popup.textContent({timeout:3000}),{cause})});
  const run=()=>popup.locator('.selection-translate').click();
  await page.route('**/bergamot/models.json',r=>breakRegistry?r.abort():r.continue());
  try{
    await openSource(page,fixture('Optical measurements',lines),process.env.READER_UI_LANGUAGE||'en');
    await selectText(page,lines[0]);await run();await wait('error');
    assert.equal(await popup.getAttribute('data-translation-stage'),'download');
    await capture('interrupted-download');breakRegistry=false;
    let cdp;
    if(lang!=='webkit'&&captures){
      cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:5*1024*1024,uploadThroughput:1024*1024});
    }
    await run();
    if(cdp){
      await popup.locator('small').filter({hasText:/MiB received|已接收/}).first().waitFor({timeout:30000});
      await capture('model-progress');
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    }
    await wait('translated');assert.match(await popup.locator(':scope > p').innerText(),/蓝光.*玻璃/);
    await capture('recovered-translation');await popup.locator('.selection-close').click();
    await selectText(page,'SEM');await run();await wait('translated');
    assert.match(await popup.locator(':scope > p').innerText(),/均值标准误/);
    await capture('contextual-terminology');await popup.locator('.selection-close').click();
    await page.evaluate(()=>{
      const original=PaperLanguageText.translate;
      window.unitFault=true;window.unitCalls=[];
      PaperLanguageText.translate=Object.assign(async(t,...rest)=>{
        unitCalls.push(t);
        if(unitFault&&t==='The second sensor failed.')throw Object.assign(new Error('Test interruption for one sentence'),{stage:'download'});
        return original(t,...rest);
      },{withTerms:original.withTerms});
    });
    const paragraph=/The blue light passed through the glass\.[\s\S]*?The final temperature was stable\./;
    await selectText(page,paragraph);await run();await wait('partial');
    const kept=await popup.locator(':scope > p').innerText();assert.match(kept,/玻璃/);
    await popup.locator('.selection-review summary').click();
    assert.match(await popup.locator('.translation-unit').innerText(),/second sensor/);
    assert.equal(await popup.locator('.translation-unit').count(),1);
    await capture('partial-paragraph');
    await page.evaluate(()=>{unitFault=false;unitCalls.length=0});
    await popup.locator('.selection-review summary').click();
    await popup.locator(':scope > p .translation-issue-link').click();await wait('translated');
    assert.deepEqual(await page.evaluate(()=>unitCalls),['The second sensor failed.']);
    await capture('single-sentence-retry');await popup.locator(':scope > details').filter({has:page.locator('blockquote')}).locator('summary').click();
    await capture('whole-paragraph-source');
    await popup.locator('.selection-precision').click();
    const pane=popup.locator('.selection-precision-pane');
    await pane.waitFor();
    assert.match(await pane.locator('pre').innerText(),/The second sensor failed/);
    await capture('precision-preview');
    if(!await page.evaluate(()=>ReaderAccess.local)){
      let submitted=[],code=401;
      await page.route('**/chat/completions',async r=>{
        const data=r.request().postDataJSON(),message=JSON.parse(data.messages[1].content);
        submitted.push(message);
        const json=code===200?{choices:[{finish_reason:'stop',message:{content:JSON.stringify({translations:message.units.map((u,i)=>({id:u.id,text:['蓝光穿过玻璃。','水保持清澈。','第二个传感器失灵了。','表面很光滑。','最终温度稳定。'][i]}))})}}]}:{error:'QA fixture'};
        return r.fulfill({status:code,json});
      });
      await pane.locator('.access-keys summary').click();await pane.locator('input[type=password]').fill('qa-key-intercepted');
      await pane.locator('.access-keys button').first().click();
      const send=pane.getByRole('button',{name:/Send and refine|同意发送/});
      assert.equal(submitted.length,0);const before=await popup.locator(':scope > p').innerText();
      for(code of [401,429,200]){
        const count=submitted.length;await send.click();
        await page.waitForFunction(()=>!document.querySelector('.selection-precision-pane > button').disabled);
        assert.equal(submitted.length,count+1);assert.equal(submitted.at(-1).context,'');
        assert.deepEqual(submitted.at(-1).units.map(u=>u.text),lines.slice(0,5));
        if(code!==200)assert.equal(await popup.locator(':scope > p').innerText(),before);
      }
      assert.match(await popup.locator(':scope > p').innerText(),/传感器失灵/);
    }
    await popup.locator('.selection-close').click();
    await selectText(page,'temperature');await run();await wait('translated');await capture('word');
    // Both claims must survive a real model translation from selected PDF text.
    await popup.locator('.selection-close').click();
    for(const [line,expected] of [[lines[7],/poly\s*\(vinyl acetate\)/i],[lines[8],/至少\s*(?:有\s*)?k|≥\s*k/i]]){
      await selectText(page,line);await run();
      await popup.locator(':scope > p').filter({hasText:expected}).waitFor();
      assert.match(await popup.locator(':scope > p').innerText(),/[\u4e00-\u9fff]/);
      await capture(line===lines[7]?'chemical-identity':'symbolic-threshold');
      await popup.locator('.selection-close').click();
    }
    // Force a known numerical swap to verify the UI independently of whether
    // this particular worker happens to mistranslate the sentence today.
    await page.evaluate(source=>{
      const previous=PaperLanguageText.translate;
      PaperLanguageText.translate=Object.assign((s,...args)=>s===source?
        Promise.resolve('A 组接受 11 mg，B 组接受 7 mg。'):previous(s,...args),{withTerms:previous.withTerms});
    },lines[9]);
    await selectText(page,lines[9]);await run();await wait('partial');
    const evidence=popup.locator(':scope > p .translation-issue-link');
    assert.match(await evidence.innerText(),/7 mg.*11 mg/);
    await capture('swapped-group-evidence');
    await evidence.click();
    assert.equal(await popup.locator('.selection-review').getAttribute('open'),'');
    assert.match(await popup.locator('.translation-unit:focus').innerText(),/7 mg/);
    await page.locator('input[id$="-main"]').first().setInputFiles(fixture('Second document',['A separate study examined light.']));
    await page.waitForFunction(()=>document.querySelector('.local-translation')?.hidden);
    assert.deepEqual(errors,[]);
    console.log('PASS',lang,'actual upload, download recovery, term, partial progress, one-sentence retry, consent, paper switch');
  }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
