const fs=require('node:fs'),crypto=require('node:crypto');
const [baseFile,candidateFile,output,keyfile]=process.argv.slice(2);
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const sides=fs.existsSync(keyfile)?read(keyfile):crypto.randomInt(2)?['baseline','candidate']:['candidate','baseline'];
if(!fs.existsSync(keyfile))fs.writeFileSync(keyfile,JSON.stringify(sides));
const base=read(baseFile).rows,next=read(candidateFile).rows;
if(base.length!==105||next.length!==105||!base.every((v,i)=>v.id===next[i].id))throw Error('Incomplete or mismatched frozen corpus');
function visible(v){
  const units=v.units?.map((u,i)=>({id:i+1,source:u.source,rawCandidate:u.text||null,status:u.status,
    displayed:!!u.text,accepted:u.status==='translated',issues:u.validation?.issues||[],error:u.error||null,
    inlineText:u.text&&!u.validation?.issues.some(x=>x.severity==='severe')?u.text:''}));
  const visibleText=units?units.map(u=>u.inlineText||(u.status==='review'?'〔待核对〕':'〔待重试〕')).join(''):v.text||'';
  return {status:v.status,displayed:units?units.some(u=>u.inlineText):!!v.text,accepted:v.status==='translated',
    translation:visibleText,rawCandidate:v.text||null,latencyMs:v.ms,units,
    retries:units?Math.max(0,v.units.reduce((n,u)=>n+u.attempts-1,0)):null,extraActions:null,error:v.error||null};
}
const rows=base.map((v,i)=>{const p={baseline:visible(v),candidate:visible(next[i])};return {id:v.id,A:p[sides[0]],B:p[sides[1]]}});
fs.writeFileSync(output,rows.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log(rows.length+' blinded pairs');
