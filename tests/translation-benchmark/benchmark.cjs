// Run against an unmodified release or a candidate. The browser executes the shipped model.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium,webkit}=require('playwright-core');
const [url,destination,corpus]=process.argv.slice(2);
const engine=process.env.READER_BROWSER||'chrome';
const rows=corpus?fs.readFileSync(corpus,'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(s=>JSON.parse(s)):null;
const samples=['The blue light passed through the glass.','A warm surface cools after the light is removed.',
  'The concentration was 0.25 mg/mL (Fig. 2c).','Group A increased by 10%, whereas Group B decreased by 20%.',
  'The room temperature remained stable during the measurement.'];
const results={url,engine,rows:[],probes:{},snapshots:[]};
const save=()=>fs.writeFileSync(destination,JSON.stringify(results,null,2));
const pause=ms=>new Promise(f=>setTimeout(f,ms));
function observe(){
  window.benchAudit={starts:0,inferences:0,modelReady:[],requests:[]};
  const post=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(m,...args){
    if(m?.name==='initialize')benchAudit.starts++;
    if(m?.name==='translate')benchAudit.inferences++;
    if(m?.name==='loadTranslationModel'){
      const when=performance.now();
      const receive=e=>{if(e.data.id===m.id){this.removeEventListener('message',receive);if(!e.data.error)benchAudit.modelReady.push({start:when,end:performance.now(),from:m.args[0].from})}};
      this.addEventListener('message',receive);
    }
    return post.call(this,m,...args);
  };
}
async function execute(p,entry){
  return p.evaluate(async entry=>{
    const start=performance.now(),science=await PaperLanguageText.science();
    const source=entry.source, from=entry.from||'en', field=entry.field||'auto';
    try{
      let output,units;
      if(PaperLanguageText.session){
        const {createTranslationSession}=await PaperLanguageText.session();
        const s=createTranslationSession({source,from,field,context:entry.context||''});
        await s.run();
        units=s.units.map(u=>({id:u.id,status:u.status,source:u.source,text:u.text,validation:u.validation,error:u.error?.message||u.error,attempts:u.attempts}));
        output=units.map(u=>u.text||'').join(' ');
      }else{
        const t=await science.selectionTranslation(source,from,PaperLanguageText.translate,{field,context:entry.context||''});
        output=t.text;
      }
      return {id:entry.id,chars:source.length,from,ms:Math.round(performance.now()-start),text:output,units,
        status:!units||units.every(u=>u.status==='translated')?'translated':units.some(u=>u.status==='translated')?'partial':units.some(u=>u.status==='review')?'review':'failed'};
    }catch(e){return {id:entry.id,chars:source.length,from,ms:Math.round(performance.now()-start),status:'failed',error:e.message,stage:e.stage,reason:e.reason}}
  },entry);
}
async function main(){
  const browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:engine==='chromium'?'chromium':engine});
  let monitor;
  try{
    if(process.env.BENCH_PYTHON&&engine!=='webkit'&&process.platform==='win32'){
      const cdp=await browser.newBrowserCDPSession();
      const info=await cdp.send('SystemInfo.getProcessInfo');
      const pid=info.processInfo.find(p=>p.type==='browser').id;
      monitor=spawn(process.env.BENCH_PYTHON,[path.join(__dirname,'working-set.py'),String(pid),destination+'.rss.json'],{windowsHide:true,stdio:'ignore'});
    }
    const context=await browser.newContext();
    await context.addInitScript(observe);
    const page=await context.newPage(),files={};
    page.on('request',r=>{if(/vendor\/bergamot\/.+(?:[.]bin|[.]spm|models[.]json)(?:[?]|$)/.test(r.url())){const key=new URL(r.url()).pathname.split('/').pop();files[key]=(files[key]||0)+1}});
    await page.goto(new URL('?lang=en',url).href,{waitUntil:'load',timeout:120000});
    results.version=(await page.evaluate(async()=>await (await fetch('./VERSION',{cache:'no-store'})).text())).trim();
    const snap=async label=>{results.snapshots.push({label,files:{...files},...await page.evaluate(()=>({...benchAudit,ts:performance.now()}))});save()};
    if(rows){
      for(const entry of rows){results.rows.push(await execute(page,entry));if(results.rows.length%10===0){save();console.log(results.rows.length+'/'+rows.length)}}
    }else{
      await snap('before cold');
      for(const [i,s] of [...samples,...samples,...samples].entries())results.rows.push(await execute(page,{id:'hot-'+i,source:s}));
      await snap('after en');
      for(const [i,s] of ['实验组增加了 10%，而对照组降低了 20%。','光穿过玻璃。','样品的温度保持稳定。'].entries())results.rows.push(await execute(page,{id:'zh-'+i,source:s,from:'zh'}));
      for(const n of [100,500,2000,6000]){
        const source=Array.from({length:n},(_,i)=>samples[i%samples.length]).join(' ').slice(0,n);
        results.rows.push(await execute(page,{id:'length-'+n,source}));
      }
      const gap='The blue light passed through the glass. Glass cooled slowly. The second sensor failed. The final temperature was stable. Water remained clear.';
      results.probes.partial=await page.evaluate(async s=>{
        const lib=await PaperLanguageText.science(),base=PaperLanguageText.translate;
        const fault=async(t,...r)=>{if(/second sensor/i.test(t))throw Object.assign(new Error('Interrupted this unit'),{stage:'download'});return base(t,...r)};
        try{if(PaperLanguageText.session){const {createTranslationSession}=await PaperLanguageText.session();const session=createTranslationSession({source:s,from:'en',engine:{id:'local',translate:fault}});await session.run();return session.units.map(u=>[u.status,u.text,u.attempts])}
          return (await lib.selectionTranslation(s,'en',fault)).text}catch(e){return {error:e.message,stage:e.stage}}},gap);
      const job=page.evaluate(async ss=>Promise.allSettled(ss.map((s,i)=>PaperLanguageText.chinese(s+' Sample '+(i+1)+'.'))),samples);
      results.probes.foregroundDuringMap=await execute(page,{id:'foreground',source:'The sample was kept in the shade.'});await job;
      await context.setOffline(true);
      results.probes.warmOffline=await execute(page,{id:'warm-offline',source:'A new sample was kept at room temperature.'});
      await context.setOffline(false);await snap('both languages');
      const cold=await browser.newContext();await cold.addInitScript(observe);const cp=await cold.newPage();
      await cp.goto(new URL('?lang=en',url).href);await cp.evaluate(()=>PaperLanguageText.science());await cold.setOffline(true);
      results.probes.emptyOffline=await execute(cp,{id:'cold-offline',source:samples[0]});
      await cold.setOffline(false);results.probes.recovery=await execute(cp,{id:'network-restored',source:samples[0]});await cold.close();
    }
    await snap('complete');console.log('Wrote',destination,results.rows.length,results.version);
  }finally{await browser.close();if(monitor)await pause(800);save()}
}
main().catch(e=>{console.error(e);results.error=String(e);save();process.exitCode=1});
