import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {TranslatorBacking} from '../dist/vendor/bergamot/translator.js';

const checksum=text=>createHash('sha256').update(text).digest('hex');
const originalFetch=globalThis.fetch;
const calls=[];
const data=['study',' ','group',' ','label'];
let recover=false;
globalThis.fetch=async(url,{signal})=>{
  calls.push(url);
  return new Response(new ReadableStream({
    start(stream){
      if(url==='stall'){
        signal.addEventListener('abort',()=>stream.error(new Error('Timed out')),{once:true});
        return;
      }
      const parts=url==='slow'?data:[recover?'second file':'corrupt'];
      let i=0;
      const timer=setInterval(()=>{
        stream.enqueue(new TextEncoder().encode(parts[i++]));
        if(i===parts.length){clearInterval(timer);stream.close()}
      },url==='slow'?75:1);
      signal.addEventListener('abort',()=>{clearInterval(timer);stream.error(new Error('Timed out'))},{once:true});
    }
  }));
};
try{
  const backing=Object.assign(Object.create(TranslatorBacking.prototype),{fileBuffers:new Map(),failedFiles:new Set(),downloadTimeout:240});
  const slow={name:'slow',expectedSha256Hash:checksum(data.join(''))};
  const second={name:'second',expectedSha256Hash:checksum('second file')};
  const progress=[];
  backing.onprogress=(url,bytes,finished)=>{if(url==='slow')progress.push([bytes,finished])};
  const start=Date.now();
  const result=await backing.fetchModelFile(slow);
  assert.equal(new TextDecoder().decode(result),'study group label');
  assert(Date.now()-start>backing.downloadTimeout);
  assert(progress.length>data.length);assert.deepEqual(progress.at(-1),[17,true]);
  await assert.rejects(backing.fetchModelFile(second),/checksum mismatch/);
  recover=true;
  assert.equal(await backing.fetchModelFile(slow),result);
  assert.equal(new TextDecoder().decode(await backing.fetchModelFile(second)),'second file');
  assert.deepEqual(calls,['slow','second','second']);
  await assert.rejects(backing.fetch('stall',slow.expectedSha256Hash),/Timed out/);
  console.log('PASS an active slow download completes, a stalled one stops, and retry reuses verified files and rejects corrupt data.');
}finally{globalThis.fetch=originalFetch}

// Both published naming conventions must resolve against the registry, independent
// of the current page. A joint vocabulary is passed to WASM only once.
const base='https://reader.example/subpath/vendor/bergamot/';
const ref=name=>({name,expectedSha256Hash:checksum(name.split('/').at(-1))});
for(const slot of ['lex','shortlist']){
  const files={model:ref('./model.bin'),[slot]:ref('./vendor/bergamot/lex.bin'),vocab:ref('./shared.spm')};
  const seen=[];
  globalThis.fetch=async url=>{
    seen.push(url);
    return new Response(url.endsWith('models.json')?JSON.stringify({zhen:files}):url.split('/').at(-1));
  };
  try{
    const backing=new TranslatorBacking({registryUrl:base+'models.json'});
    const model=await backing.getTranslationModel({from:'zh',to:'en'});
    assert.deepEqual(seen.sort(),['lex.bin','model.bin','models.json','shared.spm'].map(file=>base+file));
    assert.equal(new TextDecoder().decode(model.shortlist),'lex.bin');
    assert.equal(model.vocabs.length,1);
  }finally{globalThis.fetch=originalFetch}
}
console.log('PASS legacy lex, current shortlist, registry-relative URLs and joint vocabulary.');
