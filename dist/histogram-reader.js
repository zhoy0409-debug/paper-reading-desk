(() => {
  'use strict';
  const vendor=new URL('./vendor/ocr/',document.currentScript.src),file=n=>new URL(n,vendor).href;
  const midX=b=>(b.x0+b.x1)/2,midY=b=>(b.y0+b.y1)/2;
  const num=/^[−-]?\d+(?:[.,]\d+)?$/;
  // Detect closed plotting frames from continuous ink, independently of the caption.
  function frames(rgba,W,H){
    const ink=(x,y)=>{const i=4*(y*W+x);return Math.max(rgba[i],rgba[i+1],rgba[i+2])<170};
    const edges=[],minimum=Math.max(40,W*.19);
    for(let y=0;y<H;y++){
      for(let x=0;x<W;){
        if(!ink(x,y)){x++;continue}
        const start=x++;while(x<W&&ink(x,y))x++;
        if(x-start<minimum)continue;
        const prev=edges.slice(-12).find(r=>y-r.last<=2&&Math.abs(start-r.a)<=3&&Math.abs(x-1-r.b)<=3);
        if(prev)prev.last=y;else edges.push({a:start,b:x-1,y,last:y});
      }
    }
    const result=[];
    function wall(x,y,bottom){
      let dark=0,n=0;
      for(let j=y;j<=bottom;j+=2){n++;if([-2,-1,0,1,2].some(d=>x+d>=0&&x+d<W&&ink(x+d,j)))dark++}
      return dark/n>.88;
    }
    for(const top of edges){
      const bottom=edges.filter(e=>e.y-top.y>Math.max(35,H*.14)&&Math.abs(e.a-top.a)<=4&&Math.abs(e.b-top.b)<=4&&
        wall(top.a,top.last,e.y)&&wall(top.b,top.last,e.y)).at(-1);
      if(!bottom)continue;
      const box={x0:top.a,x1:top.b,y0:top.y,y1:bottom.last};
      if(result.some(r=>box.x0>=r.x0-4&&box.x1<=r.x1+4&&box.y0>=r.y0-4&&box.y1<=r.y1+4))continue;
      result.push(box);
    }
    if(result.length>8)return [];
    return result.sort((a,b)=>Math.abs(a.y0-b.y0)<H*.05?a.x0-b.x0:a.y0-b.y0);
  }
  function peak(data,W,b){
    const values=[],span=b.x1-b.x0,h=b.y1-b.y0;
    for(let x=b.x0+3;x<b.x1-2;x++){
      let y=b.y1-3;
      for(;y>b.y0+1;y--){const i=4*(y*W+x);if(Math.min(data[i],data[i+1],data[i+2])>160)break}
      values.push(b.y1-3-y);
    }
    if(values.filter(v=>v>h*.06).length<span*.09||values.filter(v=>v>h*.94).length>span*.4)return null;
    // Isolated grid lines are too narrow to identify a modal region.
    const width=Math.max(3,Math.round(span*.022)),blocks=[];
    for(let i=0;i+width<=values.length;i+=width)blocks.push(values.slice(i,i+width).reduce((a,b)=>a+b,0)/width);
    const max=Math.max(...blocks),tops=blocks.map((v,i)=>v>max*.9?i:-1).filter(i=>i>=0);
    if(max<h*.13||!tops.length||tops.at(-1)-tops[0]>blocks.length*.18)return null;
    const pos=(tops[0]+tops.at(-1)+1)/(2*blocks.length);
    const where=pos<.33?['较低取值一侧','lower-value end']:pos>.67?['较高取值一侧','higher-value end']:['中段','middle'];
    return {zh:'按柱形目测，较高的柱集中在横轴'+where[0]+'。原始频数和精确峰值仍需核对。',en:'Visually, taller bars cluster toward the '+where[1]+' of the x range. Exact bin counts and the peak value need checking.'};
  }
  function create(session,preferences,save){
    let worker=null,creating=null,chain=Promise.resolve(),closed=false,version=0;
    const cache=new Map(),lastMetric=preferences.histogramMetrics ||= {};
    const previews=new Map();
    function preview(body,page,box,crop,label){
      const frame=document.createElement('button'),canvas=document.createElement('canvas');
      frame.type='button';frame.className='hist-loupe';frame.hidden=true;
      frame.setAttribute('aria-label','放大所选小图 / Enlarge selected plot · '+label);
      frame.setAttribute('aria-pressed','false');
      const caption=PaperUI.set(document.createElement('small'),'放大小图','Enlarge plot');
      frame.append(canvas,caption);body.append(frame);
      const toggle=()=>{
        const expanded=frame.getAttribute('aria-pressed')!=='true';
        frame.setAttribute('aria-pressed',String(expanded));
        PaperUI.set(caption,expanded?'缩回小图':'放大小图',expanded?'Reduce plot':'Enlarge plot');
        frame.setAttribute('aria-label',(expanded?'缩回小图 / Reduce plot':'放大小图 / Enlarge selected plot')+' · '+label);
      };
      // Touch browsers can suppress the synthesized click after the source pane scrolls.
      let start=null;
      frame.onpointerdown=e=>{if(e.pointerType==='touch'&&e.isPrimary)start={x:e.clientX,y:e.clientY,id:e.pointerId}};
      frame.onpointercancel=()=>{start=null};
      frame.onpointerup=e=>{
        if(start?.id===e.pointerId&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<8)toggle();
        start=null;
      };
      frame.onclick=e=>{if(e.pointerType!=='touch'&&!e.sourceCapabilities?.firesTouchEvents)toggle()};
      const region={x:box.x+crop.x*box.width,y:box.y+crop.y*box.height,width:crop.width*box.width,height:crop.height*box.height};
      const key=JSON.stringify([page,region]);
      setTimeout(async()=>{
        if(!frame.isConnected||closed)return;
        try{
          if(!previews.has(key)){
            if(previews.size>=8)previews.delete(previews.keys().next().value);
            previews.set(key,session.renderRegion(page,region,{quality:'slide'}));
          }
          const pic=await previews.get(key);if(pic.mode!=='crop'||!frame.isConnected)return;
          const bm=await createImageBitmap(pic.blob);
          try{
            if(!frame.isConnected)return;
            const scale=Math.min(1,850/bm.width,500/bm.height);
            canvas.width=Math.max(1,Math.round(bm.width*scale));canvas.height=Math.max(1,Math.round(bm.height*scale));
            canvas.getContext('2d').drawImage(bm,0,0,canvas.width,canvas.height);frame.hidden=false;
          }finally{bm.close()}
        }catch{previews.delete(key)}
      },80);
    }
    async function getWorker(){
      if(!creating){
        creating=import(file('tesseract.esm.min.js')).then(async({default:ocr})=>{
          if(closed)throw Error('Closed');
          const w=await ocr.createWorker('eng',1,{workerPath:file('worker.min.js'),corePath:file('tesseract-core-lstm.wasm.js'),
            langPath:vendor.href,workerBlobURL:false,cacheMethod:'none'});
          if(closed){await w.terminate();throw Error('Closed')}
          worker=w;await w.setParameters({tessedit_pageseg_mode:'11'});return w;
        }).catch(e=>{creating=null;throw e});
      }return creating;
    }
    async function ocrLines(canvas,digits=false,labelsOnly=false){
      const w=await getWorker();
      await w.setParameters({tessedit_pageseg_mode:digits?'6':'11',tessedit_char_whitelist:digits?'0123456789.-,':''});
      const {data}=await w.recognize(canvas,{}, {blocks:true});
      return (data.blocks||[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>{
        // Sparse OCR sometimes joins two titles on the same line. Split at a large gutter.
        const lines=[];
        for(const word of l.words){
          // A colour key often becomes an isolated low-confidence OCR glyph.
          // Keep its pixels for hit testing, but do not merge it into the series name.
          if(labelsOnly&&word.confidence<65&&!/[\p{L}\p{N}]{2}/u.test(word.text))continue;
          const b=word.bbox,prev=lines.at(-1);
          const numericPeer=labelsOnly&&prev&&/^(?:mock|control|vehicle|baseline|WT)$/i.test(prev.text)&&/^\d{3,8}$/.test(word.text);
          if(numericPeer){prev.category=true;lines.push({...b,text:word.text,conf:word.confidence,category:true});continue}
          if(prev&&b.x0-prev.x1<(b.y1-b.y0)*1.25){
            prev.text+=' '+word.text;
            prev.x0=Math.min(prev.x0,b.x0);prev.x1=Math.max(prev.x1,b.x1);
            prev.y0=Math.min(prev.y0,b.y0);prev.y1=Math.max(prev.y1,b.y1);
            prev.conf=Math.min(prev.conf,word.confidence);
          }else lines.push({...b,text:word.text,conf:word.confidence});
        }
        return lines;
      })));
    }
    async function analyze(page,box){
      const pic=await session.renderRegion(page,box,{quality:'slide'});
      if(pic.mode!=='crop')return [];
      const bitmap=await createImageBitmap(pic.blob),c=document.createElement('canvas');
      const scale=Math.min(1,1350/bitmap.width,1450/bitmap.height);
      c.width=Math.round(bitmap.width*scale);c.height=Math.round(bitmap.height*scale);
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,c.width,c.height);bitmap.close();
      const W=c.width,H=c.height,pixels=ctx.getImageData(0,0,W,H).data;
      const grid=HistogramGrid.detect(pixels,W,H),plots=grid.length?grid:frames(pixels,W,H);
      if(!plots.length)return [];
      const vector=await session.chartText(page,box);
      const text=vector.map(t=>({...t,x0:t.x0*W,x1:t.x1*W,y0:t.y0*H,y1:t.y1*H,conf:100}));
      let ocrFailed=false;
      const raster=!text.some(t=>!t.rotate&&num.test(t.text));
      if(raster){
        ctx.fillStyle='white';for(const b of plots)ctx.fillRect(b.x0-1,b.y0-1,b.x1-b.x0+3,b.y1-b.y0+3);
        try{text.push(...await ocrLines(c))}catch{ocrFailed=true}
      }
      if(grid.length)HistogramGrid.annotate(grid,text,W,H);
      const charts=[];
      for(const [i,b] of plots.entries()){
        const w=b.x1-b.x0,h=b.y1-b.y0;
        const words=text.filter(t=>t.conf>=60&&!t.rotate), near=words.filter(t=>midX(t)>b.x0&&midX(t)<b.x1&&/[a-zA-Z]{2}/.test(t.text)&&t.conf>=72);
        function label(lines){return lines.length===1?lines[0].text.trim():''}
        const title=label(near.filter(t=>t.y1<=b.y0+3&&midY(t)>b.y0-h*.17));
        const x=label(near.filter(t=>t.y0>b.y1+3&&t.y1<b.y1+h*.25&&!/^\s*\([a-z]\)/i.test(t.text)&&!grid.some(q=>q.print===t)));
        const leftmost=Math.max(b.x0-w*.23,...plots.filter(q=>q.x1<b.x0&&midY(q)>b.y0&&midY(q)<b.y1).map(q=>q.x1+1));
        const side=text.filter(t=>t.x1<=b.x0+1&&t.x0>=leftmost&&midY(t)>=b.y0-12&&midY(t)<=b.y1+6);
        let y=label(side.filter(t=>t.rotate&&t.conf>=72&&/[a-z]{2}/i.test(t.text)));
        let numeric=side.filter(t=>!t.rotate&&num.test(t.text)&&t.conf>=64);
        if(raster&&!ocrFailed&&!grid.length){
          const gutter=document.createElement('canvas'),x0=Math.max(0,Math.ceil(leftmost)),y0=Math.max(0,b.y0-16);
          const gw=b.x0-x0-2,gh=Math.min(H,b.y1+13)-y0;
          if(gw>6&&gh>15){
            gutter.width=gw+36;gutter.height=gh+36;
            const g=gutter.getContext('2d');g.fillStyle='white';g.fillRect(0,0,gutter.width,gutter.height);
            g.drawImage(c,x0,y0,gw,gh,18,18,gw,gh);
            const local=(await ocrLines(gutter,true)).filter(t=>num.test(t.text)&&t.conf>=65);
            if(local.length>numeric.length)numeric=local;
            if(!y){
              const rotated=document.createElement('canvas');
              rotated.width=gutter.height;rotated.height=gutter.width;
              const rc=rotated.getContext('2d');
              rc.translate(rotated.width,0);rc.rotate(Math.PI/2);rc.drawImage(gutter,0,0);
              const candidates=(await ocrLines(rotated)).filter(t=>t.conf>=82&&/[A-Za-z]{3,}/.test(t.text)&&midX(t)>rotated.width*.2&&midX(t)<rotated.width*.8);
              y=label(candidates);
            }
          }
        }
        numeric.sort((a,b)=>midY(b)-midY(a));
        const ticks=numeric.map(t=>Number(t.text.replace('−','-').replace(',','.')));
        const ordered=ticks.length>=2&&ticks.every((v,i)=>i===0||v>ticks[i-1]);
        charts.push({title:grid.length?b.print?.text||'':title,x,y:grid.length?'':y,ticks:grid.length?[]:ordered?ticks:[],peak:peak(pixels,W,b),ocrFailed,only:plots.length===1,
          group:b.group,groupBox:b.groupBox,groupLabel:b.groupLabel,row:b.row,col:b.col,shared:b.shared,crop:b.crop,
          rect:{x:b.x0/W,y:b.y0/H,width:w/W,height:h/H},position:plots.length===1?'':plots.length===2&&Math.min(plots[0].y1,plots[1].y1)>Math.max(plots[0].y0,plots[1].y0)+h*.6?(i?'右':'左'):String(i+1)});
      }
      return charts;
    }
    function reset(){++version}
    function show(host,f,p,scope,box,focus,showRegions,report){
      const mine=++version;
      const ui=(tag,zh,en)=>PaperUI.set(document.createElement(tag),zh,en);
      const root=document.createElement('section');root.className='hist-reading panel-reading';host.append(root);
      root.setAttribute('aria-label','直方图精读 / Histogram reading');
      const status=ui('p','正在本机读取绘图区和轴标签…','Reading plot frames and labels locally…');status.setAttribute('role','status');root.append(status);
      const found=!p&&f.openHistogram,savedLayout=report?.layout();
      const useSaved=found&&savedLayout&&preferences.histogramLayoutMode?.[f.id]==='manual';
      const layout=found?(useSaved?savedLayout:null):savedLayout,configure=()=>root.append(HistogramGrid.layoutControl(layout,report.drawLayout));
      if(found)box ||= {x:0,y:0,width:1,height:1};
      if(layout)box ||= {x:0,y:0,width:1,height:1};
      if(scope.uncertain&&!layout){
        PaperUI.set(status,'图注涉及多个小图或多个维度。请在原图定位具体小图，再核对横轴、纵轴和颜色各表示什么。','This caption spans multiple panels or dimensions. Locate the individual plot and check what its axes and colours encode.');
        if(report)configure();
        return;
      }
      if(scope.peers?.length)root.prepend(ui('strong',scope.peers[scope.index],'Selected condition'));
      const uncertain=()=>{PaperUI.set(status,'绘图区待核对。可在原页检查图框、横纵轴和分箱。','Plot bounds unresolved. Inspect the axes and bins on the original page.')};
      if(!box){uncertain();if(report)configure();return}
      const k=JSON.stringify([f.page,box]);
      if(!layout&&!found&&!cache.has(k)){
        const job=chain.then(()=>closed||mine!==version?null:analyze(f.page,box));chain=job.catch(()=>{});
        if(cache.size>20)cache.delete(cache.keys().next().value);
        cache.set(k,job);job.then(r=>{if(r===null&&cache.get(k)===job)cache.delete(k)},()=>{if(cache.get(k)===job)cache.delete(k)});
      }
      const result=layout?Promise.resolve(HistogramGrid.manualCells(layout)):found?Promise.resolve(OpenHistograms.charts(found,box)):cache.get(k);
      result.then(plots=>{
        if(closed||mine!==version||!root.isConnected)return;
        if(plots===null){cache.delete(k);show(host,f,p,scope,box,focus,showRegions,report);root.remove();return}
        const unlocated=!plots.length;
        if(unlocated){
          uncertain();if(!scope.manual){if(report)configure();return}
          plots=[{title:'',x:'',y:'',ticks:[],only:true,rect:{x:0,y:0,width:1,height:1}}];
        }
        root.replaceChildren();const nav=document.createElement('div');nav.className='hist-tabs';
        if(unlocated)root.append(status);
        const body=document.createElement('div');body.className='hist-detail';root.append(nav,body);
        if(found?.partial&&!layout)root.prepend(ui('p','仅定位到部分绘图区，可在 PDF 原页核对整组。','Only some plots were located. Check the full array on the PDF page.'));
        if(found&&savedLayout){
          const switcher=ui('button',layout?'使用自动定位':'查看我保存的网格',layout?'Use detected plots':'Open my saved grid');
          switcher.type='button';switcher.className='frw-inline';root.append(switcher);
          switcher.onclick=()=>{
            (preferences.histogramLayoutMode ||= {})[f.id]=layout?'auto':'manual';save();
            root.remove();show(host,f,p,scope,box,focus,showRegions,report);
          };
        }
        if(layout){
          root.prepend(ui('p','读者设定的等分网格。点原图核对每格的内容和边界。','Reader-defined grid. Check each cell against the original.'));
          configure();
        }else if(report&&!p&&(found||plots[0].group===undefined))configure();
        nav.setAttribute('role','group');nav.setAttribute('aria-label','选择直方图 / Select histogram');
        const dense=plots[0].group!==undefined;
        const names=plots.map((c,i)=>{
          if(c.dual&&c.conditions)return HistogramMatrix.position(c)+' · '+HistogramMatrix.settings(c);
          return unlocated?'手选区域':dense?(c.title||('R'+(c.row+1)+' · C'+(c.col+1))):c.position==='左'?'左侧直方图':c.position==='右'?'右侧直方图':'直方图 '+(i+1);
        });
        const makeKey=(base,rect)=>JSON.stringify([f.id,f.page,p?.id||'',...[base,rect].flatMap(b=>['x','y','width','height'].map(k=>Math.round(b[k]*1e5)))]);
        const oldPositions=new Set([...(preferences.plotComparisons?.[f.id]||[]),preferences.gridSpots?.[f.id],...Object.keys(preferences.axisCorrections||{})]);
        const plotKey=c=>{
          // A previously partial figure used page-relative keys. Keep its
          // saved comparison, edits and queued slide when the plate grows.
          if(c.conditions&&c.pageTickRect){
            const prior=makeKey({x:0,y:0,width:1,height:1},c.pageTickRect);
            if(oldPositions.has(prior)||report?.queued(prior))return prior;
          }
          return makeKey(c.keyBase||box,c.keyRect||c.rect);
        };
        let controls;
        const open=!!plots[0].open;
        const recent=preferences.plotComparisons?.[f.id]||[];
        let selected=open?plots.findIndex(q=>plotKey(q)===recent[1]):-1;
        let previous=open?plots.findIndex(q=>plotKey(q)===recent[0]):-1;
        if(dense){
          controls=HistogramGrid.navigator(plots,names,i=>choose(i,true));nav.append(controls.node);
        }
        function choose(i,clicked){
          const c=plots[i],id=plotKey(c),values=preferences.axisCorrections?.[id];
          if(open&&clicked&&selected!==i){
            previous=selected;selected=i;
            (preferences.plotComparisons ||= {})[f.id]=[previous>=0?plotKey(plots[previous]):'',id];
          }
          const peer=open&&selected===i&&previous>=0&&previous!==i?plots[previous]:null;
          const groupKey=dense?plotKey({rect:c.groupBox,keyBase:c.keyBase,keyRect:c.keyGroup}):'';
          const changedX=values?.x&&values.x.toLowerCase()!==(c.x||c.title||'').toLowerCase();
          const evidence=layout?{caption:'',peers:[],page:f.page}:scope;
          const chart=layout?{...c,title:''}:c;
          const reading=HistogramEvidence.explain(evidence,changedX?{...chart,x:values.x,only:false}:chart);
          if(open){
            const corrected=(plot,edits)=>edits?.y?{...plot,y:edits.y}:plot;
            const peerEdits=peer&&preferences.axisCorrections?.[plotKey(peer)];
            reading.rows=c.conditions?HistogramMatrix.reading(c,peer,evidence.caption,f.binningEvidence):
              BinningReading.rowsFor(corrected(c,values),peer&&corrected(peer,peerEdits),f.binningEvidence);
          }
          if(dense&&!layout&&c.groupLabel&&c.title){
            const same=plots.some(q=>q.group!==c.group&&q.title===c.title);
            reading.rows.unshift({zh:'比较对象',en:'Comparison',content:{
              zh:'当前小图标为「'+c.title+'」，位于「'+c.groupLabel+'」组。'+(same?'换到另一组并保留这个小图名，可比较同一项目在两组中的分布。':'同组切换小图，可对照各图的标签和柱形。'),
              en:'“'+c.title+'” appears in the group “'+c.groupLabel+'”. '+(same?'Choose the same plot in another group to compare distributions.':'Compare the labelled plots within this group.')}});
          }
          if(c.shared?.some(s=>s.kind==='y')){
            const axis=c.shared.find(s=>s.kind==='y'),row=reading.rows.find(r=>r.zh.startsWith('纵轴'));
            row.zh='纵轴 · 组旁标注';row.en='Vertical axis · group label';
            row.content=HistogramEvidence.sharedAxis(axis.label);
          }
          if(c.shared?.some(s=>s.kind==='x')){
            const label=c.shared.find(s=>s.kind==='x').label,row=reading.rows.find(r=>r.zh.startsWith('横轴'));
            row.zh='横轴 · 组下标注';row.en='Horizontal axis · group label';
            row.content={zh:'本组下方印有「'+label+'」。可定位到该标注核对适用范围。',en:'“'+label+'” appears beneath this group. Locate it to check its scope.'};
          }
          HistogramAxes.apply(reading,c,values);
          if(clicked){
            lastMetric[f.id]=(c.x||c.title||'').toLowerCase();
            if(dense&&!open)(preferences.gridSpots ||= {})[f.id]=id;
            save();
          }
          const highlight=()=>focus(c.rect,(p?.label||f.label)+' · '+names[i],true,peer?.rect);
          focus(c.rect,(p?.label||f.label)+' · '+names[i],clicked,peer?.rect);
          if(dense)controls.select(i);else [...nav.children].forEach((b,n)=>b.setAttribute('aria-pressed',String(i===n)));
          body.replaceChildren();
          if(dense){
            if(open){
              const band=document.createElement('div');band.className='hist-pair';band.classList.toggle('paired',!!peer);
              const slot=(chart,role,translation)=>{
                const item=document.createElement('div');item.append(ui('strong',role,translation),
                  ui('span',chart.conditions?HistogramMatrix.position(chart):chart.title||(chart.x?'横轴 '+chart.x:'标题待核对'),chart.conditions||chart.title?'':chart.x?'X axis':'Unconfirmed title'));
                preview(item,f.page,box,chart.crop,chart.title);
                if(chart.dual){
                  const d=chart.dual,reported=d.reported,tag=d.symbol+' = '+d.at;
                  const estimate=Number.isFinite(d.estimate)?(Math.round(d.estimate*20)/20).toFixed(2):'';
                  const readout=ui('small',estimate?'按点高估读约 '+estimate+'（右轴）':'点高待核对，图中无法可靠估数',
                    estimate?'About '+estimate+' on the right axis (visual estimate)':'Point height unresolved on the plot');
                  readout.className='dual-readout';item.append(readout);
                  if(chart.leftScale){
                    const scale=ui('button','看柱子的左轴','Locate bar scale');
                    scale.type='button';scale.className='frw-inline dual-left';
                    scale.onclick=()=>focus(chart.leftScale,(chart.y||'左轴')+' · Left axis',true,peer?.rect,c.rect);
                    item.append(scale);
                  }
                  if(chart.rightScale){
                    const guide=ui('button',chart.axisGuide?'沿点顶看右轴':'定位右轴刻度',chart.axisGuide?'Trace to right axis':'Locate right scale');
                    guide.type='button';guide.className='frw-inline dual-guide';
                    guide.onclick=()=>focus(chart.axisGuide||chart.rightScale,tag+' · '+(estimate?'≈ '+estimate:'右轴 / Right axis'),true,peer?.rect,c.rect);
                    item.append(guide);
                  }
                  if(reported){
                    const text=reported.printed,percent=Math.round(Number(text)*10000)/100;
                    item.append(ui('small','原表报告 '+text+'。'+(Number(text)===0?'零为表中显示的精度。':'模型给“'+tag+'”的后验权重为 '+percent+'%。'),
                      'The table reports '+text+(Number(text)===0?' at its printed precision.':', or '+percent+'% posterior weight on '+tag+'.')));
                    const source=ui('button','看表 '+d.table+' 的这个数 · p.'+reported.page,'Locate table value');
                    source.type='button';source.className='frw-inline dual-table';
                    source.onclick=()=>report.source(reported.page,null,reported.region);item.append(source);
                  }else if(d.table)item.append(ui('small','表 '+d.table+' 的对应数值待核对。','Matching table entry unverified.'));
                }
                if(chart.conditions){
                  const parameters=document.createElement('small');
                  for(const [k,v] of Object.entries(chart.conditions)){
                    if(parameters.childNodes.length)parameters.append(', ');
                    const other=chart===c?peer:c;
                    const text=k+' = '+v;
                    if(other&&Number(other.conditions[k])!==Number(v)){
                      const value=document.createElement('b');value.textContent=text;parameters.append(value);
                    }else parameters.append(text);
                  }
                  item.append(parameters);
                }
                if(chart.conditionsUnclear)item.append(ui('small','图注中的参数还不能可靠对应到每一格。','Caption settings could not be assigned to individual cells.'));
                if(chart.edgeCheck)item.append(ui('small','裁切边界按刻度估计，请核对两端。','Crop estimated from ticks. Check both ends on the original.'));
                if(peer&&chart.y){
                  const ticks=chart.ticks.length?' · '+chart.ticks.join(', '):'';
                  item.append(ui('small','纵轴 '+chart.y+ticks,'Printed y scale'));
                }
                if(peer){
                  for(const method of BinningReading.references(chart,f.binningEvidence)){
                    item.append(ui('small',method.zh+'（p.'+method.page+'）',method.en+' (p.'+method.page+')'));
                  }
                }
                band.append(item);
              };
              if(peer)slot(peer,'上一次点选','Previous');
              slot(c,'当前小图','Selected');body.append(band);
              if(c.tightAxes||peer?.tightAxes)body.append(ui('small','相邻小图的轴字很近，裁切边缘可能带入邻格刻度。点预览下的读轴按钮可在整图上定位。','Neighbouring labels touch the crop edges. Use the axis buttons to locate each scale on the full figure.'));
              if(!peer)body.append(c.conditions?ui('small','再点同一行或同一列，比较参数和柱形。','Click another plot in this row or column to compare settings and shapes.'):ui('small','在原图上依次点两张小图，对照它们的分箱。','Click two plots on the figure to compare their bins.'));
            }else preview(body,f.page,box,c.crop,names[i]);
            const context=document.createElement('div');context.className='hist-context';
            for(const s of [...c.shared,...(report?.legends(groupKey)||[])]){
              const label={y:['看共用纵轴','Y label'],x:['看共用横轴','X label'],group:['看组标题','Heading'],legend:['看已选图例','Saved legend']}[s.kind];
              const button=ui('button',...label);
              button.type='button';button.title=s.label;button.onclick=()=>focus(s.rect,s.label,true);context.append(button);
            }
            const back=ui('button','定位小图','Locate plot');back.type='button';back.onclick=highlight;context.append(back);
            const legend=ui('button','框选本组图例','Select group legend');legend.type='button';
            legend.onclick=()=>{choose(i,true);report.drawLegend(groupKey)};
            context.append(legend);body.append(context);
          }
          const dl=document.createElement('dl');
          for(const row of reading.rows){dl.append(ui('dt',row.zh,row.en));const dd=document.createElement('dd');dd.textContent=row.content.zh;
            const en=document.createElement('small');en.className='ui-en';en.lang='en';en.textContent=row.content.en;dd.append(en);dl.append(dd)}
          body.append(dl);
          if(open){
            const refs=BinningReading.references(c,f.binningEvidence);
            if(c.dual&&f.binningEvidence?.zeroRegime)refs.push(f.binningEvidence.zeroRegime);
            if(c.conditions)for(const term of Object.values(f.binningEvidence?.parameterTerms||{})){
              if(!refs.some(r=>r.page===term.page&&r.quote===term.quote))refs.push({name:'参数定义',...term});
            }
            if(peer)for(const ref of BinningReading.references(peer,f.binningEvidence)){
              if(!refs.some(r=>r.name===ref.name&&r.page===ref.page))refs.push(ref);
            }
            if(peer&&f.binningEvidence?.rounding)refs.push({name:'取整记录',...f.binningEvidence.rounding});
            for(const r of refs){
              const link=ui('button',r.name+' · 正文 p.'+r.page,'Read source in paper');
              link.type='button';link.className='frw-inline';link.onclick=()=>report.source(r.page,r.quote);body.append(link);
            }
          }
          body.append(HistogramAxes.editor(c,values,next=>{
            const edits=preferences.axisCorrections ||= {};
            if(next)edits[id]=next;else delete edits[id];
            const ok=save();choose(i,false);
            const message=ok===false?ui('p','本机存储写入失败','Local save failed'):next?ui('p','已保存本图校正','Plot correction saved'):ui('p','已恢复自动识别','Detected labels restored');
            message.setAttribute('role','status');body.querySelector('.hist-axes').after(message);
            body.querySelector('.hist-axes summary').focus({preventScroll:true});
          }));
          if(dense&&report){
            const action=ui('button','加入汇报','Add plot to slides');action.type='button';action.className='hist-add';
            action.disabled=report.queued(id);if(action.disabled)PaperUI.set(action,'已加入汇报','Added to slides');
            action.onclick=()=>{
              const y=c.shared.find(s=>s.kind==='y');
              const source=[c.groupLabel,c.title].filter(Boolean).join(' · ');
              let sentence=c.conditions?HistogramMatrix.position(c)+' · '+HistogramMatrix.settings(c):open?BinningReading.narration(c,f.binningEvidence):layout?'':source+(y?'。组旁纵轴标为「'+y.label+'」。':'');
              if(c.dual?.reported)sentence+='。表 '+c.dual.table+' 报告 '+c.dual.symbol+' 恰好等于 '+c.dual.at+' 的后验权重为 '+c.dual.reported.printed+'。';
              report.add(id,[c.groupLabel,names[i]].filter(Boolean).join(' · '),c.crop,c.shared,groupKey,sentence,open?'open':layout?'manual':'grid');choose(i,false);
            };
            body.append(action);
          }
          if(c.ocrFailed)body.append(ui('p','本地轴文字识别未完成，请对照原图。','Local axis recognition was unavailable.'));
          const source=document.createElement('details');source.className='panel-sources';source.append(ui('summary',(layout?'整图图注':'核对图注')+' · PDF p.'+scope.page,layout?'Figure caption':'Caption evidence'));
          for(const q of [reading.quote||scope.caption,reading.peerQuote].filter(Boolean)){const b=document.createElement('blockquote');b.textContent=q;source.append(b)}
          if(scope.caption)body.append(source);
          if(clicked&&!matchMedia('(prefers-reduced-motion: reduce)').matches)body.animate([{opacity:.45,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'});
        }
        if(!dense)plots.forEach((c,i)=>{const b=ui('button',names[i],unlocated?'Manual selection':c.position==='左'?'Left':c.position==='右'?'Right':'Plot '+(i+1));b.type='button';b.onclick=()=>choose(i,true);nav.append(b)});
        showRegions(plots.map((c,i)=>({rect:c.open?c.crop:c.rect,plotRect:c.rect,name:[c.groupLabel,names[i]].filter(Boolean).join(' · '),action:()=>choose(i,true)})));
        nav.onkeydown=e=>{
          if(dense)return;
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
          const i=[...nav.children].indexOf(document.activeElement);if(i<0)return;
          e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?plots.length-1:(i+(e.key==='ArrowRight'?1:-1)+plots.length)%plots.length;
          nav.children[next].focus();choose(next,true);
        };
        const matches=lastMetric[f.id]?plots.map((c,i)=>(c.x||c.title||'').toLowerCase()===lastMetric[f.id]?i:-1).filter(i=>i>=0):[];
        const saved=dense?plots.findIndex(c=>plotKey(c)===preferences.gridSpots?.[f.id]):-1;
        choose(open&&selected>=0?selected:saved>=0?saved:matches.length===1?matches[0]:0,false);
      }).catch(()=>{if(!closed&&mine===version)uncertain()});
    }
    // Most vertical chart labels read from bottom to top. Rotate only the two margins.
    // A rotated µ may be read as y. Only reuse a unit when the printed suffix also matches.
    function matchedExtent(canvas,horizontal,strip,line){
      const candidate=/^([xy]):(\d+)\((\d+(?:\.\d+)?)[µμuy]m\)$/i.exec(line.text.replace(/\s/g,''));
      if(!candidate)return null;
      const ref=horizontal.find(l=>{
        const m=/^([xy]):(\d+)\((\d+(?:\.\d+)?)[µμu]m\)$/i.exec(l.text.replace(/\s/g,''));
        return l.conf>=65 && m && m[1].toLowerCase()!==candidate[1].toLowerCase() && m[2]===candidate[2] && m[3]===candidate[3];
      });
      if(!ref)return null;
      const width=160,height=28;
      function mask(source,b){
        const c=document.createElement('canvas');c.width=width;c.height=height;
        const ctx=c.getContext('2d');ctx.drawImage(source,b.x0,b.y0,b.x1-b.x0,b.y1-b.y0,0,0,width,height);
        return ctx.getImageData(0,0,width,height).data;
      }
      const a=mask(canvas,ref),b=mask(strip,line);
      let best=0;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
        let common=0,total=0,unitCommon=0,unitTotal=0;
        for(let y=2;y<height-2;y++)for(let x=32;x<width-2;x++){
          const inkA=a[4*(y*width+x)]<140,inkB=b[4*((y+dy)*width+x+dx)]<140;
          if(inkA||inkB)total++;
          if(inkA&&inkB)common++;
          if(x>=width*.76){if(inkA||inkB)unitTotal++;if(inkA&&inkB)unitCommon++}
        }
        if(total>80&&unitTotal>24)best=Math.max(best,Math.min(common/total,unitCommon/unitTotal));
      }
      return best>=.68?candidate[1]+':'+candidate[2]+'('+candidate[3]+' µm)':null;
    }
    async function verticalLabels(canvas,horizontal,isCurrent){
      const labels=[];
      const band=Math.max(1,Math.ceil(canvas.width*.22));
      const strip=document.createElement('canvas');strip.width=canvas.height;strip.height=band;
      const ctx=strip.getContext('2d');
      try{
        for(const start of [0,canvas.width-band]){
          for(const down of (start?[true,false]:[false,true])){
            if(!isCurrent())return labels;
            if(down)ctx.setTransform(0,-1,1,0,0,start+band);
            else ctx.setTransform(0,1,-1,0,canvas.height,-start);
            ctx.drawImage(canvas,0,0);
            const found=[];
            for(const line of await ocrLines(strip)){
              if(line.x1-line.x0<(line.y1-line.y0)*2.1||!/[a-zµμ]{2}/i.test(line.text))continue;
              const text=line.conf>=70?line.text.trim():matchedExtent(canvas,horizontal,strip,line);
              if(!text)continue;
              found.push({text,rotate:true,
                x0:(down?start+band-line.y1:start+line.y0)/canvas.width,
                x1:(down?start+band-line.y0:start+line.y1)/canvas.width,
                y0:down?line.x0/canvas.height:1-line.x1/canvas.height,
                y1:down?line.x1/canvas.height:1-line.x0/canvas.height});
            }
            if(found.length){labels.push(...found);break}
          }
        }
      }finally{strip.width=strip.height=0}
      return labels;
    }
    async function readOutlinedKeys(canvas,isCurrent){
      const boxes=PrintedLegend.outlinedKeys(canvas);
      if(!boxes.length)return [];
      const W=canvas.width,H=canvas.height,worker=await getWorker(),result=[];
      const ctx=canvas.getContext('2d',{willReadFrequently:true}),pix=ctx.getImageData(0,0,W,H).data;
      await worker.setParameters({tessedit_pageseg_mode:'7',tessedit_char_whitelist:''});
      for(const b of boxes){
        if(!isCurrent())break;
        const x0=Math.min(W,b.r+2),yt=Math.max(0,Math.floor(b.t-b.h*.17)),yb=Math.min(H,Math.ceil(b.b+b.h*.17));
        let first=-1,last=-1;
        for(let x=x0;x<Math.min(W,b.r+b.h*13);x++){
          let ink=0;for(let y=yt;y<yb;y++){const k=4*(y*W+x);if(Math.max(pix[k],pix[k+1],pix[k+2])<145)ink++}
          if(ink){if(first<0)first=x;last=x}
          if((last<0?x-b.r:x-last)>b.h*.65)break;
        }
        if(first<0||last-first<3)continue;
        const region=document.createElement('canvas'),scale=Math.max(1,Math.min(4,36/b.h)),pad=10;
        region.width=Math.ceil((last-first+1)*scale)+2*pad;region.height=Math.ceil((yb-yt)*scale)+2*pad;
        const g=region.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,region.width,region.height);
        g.drawImage(canvas,first,yt,last-first+1,yb-yt,pad,pad,(last-first+1)*scale,(yb-yt)*scale);
        const {data}=await worker.recognize(region,{}, {blocks:true});region.width=region.height=0;
        const line=data.blocks?.[0]?.paragraphs?.[0]?.lines?.[0],name=line?.text.trim(),bb=line?.bbox;
        if(!bb||line.confidence<56||!name||name.length>68||!/[\p{L}]{2}/u.test(name))continue;
        const chart={name,color:b.open?'#222222':b.color,open:b.open,swatch:true,solidBox:true,context:{axes:[],yName:'',caption:''}};
        result.push({text:name,x0:(first+(bb.x0-pad)/scale)/W,x1:(first+(bb.x1-pad)/scale)/W,y0:(yt+(bb.y0-pad)/scale)/H,y1:(yt+(bb.y1-pad)/scale)/H,chart:{...chart,kind:'legend'}},
          {text:name,x0:b.l/W,x1:b.r/W,y0:b.t/H,y1:b.b/H,chart:{...chart,kind:'symbol'}});
      }
      // Reject lone apparent keys inside the plot when their supposed partner has no legible name.
      const symbols=result.filter(k=>k.chart.kind==='symbol');
      const accepted=symbols.filter(a=>symbols.some(b=>b!==a&&b.text!==a.text&&
        Math.abs(a.x0-b.x0)<(a.x1-a.x0)*.2&&Math.abs((a.x1-a.x0)-(b.x1-b.x0))<(a.x1-a.x0)*.25&&
        Math.abs(a.y0-b.y0)<(a.y1-a.y0)*3.8&&Math.abs(a.y0-b.y0)>(a.y1-a.y0)*.8));
      return result.filter(k=>accepted.some(s=>s.text===k.text&&Math.abs(s.y0-k.y0)<s.y1-s.y0));
    }
    const labelCache=new Map();
    function panelLabels(page,box,isCurrent,{canvas,onLabels}={}){
      const key=JSON.stringify([page,box]);
      if(labelCache.has(key))return Promise.resolve(labelCache.get(key));
      const job=chain.then(async()=>{
        if(closed||!isCurrent())return [];
        let c=canvas;
        if(!c){
          const pic=await session.renderRegion(page,box,{quality:'slide'});
          if(!isCurrent()||pic.mode!=='crop')return [];
          const bitmap=await createImageBitmap(pic.blob);
          c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
          try{c.getContext('2d').drawImage(bitmap,0,0)}finally{bitmap.close()}
        }
        try{
          let lines=await ocrLines(c,false,true);
          if(!isCurrent())return [];
          const asLabels=lines=>lines.filter(l=>l.conf>=65&&(l.category||/[\p{L}]{2}|[µμ]m|\d+\s*h\b/u.test(l.text)||/^p\s*[=<>≤≥]\s*0?\.\d+$/i.test(l.text)))
            .map(l=>({text:l.text.trim(),...(l.category&&/^\d+$/.test(l.text)?{chart:{kind:'category',context:{axes:[],caption:''}}}:{}),x0:l.x0/c.width,x1:l.x1/c.width,y0:l.y0/c.height,y1:l.y1/c.height}));
          onLabels?.(asLabels(lines));
          if(lines.filter(l=>l.conf>=65&&/\p{L}{2}/u.test(l.text)).length<3){
            const mask=document.createElement('canvas');mask.width=c.width;mask.height=c.height;
            const ctx=mask.getContext('2d',{willReadFrequently:true});
            ctx.drawImage(c,0,0);
            const pix=ctx.getImageData(0,0,mask.width,mask.height),a=pix.data;let coloured=0;
            for(let i=0;i<a.length;i+=4)if(Math.max(a[i],a[i+1],a[i+2])-Math.min(a[i],a[i+1],a[i+2])>40){
              a[i]=a[i+1]=a[i+2]=255;coloured++;
            }
            if(coloured){ctx.putImageData(pix,0,0);lines=lines.concat(await ocrLines(mask,false,true))}
            mask.width=mask.height=0;
          }
          const labels=asLabels(lines);
          const axisLike=lines.some(l=>l.category||/^(?:female|male|combined|mock)\b/i.test(l.text)||/^\s*x\s*[:：]\s*\d/i.test(l.text)||/\b(?:time|frequency|intensity|score|voltage|distance|probability|concentration)\b/i.test(l.text));
          if(axisLike&&isCurrent())labels.push(...await verticalLabels(c,lines,isCurrent));
          if(!isCurrent())return [];
          const outlined=await readOutlinedKeys(c,isCurrent);
          if(!isCurrent())return [];
          const covers=(a,b)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)&&Math.min(a.y1,b.y1)>Math.max(a.y0,b.y0);
          const unique=labels.filter((v,i)=>!(v.rotate&&outlined.some(w=>covers(w,v)))&&!labels.slice(0,i).some(w=>v.text===w.text&&Math.abs(v.x0-w.x0)<.006&&Math.abs(v.y0-w.y0)<.006));
          unique.push(...outlined);
          labelCache.set(key,unique);if(labelCache.size>64)labelCache.delete(labelCache.keys().next().value);
          return unique;
        }finally{if(!canvas)c.width=c.height=0}
      });
      chain=job.catch(()=>{});return job;
    }
    return {show,reset,panelLabels,destroy(){closed=true;reset();cache.clear();previews.clear();worker?.terminate()}};
  }
  window.HistogramReader={create};
})();
