/* Slides and the reader's own pictures. Slides live with the paper's state; pictures in this browser's database. */
(() => {
  'use strict';
  const MAX=24*1024*1024,EDGE=2200;
  let opening=null;
  function db(){
    return opening||=new Promise((ok,no)=>{
      const r=indexedDB.open('reading-desk-deck',1);
      r.onupgradeneeded=()=>r.result.createObjectStore('pictures');
      r.onsuccess=()=>ok(r.result);r.onerror=()=>{opening=null;no(r.error)};
    });
  }
  async function run(mode,work){
    const tx=(await db()).transaction('pictures',mode);
    return new Promise((ok,no)=>{const r=work(tx.objectStore('pictures'));tx.oncomplete=()=>ok(r.result);tx.onerror=tx.onabort=()=>no(tx.error)});
  }
  // Re-encoded so the slide file opens everywhere and stays small.
  async function addPicture(file){
    if(!/^image\//.test(file?.type||'')||file.size>MAX)throw Error('picture');
    const bitmap=await createImageBitmap(file);
    try{
      const s=Math.min(1,EDGE/Math.max(bitmap.width,bitmap.height)),c=document.createElement('canvas');
      c.width=Math.max(1,Math.round(bitmap.width*s));c.height=Math.max(1,Math.round(bitmap.height*s));
      c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);
      const type=file.type==='image/jpeg'?'image/jpeg':'image/png';
      const blob=await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(Error('picture')),type,.9));
      const id='pic-'+crypto.randomUUID();
      await run('readwrite',s=>s.put(blob,id));
      return id;
    }finally{bitmap.close()}
  }
  const picture=id=>run('readonly',s=>s.get(id));
  const dropPicture=id=>run('readwrite',s=>s.delete(id)).catch(()=>{});
  const slide=(kind,more)=>({id:'s-'+Math.random().toString(36).slice(2,10),kind,title:'',body:'',say:'',layout:'full',...more});

  // A talk in the paper's own order: cover, question, one slide per figure, close.
  function skeleton({title,question,figures,titleOf,zh}){
    return [
      slide('cover',{title,body:zh?'组会文献汇报':'Journal club'}),
      slide('text',{title:zh?'这篇论文要回答什么':'What does this paper ask?',body:question}),
      ...figures.map(f=>slide('figure',{figure:f.id,title:titleOf(f)})),
      slide('text',{title:zh?'结论与讨论':'Conclusions and discussion',body:''})
    ];
  }
  // Panels added from the close-up join the deck after their figure. Removed panels leave it.
  function merge(deck,queue){
    const keys=new Set(queue);let changed=false;
    for(let i=deck.length-1;i>=0;i--)if(deck[i].kind==='panel'&&!keys.has(deck[i].key)){deck.splice(i,1);changed=true}
    for(const key of queue){
      if(deck.some(s=>s.key===key))continue;
      let figure='';try{figure=JSON.parse(key)[0]}catch{continue}
      const at=deck.findLastIndex(s=>s.figure===figure);
      deck.splice(at<0?Math.max(0,deck.length-1):at+1,0,slide('panel',{key,figure}));changed=true;
    }
    const panels=new Map(deck.filter(s=>s.kind==='panel').map(s=>[s.key,s]));
    const ordered=queue.map(key=>panels.get(key)).filter(Boolean);
    let cursor=0;
    for(let i=0;i<deck.length;i++){
      if(deck[i].kind!=='panel')continue;
      const next=ordered[cursor++];
      if(next && next!==deck[i]){deck[i]=next;changed=true}
    }
    return changed;
  }
  function move(deck,id,to){
    const from=deck.findIndex(s=>s.id===id);
    if(from<0||to<0||to>=deck.length||from===to)return false;
    deck.splice(to,0,...deck.splice(from,1));return true;
  }
  const api={addPicture,picture,dropPicture,slide,skeleton,merge,move};
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.ReadingDeckStore=Object.freeze(api);
})();
