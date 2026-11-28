/* Compare real Bergamot inference on an immutable in-memory copy of the candidate's code.
   No product, model or version files are changed. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright-core');

const root = path.resolve(process.argv[2]);
const rows = fs.readFileSync(path.join(__dirname, 'development-sources.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const output = path.join(__dirname, 'alignment-crossover.json');
const scripts = new Map();
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.bin':'application/octet-stream','.spm':'application/octet-stream','.svg':'image/svg+xml','.woff2':'font/woff2'};
for (const entry of fs.readdirSync(root,{recursive:true,withFileTypes:true})) {
  if (!entry.isFile()) continue;
  const filename=path.join(entry.parentPath,entry.name);
  if (/\.(?:m?js|css|html|json)$/i.test(entry.name)||entry.name==='VERSION')
    scripts.set(path.relative(root,filename).split(path.sep).join('/'),fs.readFileSync(filename));
}
const original=scripts.get('translation-session.js').toString('utf8');
const marker="const back=await translator(text,'zh');";
if(original.split(marker).length!==2) throw new Error('Candidate changed, cannot instrument reverse inference');
const sessionWithTimer=original.replace(marker,`const auditStart=performance.now();
      const back=await translator(text,'zh');
      globalThis.__auditCalls.push({id:globalThis.__auditId, ms:performance.now()-auditStart});`);
const checksum = input=>crypto.createHash('sha256').update(input).digest('hex');
const hashes=Object.fromEntries(['translation-session.js','translation-alignment.js','scientific-translation.js','discipline-glossary.js','paper-language.js'].map(s=>[s,checksum(scripts.get(s))]));
let enabled=true, requests=[];
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith('/read/')) {res.writeHead(404).end();return;}
  const rel=pathname.slice(6)||'index.html';
  const absolute=path.resolve(root,rel);
  if(!absolute.startsWith(root+path.sep)) {res.writeHead(404).end();return;}
  let data=scripts.get(rel);
  if(rel==='translation-session.js') data=Buffer.from(sessionWithTimer);
  if(rel==='translation-alignment.js'&&!enabled)
    data=Buffer.from(data.toString('utf8').replace('export function needsAlignment(source){','export function needsAlignment(source){ return false;'));
  try {
    const size=data?data.length:fs.statSync(absolute).size;
    res.writeHead(200,{'Content-Type':types[path.extname(rel)]||'application/octet-stream','Cache-Control':'no-store','Content-Length':size});
    if(rel.includes('bergamot')&&/\.(?:bin|spm)$/.test(rel)) requests.push({rel,bytes:size});
    if(data) res.end(data); else fs.createReadStream(absolute).pipe(res);
  }catch { if(!res.headersSent) res.writeHead(404); res.end(); }
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/read/?lang=en';
  const browser=await chromium.launch({channel:'chrome'});
  const result={artifactHashes:hashes,order:['off','on','on','off'],runs:[]};
  try{
    for(const mode of result.order){
      enabled=mode==='on';requests=[];
      const ctx=await browser.newContext();
      await ctx.addInitScript(()=>{
        globalThis.__auditCalls=[];globalThis.__auditWorkers=0;
        const send=Worker.prototype.postMessage;
        Worker.prototype.postMessage=function(message,...rest){if(message?.name==='initialize')globalThis.__auditWorkers++;return send.call(this,message,...rest);};
      });
      const p=await ctx.newPage();
      await p.goto(url,{waitUntil:'load'});
      const run={mode,rows:[]};
      for(const r of rows){
        const row=await p.evaluate(async r=>{
          globalThis.__auditId=r.id;
          const start=performance.now();
          const {createTranslationSession}=await PaperLanguageText.session();
          const session=createTranslationSession({source:r.source,from:'en',field:r.field,context:''});
          await session.run();
          return {id:r.id,ms:performance.now()-start,text:session.units.map(u=>u.text||'').join(' '),
            issues:session.units.flatMap(u=>(u.validation?.issues||[]).map(v=>v.code))};
        },r);
        run.rows.push(row);
      }
      Object.assign(run,await p.evaluate(()=>({calls:globalThis.__auditCalls,workers:globalThis.__auditWorkers})),{files:requests});
      await ctx.close();result.runs.push(run);
      fs.writeFileSync(output,JSON.stringify(result,null,2));
      console.log('finished',result.runs.length,mode,'reverse calls',run.calls.length,'model bytes',requests.reduce((a,x)=>a+x.bytes,0));
    }
  }finally{await browser.close();server.close();}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
