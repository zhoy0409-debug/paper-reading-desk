(() => {
  'use strict';
  function dataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob)})}
  async function build({paper,items,session,fileId}){
    const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.author='a';ppt.company='';ppt.subject=paper.title;ppt.title=paper.title;
    const groups=[];
    for(const item of items){
      const prior=groups.at(-1)?.[0];
      if(!prior||prior.figure.id!==item.figure.id||JSON.stringify(prior.shared)!==JSON.stringify(item.shared))groups.push([]);
      groups.at(-1).push(item);
    }
    const cache=new Map();
    async function addPicture(slide,part,fig,frame){
      const key=JSON.stringify([fig.page,part.box,part.recipe]);
      if(!cache.has(key)){
        const pic=await PaperPanelLabels.rendered(session,fig,part.box,part.recipe);
        if(pic.mode!=='crop')throw Error('所选区域没有检测到图像：'+fig.label+' '+part.label+'。请校正边界。');
        cache.set(key,{width:pic.width,height:pic.height,data:await dataURL(pic.blob)});
      }
      const pic=cache.get(key),scale=Math.min(frame.w/pic.width,frame.h/pic.height);
      const w=pic.width*scale,h=pic.height*scale;
      slide.addImage({data:pic.data,x:frame.x+(frame.w-w)/2,y:frame.y+(frame.h-h)/2,w,h,objectName:fig.label+' · '+part.label,altText:fig.label+' '+part.label});
    }
    for(const panels of groups.values()){
      const figure=panels[0].figure;
      for(let n=0;n<panels.length;n+=2){
        const pair=panels.slice(n,n+2),context=panels[0].shared||[],slide=ppt.addSlide();
        const heading=context.find(s=>s.kind==='group'),axis=context.find(s=>s.kind==='y');
        const shared=context.filter(s=>s!==heading&&s!==axis);
        slide.addText(figure.title||figure.label,{x:.48,y:.23,w:12.35,h:.62,fontSize:22,bold:true,margin:0,fit:'shrink',objectName:'图题'});
        const sideKey=shared.length===1&&shared[0].box.height>shared[0].box.width*.85;
        const bottomKey=shared.length&&!sideKey;
        const margin=axis ? .97 : .52;
        const width=((sideKey?10:12.2)-(margin-.52))/pair.length;
        const plotTop=heading?1.38:1.03;
        for(let i=0;i<pair.length;i++){
          const p=pair[i],x=margin+i*width;
          await addPicture(slide,p,figure,{x:x+.05,y:plotTop,w:width-.24,h:(bottomKey?4.51:5.60)-plotTop});
          if(p.sentence?.trim())slide.addText(p.sentence.replace(/\s*\n\s*/g,' '),{x,y:bottomKey?4.56:5.68,w:width-.27,h:.73,fontSize:16,margin:.03,fit:'shrink',objectName:'讲解 · '+p.label});
          const deep=PaperShelf.link(fileId,figure.id,p.id,figure.page);
          const display=p.recipe?p.recipe.label+' ← '+figure.label+' · '+p.label:figure.label+' · '+p.label;
          const refs=[{text:display+' · PDF p.'+figure.page,options:{hyperlink:{url:deep}}}];
          if(p.publicUrl){
            const origin=new URL(p.publicUrl);
            if(/\.pdf$|\/pdf\//i.test(origin.pathname))origin.hash='page='+figure.page;
            refs.push({text:'     '},{text:'公开原文 / Source',options:{hyperlink:{url:origin.href}}});
          }
          slide.addText(refs,{x,y:bottomKey?5.31:6.48,w:width-.25,h:.32,fontSize:12,margin:0,objectName:'读图来源 · '+p.label});
        }
        if(heading)await addPicture(slide,heading,figure,{x:1,y:.87,w:11.25,h:.36});
        if(axis)await addPicture(slide,axis,figure,{x:.48,y:1.5,w:.38,h:2.85});
        if(sideKey){
          slide.addText(shared[0].label,{x:10.68,y:1.32,w:2.04,h:.35,fontSize:13,margin:0,fit:'shrink'});
          await addPicture(slide,shared[0],figure,{x:10.68,y:1.78,w:2.04,h:3.05});
        }else if(bottomKey){
          const cell=12.2/shared.length;
          for(let i=0;i<shared.length;i++){
            const p=shared[i];await addPicture(slide,p,figure,{x:.55+i*cell,y:5.8,w:cell-.22,h:.98});
          }
        }
        const pub=panels[0].publicUrl||'';
        slide.addText(paper.title,{x:.52,y:7.02,w:12.2,h:.24,fontSize:10,margin:0,fit:'shrink',
          ...(pub?{hyperlink:{url:pub}}:{}),objectName:'论文出处'});
      }
    }
    const name=String(paper.title||'读图汇报').replace(/[\\/:*?"<>|]/g,' ').slice(0,72).trim();
    await ppt.writeFile({fileName:name+'-读图汇报.pptx',compression:true});
  }
  window.PaperTalk={build};
})();
