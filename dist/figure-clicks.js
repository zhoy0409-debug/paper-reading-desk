(() => {
  'use strict';
  function feedback(){
    const node=document.createElement('div');node.className='figure-point-status';node.hidden=true;
    node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');
    let busy=false,pending=null;
    function say(state,zh,en){node.hidden=false;node.dataset.state=state;PaperUI.set(node,zh,en)}
    return {node,
      clear(){busy=false;pending=null;node.hidden=true},
      begin(){busy=true;pending=null;say('loading','正在识别标注，可先点图中名称','Finding labels. You can already tap a name.')},
      capture(event,layer){
        if(!busy||!layer)return false;
        const r=layer.parentElement.getBoundingClientRect(),area=layer.getBoundingClientRect();
        const box=area.width&&area.height?area:r;
        const x=(event.clientX-box.left)/box.width,y=(event.clientY-box.top)/box.height;
        if(!(x>=0&&x<=1&&y>=0&&y<=1))return false;
        pending={layer,x,y};
        say('loading','正在识别你点的位置…','Reading the spot you selected…');return true;
      },
      cancelTap(){pending=null},
      update(count,complete){
        if(!busy)return;
        if(pending){
          const {x,y,layer}=pending;
          const match=[...layer.querySelectorAll('button.rq-hit')].map(b=>({b,x:parseFloat(b.style.left)/100,y:parseFloat(b.style.top)/100,
            w:parseFloat(b.style.width)/100,h:parseFloat(b.style.height)/100})).filter(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)
            .sort((a,b)=>a.w*a.h-b.w*b.h)[0];
          if(match){pending=null;match.b.click()}
        }
        if(complete){
          busy=false;
          if(pending){pending=null;say('empty','此处未读出标注，可查看整图图解。','No label found at this spot. Open the figure explanation.');return}
        }
        if(pending)return;
        if(count)say('ready',count+' 处标注可点读','Explore '+count+' figure labels');
        else if(complete)say('empty','可先看整图图解','Read the whole-figure explanation');
      }
    };
  }
  // Same normalized coordinates on the original figure and the expanded viewer.
  function mount({session,histograms,plate,modalPlate,visual,modal,notes,findPassage,openSource}){
    const layers=[plate,modalPlate].map(parent=>{
      const layer=document.createElement('div');layer.className='figure-click-layer';parent.append(layer);return layer;
    });
    const cards=[visual,modal].map(parent=>{
      const card=document.createElement('article');card.className='figure-click-note';card.hidden=true;card.setAttribute('aria-live','polite');
      if(parent===visual)visual.querySelector('.frw-caption').before(card);else modal.append(card);
      return card;
    });
    const choices=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('div');
    const progress=feedback();visual.querySelector('.frw-viewport').before(progress.node);
    const modalStatus=progress.node.cloneNode(false);modal.querySelector('.frw-modal-head strong').after(modalStatus);
    const mirror=new MutationObserver(()=>{modalStatus.hidden=progress.node.hidden;modalStatus.dataset.state=progress.node.dataset.state;modalStatus.replaceChildren(...Array.from(progress.node.childNodes,n=>n.cloneNode(true)))});
    mirror.observe(progress.node,{attributes:true,childList:true});
    choices.className='figure-label-list';choices.hidden=true;
    choices.append(summary,list);notes.append(choices);
    const saved=new Map();
    let key='',run=0,marks=[],figure=null;
    function close(){
      for(const layer of layers)for(const button of layer.querySelectorAll('[aria-pressed=true]'))button.setAttribute('aria-pressed','false');
      for(const card of cards)card.hidden=true;
    }
    function select(m,button,index){
      close();progress.cancelTap();
      const entry=m.entry||(m.chart?CartesianPanels.explanation(m,figure.page):null);
      if(!entry)return;
      const context=entry.lookup&&findPassage?.(m.text,figure.page);
      const content=context||entry;
      const card=cards[index];
      button.setAttribute('aria-pressed','true');
      const heading=PaperUI.set(document.createElement('strong'),content[0],content[1]);
      const body=PaperUI.set(document.createElement('p'),content[2],content[3]);
      if(content.localize)PaperLanguageText.bind(body,content[3],{showSource:true});
      const dismiss=PaperUI.set(document.createElement('button'),'收起','Close');
      dismiss.type='button';dismiss.onclick=()=>{close();button.focus({preventScroll:true})};
      card.replaceChildren(heading,body);
      if(content.quote&&content[4]&&openSource){
        const page=content[4],link=PaperUI.set(document.createElement('button'),'原文 p.'+page,'Source p.'+page);
        link.type='button';link.onclick=()=>{if(index===1&&modal.open)modal.close();openSource(page,content.quote)};card.append(link);
      }
      card.append(dismiss);
      card.hidden=false;card.scrollIntoView({block:'nearest',behavior:'instant'});
    }
    function draw(){
      const selected=layers.map(layer=>layer.querySelector('[aria-pressed=true]')?.title);
      list.replaceChildren();
      for(const [i,layer] of layers.entries()){
        const buttons=marks.map(m=>{
          const entry=m.entry||CartesianPanels.explanation(m,figure.page);
          const b=document.createElement('button');b.type='button';b.className='rq-hit';
          if(m.chart?.kind==='symbol')b.classList.add('rq-legend-symbol');
          b.title=ReaderLanguage.choose(entry[0],entry[1]);b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed','false');
          Object.assign(b.style,{left:100*m.x0+'%',top:100*m.y0+'%',width:100*(m.x1-m.x0)+'%',height:100*(m.y1-m.y0)+'%'});
          if(b.title===selected[i]&&!cards[i].hidden)b.setAttribute('aria-pressed','true');
          b.onclick=e=>{e.stopPropagation();select(m,b,i)};
          if(i===0&&!entry.lookup&&m.chart?.kind!=='tick'){
            const control=document.createElement('button');control.type='button';
            const plot=figure.panels.length>1&&m.chart?.kind!=='x'&&m.chart?.context?.xName;
            const suffix=plot?' · '+plot:'';
            PaperUI.set(control,entry[0]+suffix,entry[1]+suffix);
            control.onclick=()=>{choices.open=false;b.focus({preventScroll:true});b.click()};
            list.append(control);
          }
          return b;
        });
        layer.replaceChildren(...buttons);layer.hidden=!buttons.length;
      }
      const count=list.childElementCount;
      choices.hidden=!count;PaperUI.set(summary,'点读标注（'+count+'）','Figure labels ('+count+')');
    }
    const escape=e=>{if(e.key==='Escape'&&cards.some(c=>!c.hidden)){close();e.preventDefault()}};
    const dismiss=e=>{
      if(e.target.closest('button,.figure-click-note'))return;
      close();progress.capture(e,layers[e.currentTarget===modalPlate?1:0]);
    };
    for(const p of [plate,modalPlate])p.addEventListener('click',dismiss);
    document.addEventListener('keydown',escape);document.addEventListener('reader-language-change',draw);
    async function render(f,enabled,mode,url){
      const next=enabled&&f&&url?[f.id,mode,url].join('|'):'';
      if(next===key)return;
      if(f?.id!==figure?.id)choices.open=false;
      key=next;const current=++run;marks=[];figure=f;close();draw();
      progress.clear();if(!next)return;
      const bounds=(mode==='figure'&&f.raw.verifiedRegion)||f.raw.pageBox||(f.raw.pageOnly?{x:0,y:0,width:1,height:1}:null);
      if(!bounds)return;
      progress.begin();
      const live=()=>current===run;
      const resolved=new Map();
      const sources=[{text:f.caption,page:f.raw.captionPage||f.page},...(f.raw.authorPassages||[])];
      function entries(words){
        return words.filter(w=>!w.chart&&/[\p{L}]{2}|[µμ]m/u.test(w.text)&&w.text.length<=82).map(w=>{
          if(!resolved.has(w.text)){
            const entry=FigureElements.explain(w,{caption:f.caption,page:f.page,words})||
              FigureElements.labelPassage(w.text,sources,findPassage,f.page)||
              (!f.raw.pageOnly&&!(f.raw.review&&f.raw.rasterPlate)&&FigureElements.unresolved(w.text,f.page));
            resolved.set(w.text,entry);
          }
          return {...w,entry:resolved.get(w.text)};
        }).filter(m=>m.entry);
      }
      function publish(found,complete=false){
        if(!live())return;
        marks=found.map(m=>mode==='figure'?m:{...m,x0:bounds.x+m.x0*bounds.width,x1:bounds.x+m.x1*bounds.width,y0:bounds.y+m.y0*bounds.height,y1:bounds.y+m.y1*bounds.height});
        draw();progress.update(marks.length,complete);
      }
      const cacheKey=JSON.stringify([f.id,f.page,bounds]);
      if(saved.has(cacheKey)){publish(saved.get(cacheKey),true);return}
      try{
        const vectors=(session.chartMarks?.(f.page,bounds,f.raw.matchKey)||[]).filter(m=>m.chart);
        const words=vectors.some(m=>m.chart.kind==='legend')?[]:await session.chartText(f.page,bounds);
        if(!live())return;
        const first=entries(words);
        if(vectors.length||first.length)publish([...vectors,...first]);
        const picture=await session.renderRegion(f.page,bounds,{quality:vectors.length?'chart':'slide'});
        if(!live()||picture.mode!=='crop')return;
        const bitmap=await createImageBitmap(picture.blob);
        const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
        try{
          c.getContext('2d',{willReadFrequently:true}).drawImage(bitmap,0,0);
          CartesianPanels.fitInk(vectors,c,picture.pixels);
          let found=vectors;
          if(!vectors.some(m=>m.chart.kind==='legend')){
            let labels=words;
            if(!live())return;
            if(words.filter(w=>/\p{L}{2}/u.test(w.text)).length<2&&histograms)
              labels=words.concat(await histograms.panelLabels(f.page,bounds,live,{canvas:c,onLabels:partial=>{
                if(live()&&partial.length)publish([...vectors,...first,...entries(partial)]);
              }}));
            if(!live())return;
            const outlined=labels.filter(w=>w.chart);labels=labels.filter(w=>!w.chart);
            const keys=outlined.concat(PrintedLegend.samples(labels,c).filter(k=>!outlined.some(o=>o.text===k.text&&Math.abs(o.y0-k.y0)<.02)));
            found=[...vectors,...entries(labels.filter(w=>!keys.some(k=>k.text===w.text))),...keys];
          }
          if(!live())return;
          if(found.length){
            saved.set(cacheKey,found);
            if(saved.size>16)saved.delete(saved.keys().next().value);
          }
          publish(found,true);
        }finally{bitmap.close();c.width=c.height=0}
      }catch{/* Already readable labels stay active. */}
      finally{if(live())progress.update(marks.length,true)}
    }
    return {render,destroy(){run++;saved.clear();mirror.disconnect();for(const p of [plate,modalPlate])p.removeEventListener('click',dismiss);document.removeEventListener('keydown',escape);document.removeEventListener('reader-language-change',draw)}};
  }
  window.FigureClicks={mount,feedback};
})();
