/* Slide editor: order on the left, the slide in the middle, speaker notes underneath. */
(() => {
  'use strict';
  const S=()=>window.ReadingDeckStore;
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
  const ui=(tag,cls,zh,en)=>PaperUI.set(el(tag,cls),zh,en);
  const t=(zh,en)=>window.ReaderLanguage?.current==='en'?en:zh;
  function button(cls,zh,en,fn){const b=ui('button',cls,zh,en);b.type='button';b.addEventListener('click',fn);return b}

  function mount({workbench,model,paper,state,save,render,desk,changed}){
    const figures=model.figures.filter(f=>!f.raw?.pageOnly),byId=new Map(figures.map(f=>[f.id,f]));
    const titleOf=f=>f.raw?.evidenceStep?t(f.title,f.raw.evidenceStep[0]):PaperOutline.title(f.raw?.caption,f.label)||f.title||f.label;
    const urls=new Map(),cropVersions=new Map();let host=null,open='',timer=0,busy=false;
    const deck=()=>state.deck;
    function ensure(){
      if(!Array.isArray(state.deck)){
        state.deck=S().skeleton({title:paper.title||'',question:PaperOutline.claim(t(model.question,model.questionEnglish)||model.rootLabel||''),figures,titleOf,zh:t(1,0)===1});keep();if(t(1,0)===1)translateTitles();
      }
      state.deck=state.deck.filter(s=>s&&s.id&&(!s.figure||byId.has(s.figure)));
      if(S().merge(state.deck,state.queue||[]))keep();
    }
    // Generated titles follow the reading language. A title the reader has typed is left alone.
    function translateTitles(){
      for(const s of state.deck){
        for(const part of ['title','body']){
          const source=s[part];if(!source||/[㐀-鿿]/.test(source)||s.kind==='cover')continue;
          PaperLanguageText.chinese(source).then(zh=>{if(zh&&s[part]===source){s[part]=zh.replace(/[。.]$/,part==='title'?'':'$&');keep();if(host)refreshAll()}},()=>{});
        }
      }
    }
    let redraw=0;
    function refreshAll(){clearTimeout(redraw);redraw=setTimeout(()=>{if(host&&!host.contains(document.activeElement?.closest?.('textarea')))draw()},300)}
    function keep(){clearTimeout(timer);timer=setTimeout(()=>{timer=0;save();changed(deck().length)},200)}
    function flush(){if(timer){clearTimeout(timer);timer=0;save()}}
    window.addEventListener('pagehide',flush);
    const sayOf=s=>s.kind==='figure'?state.lens?.[s.figure]?.say||'':s.kind==='panel'?desk.describe(s.key).sentence||'':s.say||'';
    function setSay(s,value){
      if(s.kind==='figure'){((state.lens||={})[s.figure]||={}).say=value;desk.syncLine(s.figure)}
      else if(s.kind==='panel')desk.setSentence(s.key,value);
      else s.say=value;
      keep();
    }
    const nameOf=s=>s.kind==='panel'?desk.describe(s.key).name:s.kind==='figure'?byId.get(s.figure)?.label||'':'';
    const heading=s=>s.title||nameOf(s)||(s.kind==='picture'?t('我的图片','My picture'):t('未命名','Untitled'));
    // One picture per slide, cached as an object URL.
    async function image(s){
      if(s.kind==='figure'){const f=byId.get(s.figure),pic=await render(f.raw);return {...pic,source:f.label+(f.page?' · PDF p.'+f.page:'')}}
      if(s.kind==='panel'){
        const item=desk.describe(s.key);
        if(!item.box)throw Error(t('这个小图缺少边界：','No bounds for this panel: ')+item.name);
        if(item.recipe&&!item.recipe.known)throw Error(item.name+t('：请先标出旧编号',': locate the printed label first'));
        const pic=await desk.renderPanel(s.key);return {...pic,source:item.name+' · PDF p.'+item.figure.page};
      }
      if(s.kind==='picture'){
        const blob=await S().picture(s.picture);if(!blob)throw Error(t('这张图片已不在本机','This picture is no longer on this device'));
        const b=await createImageBitmap(blob),out={blob,width:b.width,height:b.height,source:''};b.close();return out;
      }
      return null;
    }
    const key=s=>s.kind+(s.picture||s.key||s.figure||'');
    function url(s){
      if(s.kind==='panel'){
        const item=desk.describe(s.key),stamp=JSON.stringify([item.box,item.recipe]),old=cropVersions.get(s.key);
        if(old!==stamp){
          urls.get(key(s))?.then(URL.revokeObjectURL,()=>{});
          urls.delete(key(s));cropVersions.set(s.key,stamp);
        }
      }
      if(s.kind==='text'||s.kind==='cover')return Promise.resolve('');
      if(!urls.has(key(s))){const job=image(s).then(p=>URL.createObjectURL(p.blob));urls.set(key(s),job);job.catch(()=>urls.delete(key(s)))}
      return urls.get(key(s));
    }
    function paint(s){
      const box=el('div','dk-slide dk-'+s.kind+(s.layout==='split'&&s.body?' dk-split':'')),head=el('h3','',s.title),main=el('div','dk-main');
      if(s.kind!=='text'&&s.kind!=='cover'){const img=el('img');img.alt=heading(s);main.append(img);url(s).then(u=>{img.src=u},e=>{img.replaceWith(el('small','dk-miss',e.message))})}
      const lines=(s.body||'').split(/\n+/).filter(x=>x.trim());
      if(lines.length){const ul=el(lines.length>1?'ul':'p','dk-text');for(const l of lines)ul.append(lines.length>1?el('li','',l.replace(/^[-•·]\s*/,'')):document.createTextNode(l));main.append(ul)}
      box.append(head,main);return box;
    }
    const active=()=>deck().find(s=>s.id===open)||deck()[0];

    /* ----- adding ----- */
    function insert(s){const at=deck().findIndex(x=>x.id===open);deck().splice(at<0?deck().length:at+1,0,s);open=s.id;keep();draw()}
    async function addFiles(files){
      let bad=0;
      for(const f of files){try{insert(S().slide('picture',{picture:await S().addPicture(f),title:''}))}catch{bad++}}
      if(bad)say(t(bad+' 个文件不是可用的图片',bad+' files could not be read as pictures'));
    }
    const picker=el('input');picker.type='file';picker.accept='image/*';picker.multiple=true;picker.hidden=true;
    picker.addEventListener('change',()=>{addFiles([...picker.files]);picker.value=''});
    let message=null;
    const say=text=>{if(message)message.textContent=text};
    function chooseFigure(anchor){
      const pop=el('div','dk-pop');pop.append(ui('small','','加入论文里的图','Add a figure from the paper'));
      const grid=el('div','dk-popgrid');
      for(const f of figures){
        const b=el('button');b.type='button';const img=el('img');img.alt='';b.append(img,el('span','',f.label));
        url({kind:'figure',figure:f.id}).then(u=>{img.src=u},()=>{});
        b.addEventListener('click',()=>{pop.remove();insert(S().slide('figure',{figure:f.id,title:titleOf(f)}))});grid.append(b);
      }
      pop.append(grid);anchor.parentElement.append(pop);
      const off=e=>{if(!pop.contains(e.target)&&e.target!==anchor){pop.remove();document.removeEventListener('pointerdown',off,true)}};
      document.addEventListener('pointerdown',off,true);
    }
    function remove(s){
      const at=deck().indexOf(s);deck().splice(at,1);
      if(s.kind==='panel')desk.removeSlide(s.key);
      if(s.kind==='picture'&&!deck().some(x=>x.picture===s.picture))S().dropPicture(s.picture);
      open=(deck()[at]||deck()[at-1])?.id||'';keep();draw();
    }

    /* ----- editor ----- */
    function list(){
      const ol=el('ol','dk-list');
      deck().forEach((s,i)=>{
        const li=el('li'),b=el('button','dk-item');b.type='button';li.draggable=true;li.dataset.id=s.id;
        const mini=paint(s);mini.classList.add('dk-mini');mini.setAttribute('aria-hidden','true');
        b.append(el('i','',String(i+1)),mini);b.setAttribute('aria-current',String(s===active()));b.setAttribute('aria-label',(i+1)+'. '+heading(s)+(sayOf(s).trim()?t('，有备注',', has notes'):''));
        if(sayOf(s).trim())b.classList.add('dk-noted');
        b.addEventListener('click',()=>{open=s.id;draw()});
        b.addEventListener('keydown',e=>{
          const n={ArrowUp:-1,ArrowDown:1}[e.key];if(!n)return;e.preventDefault();
          if(e.altKey){if(moveSlide(s.id,i+n)){keep();draw();focusItem(s.id)}}
          else{const other=deck()[i+n];if(other){open=other.id;draw();focusItem(other.id)}}
        });
        li.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/x-slide',s.id);e.dataTransfer.effectAllowed='move';li.classList.add('dk-drag')});
        li.addEventListener('dragend',()=>li.classList.remove('dk-drag'));
        li.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('text/x-slide')){e.preventDefault();li.classList.add('dk-over')}});
        li.addEventListener('dragleave',()=>li.classList.remove('dk-over'));
        li.addEventListener('drop',e=>{
          const id=e.dataTransfer.getData('text/x-slide');if(!id)return;
          e.preventDefault();e.stopPropagation();if(moveSlide(id,i)){keep();draw()}
        });
        li.append(b);ol.append(li);
      });
      return ol;
    }
    const focusItem=id=>host?.querySelector('li[data-id="'+id+'"] button')?.focus({preventScroll:true});
    function editor(s){
      const box=el('section','dk-edit'),frame=el('div','dk-frame'),slide=paint(s);
      const title=el('textarea','dk-title');title.rows=1;title.maxLength=160;title.value=s.title;title.placeholder=t('标题','Title');title.setAttribute('aria-label',title.placeholder);
      slide.querySelector('h3').replaceWith(title);
      title.addEventListener('input',()=>{s.title=title.value.replace(/\n/g,' ');keep();refresh(s)});
      frame.append(slide);
      const tools=el('div','dk-tools');
      if(s.kind!=='text'&&s.kind!=='cover')for(const [k,zh,en] of [['full','图占满','Full image'],['split','左图右文','Image and text']]){
        const b=button('',zh,en,()=>{s.layout=k;keep();draw()});b.setAttribute('aria-pressed',String((s.layout||'full')===k));tools.append(b);
      }
      tools.append(button('dk-del','删除这页','Delete slide',()=>remove(s)));
      const field=(zh,en,value,hintZh,hintEn,fn,rows)=>{
        const l=el('label','dk-field'),a=el('textarea');l.append(ui('span','',zh,en),a);a.rows=rows;a.value=value;a.placeholder=t(hintZh,hintEn);a.maxLength=2000;a.addEventListener('input',()=>fn(a.value));return l;
      };
      const texts=el('div','dk-fields');
      texts.append(field('页面文字','Text on the slide',s.body||'','每行一条要点','One point per line',v=>{s.body=v;keep();refresh(s)},4),
        field('演讲备注','Speaker notes',sayOf(s),'想讲的话写在这里，导出后在 PPT 备注里','What you will say. Exported as PowerPoint notes',v=>{setSay(s,v);refresh(s)},4));
      box.append(frame,tools,texts);return box;
    }
    function refresh(s){
      const li=host?.querySelector('li[data-id="'+s.id+'"]');if(!li)return;
      const mini=paint(s);mini.classList.add('dk-mini');li.querySelector('.dk-mini').replaceWith(mini);
      li.querySelector('button').classList.toggle('dk-noted',!!sayOf(s).trim());
      const main=host.querySelector('.dk-frame .dk-main'),now=paint(s);
      if(main)main.replaceWith(now.querySelector('.dk-main'));
      host.querySelector('.dk-frame .dk-slide').className=now.className;total();
    }
    function moveSlide(id,index){
      if(!S().move(deck(),id,index))return false;
      state.queue=deck().filter(s=>s.kind==='panel').map(s=>s.key);
      desk.syncQueue();return true;
    }
    function total(){
      const n=deck().length,done=deck().filter(s=>sayOf(s).trim()).length;
      const sec=deck().reduce((a,s)=>a+ReadingLens.seconds(sayOf(s)),0),node=host?.querySelector('.dk-sum');
      if(node)PaperUI.set(node,n+' 页，'+done+' 页有备注，约讲 '+ReadingDeckTalk.clock(sec),n+' slides, '+done+' with notes, about '+ReadingDeckTalk.clock(sec));
    }
    const plain=()=>deck().map(s=>({...s,say:sayOf(s),title:s.title||nameOf(s)}));
    async function exportDeck(b){
      if(busy)return;busy=true;b.disabled=true;say(t('正在生成…','Building…'));
      try{await ReadingDeckExport.build({slides:plain(),paper:{title:paper.title,publicUrl:state.publicUrl??paper.publicUrl},image});say(t('已导出','Exported'))}
      catch(e){say(e.message||t('导出没有完成','Export did not finish'))}
      finally{busy=false;b.disabled=false}
    }
    function talk(){ensure();const all=plain();ReadingDeckTalk.start({host:workbench,slides:all,paint,from:Math.max(0,deck().findIndex(s=>s.id===open))})}
    function draw(){
      if(!host)return;
      const scroll=host.querySelector('.dk-list')?.scrollTop||0,s=active();open=s?.id||'';
      const left=el('aside','dk-side'),add=el('div','dk-add');
      const fig=button('','论文图','Figure',()=>chooseFigure(fig));
      add.append(fig,button('','我的图片','My picture',()=>picker.click()),button('','文字页','Text',()=>insert(S().slide('text',{title:''}))),picker);
      left.append(add,list());
      const top=el('header','dk-top');message=el('span','dk-message');message.setAttribute('role','status');
      const out=button('primary','导出整套 PPTX','Export slide deck',()=>exportDeck(out));
      const rehearse=button('light','试讲','Rehearse',talk);
      out.disabled=rehearse.disabled=!s;
      top.append(el('span','dk-sum'),message,rehearse,out);
      host.replaceChildren(left,top,...(s?[editor(s)]:[]));
      host.querySelector('.dk-list').scrollTop=scroll;total();
    }
    function onPaste(e){
      if(!host||host.hidden)return;
      const files=[...(e.clipboardData?.files||[])].filter(f=>/^image\//.test(f.type));
      if(files.length){e.preventDefault();addFiles(files)}
    }
    document.addEventListener('paste',onPaste);
    return {
      show(node){
        host=node;host.classList.add('dk');ensure();
        if(!host.dataset.drop){
          host.dataset.drop='1';
          host.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();host.classList.add('dk-dropping')}});
          host.addEventListener('dragleave',e=>{if(!host.contains(e.relatedTarget))host.classList.remove('dk-dropping')});
          host.addEventListener('drop',e=>{
            host.classList.remove('dk-dropping');
            const files=[...e.dataTransfer.files].filter(f=>/^image\//.test(f.type));
            if(files.length){e.preventDefault();e.stopPropagation();addFiles(files)}
          });
        }
        draw();
      },
      hide(){flush();host?.replaceChildren();host=null},
      talk,count(){return Array.isArray(state.deck)&&state.deck.length?state.deck.length:(state.queue||[]).length},
      destroy(){flush();window.removeEventListener('pagehide',flush);document.removeEventListener('paste',onPaste);for(const u of urls.values())u.then(URL.revokeObjectURL,()=>{})}
    };
  }
  window.ReadingDeck=Object.freeze({mount});
})();
