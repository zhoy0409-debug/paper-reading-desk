(() => {
  'use strict';
  const width = box => box.x + box.width, bottom = box => box.y + box.height;
  function intersection(a,b) {
    if(!a || !b)return null;
    const x=Math.max(a.x,b.x), y=Math.max(a.y,b.y);
    const w=Math.min(width(a),width(b))-x, h=Math.min(bottom(a),bottom(b))-y;
    return w>0 && h>0 ? {x,y,width:w,height:h} : null;
  }
  const relative=(r,b)=>({x:(r.x-b.x)/b.width,y:(r.y-b.y)/b.height,width:r.width/b.width,height:r.height/b.height});
  const onPage=(r,b)=>({x:b.x+r.x*b.width,y:b.y+r.y*b.height,width:r.width*b.width,height:r.height*b.height});
  function letters(index) {
    let value=index+1, label='';
    while(value>0){value--;label=String.fromCharCode(65+value%26)+label;value=Math.floor(value/26)}
    return label;
  }
  function sameBox(a,b){return a && ['x','y','width','height'].every(k=>Math.abs(a[k]-b[k])<.00001)}
  function plan(mode,box,figure,panel,edits,order) {
    if(mode!=='replace' || !box)return null;
    const label=edits?.label?.trim()||letters(order);
    const anchors=figure.panels.filter(p=>intersection(p.markerBox,box));
    let known=false, regions=[];
    const reviewedArea=intersection(edits?.forBox,box);
    if(edits?.regions?.length && sameBox(reviewedArea,box)){
      regions=edits.regions;known=true;
    }else if(sameBox(edits?.noLabelIn,box))known=true;
    else if(anchors.length===1){regions=[anchors[0].markerBox];known=true}
    else if(!anchors.length && panel.markerBox && !edits?.regions?.length)known=true;
    return {label,known,masks:regions.map(r=>intersection(r,box)).filter(Boolean).map(r=>relative(r,box))};
  }
  function draw(source, recipe) {
    if(!recipe?.known)return source;
    const w=source.width,h=source.height;
    const font=Math.max(1,Math.round(Math.min(w*.09,h*.12)));
    const band=Math.max(2,Math.ceil(font*1.42));
    const out=document.createElement('canvas');out.width=w;out.height=h+band;
    const ctx=out.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,w,band);ctx.drawImage(source,0,band);
    for(const r of recipe.masks){
      const x=Math.floor(r.x*w),y=Math.floor(r.y*h);
      ctx.fillRect(x,y+band,Math.ceil((r.x+r.width)*w)-x,Math.ceil((r.y+r.height)*h)-y);
    }
    ctx.font='bold '+font+'px Arial, sans-serif';ctx.fillStyle='#142824';ctx.textBaseline='middle';
    ctx.fillText(recipe.label,Math.max(1,Math.round(font*.23)),band*.5,w-font*.35);
    return out;
  }
  async function rendered(session,figure,box,recipe) {
    if(recipe && !recipe.known)throw Error('请先标出旧编号，或确认裁切范围里没有编号。 / Locate the printed label or confirm there is none.');
    const pic=await session.renderRegion(figure.page,box,{quality:'slide'});
    if(pic.mode!=='crop')throw Error('所选区域没有可导出的原图，请校正边界。 / Check the selected crop.');
    if(!recipe)return pic;
    const bitmap=await createImageBitmap(pic.blob);
    try{
      const out=draw(bitmap,recipe), blob=await new Promise((ok,fail)=>out.toBlob(b=>b?ok(b):fail(Error('PNG export failed')),'image/png'));
      return {blob,width:out.width,height:out.height,mode:'crop',page:figure.page};
    }finally{bitmap.close()}
  }
  function editMask(host,source,initial,commit) {
    const dialog=document.createElement('dialog');dialog.className='pd-label-dialog';
    const title=document.createElement('h3');PaperUI.set(title,'只框住原来的编号','Mark the printed label');
    const help=document.createElement('p');PaperUI.set(help,'拖框覆盖旧字母或数字，可连续框多个。白底仅应用于标出的区域。','Drag around each old label. Only the marked areas will be cleared to white.');
    const surface=document.createElement('canvas');surface.width=source.width;surface.height=source.height;
    surface.setAttribute('aria-label','原始裁切图 / Original crop');
    let regions=initial.map(r=>({...r})),start=null,curr=null;
    function button(zh,en,fn){const b=document.createElement('button');b.type='button';PaperUI.set(b,zh,en);b.onclick=fn;return b}
    const undo=button('撤去最后一框','Undo mark',()=>{regions.pop();paint()});
    const apply=button('使用这些区域','Apply marks',()=>{commit(regions);dialog.close()});
    const close=button('取消','Cancel',()=>dialog.close());
    const actions=document.createElement('div');actions.append(undo,apply,close);
    const coords=e=>{const b=surface.getBoundingClientRect();return {x:Math.min(1,Math.max(0,(e.clientX-b.left)/b.width)),y:Math.min(1,Math.max(0,(e.clientY-b.top)/b.height))}};
    const rect=(a,b)=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)});
    function paint(){
      const ctx=surface.getContext('2d'),w=surface.width,h=surface.height;
      ctx.drawImage(source,0,0);ctx.fillStyle='rgba(190,95,14,.23)';ctx.strokeStyle='#ae5400';ctx.lineWidth=Math.max(1,w/470);
      for(const r of [...regions,...(curr?[curr]:[])]){ctx.fillRect(r.x*w,r.y*h,r.width*w,r.height*h);ctx.strokeRect(r.x*w,r.y*h,r.width*w,r.height*h)}
      undo.disabled=!regions.length;apply.disabled=!regions.length;
    }
    surface.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();start=coords(e);surface.setPointerCapture(e.pointerId)};
    surface.onpointermove=e=>{if(start){curr=rect(start,coords(e));paint()}};
    surface.onpointerup=e=>{if(!start)return;const r=rect(start,coords(e));if(r.width*surface.width>=2&&r.height*surface.height>=2)regions.push(r);curr=start=null;paint()};
    surface.onpointercancel=()=>{start=curr=null;paint()};
    dialog.append(title,help,surface,actions);host.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});paint();dialog.showModal();
  }
  window.PaperPanelLabels={letters,plan,draw,rendered,editMask,onPage};
})();
