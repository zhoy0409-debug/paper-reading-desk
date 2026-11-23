(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  const lang=['en','zh'].includes(params.get('lang'))?params.get('lang'):(/^zh/i.test(navigator.language)?'zh':'en'), en=lang==='en';
  const local=(zh,english)=>en?english:zh;
  const el=id=>document.getElementById(id);
  const embedded=params.get('embed')==='1';
  document.documentElement.classList.toggle('embed',embedded);
  document.documentElement.lang=en?'en':'zh-CN';
  document.title=local('操作演示 · 文献精读','Product tour · Reading Desk');
  el('title').textContent=local('做文献汇报，还在逐张截图？','Still cropping paper figures for your slides?');
  const reader=el('open-reader');reader.textContent=local('打开阅读器','Open the reader');
  reader.href=(location.pathname.includes('/media/tour/')?'../../':'./read/')+'?lang='+lang;
  el('brand').textContent=local('文献精读','Reading Desk');
  el('credit').textContent=local('示例图源','Figure reproduced from');
  el('repo').textContent=local('打开项目','Open the project');
  el('chapter-heading').textContent=local('选一个你遇到过的问题','Jump to a question');
  document.querySelector('nav').setAttribute('aria-label',local('语言','Language'));
  el(lang).setAttribute('aria-current','page');
  if(embedded)document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && !document.fullscreenElement)window.frameElement?.closest('dialog')?.close();
  });
  const film=el('film');
  film.poster='cover-'+lang+'.webp';
  const movie='tour-'+lang+'.mp4';
  // The bundled Python file server sends whole files. A local Blob lets a browser seek
  // to any chapter even when the server does not implement HTTP Range requests.
  const localHost=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  const sourceReady=localHost ? fetch(movie).then(r=>{
    if(!r.ok)throw Error();return r.blob();
  }).then(blob=>{film.src=URL.createObjectURL(blob);}).catch(()=>{film.src=movie;})
    : Promise.resolve(film.src=movie);
  const track=document.createElement('track');
  track.kind='captions';track.srclang=en?'en':'zh';track.label=en?'English':'中文';
  track.src='tour-'+lang+'.vtt';film.append(track);
  let chapters=[],aliases={},pending=null;
  function currentKey(){return location.hash.slice(1);}
  function updateLinks(){for(const code of ['zh','en'])el(code).href='?lang='+code+location.hash;}
  async function seek(key,play){
    await sourceReady;
    const start=chapters.find(c=>c.key===key)?.start??(Object.hasOwn(aliases,key)?aliases[key]:undefined);if(!Number.isFinite(start))return;
    if(film.readyState<1){pending={key,play};film.preload='metadata';film.load();}
    else film.currentTime=start;
    if(play)film.play().catch(()=>{});
  }
  film.addEventListener('loadedmetadata',()=>{if(pending){const next=pending;pending=null;seek(next.key,next.play);}});
  function mark(){
    const active=chapters.filter(item=>item.start<=film.currentTime+.02).pop();
    for(const a of el('chapters').querySelectorAll('a')){if(active&&a.hash==='#'+active.key)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');}
  }
  film.addEventListener('timeupdate',mark);
  addEventListener('hashchange',()=>{updateLinks();seek(currentKey(),false);});
  updateLinks();
  fetch('chapters-'+lang+'.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
    chapters=data.chapters;aliases=data.aliases||{};
    for(const c of chapters){
      const li=document.createElement('li'),a=document.createElement('a'),time=document.createElement('time'),body=document.createElement('span'),
        name=document.createElement('strong'),detail=document.createElement('small');
      const start=Math.floor(c.start);time.textContent=Math.floor(start/60)+':'+String(start%60).padStart(2,'0');
      name.textContent=c.title;detail.textContent=c.answer;a.href='#'+c.key;
      body.append(name,detail);a.append(time,body);li.append(a);el('chapters').append(li);
      a.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();history.replaceState(null,'','#'+c.key);updateLinks();seek(c.key,true);film.scrollIntoView({block:'nearest'});});
    }
    if(currentKey())seek(currentKey(),false);else if(embedded){film.muted=true;sourceReady.then(()=>film.play()).catch(()=>{});}
    mark();
  }).catch(()=>{document.querySelector('.chapters').hidden=true;});
})();
