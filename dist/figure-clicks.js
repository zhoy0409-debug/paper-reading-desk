(() => {
  'use strict';
  // Same normalized coordinates on the original figure and the expanded viewer.
  function mount({session,histograms,plate,modalPlate,visual,modal,notes,findPassage}){
    const layers=[plate,modalPlate].map(parent=>{
      const layer=document.createElement('div');layer.className='figure-click-layer';parent.append(layer);return layer;
    });
    const cards=[visual,modal].map(parent=>{
      const card=document.createElement('article');card.className='figure-click-note';card.hidden=true;card.setAttribute('aria-live','polite');
      if(parent===visual)visual.querySelector('.frw-caption').before(card);else modal.append(card);
      return card;
    });
    const choices=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('div');
    choices.className='figure-label-list';choices.hidden=true;
    choices.append(summary,list);notes.append(choices);
    let key='',run=0,marks=[],figure=null;
    function close(){
      for(const layer of layers)for(const button of layer.querySelectorAll('[aria-pressed=true]'))button.setAttribute('aria-pressed','false');
      for(const card of cards)card.hidden=true;
    }
    function select(m,button,index){
      close();
      const entry=m.entry||(m.chart?CartesianPanels.explanation(m,figure.page):null);
      if(!entry)return;
      const context=entry.lookup&&findPassage?.(m.text,figure.page);
      const content=context||entry;
      const card=cards[index];
      button.setAttribute('aria-pressed','true');
      const heading=PaperUI.set(document.createElement('strong'),content[0],content[1]);
      const body=PaperUI.set(document.createElement('p'),content[2],content[3]);
      if(content.localize)PaperLanguageText.bind(body,content[3]);
      const dismiss=PaperUI.set(document.createElement('button'),'收起','Close');
      dismiss.type='button';dismiss.onclick=()=>{close();button.focus({preventScroll:true})};
      card.replaceChildren(heading,body,dismiss);
      card.hidden=false;card.scrollIntoView({block:'nearest',behavior:'instant'});
    }
    function draw(){
      list.replaceChildren();choices.open=false;
      for(const [i,layer] of layers.entries()){
        const buttons=marks.map(m=>{
          const entry=m.entry||CartesianPanels.explanation(m,figure.page);
          const b=document.createElement('button');b.type='button';b.className='rq-hit';
          if(m.chart?.kind==='symbol')b.classList.add('rq-legend-symbol');
          b.title=ReaderLanguage.choose(entry[0],entry[1]);b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed','false');
          Object.assign(b.style,{left:100*m.x0+'%',top:100*m.y0+'%',width:100*(m.x1-m.x0)+'%',height:100*(m.y1-m.y0)+'%'});
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
    const dismiss=e=>{if(!e.target.closest('.figure-click-layer button,.figure-click-note'))close()};
    for(const p of [plate,modalPlate])p.addEventListener('click',dismiss);
    document.addEventListener('keydown',escape);document.addEventListener('reader-language-change',draw);
    async function render(f,enabled,mode,url){
      const next=enabled&&f&&url?[f.id,mode,url].join('|'):'';
      if(next===key)return;
      key=next;const current=++run;marks=[];figure=f;close();draw();
      if(!next)return;
      const bounds=(mode==='figure'&&f.raw.verifiedRegion)||f.raw.pageBox||(f.raw.pageOnly?{x:0,y:0,width:1,height:1}:null);
      if(!bounds)return;
      const live=()=>current===run;
      try{
        const vectors=(session.chartMarks?.(f.page,bounds,f.raw.matchKey)||[]).filter(m=>m.chart);
        const picture=await session.renderRegion(f.page,bounds,{quality:vectors.length?'chart':'slide'});
        if(!live()||picture.mode!=='crop')return;
        const bitmap=await createImageBitmap(picture.blob);
        const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
        try{
          c.getContext('2d',{willReadFrequently:true}).drawImage(bitmap,0,0);
          CartesianPanels.fitInk(vectors,c,picture.pixels);
          let choices=vectors;
          if(!vectors.some(m=>m.chart.kind==='legend')){
            let words=await session.chartText(f.page,bounds);
            if(!live())return;
            if(words.filter(w=>/\p{L}{2}/u.test(w.text)).length<2&&histograms)
              words=words.concat(await histograms.panelLabels(f.page,bounds,live));
            if(!live())return;
            const outlined=words.filter(w=>w.chart);words=words.filter(w=>!w.chart);
            const keys=outlined.concat(PrintedLegend.samples(words,c).filter(k=>!outlined.some(o=>o.text===k.text&&Math.abs(o.y0-k.y0)<.02)));
            const evidence=words.filter(w=>!keys.some(k=>k.text===w.text)).map(w=>({...w,entry:FigureElements.explain(w,{caption:f.caption,page:f.page,words})||
              FigureElements.passage(w.text,[{text:f.caption,page:f.raw.captionPage||f.page}])||
              (!f.raw.pageOnly&&/[\p{L}]{2}/u.test(w.text)&&FigureElements.unresolved(w.text,f.page))})).filter(m=>m.entry);
            choices=[...vectors,...evidence,...keys];
          }
          if(!live())return;
          marks=choices.map(m=>mode==='figure'?m:{...m,x0:bounds.x+m.x0*bounds.width,x1:bounds.x+m.x1*bounds.width,y0:bounds.y+m.y0*bounds.height,y1:bounds.y+m.y1*bounds.height});
          draw();
        }finally{bitmap.close();c.width=c.height=0}
      }catch{/* Keep the original figure and its panel navigation available. */}
    }
    return {render,destroy(){run++;for(const p of [plate,modalPlate])p.removeEventListener('click',dismiss);document.removeEventListener('keydown',escape);document.removeEventListener('reader-language-change',draw)}};
  }
  window.FigureClicks={mount};
})();
