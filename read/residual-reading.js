(() => {
  'use strict';
  const clean=t=>String(t||'').normalize('NFKC').replace(/([a-z])-\s+([a-z])/gi,'$1$2').replace(/\s+/g,' ').trim();
  // Require two closed frames in the raster itself. A horizontal line at
  // zero may cross the data, but cannot create two independent side walls.
  function walls(pixels,w,h){
    const ink=(x,y)=>{const i=(y*w+x)*4;return Math.max(pixels[i],pixels[i+1],pixels[i+2])<125};
    const pairs=[];
    for(let x=1;x<w-1;x++){
      const runs=[];let start=-1;
      for(let y=0;y<=h;y++){
        if(y<h&&ink(x,y)){if(start<0)start=y;continue}
        if(start>=0&&y-start>h*.11)runs.push([start,y-1]);start=-1;
      }
      if(runs.length===2&&runs[1][0]-runs[0][1]<h*.18)pairs.push({x,runs});
    }
    const solutions=[];
    for(const l of pairs)for(const r of pairs){
      if(r.x-l.x<w*.44||l.runs.flat().some((v,i)=>Math.abs(v-r.runs.flat()[i])>3))continue;
      const solid=y=>[-2,-1,0,1,2].some(d=>{
        let hits=0,n=0;for(let x=l.x;x<=r.x;x+=2){n++;if(y+d>=0&&y+d<h&&ink(x,y+d))hits++}return hits>.94*n;
      });
      if(l.runs.flat().every(solid)&&!solutions.some(p=>Math.abs(p[0].x0-l.x)<4&&Math.abs(p[0].x1-r.x)<4))
        solutions.push(l.runs.map(([y0,y1])=>({x0:l.x,x1:r.x,y0,y1})));
    }
    return solutions.length===1?solutions[0]:[];
  }
  async function redshiftTicks(canvas,frame){
    const strip=document.createElement('canvas');
    const top=frame.y1+3,H=Math.min(canvas.height-top,Math.ceil(canvas.height*.083));
    if(H<12)return null;
    strip.width=canvas.width;strip.height=H;
    strip.getContext('2d').drawImage(canvas,0,top,strip.width,H,0,0,strip.width,H);
    let worker;
    try{
      worker=await StackedPlots.createOcrWorker();await worker.setParameters({tessedit_pageseg_mode:'11'});
      const {data}=await worker.recognize(strip,{}, {blocks:true});
      const words=(data.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words)));
      const ticks=words.filter(w=>/^\d+(\.\d+)?$/.test(w.text)&&w.confidence>=65).map(w=>({value:Number(w.text),x:(w.bbox.x0+w.bbox.x1)/2})).sort((a,b)=>a.x-b.x);
      for(let j=2;j<ticks.length;j++){
        const [a,b,c]=ticks.slice(j-2,j+1);
        if(a.value>0&&Math.abs(b.value/a.value-10)<.02&&Math.abs(c.value/b.value-10)<.02&&
          c.x-a.x>(frame.x1-frame.x0)*.55&&Math.abs((b.x-a.x)/(c.x-b.x)-1)<.07)return [a.value,b.value,c.value];
      }
      return null;
    }catch{return null}finally{if(worker)await worker.terminate();strip.width=strip.height=0}
  }
  async function rasterPair(cap,objects,page,viewport,annotationMode){
    const c=cap.line,images=objects.filter(o=>o.kind==='image'&&o.y1<=c.y0+2&&c.y0-o.y1<Math.min((o.x1-o.x0)*.14,36)&&
      o.y1-o.y0>65&&o.x1-o.x0>viewport.width*.20&&(o.x0+o.x1)/2>=c.x0-3&&(o.x0+o.x1)/2<=c.x1+3);
    if(!images.length){
      const plates=objects.filter(o=>o.barRect&&o.x1-o.x0>viewport.width*.2&&c.y0>=o.y1&&c.y0-o.y1<=18&&Math.abs(o.x0-c.x0)<14);
      const matches=[];
      for(const plate of plates){
        const frames=objects.filter(o=>o!==plate&&o.barRect&&o.x0>=plate.x0&&o.x1<=plate.x1&&o.y0>=plate.y0&&o.y1<=plate.y1&&
          o.x1-o.x0>(plate.x1-plate.x0)*.55&&o.y1-o.y0>(plate.y1-plate.y0)*.12&&o.y1-o.y0<(plate.y1-plate.y0)*.78).sort((a,b)=>a.y0-b.y0);
        if(frames.length===2&&Math.abs(frames[0].x0-frames[1].x0)<2&&Math.abs(frames[0].x1-frames[1].x1)<2&&frames[1].y0>=frames[0].y1-1)
          matches.push({crop:plate,frames});
      }
      if(matches.length===1)return matches[0];
      // A dense vector plot may exceed the graphics-object cap. Work from the page ink
      // only if the caption explicitly names the upper and lower observations.
      if(!/Hubble diagram/i.test(cap.caption)||!/residuals?/i.test(cap.caption)||!/\b(?:top|upper)\b/i.test(cap.caption)||!/\b(?:bottom|lower)\b/i.test(cap.caption))return null;
      const width=c.x1-c.x0;
      if(width<viewport.width*.19)return null;
      const region={x0:Math.max(0,c.x0-2),x1:Math.min(viewport.width,c.x1+2),y0:Math.max(0,c.y0-width*1.3),y1:c.y0-1};
      const scale=Math.min(2.6,1250/(region.x1-region.x0));
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil((region.x1-region.x0)*scale);canvas.height=Math.ceil((region.y1-region.y0)*scale);
      try{
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        await page.render({canvas,canvasContext:ctx,viewport:page.getViewport({scale}),transform:[1,0,0,1,-region.x0*scale,-region.y0*scale],annotationMode,background:'#fff'}).promise;
        const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,W=canvas.width,H=canvas.height;
        let boxes=walls(data,W,H);
        if(!boxes.length)boxes=StackedPlots.frames(data,W,H,2);
        if(!boxes.length){
          const three=StackedPlots.frames(data,W,H,3);
          if(three.length===3){
            const dark=(x,y)=>{const i=4*(y*W+x);return Math.max(data[i],data[i+1],data[i+2])<150};
            const ticks=y=>{const xs=[];for(let x=three[0].x0+10;x<three[0].x1-10;x++){
              if((dark(x,y-2)&&dark(x,y-3)||dark(x,y+2)&&dark(x,y+3))&&(!xs.length||x-xs.at(-1)>4))xs.push(x);
            }return xs};
            const top=ticks(three[0].y0),bottom=ticks(three[2].y1);
            const score=y=>ticks(y).filter(x=>top.some(t=>Math.abs(t-x)<=2)&&bottom.some(t=>Math.abs(t-x)<=2)).length;
            const first=score(three[0].y1),second=score(three[1].y1);
            if(first>=4&&second<first*.4)boxes=[three[0],{...three[2],y0:three[1].y0}];
            if(second>=4&&first<second*.4)boxes=[{...three[0],y1:three[1].y1},three[2]];
          }
        }
        if(boxes.length!==2||(H-boxes[1].y1)>(boxes[0].x1-boxes[0].x0)*.19)return null;
        const frames=boxes.map(b=>({x0:region.x0+b.x0/scale,x1:region.x0+b.x1/scale,y0:region.y0+b.y0/scale,y1:region.y0+b.y1/scale}));
        // Preserve axis labels and a possible colour key above the frames.
        return {frames,crop:{...region,y0:Math.max(region.y0,frames[0].y0-width*.13)}};
      }finally{canvas.width=canvas.height=0}
    }
    if(images.length!==1)return null;
    const crop=images[0],width=crop.x1-crop.x0,height=crop.y1-crop.y0,scale=Math.min(3,1000/width,1080/height);
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
    try{
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      await page.render({canvas,canvasContext:ctx,viewport:page.getViewport({scale}),transform:[1,0,0,1,-crop.x0*scale,-crop.y0*scale],annotationMode,background:'#fff'}).promise;
      const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let boxes=walls(data,canvas.width,canvas.height);
      if(!boxes.length)boxes=StackedPlots.frames(data,canvas.width,canvas.height,2);
      if(boxes.length!==2)return null;
      const ticks=/Hubble diagram/i.test(cap.caption)&&/residual/i.test(cap.caption)?await redshiftTicks(canvas,boxes[1]):null;
      return {crop,ticks,frames:boxes.map(b=>({x0:crop.x0+b.x0/scale,x1:crop.x0+b.x1/scale,y0:crop.y0+b.y0/scale,y1:crop.y0+b.y1/scale}))};
    }finally{canvas.width=canvas.height=0}
  }
  function resolve(figure,rows){
    const parts=figure.captionRows?.passages;
    if(!parts||!/\b(?:Hubble diagram|distance modul(?:us|i))\b/i.test(figure.caption)||!/\bresiduals?\b/i.test(parts.lower))return;
    const cap=clean(figure.caption);
    const reference=cap.match(/\b(?:best[- ]fit(?:ting|ted)?|reference|fiducial)\s+(?:([\p{L}\d]*CDM)\s+)?(?:cosmolog(?:y|ical model)|model)\b/iu);
    const cited=rows.flatMap((row,i)=>{
      if(!row.mentions?.includes(figure.matchKey)||row.fig)return [];
      let a=i,b=i;while(a>0&&i-a<3&&rows[a-1].page===row.page&&!rows[a-1].fig&&!rows[a-1].mentions?.length)a--;
      while(b+1<rows.length&&b-i<3&&rows[b+1].page===row.page&&!rows[b+1].fig&&!rows[b+1].mentions?.length)b++;
      const text=clean(rows.slice(a,b+1).map(r=>r.text).join(' '));
      const math=text.replace(/[~⃗\s]/g,'').replace(/µ/g,'μ').replace(/−/g,'-');
      const sign=/[∆Δ]μ=μ-μ(?:model|theory|pred)/i.test(math)?1:/[∆Δ]μ=μ(?:model|theory|pred)-μ(?![a-z])/i.test(math)?-1:0;
      const anchored=text.match(/(?:Given a vector of binned distance residuals|[^.!?]*[∆Δ][~⃗\s]*[μµ]\s*=).*?(?:distances from a cosmological model|$)/i);
      const line=rows.slice(a,b+1).find(r=>/[∆Δ].{0,12}[μµ]\s*=/.test(clean(r.text)));
      return sign?[{sign,page:row.page,text:anchored?.[0]?.trim()||row.text,anchor:line?.text}]:[];
    });
    const body=cited.length&&cited.every(m=>m.sign===cited[0].sign)?cited[0]:null;
    const nominal=cap.match(/\b(?:nominal|fiducial|reference)\s+(flat\s+)?([ΛL]CDM)\s+(?:cosmology|model)\b/i);
    const densities=nominal&&cap.match(/Ω\s*m\s*=\s*(0\.\d+)\s+and\s+Ω\s*Λ\s*=\s*(0\.\d+)/i);
    const scatter=cap.match(/\busing\s+(?:the\s+)?([A-Z]\d+)\s+scatter model/i)?.[1]||'';
    const magnitudeDifference=/cosmolog(?:y|ical model) (?:has been|is|was) subtracted from the [^.;]{0,100}(?:corrected|observed) [^.;]{0,30}magnitudes/i.test(parts.lower);
    figure.captionRows.residual={reference:reference?.[0]||nominal?.[0]||'',family:reference?.[1]||nominal?.[2]||'',densities:densities?.slice(1),flat:!!nominal?.[1],fitNodes:/piecewise[- ]linear function/i.test(parts.lower),body,scatter,magnitudeDifference,ticks:figure.captionRows.ticks,individual:/each (?:SN|supernova)\b/i.test(parts.upper),binned:!!body&&/\bbinned distance residual/i.test(body.text)};
  }
  function guide(r,lower){
    const reference=r.reference?/best/i.test(r.reference)?['最佳拟合宇宙学模型','best-fitting cosmology']:['图注所指的参考模型','reference model named in the caption']:['参考模型（名称待核对）','reference model (identity unverified)'];
    if(r.family){reference[0]+='（'+(r.flat?'平坦 ':'')+r.family+'）';reference[1]+=' ('+(r.flat?'flat ':'')+r.family+')'}
    const content=[['横轴 · 红移 z','Horizontal axis · redshift z','红移描述光在传播中波长拉长了多少。z = 0.1 表示我们收到的波长比发出时长 10%。向右看红移较大的超新星。读轴时以印刷刻度为准。','Redshift measures wavelength stretching. At z = 0.1, light reaches us with a wavelength 10% longer than when it was emitted. Move right for higher-redshift supernovae and use the printed ticks.']];
    if(r.ticks){
      const values=r.ticks.join(' → ');
      content[0][2]+=' 图上的 '+values+' 等距排列，每向右一大格，红移乘以 10。';
      content[0][3]+=' The equally spaced ticks '+values+' form a logarithmic scale. One major step right multiplies z by ten.';
    }
    if(!lower)content.push(['纵轴 · 距离模数 μ','Vertical axis · distance modulus μ',
      (r.individual?'每个点是一颗超新星。':'')+'距离模数用星等表达光度距离。把标准化后的视星等 m 减去绝对星等 M，得到 μ = m − M。μ 越大，推算的光度距离越远。相差 5 mag，距离相差 10 倍。',
      (r.individual?'Each point represents one supernova. ':'')+'Distance modulus expresses luminosity distance in magnitudes. Subtract the absolute magnitude M from the standardized apparent magnitude m. A larger μ means a greater inferred distance. A 5 mag difference corresponds to a factor of ten in distance.']);
    else if(r.body){
      const obsFirst=r.body.sign===1;
      content.push([obsFirst?'Δμ = μ观测 − μ模型':'Δμ = μ模型 − μ观测',obsFirst?'Observed minus predicted':'Predicted minus observed',
        '在同一红移，'+(obsFirst?'用超新星测得的距离模数减去':'用模型预测的距离模数减去')+(obsFirst?reference[0]+'预测的距离模数。':'超新星测得的距离模数。')+'相减为 0 就是吻合。点在零线上方时，观测推得的距离比模型预测的'+(obsFirst?'远':'近')+'。下方则相反。',
        (obsFirst?'Subtract the distance modulus predicted by the '+reference[1]+' from the measured modulus':'Subtract the measured distance modulus from the model prediction')+' at the same redshift. Zero means agreement. Above zero, the supernova implies a '+(obsFirst?'larger':'smaller')+' distance than the model predicts. Below zero, the ordering reverses.']);
    }else if(r.magnitudeDifference)content.push(['校正后的观测星等 − 模型星等','Corrected observed magnitude minus model magnitude','图注明确写出，从校正后的峰值星等中减去最佳拟合模型在同一红移的预测值。0 表示相等。正残差表示校正后的超新星比模型预期更暗。','The caption subtracts the best-fit prediction at the same redshift from the corrected peak magnitude. Zero means agreement. A positive residual means the corrected supernova is fainter than predicted.']);
    else content.push(['纵轴 · 距离残差','Vertical axis · distance residual','残差为 0 表示观测与参考预测相等。减法方向尚未由引用本图的正文公式核实，请在原文核对正负号。','Zero indicates agreement between observation and reference. The subtraction order still needs confirmation in the article before interpreting the sign.']);
    if(lower&&r.fitNodes)content.push(['怎样读相连的点','Reading the connected points','图注说明，连线的点是作者在对数红移上做分段线性拟合时使用的控制点，用于表示整组超新星的距离变化。','The caption identifies the connected points as controls of a piecewise-linear fit in log redshift. They describe the distances of the sample collectively.']);
    if(lower&&r.densities)content.push(['零线对应的参考模型','Model on the zero line',reference[0]+'采用 Ωₘ = '+r.densities[0]+'、ΩΛ = '+r.densities[1]+'，零表示观测与这个模型的预测吻合。','Zero denotes agreement with the '+reference[1]+', with Ωₘ = '+r.densities[0]+' and ΩΛ = '+r.densities[1]+'.']);
    else if(lower&&r.reference)content.push(['参考模型','Reference', '图注写的是'+reference[0]+'。'+(r.scatter?r.scatter+' 用于处理超新星亮度散布。':'')+'这段图注未给出参考曲线的一组完整宇宙学参数。','The caption specifies the '+reference[1]+'. '+(r.scatter?r.scatter+' describes supernova brightness scatter. ':'')+'The cited caption does not specify a full parameter set for the reference curve.']);
    if(lower&&r.binned)content.push(['单颗与分箱','Individual and binned residuals','正文公式描述按红移分箱后的距离残差。原图中标出的分箱点汇总同一红移区间的测量。拥挤区域的单颗数值和误差棒端点需要原始数据核对。','The article gives the equation for binned distance residuals. A binned point summarizes measurements in a redshift interval. Overlapping individual values and error-bar endpoints require the underlying data.']);
    return content;
  }
  window.ResidualReading={rasterPair,resolve,guide};
})();
