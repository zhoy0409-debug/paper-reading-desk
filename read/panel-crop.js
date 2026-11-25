(() => {
  'use strict';
  const pageBounds={x:0,y:0,width:1,height:1};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const create=tag=>document.createElement(tag);
  const t=(zh,en)=>ReaderLanguage.choose(zh,en);
  function around(box){
    const dx=Math.max(.025,box.width*.38),dy=Math.max(.02,box.height*.38);
    const x=Math.max(0,box.x-dx),y=Math.max(0,box.y-dy);
    return {x,y,width:Math.min(1,box.x+box.width+dx)-x,height:Math.min(1,box.y+box.height+dy)-y};
  }
  function open({host,session,page,title,initial,automatic,context,commit}){
    const dialog=create('dialog');
    dialog.className='pc-dialog';
    const header=create('header'),heading=create('h3'),hint=create('p'),status=create('p');
    heading.textContent=title;
    dialog.setAttribute('aria-label',title);
    hint.textContent=t('拖动边或角调整范围，拖框内可移动，拖框外可重新框选。','Drag an edge or corner to resize, the inside to move, or outside to draw a new crop.');
    const frame=create('div'),surface=create('div'),img=create('img'),box=create('div');
    frame.className='pc-frame';surface.className='pc-surface';box.className='pc-box';
    img.alt='';img.draggable=false;box.tabIndex=0;box.dataset.edge='move';
    box.setAttribute('role','group');
    box.setAttribute('aria-label',t('裁切框，用方向键移动','Crop area, use arrow keys to move'));
    const footer=create('footer');
    function button(zh,en,fn){
      const b=create('button');b.type='button';b.textContent=t(zh,en);b.onclick=fn;return b;
    }
    const toggle=button('查看整页','Show full page',()=>load(!fullView));
    const reset=button(automatic?'还原自动边界':'重置选框',automatic?'Restore detected bounds':'Reset crop',()=>{
      selection={...(automatic||start)};
      load(false);
    });
    const cancel=button('取消','Cancel',()=>dialog.close());
    const apply=button('应用裁切','Apply crop',()=>{
      if(!apply.disabled){commit({...selection});dialog.close()}
    });
    apply.className='pc-apply';status.setAttribute('role','status');
    const retry=button('重试','Retry',()=>load(fullView));
    header.append(heading,toggle);frame.append(surface,status,retry);surface.append(img,box);footer.append(reset,cancel,apply);
    dialog.append(header,hint,frame,footer);host.append(dialog);
    let selection=initial?{...initial}:{x:context.x+context.width*.2,y:context.y+context.height*.2,width:context.width*.6,height:context.height*.6};
    const start={...selection};
    let basis,fullView=false,generation=0,objectURL='',drag=null,ready=false;
    const handles=[['nw','左上','Top left'],['n','上边','Top'],['ne','右上','Top right'],['e','右边','Right'],['se','右下','Bottom right'],['s','下边','Bottom'],['sw','左下','Bottom left'],['w','左边','Left']];
    for(const [edge,zh,en] of handles){
      const b=create('button');b.type='button';b.className='pc-handle';b.dataset.edge=edge;
      b.setAttribute('aria-label',t(zh+'边界，用方向键调整',en+' crop handle, use arrow keys to resize'));
      box.append(b);
    }
    function paint(){
      const b=selection;
      Object.assign(box.style,{left:(b.x-basis.x)/basis.width*100+'%',top:(b.y-basis.y)/basis.height*100+'%',width:b.width/basis.width*100+'%',height:b.height/basis.height*100+'%'});
    }
    async function load(full){
      const token=++generation;
      ready=false;drag=null;fullView=full;
      basis=full?pageBounds:around(initial?selection:context);
      surface.hidden=retry.hidden=true;apply.disabled=true;status.hidden=false;
      status.textContent=t('正在打开原图…','Opening the source image…');
      toggle.textContent=full?t('放大小图周边','Zoom to crop'):t('查看整页','Show full page');
      try{
        const pic=full?await session.renderPage(page):await session.renderRegion(page,basis,{quality:'slide'});
        if(token!==generation)return;
        if(pic.mode!=='crop')basis=pageBounds;
        if(objectURL)URL.revokeObjectURL(objectURL);
        img.src=objectURL=URL.createObjectURL(pic.blob);
        await img.decode();
        if(token!==generation)return;
        surface.style.setProperty('--pc-ratio',img.naturalWidth/img.naturalHeight);
        ready=true;status.hidden=true;surface.hidden=false;apply.disabled=false;paint();
      }catch{
        if(token!==generation)return;
        status.textContent=t('原图加载失败。','Could not load the source image.');retry.hidden=false;
      }
    }
    function coords(e){
      const r=surface.getBoundingClientRect();
      return {x:basis.x+clamp((e.clientX-r.x)/r.width,0,1)*basis.width,y:basis.y+clamp((e.clientY-r.y)/r.height,0,1)*basis.height};
    }
    function adjust(b,edge,dx,dy){
      const right=basis.x+basis.width,bottom=basis.y+basis.height;
      if(edge==='move')return {...b,x:clamp(b.x+dx,basis.x,right-b.width),y:clamp(b.y+dy,basis.y,bottom-b.height)};
      const r=surface.getBoundingClientRect();
      const minW=Math.min(b.width,6*basis.width/r.width),minH=Math.min(b.height,6*basis.height/r.height);
      const x=edge.includes('w')?clamp(b.x+dx,basis.x,b.x+b.width-minW):b.x;
      const y=edge.includes('n')?clamp(b.y+dy,basis.y,b.y+b.height-minH):b.y;
      const endX=edge.includes('e')?clamp(b.x+b.width+dx,x+minW,right):b.x+b.width;
      const endY=edge.includes('s')?clamp(b.y+b.height+dy,y+minH,bottom):b.y+b.height;
      return {x,y,width:endX-x,height:endY-y};
    }
    surface.onpointerdown=e=>{
      if(!ready||drag||e.button!==0)return;
      const target=e.target.closest('[data-edge]');
      drag={edge:target?.dataset.edge||'draw',from:coords(e),start:{...selection},id:e.pointerId};
      e.preventDefault();surface.setPointerCapture(e.pointerId);(target||box).focus({preventScroll:true});
    };
    function update(e){
      if(!drag||e.pointerId!==drag.id)return;
      const p=coords(e),a=drag.from;
      selection=drag.edge==='draw'?{x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.abs(p.x-a.x),height:Math.abs(p.y-a.y)}:adjust(drag.start,drag.edge,p.x-a.x,p.y-a.y);
      paint();
    }
    surface.onpointermove=update;
    surface.onpointerup=e=>{
      if(!drag||e.pointerId!==drag.id)return;
      update(e);
      const r=box.getBoundingClientRect();
      if(drag.edge==='draw'&&(r.width<6||r.height<6))selection=drag.start;
      drag=null;paint();
    };
    surface.onlostpointercapture=()=>{if(drag){selection=drag.start;drag=null;paint()}};
    surface.onkeydown=e=>{
      if(!ready||!e.key.startsWith('Arrow')||!e.target.dataset.edge)return;
      e.preventDefault();e.stopPropagation();
      const r=surface.getBoundingClientRect(),step=e.shiftKey?10:1;
      const dx=(Number(e.key==='ArrowRight')-Number(e.key==='ArrowLeft'))*step*basis.width/r.width;
      const dy=(Number(e.key==='ArrowDown')-Number(e.key==='ArrowUp'))*step*basis.height/r.height;
      selection=adjust(selection,e.target.dataset.edge,dx,dy);paint();
    };
    dialog.addEventListener('close',()=>{
      generation++;if(objectURL)URL.revokeObjectURL(objectURL);dialog.remove();
    },{once:true});
    dialog.showModal();
    cancel.focus({preventScroll:true});load(false);
    return dialog;
  }
  window.PanelCrop={open};
})();
