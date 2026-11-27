// The local updater may answer after the reader has moved the language buttons.
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');

(async()=>{
  const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':'chromium'});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:850}});
    const errors=[],actions=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/portable-update',async route=>{
      await page.locator('.st-right [data-language-switch]').waitFor();
      const action=route.request().method()==='GET'?'status':route.request().postDataJSON().action;
      actions.push(action);
      await route.fulfill({json:{enabled:true,current:'1.0.0',latest:'1.0.1',phase:action==='install'?'ready':'available'}});
    });
    await page.goto(new URL('?lang=zh',process.argv[2]).href);
    await page.addLocatorHandler(page.locator('.gd-skip:visible'),b=>b.click());
    const panel=page.locator('.st-right .portable-update');
    await panel.locator('summary').click();
    assert.match(await panel.locator('[role=status]').innerText(),/v1\.0\.1/);
    await panel.getByRole('button',{name:'下载安装'}).click();
    await panel.getByRole('button',{name:'重启并应用'}).waitFor();
    await page.locator('button[data-locale=en]').first().click();
    await panel.locator('summary').click();await panel.getByRole('button',{name:'Restart to apply'}).waitFor();
    assert.deepEqual(actions,['status','install']);assert.deepEqual(errors,[]);
    console.log('PASS the Windows update control survives header reparenting and language changes.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
