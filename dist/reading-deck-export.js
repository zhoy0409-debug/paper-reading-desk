/* Deck to PowerPoint. Titles, text and speaker notes stay editable; figures are images cut from the PDF. */
(() => {
  'use strict';
  const dataURL=blob=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(r.error);r.readAsDataURL(blob)});
  const FONT='Microsoft YaHei',INK='171A21',GREY='667080';
  async function build({slides,paper,image}){
    const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.title=paper.title||'';ppt.subject=paper.title||'';ppt.company='';ppt.author='a';
    for(const s of slides){
      const page=ppt.addSlide(),text=(value,at)=>value&&page.addText(value,{fontFace:FONT,color:INK,margin:0,fit:'shrink',...at});
      const say=s.say.trim();if(say)page.addNotes(say);
      if(s.kind==='cover'){
        text(s.title,{x:.9,y:2.2,w:11.5,h:1.9,fontSize:38,bold:true,valign:'bottom',objectName:'题名'});
        text(s.body,{x:.9,y:4.3,w:11.5,h:.8,fontSize:18,color:GREY,valign:'top'});
        continue;
      }
      text(s.title,{x:.6,y:.38,w:12.1,h:.86,fontSize:26,bold:true,valign:'middle',objectName:'标题'});
      const pic=s.kind==='text'?null:await image(s);
      const split=s.layout==='split'&&s.body.trim(),lower=!split&&s.body.trim();
      if(pic){
        const frame=split?{x:.6,y:1.4,w:7.6,h:5.3}:{x:.6,y:1.4,w:12.1,h:lower?4.35:5.35};
        const k=Math.min(frame.w/pic.width,frame.h/pic.height),w=pic.width*k,h=pic.height*k;
        page.addImage({data:await dataURL(pic.blob),x:frame.x+(frame.w-w)/2,y:frame.y+(frame.h-h)/2,w,h,altText:s.title||pic.source||''});
      }
      const lines=s.body.trim().split(/\n+/).filter(Boolean);
      if(lines.length){
        const at=!pic?{x:.6,y:1.6,w:12.1,h:4.9,fontSize:22}:split?{x:8.5,y:1.5,w:4.25,h:5.1,fontSize:18}:{x:.6,y:5.85,w:12.1,h:.85,fontSize:16};
        page.addText(lines.map(l=>({text:l.replace(/^[-•·]\s*/,''),options:{bullet:lines.length>1?{indent:14}:false,breakLine:true}})),
          {fontFace:FONT,color:INK,margin:0,valign:'top',fit:'shrink',paraSpaceAfter:8,objectName:'正文',...at});
      }
      if(pic?.source){
        const run={text:pic.source+(paper.title?'  ·  '+paper.title:''),options:paper.publicUrl?{hyperlink:{url:paper.publicUrl}}:{}};
        page.addText([run],{x:.6,y:6.95,w:12.1,h:.26,fontFace:FONT,fontSize:10,color:GREY,margin:0,fit:'shrink',objectName:'出处'});
      }
    }
    const name=String(paper.title||'读图汇报').replace(/[\\/:*?"<>|]/g,' ').slice(0,72).trim();
    await ppt.writeFile({fileName:name+'-组会汇报.pptx',compression:true});
  }
  window.ReadingDeckExport=Object.freeze({build});
})();
