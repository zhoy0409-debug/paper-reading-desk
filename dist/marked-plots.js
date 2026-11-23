(() => {
  'use strict';
  const shapes={circles:['圆点','circles'],squares:['方块','squares'],triangles:['三角形','triangles'],diamonds:['菱形','diamonds']};
  const positions=['top','bottom'];
  const row=(role,en,zh,enText)=>({role,en,zh,enText});
  function sections(caption){
    const headers=[...caption.matchAll(/(?:^|[.;:]\s+)(?:panel\s+)?(?:\(([a-z])\)|([a-z])\))\s+/gi)];
    return headers.length?headers.map((m,i)=>({id:(m[1]||m[2]).toLowerCase(),text:caption.slice(m.index+m[0].length,headers[i+1]?.index)})):[{id:'',text:caption}];
  }
  function mappings(text){
    const found=[...text.matchAll(/(?<![\p{L}\d])((?:\d+\s*)?[\p{L}][\p{L}\d-]*)\s*\(\s*(?:(?:open|filled|solid|empty|black|red|blue|green|full)\s+){0,2}(circles|squares|diamonds|triangles)\s*[,;]\s*(?:the\s+)?(right|left)(?:[- ]hand)?\s+(?:y[- ]?)?axis\s*\)/giu)];
    if(found.length<2||found.length>4||new Set(found.map(m=>m[2].toLowerCase())).size!==found.length||new Set(found.map(m=>m[3].toLowerCase())).size!==2)return [];
    if(found.some(m=>/^(?:K|Hz|kHz|nm|mm|cm|mV|GPa|T)$/u.test(m[1])&&/\d\s*$/.test(text.slice(0,m.index))))return [];
    const inset=/\b(?:the|an) inset (?:shows|plots|displays)\b/i.test(text.slice(0,found[0].index).split(/(?<=[.!?])\s+/).at(-1));
    return found.map(m=>({quantity:m[1].replace(/^(\d+)\s+(?=\p{L})/u,'$1'),shape:m[2].toLowerCase(),side:m[3].toLowerCase(),inset}));
  }
  function groups(text){
    const top=text.match(/(?:[,(;]\s*)([^,;()]{2,65}?)\s+(?:top|upper)\s+(?:part|panel|plot)\b/i);
    const bottom=text.match(/(?:[,(;]\s*)([^,;()]{2,65}?)\s+(?:bottom|lower)\s+(?:part|panel|plot)\b/i);
    return top&&bottom?[top[1].trim(),bottom[1].trim()]:null;
  }
  const bounds=all=>({x0:Math.min(...all.map(b=>b.x0)),y0:Math.min(...all.map(b=>b.y0)),x1:Math.max(...all.map(b=>b.x1)),y1:Math.max(...all.map(b=>b.y1))});
  const relative=(r,b)=>({x:(r.x0-b.x0)/(b.x1-b.x0),y:(r.y0-b.y0)/(b.y1-b.y0),width:(r.x1-r.x0)/(b.x1-b.x0),height:(r.y1-r.y0)/(b.y1-b.y0)});
  // Compare the vertical envelopes of the dominant ink at opposite ends.
  // Overlapping envelopes, sparse marks and multiple competing colors give no trend.
  function lowerAtHighFrequency(data,width,frame){
    const h=frame.y1-frame.y0,w=frame.x1-frame.x0;
    function band(start,end){
      const colors=[[],[],[]];
      for(let x=Math.ceil(frame.x0+w*start);x<=frame.x0+w*end;x++){
        for(let y=frame.y0+2;y<frame.y1-2;y++){
          const at=4*(y*width+x),rgb=[data[at],data[at+1],data[at+2]];
          const peak=Math.max(...rgb),index=rgb.indexOf(peak),other=Math.max(rgb[(index+1)%3],rgb[(index+2)%3]);
          if(peak>65&&other<peak*.42)colors[index].push(y);
        }
      }
      const ordered=colors.map((ys,i)=>({ys,i})).sort((a,b)=>b.ys.length-a.ys.length);
      const first=ordered[0];if(first.ys.length<w*.12||first.ys.length<ordered[1].ys.length*3)return null;
      first.ys.sort((a,b)=>a-b);return first;
    }
    const low=band(.055,.11),high=band(.89,.945);
    return !!(low&&high&&low.i===high.i&&low.ys[Math.floor(low.ys.length*.98)]+h*.06<high.ys[Math.floor(high.ys.length*.02)]);
  }
  async function frequencyLabel(canvas,frame){
    const vendor=new URL('./vendor/ocr/',document.baseURI),file=name=>new URL(name,vendor).href;
    const crop=document.createElement('canvas'),start=frame.y1+2;
    if(start>=canvas.height)return false;
    crop.width=canvas.width;crop.height=canvas.height-start;
    crop.getContext('2d').drawImage(canvas,0,-start);
    let worker;
    try{
      const {default:ocr}=await import(file('tesseract.esm.min.js'));
      worker=await ocr.createWorker('eng',1,{workerPath:file('worker.min.js'),corePath:file('tesseract-core-lstm.wasm.js'),langPath:vendor.href,workerBlobURL:false,cacheMethod:'none'});
      await worker.setParameters({tessedit_pageseg_mode:'6'});
      const {data}=await worker.recognize(crop);
      return /\blog\s*[\[(]?\s*f\s*[\[(]?\s*Hz\b/i.test(data.text);
    }finally{if(worker)await worker.terminate();crop.width=crop.height=0}
  }
  async function locate(cap,marks,words,page,view,annotationMode){
    const parts=sections(cap.caption);
    if(parts.length!==2||!mappings(parts[0].text).length||!groups(parts[0].text))return null;
    const images=marks.filter(m=>m.kind==='image'&&m.y1<=cap.line.y0+1&&cap.line.y0-m.y1<cap.line.size*3&&m.x1-m.x0>view.width*.13&&m.y1-m.y0>view.height*.1);
    if(images.length!==1)return null;
    const im=images[0],w=im.x1-im.x0,h=im.y1-im.y0;
    const adjacent=words.filter(t=>t.text.trim().toLowerCase()===parts[1].id+')'&&t.x0>im.x1&&t.y0>=im.y0&&t.y1<=im.y1);
    if(adjacent.length!==1)return null;
    const neighbours=[...words,...marks].filter(t=>t.x0>im.x1&&t.x1<=view.width&&t.y0>=im.y0-4&&t.y1<=cap.line.y0-1);
    if(!neighbours.length)return null;
    const other=bounds(neighbours);
    if(other.x1-other.x0<w*.5||other.y1-other.y0<h*.75||other.x0-im.x1>w*.5)return null;
    const canvas=document.createElement('canvas'),scale=Math.min(4,900/Math.max(w,h));
    canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    try{
      await page.render({canvas,canvasContext:ctx,viewport:page.getViewport({scale}),transform:[1,0,0,1,-im.x0*scale,-im.y0*scale],annotationMode,background:'#fff'}).promise;
      const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      const frames=HistogramGrid.detect(pixels,canvas.width,canvas.height,true);
      if(frames.length!==2)return null;
      const mid=im.y0+(frames[0].y1+frames[1].y0)/(2*scale);
      const crop=bounds([im,other]);crop.x0-=2;crop.x1+=2;crop.y0-=2;crop.y1+=2;
      const rects=[{...im,y1:mid},{...im,y0:mid}];
      const last=frames[1],sharedX={x0:im.x0,x1:im.x1,y0:im.y0+last.y1/scale,y1:im.y1};
      const logHz=/frequency dependence/i.test(parts[0].text)&&await frequencyLabel(canvas,last).catch(()=>false);
      const rows=rects.map((r,i)=>{
        const frame=frames[i],y0=im.y0+frame.y0/scale,y1=im.y0+frame.y1/scale;
        return {region:relative(r,crop),name:groups(parts[0].text)[i],position:positions[i],logHz,lowerAtHigh:lowerAtHighFrequency(pixels,canvas.width,frame),axes:{
          left:relative({x0:im.x0,x1:im.x0+frame.x0/scale,y0,y1},crop),
          right:relative({x0:im.x0+frame.x1/scale,x1:im.x1,y0,y1},crop),x:relative(sharedX,crop)}};
      });
      return {crop,first:parts[0].id,panels:[{position:parts[0].id,label:parts[0].id.toUpperCase(),rect:im},{position:parts[1].id,label:parts[1].id.toUpperCase(),rect:other}],rows};
    }finally{canvas.width=canvas.height=0}
  }
  function groupNames(name){
    if(/^bare NPs$/i.test(name))return ['未接枝纳米粒子',name];
    const graft=name.match(/^(C\d+)\s+([\d.]+)\s*\/\s*nm[²2]\s+grafted NPs$/i);
    if(graft)return [graft[1]+' 接枝纳米粒子（'+graft[2]+' nm⁻²）',graft[1]+'-grafted nanoparticles ('+graft[2]+' nm⁻²)'];
    return [name,name];
  }
  function explain(text,entries){
    const dielectric=/\bdielectric permittivity\b/i.test(text);
    return entries.map(e=>{
      const left=e.side==='left',side=left?'左轴':'右轴',shape=shapes[e.shape],q=e.quantity.toLowerCase();
      const meaning=dielectric&&q==='real'?['介电实部 ε′，反映材料随交变电场极化、储存电能的响应。','the real permittivity ε′, which describes polarization and energy storage in an alternating field.']:
        dielectric&&q==='imaginary'?['介电损耗 ε″，反映材料在这个频率下耗散电能的程度。','the dielectric loss ε″, which describes how strongly the material dissipates electrical energy at that frequency.']:[({resistance:'电阻',temperature:'温度',pressure:'压力'})[q]||e.quantity,e.quantity+'.'];
      return row(shape[0]+' · '+side,shape[1]+' · '+e.side+' axis',(e.inset?'在插图中，':'')+'从'+shape[0]+'水平读'+side+'。它表示'+meaning[0].replace(/。$/,'')+'。',(e.inset?'In the inset, read the ':'Read the ')+shape[1]+' horizontally against the '+e.side+' axis for '+meaning[1]);
    });
  }
  function enrich(f,rows){
    const parts=sections(f.caption);
    for(const part of parts){
      const maps=mappings(part.text);
      if(!maps.length)continue;
      const parent=f.panels.find(p=>p.id===part.id);
      const notes=explain(part.text,maps);
      if(!parent){if(!part.id)f.markReading=notes;continue}
      parent.markReading=notes;
      if(f.markedStack?.first!==part.id)continue;
      const options=f.markedStack.rows,dielectric=/dielectric permittivity/i.test(part.text);
      const srcPage=f.captionPage||f.page;
      const source=rows.filter(r=>r.page===srcPage&&!r.fig).map(r=>r.text).join(' ').replace(/\s+/g,' ');
      const statements=source.replace(/\bi\.e\.,?/gi,'i.e.,').split(/(?<=[.!?])\s+(?=[A-Z])/);
      const at=statements.findIndex(s=>/\bpeak\s+(?:then\s+)?(?:moves?|shifts?)\s+(?:back\s+)?to\s+high(?:er)?\s+frequenc(?:y|ies)\b/i.test(s)&&/\bgrafted\s+(?:NPs|nanoparticles)\b/i.test(s)&&!/\b(?:if|might|could|would|not)\b/i.test(s));
      const quote=at<0?'':statements[at].match(/\b(?:the\s+)?peak\s+(?:then\s+)?(?:moves?|shifts?)\b.*/i)?.[0];
      const next=statements[at+1]||'';
      const narrower=quote&&/\b(?:reduction (?:of|in) (?:the )?peak broadening|narrower peak)\b/i.test(next)&&/surface-modified|grafted/i.test(next)?next:'';
      for(const o of options){
        const top=o.position==='top',names=groupNames(o.name),tag=top?'上':'下';
        const guide=[row('材料与比较条件','Material and conditions',names[0]+'。点'+(top?'下图':'上图')+'对照另一组。',names[1]+'. Compare with the '+(top?'lower':'upper')+' plot.'),...notes];
        const temp=part.text.match(/\bT\s*=\s*([\d.]+)\s*K\b/),vol=part.text.match(/\b(\d+(?:\.\d+)?)\s*%\s*v[- ]PNCs\b/i);
        if(vol&&temp)guide[0]=row('材料与比较条件','Material and conditions',names[0]+'。两图都在 '+temp[1]+' K、粒子体积分数 '+vol[1]+'% 下比较。',names[1]+'. Both plots use '+vol[1]+'% particles by volume at '+temp[1]+' K.');
        if(/frequency dependence/i.test(part.text)){
          const x=o.logHz?['横轴标作 log[f(Hz)]。从 0 走到 1，频率从 1 Hz 变为 10 Hz。','The x-axis is log[f(Hz)]. Moving from 0 to 1 takes you from 1 Hz to 10 Hz.']:['沿横轴由低频向高频看。','Follow the horizontal axis from low to high frequency.'];
          guide.push(row('沿横轴怎样看','Read across frequency',x[0]+'在同一频率处，沿每种符号水平找到它自己的纵轴。',x[1]+' At a given frequency, follow each symbol horizontally to its own scale.'));
          if(o.lowerAtHigh)guide.push(row('原图两端怎么变','Compare the ends of this plot','在本格，右端的同色曲线整体低于左端。比较的是同一条曲线随频率的变化，中间仍可有峰和台阶。','The colored traces sit lower near the high-frequency end than near the low-frequency end. Trace each series across the plot to see the intervening peaks or steps.'));
        }
        const refs=[{kind:'小图图注',en:'Panel caption',text:part.text,page:srcPage}];
        const matched=dielectric&&maps.some(e=>e.shape==='squares'&&/^imaginary$/i.test(e.quantity))&&/[α]\s*[-‐]?\s*(?:peak|relaxation)/i.test(source)&&/polymer dynamics/i.test(source)&&/^bare NPs$/i.test(options[0].name)&&/grafted NPs$/i.test(options[1].name)&&quote;
        if(matched){
          const broad=narrower?'，峰形也变窄':'',narrow=narrower?' and narrows':'';
          guide.push(row('两组的损耗峰','Compare the loss peaks',top?'以这组的 α 损耗峰为参照。作者报告，接枝后峰移向更高频率'+broad+'。读峰位要看方块所在的损耗曲线。':'与上图相比，作者报告接枝后的 α 损耗峰移向更高频率'+broad+'。峰往右移表示聚合物链段响应电场的特征时间缩短。',
            'Follow the loss peak on the squares’ scale. The authors report that the α peak moves to higher frequency'+narrow+' after grafting. A higher peak frequency indicates faster segmental relaxation.'));
          refs.push({kind:'作者对样品系列的比较',en:'Authors’ comparison of the sample series',page:srcPage,text:quote+(narrower?' '+narrower:'')});
        }
        if(/solid lines represent.{0,40}fits/i.test(part.text)){
          const components=/dashed lines for MWS.{0,110}conductivity term\s*\(dotted line\)/i.test(part.text);
          guide.push(row('数据点和拟合线','Measurements and fits','符号是测量数据，实线是作者的整体拟合。'+(components?'虚线显示各弛豫贡献，点线显示直流电导项。':''),'Symbols are measurements and the solid lines are the combined fits.'+(components?' Dashed lines show relaxation contributions and the dotted line shows the DC conductivity term.':'')));
        }
        guide.push(row('数值待核对','Values to verify','没有从原始数据核实单点读数、峰频或峰宽，保留定性比较。','Individual readings, peak frequencies and peak widths have not been verified numerically.'));
        const b=f.pageBox,x=o.axes.x;
        const shared=[{kind:'x',label:'共用横轴 / Shared x-axis',box:{x:b.x+x.x*b.width,y:b.y+x.y*b.height,width:x.width*b.width,height:x.height*b.height}}];
        f.panels.push({id:part.id+'-'+o.position,label:part.id.toUpperCase()+' · '+tag,markerParent:part.id,markerPosition:o.position,markerAxes:o.axes,markerMap:maps,gridShared:shared,title:names[0],page:f.page,region:o.region,reading:{kind:'marker',title:names,rows:guide,sources:refs,narration:guide.find(r=>r.en==='Compare the loss peaks')?.zh||guide[0].zh}});
      }
    }
  }
  window.MarkedPlots={sections,mappings,locate,enrich};
})();
