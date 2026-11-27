// Only immutable translation runtime resources are eligible. Model files have a
// separate, digest-addressed cache; page requests and reader data are never intercepted.
const allowed=new Map([
  ['worker/translator-worker.js','8ae4cf62761fb7f816dd18f13175d04babd64af02b536f5a3834b7929716f2ea'],
  ['worker/bergamot-translator-worker.js','748b2418418a2ffc6e70721aeb10098d8e6fb589ea156b91f4ae8bc3490d8f7a'],
  ['worker/bergamot-translator-worker.wasm','95a2b58dd6773bf1b3f345d71f9149928b9f75f4ec9c9064c0b3e42c298671b2']
].map(([file,hash])=>[new URL('vendor/bergamot/'+file,self.registration.scope).href,hash]));
const bucket='reading-desk-translation-runtime-v1';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function valid(response,hash){
  if(!response?.ok)return false;
  const bytes=await response.clone().arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')===hash;
}
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);url.search='';
  const hash=allowed.get(url.href);
  if(!hash||event.request.method!=='GET')return;
  event.respondWith((async()=>{
    let db;try{db=await caches.open(bucket)}catch{return fetch(event.request)}
    const key=new URL(url);key.searchParams.set('sha256',hash);
    const saved=await db.match(key);
    if(await valid(saved,hash))return saved;
    if(saved)await db.delete(key);
    const response=await fetch(event.request);
    if(await valid(response,hash))await db.put(key,response.clone()).catch(()=>{});
    return response;
  })());
});
