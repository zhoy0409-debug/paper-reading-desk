// Upload a public paper and exercise both providers without using an account or credits.
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium, webkit, devices} = require('playwright-core');
const {fixtureOrigin} = require('./personal-api-fixture.cjs');
const base = new URL(process.argv[2]);
const mobile = process.env.READER_BROWSER === 'webkit' || process.argv.includes('--mobile');
const zh = mobile;
const key = {deepseek:'fixture-personal-deepseek', qwen:'fixture-personal-qwen'};
const endpoints = {
  deepseek:'https://api.deepseek.com/chat/completions',
  qwen:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
};

async function test() {
  const useWebkit = process.env.READER_BROWSER === 'webkit';
  const browser = await (useWebkit ? webkit : chromium).launch(useWebkit ? {} : {
    channel:process.env.READER_BROWSER_CHANNEL || (process.platform==='win32' ? 'msedge' : 'chromium')
  });
  const wireFixture=base.protocol==='http:'||!!(process.env.READER_TEST_CERT && process.env.READER_TEST_KEY);
  let fixture;
  try {
    const context = await browser.newContext({
      ...(mobile ? {...devices['iPhone 13'],locale:'zh-CN'} : {viewport:{width:1440,height:950}}),
      ignoreHTTPSErrors:base.protocol==='https:' && ['127.0.0.1','localhost'].includes(base.hostname),
      serviceWorkers:wireFixture?'allow':'block'
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const calls=[], errors=[], leak=[];
    let mode='success';
    page.on('pageerror',err=>errors.push(err.message));
    function respond(provider,authorization,wire){
      const prompt=JSON.parse(wire.messages[1].content);
      calls.push({provider,authorization,wire,prompt});
      const part={en:'Verified comparison in the selected figure.',zh:'已核对所选图的比较。',refs:['P1','P999','L999']};
      let content={reported:part,background:part,uncertain:{zh:'',en:'',refs:[]}};
      if(prompt.language)content={outline:'- Main finding\n  - Figure one ⟦Fig1⟧'};
      if(mode==='invalid')content={};
      const status=mode==='quota'?429:mode==='auth'?401:200;
      return {status,json:status===200?{choices:[{message:{content:JSON.stringify(content)}}]}:{error:{message:'Provider error'}}};
    }
    if(wireFixture){
      fixture=await fixtureOrigin(base.origin,respond);
      await page.addInitScript(({endpoints,target})=>{
        const destinations=new Map(Object.entries(endpoints).map(([name,url])=>[url,target+'/'+name]));
        const native=window.fetch.bind(window);
        window.fetch=(resource,init)=>{
          const url=resource instanceof Request?resource.url:String(resource);
          const redirect=destinations.get(url);
          return native(redirect||resource,init);
        };
      },{endpoints,target:fixture.origin});
    }else{
      // Without a local TLS certificate, isolate the mocked endpoints from
      // service workers that would otherwise bypass Playwright routes.
      await page.route(url=>Object.values(endpoints).includes(url.href),async route=>{
        const req=route.request();
        const headers={'Access-Control-Allow-Origin':base.origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'POST'};
        if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
        const name=Object.keys(endpoints).find(k=>endpoints[k]===req.url());
        const reply=respond(name,await req.headerValue('authorization'),req.postDataJSON());
        return route.fulfill({status:reply.status,headers,json:reply.json});
      });
    }
    const allowed=new Set(fixture?Object.keys(endpoints).map(n=>fixture.origin+'/'+n):Object.values(endpoints));
    page.on('request',req=>{
      const url=req.url();
      if(Object.values(key).some(k=>url.includes(k)||(req.postData()||'').includes(k)) ||
        (req.headers().authorization&&!allowed.has(url)))leak.push(url);
    });
    const url=new URL('?lang='+(zh?'zh':'en'),base);
    await page.goto(url.href);
    assert(await page.evaluate(()=>window.isSecureContext),'Personal-key acceptance needs a secure browser context');
    await page.addLocatorHandler(page.locator('.gd-layer .gd-skip:visible'),b=>b.click());
    await page.locator('input[id$="-main"]').first().setInputFiles(path.resolve(__dirname,'../dist/media/2007.08902.pdf'));
    await page.locator('.st-explain').first().click({timeout:100000});
    await page.locator('.rq-tabs [data-view="ask"]').first().click();
    const ask=page.locator('.rq-ask:visible').first(), provider=ask.locator('.rq-provider'), setting=ask.locator('.access-keys');
    const pwd=setting.locator('input[type=password]'), use=setting.getByRole('button',{name:zh?'使用此 Key':'Use this key',exact:true});
    const forget=setting.getByRole('button',{name:zh?'移除 Key':'Remove key',exact:true});
    const question=ask.locator(':scope > label textarea').first(), consent=ask.locator('.rq-consent input'),
      send=ask.getByRole('button',{name:zh?'发送提问':'Send question',exact:true}), status=ask.locator('.rq-status');
    assert.equal(await provider.inputValue(),'evidence');
    for(const name of ['deepseek','qwen']){
      await provider.selectOption(name);
      await pwd.waitFor();
      await pwd.fill(key[name]);
      if(mobile)await use.tap();else await use.click();
      const confirmation=setting.getByRole('status');
      await confirmation.filter({hasText:zh?'Key 已设置':'Key set'}).waitFor().catch(async error=>{
        throw new Error('Key confirmation was not displayed. Status: '+await confirmation.innerText(),{cause:error});
      });
      assert.equal(await pwd.inputValue(),'');
      assert.equal(await setting.locator('select').inputValue(),name);
      await question.fill('What does this figure compare?');
      const prior=calls.length;
      await send.click();
      assert.equal(calls.length,prior,'Selecting a provider, saving its key, and an unconfirmed click must not spend credits');
      await consent.check();
      await send.click();
      const reply=ask.locator('.rq-turn').nth(name==='deepseek'?0:1);
      await reply.getByText(zh?'已核对所选图的比较。':'Verified comparison in the selected figure.',{exact:true}).first().waitFor().catch(async cause=>{
        const controlled=await page.evaluate(()=>!!navigator.serviceWorker?.controller);
        throw new Error('Expected '+name+' answer; intercepted '+(calls.length-prior)+' provider requests; '+
          'service worker controlled='+controlled+'; reader status='+await status.innerText(),{cause});
      });
      assert.equal(calls.length,prior+1);
      const call=calls.at(-1);
      assert.equal(call.authorization,'Bearer '+key[name]);
      assert.equal(call.provider,name);
      assert.equal(call.wire.response_format.type,'json_object');
      assert(call.prompt.reading.excerpt.length>0);
      assert(call.prompt.reading.paper.some(p=>p.id==='P1' && p.page>0));
      assert.equal(call.prompt.reading.question,'What does this figure compare?');
      assert.deepEqual(call.prompt.externalRecords,[]);
      assert.doesNotMatch(await ask.locator('.rq-turn').last().innerText(),/P999|L999/);
    }
    for(const [scenario,feedback] of [['auth',zh?'服务密钥未通过验证':'The provider rejected'],['quota',zh?'服务繁忙或额度已用完':'rate or quota'],['invalid',zh?'模型返回的回答不完整':'incomplete answer']]){
      mode=scenario;
      await question.fill('Please explain this axis.');
      await consent.check();
      await send.click();
      await status.filter({hasText:feedback}).waitFor();
      assert.equal(await question.inputValue(),'Please explain this axis.');
      assert.equal(await ask.locator('.rq-turn').count(),2);
    }
    mode='success';
    await page.locator('.st-views [data-view=map]').click();
    await page.locator('.mm-ai').click();
    const dialog=page.locator('.mm-dialog[open]');
    await dialog.locator('.mm-model > div select').selectOption('qwen');
    await dialog.getByRole('button',{name:zh?'生成并核对脑图':'Generate and check map',exact:true}).click();
    await dialog.waitFor({state:'detached'});
    assert.equal(calls.at(-1).authorization,'Bearer '+key.qwen);
    assert.equal(calls.at(-1).prompt.language,zh?'zh':'en');
    assert(calls.at(-1).prompt.paper.length>20);
    await page.locator('.st-views [data-view=read]').click();
    await page.locator('.rq-tabs [data-view="ask"]').first().click();
    if(!(await pwd.isVisible()))await setting.locator('summary').click();
    await forget.click();
    assert.equal(await provider.inputValue(),'evidence');
    assert.deepEqual(await page.evaluate(()=>ReaderBrowserModels.options().available),{evidence:true,deepseek:true,qwen:false});
    const stored=await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]));
    assert(Object.values(key).every(k=>!stored.includes(k)));
    const count=calls.length;
    await page.evaluate(()=>{document.documentElement.dataset.previousApiDocument='true'});
    await page.reload({waitUntil:'commit',timeout:45000});
    await page.waitForFunction(()=>!document.documentElement.dataset.previousApiDocument&&!!window.ReaderBrowserModels,
      null,{polling:100,timeout:30000});
    assert.deepEqual(await page.evaluate(()=>ReaderBrowserModels.options().available),{evidence:true,deepseek:false,qwen:false});
    assert.equal(calls.length,count);
    assert.deepEqual(leak,[]);assert.deepEqual(errors,[]);
    console.log('Passed personal API upload, confirmation, provider isolation, question and outline, error recovery, removal and reload:',zh?'zh/mobile':'en/desktop');
  } finally {await browser.close();if(fixture)await fixture.close();}
}
test().catch(err=>{console.error(err);process.exitCode=1});
