(function(){
  'use strict';
  function mount(figureView,session,onOpen){
    const el=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n};
    const btn=(zh,en,fn)=>{const b=el('button','frw-button');b.type='button';PaperUI.set(b,zh,en);b.onclick=fn;return b};
    const bar=el('div','compare-bar'), label=el('strong','compare-selection');
    const figure=btn('原图','Figure',showFigure),page=btn('PDF 原页','PDF page',()=>showPage(selected.page));
    const fold=btn('收起','Collapse',()=>collapse(!figureView.classList.contains('source-folded')));
    fold.classList.add('compare-fold');
    bar.append(label,figure,page,fold);figureView.prepend(bar);
    const pane=el('div','compare-pdf'),nav=el('div','compare-nav');
    const prev=btn('上一页','Previous',()=>showPage(current-1)),next=btn('下一页','Next',()=>showPage(current+1));
    const count=el('span','compare-count');count.setAttribute('aria-live','polite');
    const bigger=btn('放大','Zoom in',()=>resize(scale+.5)),smaller=btn('缩小','Zoom out',()=>resize(scale-.5));
    const open=btn('大窗查看','Open viewer',()=>onOpen(current));
    for(const [b,icon] of [[prev,'‹'],[next,'›'],[smaller,'−'],[bigger,'+'],[open,'↗']]){
      b.dataset.icon=icon;b.title=b.textContent;b.setAttribute('aria-label',b.textContent);
    }
    const back=btn('回到摘录','Back to passage',()=>{
      const from=returnTo;showFigure();
      if(from?.isConnected){from.focus({preventScroll:true});from.scrollIntoView({block:'nearest'})}
    });
    back.classList.add('rq-source-back');back.hidden=true;
    nav.append(prev,count,next,smaller,bigger,open,back);
    const frame=el('div','compare-viewport');frame.tabIndex=0;frame.setAttribute('aria-label','PDF 原页对照 / Source page');
    const sheet=el('div','compare-sheet'),img=el('img'),mark=el('span','compare-mark'),status=el('p','compare-status');
    status.setAttribute('role','status');sheet.append(img,mark);frame.append(sheet);pane.append(nav,frame,status);figureView.append(pane);
    let selected=null,current=0,token=0,url='',scale=1,area=null,disposed=false,returnTo=null;
    function collapse(value){
      figureView.classList.toggle('source-folded',value);
      PaperUI.set(fold,value?'展开':'收起',value?'Expand':'Collapse');fold.setAttribute('aria-expanded',String(!value));
    }
    function mode(pdf){
      pane.hidden=!pdf;figureView.classList.toggle('source-shown',pdf);
      page.setAttribute('aria-pressed',String(pdf));figure.setAttribute('aria-pressed',String(!pdf));
    }
    function showFigure(){++token;mode(false);collapse(false);returnTo=null;back.hidden=true}
    function resize(s){
      scale=Math.max(1,Math.min(3,s));sheet.style.width=(scale*100)+'%';bigger.disabled=scale===3;smaller.disabled=scale===1;
    }
    function highlight(rect){
      mark.hidden=!rect;
      if(!rect)return;
      Object.assign(mark.style,{left:rect.x*100+'%',top:rect.y*100+'%',width:rect.width*100+'%',height:rect.height*100+'%'});
      frame.scrollTop=Math.max(0,rect.y*sheet.offsetHeight-frame.clientHeight*.26);
      frame.scrollLeft=Math.max(0,rect.x*sheet.offsetWidth-frame.clientWidth*.18);
    }
    async function showPage(n,text,sourceRect,origin){
      if(!Number.isInteger(n)||n<1||n>session.totalPages)return;
      const task=++token;current=n;mode(true);collapse(false);
      if(origin?.isConnected){
        returnTo=origin;back.hidden=false;
        back.focus({preventScroll:true});pane.scrollIntoView({block:'nearest'});
      }
      count.textContent='PDF '+n+' / '+session.totalPages;
      prev.disabled=n===1;next.disabled=n===session.totalPages;
      img.hidden=true;mark.hidden=true;
      PaperUI.set(status,'正在读取原页…','Loading page…');
      try{
        const picture=await session.renderPage(n);
        if(disposed||task!==token)return;
        if(url)URL.revokeObjectURL(url);
        url=URL.createObjectURL(picture.blob);img.alt='PDF · p.'+n;img.src=url;
        const rect=sourceRect||(text?await session.locateExcerpt(n,text):n===selected?.page?area:null);
        await img.decode();
        if(disposed||task!==token)return;
        img.hidden=false;frame.scrollTop=frame.scrollLeft=0;highlight(rect);
        if(sourceRect)PaperUI.set(status,'已标出原表中本格对应的数值。','Matching table cell highlighted.');
        else if(text)PaperUI.set(status,rect?'已标出匹配的原文行':'已到出处页，请在页内核对摘录',rect?'Matching source line':'Check the passage on this page');
        else status.textContent='';
      }catch{if(!disposed&&task===token)PaperUI.set(status,'原页未载入，可重试或大窗查看。','Retry or open the viewer.')}
    }
    function select(f,p,box){
      const changed=selected?.id!==f.id||selected?.panel!==p?.id;
      selected={id:f.id,page:f.page,panel:p?.id};area=box||f.pageBox;
      label.textContent=[f.label,p?.label,'p.'+f.page].filter(Boolean).join(' · ');
      if(changed){returnTo=null;back.hidden=true;if(!pane.hidden)showPage(f.page)}
    }
    showFigure();resize(1);
    return {select,showPage,showFigure,destroy(){disposed=true;++token;if(url)URL.revokeObjectURL(url)}};
  }
  window.PaperSourcePane={mount};
})();
