import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifiedWeights} from '../dist/translation-weight-cache.js';
import {indexPaperContext} from '../dist/translation-context.js';
import {paperDefinedTerms} from '../dist/discipline-glossary.js';

// Independently compute pins with Node crypto. Interrupt a real ReadableStream
// after one complete chunk and check the exact byte range of the next request.
const file=Uint8Array.from({length:41},(_,i)=>i),chunkBytes=16;
const parts=[0,16,32].map(a=>createHash('sha256').update(file.slice(a,a+16)).digest('hex'));
const manifest={parts,bytes:file.length,chunkBytes,sha256:createHash('sha256').update(file).digest('hex'),urls:['https://model.test/weight']};
const base='https://desk.test/read/',entries=new Map();
const cache={match:async k=>entries.get(k)?.clone(),put:async(k,r)=>entries.set(k,r.clone()),delete:async k=>entries.delete(k)};
const transfers=[];let interrupted=true,corrupt=false,ignoreRange=false;
function fetchFile(url,options){
  assert.equal(options.credentials,'omit');
  assert.equal(options.referrerPolicy,'no-referrer');
  const range=options.headers.Range;
  transfers.push(range||'full');
  if(interrupted){
    let n=0;return new Response(new ReadableStream({pull(c){if(n++)c.error(new Error('Offline'));else c.enqueue(file.slice(0,19))}}));
  }
  const [,start,end]=(!ignoreRange&&range?.match(/bytes=(\d+)-(\d+)/))||[null,0,40];
  const data=file.slice(+start,+end+1);
  if(corrupt)data[0]^=0xff;
  return new Response(data,{status:range&&!ignoreRange?206:200,headers:range&&!ignoreRange?{'Content-Range':'bytes '+start+'-'+end+'/41'}:{}});
}
const read=()=>verifiedWeights(manifest,{cache,fetchFile,base,signal:new AbortController().signal});
await assert.rejects(read(),e=>e.stage==='download'&&e.cause.errors[0].cause.message==='Offline');
assert.equal(entries.size,1);
interrupted=false;
assert.deepEqual(new Uint8Array(await (await read()).arrayBuffer()),file);
assert.deepEqual(transfers,['full','bytes=16-40']);
await read();assert.equal(transfers.length,2);
const mid=[...entries.keys()][1];
entries.set(mid,new Response(new Uint8Array(16)));
corrupt=true;await assert.rejects(read(),e=>e.stage==='integrity');
assert.equal(entries.has(mid),false);
corrupt=false;ignoreRange=true;
assert.deepEqual(new Uint8Array(await (await read()).arrayBuffer()),file);
assert.deepEqual(transfers.slice(-2),['bytes=16-31','bytes=16-31']);
const rows=[{text:'We used the edge strength metric in these maps.',page:1},{text:'A neighbouring image showed higher contrast.',page:2}];
const lookup=t=>t==='HR'?[{full:'hazard ratio'}]:[];
const ctx=indexPaperContext(rows,'A comparison of measurements',lookup)('HRs appear in the model.');
assert.match(ctx,/HRs = hazard ratio/);assert.equal(paperDefinedTerms('Two HRs were reported.','general',ctx)[0].value,'风险比');
assert.deepEqual(paperDefinedTerms('Two hours of work.','general',ctx),[]);
assert.doesNotMatch(indexPaperContext([], '',()=>[{full:'heart rate'},{full:'hazard ratio'}])('HR was recorded.'),/ = /);
console.log('PASS verified byte-range recovery, corruption detection, server ignoring Range, cache-only reuse and paper-specific definitions');
