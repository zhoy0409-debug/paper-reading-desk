// Each chunk hash is computed from the same file verified against the publisher's
// full SHA-256. This keeps verification and resumption within a small memory budget.
export const weightCacheName = 'reading-desk-hymt3-bae6e591-v1';
const idbName=weightCacheName+'-chunks';
const requestResult=request=>new Promise((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
export async function openWeightStore(){
  if(navigator.storage?.getDirectory||!globalThis.indexedDB)return caches.open(weightCacheName);
  const request=indexedDB.open(idbName,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('chunks');
  const db=await requestResult(request);
  db.onversionchange=()=>db.close();
  function use(mode,operation){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('chunks',mode),req=operation(tx.objectStore('chunks'));
      tx.oncomplete=()=>resolve(req.result);
      tx.onabort=()=>reject(tx.error||req.error||new Error('Model storage transaction aborted'));
      tx.onerror=()=>reject(tx.error||req.error);
    });
  }
  return {
    async match(url){const data=await use('readonly',s=>s.get(url));return data?new Response(data):undefined},
    async put(url,response){const data=await response.arrayBuffer();await use('readwrite',s=>s.put(data,url))},
    delete:url=>use('readwrite',s=>s.delete(url)),
    async keys(){return (await use('readonly',s=>s.getAllKeys())).map(key=>new Request(key))},
    close:()=>db.close()
  };
}
export async function clearWeightStore(){
  if(globalThis.caches)await caches.delete(weightCacheName);
  if(globalThis.indexedDB)await requestResult(indexedDB.deleteDatabase(idbName));
}
export const digestHex = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),
  b=>b.toString(16).padStart(2,'0')).join('');
export function stageError(stage,message,cause) {
  return Object.assign(new Error(message,{cause}),{stage});
}

// wllama constructs its own file manager even for an already verified Blob.
// WebKit builds can expose Cache Storage without the optional file-system API.
export function runtimeStorage(cache,base=location.href){
  const prefix=new URL('./.translation-runtime/',base).href;
  const url=key=>prefix+encodeURIComponent(key);
  const read=async key=>(await cache.match(url(key)))?.blob()??null;
  const getSize=async key=>(await read(key))?.size??-1;
  return {
    isSupported:()=>true,canWriteAt:()=>false,read,getSize,
    write(key,stream,_hint,offset=0){
      if(offset)throw new RangeError('Cache Storage only supports complete writes');
      return cache.put(url(key),new Response(stream));
    },
    async list(){
      const keys=(await cache.keys()).filter(r=>r.url.startsWith(prefix)).map(r=>decodeURIComponent(r.url.slice(prefix.length)));
      return Promise.all(keys.map(async key=>({key,size:await getSize(key)})));
    },
    async delete(key){await cache.delete(url(key))}
  };
}

export async function verifiedWeights(manifest,{cache,signal,onProgress=()=>{},onMissing=()=>{},fetchFile=fetch,base=location.href}) {
  const {bytes,chunkBytes,parts,urls}=manifest;
  if (!Number.isSafeInteger(bytes)||bytes<=0||!Number.isSafeInteger(chunkBytes)||chunkBytes<=0||
      parts.length!==Math.ceil(bytes/chunkBytes)||!parts.every(h=>/^[0-9a-f]{64}$/.test(h))||!urls.length)
    throw stageError('model','Invalid translation weight manifest');
  const blobs=new Array(parts.length),key=i=>new URL('./.translation-weights/'+manifest.sha256+'/'+i,base).href;
  const length=i=>Math.min(chunkBytes,bytes-i*chunkBytes);
  let verified=0;
  for(let i=0;i<parts.length;i++){
    signal.throwIfAborted();
    const entry=await cache.match(key(i));
    if(!entry)continue;
    const blob=await entry.blob();
    if(blob.size===length(i)&&await digestHex(await blob.arrayBuffer())===parts[i]){
      blobs[i]=blob;verified+=blob.size;
    }else await cache.delete(key(i));
    onProgress({phase:'checking',bytes:verified,total:bytes});
  }
  if(verified<bytes)onMissing(verified,bytes);

  async function fetchRange(url,first,last) {
    const start=first*chunkBytes, end=Math.min(bytes,(last+1)*chunkBytes)-1;
    const controller=new AbortController();
    const cancel=()=>controller.abort(signal.reason);
    signal.throwIfAborted();signal.addEventListener('abort',cancel,{once:true});
    let timer,reader;
    const tick=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(stageError('download','Model download stalled')),60000)};
    try{
      tick();
      const headers=(start||end+1<bytes)?{Range:'bytes='+start+'-'+end}:{};
      const response=await fetchFile(url,{headers,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok||!response.body)throw stageError('download','Model download returned HTTP '+response.status);
      const range=response.headers.get('content-range');
      if(response.status===206&&range&&range!=='bytes '+start+'-'+end+'/'+bytes)
        throw stageError('download','Unexpected model byte range: '+range);
      reader=response.body.getReader();
      let i=response.status===206?first:0, offset=0, part=new Uint8Array(length(i));
      while(i<=last){
        tick();
        const {value,done}=await reader.read();
        if(done)throw stageError('download','Model transfer ended before the requested bytes');
        for(let pos=0;pos<value.length&&i<=last;){
          const take=Math.min(part.length-offset,value.length-pos);
          part.set(value.subarray(pos,pos+take),offset);pos+=take;offset+=take;
          if(!blobs[i])onProgress({phase:'download',bytes:verified+offset,total:bytes});
          if(offset!==part.length)continue;
          if(!blobs[i]){
            if(await digestHex(part)!==parts[i])throw stageError('integrity','Incorrect SHA-256 for weight chunk '+i);
            try{
              await cache.put(key(i),new Response(part));
              const stored=await cache.match(key(i));
              if(!stored)throw new Error('The browser did not retain this model chunk');
              blobs[i]=await stored.blob();
            }catch(cause){throw stageError('storage','Cannot save verified translation weights',cause)}
            verified+=part.length;
          }
          i++;offset=0;if(i<=last)part=new Uint8Array(length(i));
        }
      }
    }catch(error){
      if(signal.aborted)throw signal.reason;
      if(controller.signal.aborted)throw controller.signal.reason;
      throw error.stage?error:stageError('download','Could not read translation weights',error);
    }finally{
      clearTimeout(timer);signal.removeEventListener('abort',cancel);
      if(reader)await reader.cancel().catch(()=>{});
    }
  }
  let index=0;
  while(index<parts.length){
    signal.throwIfAborted();
    if(blobs[index]){index++;continue}
    let last=index;
    while(last+1<parts.length&&!blobs[last+1])last++;
    const errors=[];
    for(const url of urls){
      try{await fetchRange(url,index,last);break}
      catch(error){
        if(signal.aborted||error.stage==='storage')throw error;
        errors.push(error);
        while(index<=last&&blobs[index])index++;
        if(index>last)break;
      }
    }
    if(!blobs[last]){
      const kind=errors.some(e=>e.stage==='integrity')?'integrity':'download';
      throw stageError(kind,'Could not verify model bytes from either source',new AggregateError(errors));
    }
    index=last+1;
  }
  signal.throwIfAborted();onProgress({phase:'ready',bytes:verified,total:bytes});
  return new Blob(blobs,{type:'application/octet-stream'});
}
