(() => {
  'use strict';
  const midX=b=>(b.x0+b.x1)/2,midY=b=>(b.y0+b.y1)/2;
  const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
  function bands(items,value,tolerance){
    const out=[];
    for(const item of [...items].sort((a,b)=>value(a)-value(b))){
      const last=out.at(-1);
      if(last&&Math.abs(value(item)-value(last[0]))<=tolerance)last.push(item);
      else out.push([item]);
    }
    return out;
  }
  // Require both side walls, repeated comparable frame sizes, and a complete lattice.
  // Rectangular legends, table rules and isolated grid lines do not supply panel names.
  function detect(pixels,W,H,stack=false){
    const ink=(x,y)=>{
      const n=(y*W+x)*4,r=pixels[n],g=pixels[n+1],b=pixels[n+2];
      return Math.max(r,g,b)<218&&Math.max(r,g,b)-Math.min(r,g,b)<42;
    };
    const runMin=Math.max(26,W*.045),edges=[];
    for(let y=0;y<H;y++){
      for(let x=0;x<W;){
        if(!ink(x,y)){x++;continue}
        const left=x++;while(x<W&&ink(x,y))x++;
        if(x-left<runMin)continue;
        edges.push({x0:left,x1:x-1,y});
        if(edges.length>6500)return [];
      }
    }
    function wall(x,top,bottom){
      let covered=0,steps=0;
      for(let y=top;y<=bottom;y+=3){steps++;if([-1,0,1].some(d=>x+d>=0&&x+d<W&&ink(x+d,y)))covered++}
      return covered>=steps*.91;
    }
    const boxes=[];
    if(stack){
      const bands=[];
      for(const e of edges.filter(e=>e.x1-e.x0>W*.45)){
        const last=bands.at(-1);
        if(last&&e.y-last.end<=3){last.end=e.y;if(e.x1-e.x0>last.edge.x1-last.edge.x0)last.edge=e}
        else bands.push({end:e.y,edge:e});
      }
      for(let i=1;i<bands.length;i++){
        const a=bands[i-1].edge,b=bands[i].edge,h=b.y-a.y,w=b.x1-b.x0,tol=Math.ceil(w*.018);
        if(h<H*.25||h>H*.62||Math.abs(a.x0-b.x0)>tol||Math.abs(a.x1-b.x1)>tol)continue;
        const side=x=>Array.from({length:tol*2+1},(_,j)=>x+j-tol).find(xx=>wall(xx,a.y,b.y));
        const x0=side(b.x0),x1=side(b.x1);
        if(x0!=null&&x1!=null)boxes.push({x0,x1,y0:a.y,y1:b.y});
      }
      if(boxes.length!==2)return [];
      const [a,b]=boxes,w=a.x1-a.x0,h=a.y1-a.y0;
      return Math.abs(a.x0-b.x0)<w*.035&&Math.abs(a.x1-b.x1)<w*.035&&Math.abs((b.y1-b.y0)/h-1)<.18&&b.y0-a.y1<h*.35?boxes:[];
    }
    const columns=new Map();
    for(const edge of edges){
      const k=Math.floor(edge.x0/6);
      if(!columns.has(k))columns.set(k,[]);
      columns.get(k).push(edge);
    }
    for(const top of edges){
      if(boxes.some(b=>Math.abs(b.y0-top.y)<=2&&Math.abs(b.x0-top.x0)<=3&&Math.abs(b.x1-top.x1)<=3))continue;
      const k=Math.floor(top.x0/6);
      const aligned=[k-1,k,k+1].flatMap(i=>columns.get(i)||[]).filter(e=>e.y>top.y+3&&Math.abs(top.x0-e.x0)<=4&&Math.abs(top.x1-e.x1)<=4).sort((a,b)=>a.y-b.y);
      for(const bottom of aligned){
          const h=bottom.y-top.y,w=top.x1-top.x0;
          if(h<Math.max(19,H*.032)||h>H*.65||w/h<.45||w/h>5)continue;
          if(wall(top.x0,top.y,bottom.y)&&wall(top.x1,top.y,bottom.y)){
            boxes.push({x0:top.x0,x1:top.x1,y0:top.y,y1:bottom.y});
            if(boxes.length>220)return [];
            break;
          }
      }
    }
    if(boxes.length<6||boxes.length>220)return [];
    const families=boxes.map(b=>boxes.filter(q=>Math.abs((q.x1-q.x0)/(b.x1-b.x0)-1)<.14&&Math.abs((q.y1-q.y0)/(b.y1-b.y0)-1)<.14));
    const common=families.sort((a,b)=>b.length-a.length)[0];
    if(common.length<6||common.length>96)return [];
    const h=median(common.map(b=>b.y1-b.y0)),w=median(common.map(b=>b.x1-b.x0));
    const rows=bands(common,midY,h*.16),cols=bands(common,midX,w*.16);
    if(rows.length<2||cols.length<2||rows.length*cols.length!==common.length)return [];
    if(rows.some((r,i)=>i&&median(r.map(midY))-median(rows[i-1].map(midY))<h*1.04)||
       cols.some((c,i)=>i&&median(c.map(midX))-median(cols[i-1].map(midX))<w*1.04))return [];
    const ordered=[];
    for(const [row,items] of rows.entries()){
      items.sort((a,b)=>midX(a)-midX(b));
      if(items.length!==cols.length||items.some((b,i)=>!cols[i].includes(b)))return [];
      for(const [col,b] of items.entries())ordered.push({...b,row,col});
    }
    return ordered;
  }
  function blocks(groups,lo,hi){
    const gaps=groups.slice(1).map((next,i)=>median(next.map(b=>b[lo]))-median(groups[i].map(b=>b[hi])));
    const size=median(groups.flat().map(b=>b[hi]-b[lo]));
    const inner=gaps.length?Math.min(...gaps):0;
    let id=0;
    return groups.map((_,i)=>{if(i&&gaps[i-1]>Math.max(inner*1.75,.43*size))id++;return id});
  }
  function annotate(frames,text,W,H){
    const rows=bands(frames,b=>b.row,0),cols=bands(frames,b=>b.col,0);
    const across=blocks(cols,'x0','x1'),down=blocks(rows,'y0','y1');
    const groups=new Map();
    const words=text.filter(t=>/[\p{L}]{2}/u.test(t.text)&&t.conf>=78);
    for(const b of frames){
      const key=down[b.row]+'-'+across[b.col];
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(b);
    }
    const pad=2;
    const region=(x0,y0,x1,y1)=>({x:Math.max(0,x0)/W,y:Math.max(0,y0)/H,
      width:(Math.min(W,x1)-Math.max(0,x0))/W,height:(Math.min(H,y1)-Math.max(0,y0))/H});
    const rect=t=>region(t.x0-pad,t.y0-pad,t.x1+pad,t.y1+pad);
    for(const [id,group] of groups){
      const x0=Math.min(...group.map(b=>b.x0)),x1=Math.max(...group.map(b=>b.x1));
      const y0=Math.min(...group.map(b=>b.y0)),y1=Math.max(...group.map(b=>b.y1));
      const w=median(group.map(b=>b.x1-b.x0)),h=median(group.map(b=>b.y1-b.y0));
      for(const b of group){
        const title=words.filter(t=>!t.rotate&&Math.abs(midX(t)-midX(b))<w*.3&&midY(t)<b.y0&&midY(t)>b.y0-h*.16)
                         .sort((a,c)=>midY(c)-midY(a));
        b.print=title[0]||null;
      }
      const first=group.filter(b=>b.row===group[0].row);
      const above=Math.min(y0,...first.map(b=>b.print?.y0??y0));
      const headers=words.filter(t=>!t.rotate&&t.y1<=above+2&&t.y0>y0-h*.55&&Math.abs(midX(t)-(x0+x1)/2)<(x1-x0)*.18&&!group.some(b=>b.print===t));
      const vertical=words.filter(t=>t.rotate&&t.x1<x0&&t.x0>x0-w*.48&&midY(t)>y0&&midY(t)<y1);
      const axis=vertical.length===1&&Math.abs(midY(vertical[0])-(y0+y1)/2)<(y1-y0)*.18?vertical[0]:null;
      const header=headers.length===1&&first.length>1?headers[0]:null;
      const last=group.filter(b=>b.row===group.at(-1).row);
      const below=words.filter(t=>!t.rotate&&t.y0>y1+pad&&t.y1<y1+h*.38&&t.x0>=x0&&t.x1<=x1);
      const xAxis=below.length===1&&last.length>1&&Math.abs(midX(below[0])-(x1+x0)/2)<(x1-x0)*.13&&
        !words.some(t=>!t.rotate&&t.y0>y1&&t.y0<below[0].y0&&t.x1>x0&&t.x0<x1)?below[0]:null;
      const shared=[];
      if(header)shared.push({kind:'group',label:header.text,rect:rect(header)});
      if(axis)shared.push({kind:'y',label:axis.text,rect:rect(axis)});
      if(xAxis)shared.push({kind:'x',label:xAxis.text,rect:rect(xAxis)});
      for(const b of group){
        b.group=id;b.groupBox=region(x0,y0,x1,y1);b.groupLabel=header?.text||'';b.shared=shared;
        const next=frames.find(q=>q.col===b.col&&q.row===b.row+1);
        const prev=frames.find(q=>q.row===b.row&&q.col===b.col-1);
        const bound=next?Math.min(b.y1+h*.20,next.print?.y0??next.y0-h*.18):b.y1+h*.20;
        const ticks=text.filter(t=>!t.rotate&&/^[\s\d.,−+⁻⁰¹²³⁴⁵⁶⁷⁸⁹-]+$/.test(t.text)&&t.x0>=b.x0-w*.13&&t.x1<=b.x1+w*.13&&midY(t)>b.y1&&midY(t)<bound);
        const left=Math.max(prev?prev.x1+1:0,b.x0-w*.20);
        b.crop=region(left,b.print?Math.min(b.print.y0-pad,b.y0-2):b.y0-2,b.x1+pad,Math.max(b.y1+pad,...ticks.map(t=>t.y1+pad)));
      }
    }
    return frames;
  }
  function navigator(plots,names,choose){
    const node=document.createElement('div');node.className='hist-grid-nav';
    function dropdown(zh,en){
      const label=PaperUI.set(document.createElement('label'),zh,en),select=document.createElement('select');
      label.append(select);node.append(label);return select;
    }
    const group=dropdown('比较组','Group'),plot=plots[0].open?dropdown('已定位 '+plots.length+' 张小图','Located plots'):dropdown('组内小图','Plot');
    const groups=[...new Set(plots.map(c=>c.group))];
    if(plots[0].open&&groups.length===1)group.parentElement.hidden=true;
    for(const [i,g] of groups.entries()){
      const sample=plots.find(c=>c.group===g);
      group.add(new Option(sample.groupLabel||('图块 / Block '+(i+1)),g));
    }
    function select(i){
      const c=plots[i];
      if(group.value!==c.group||plot.dataset.group!==c.group){
        group.value=c.group;plot.replaceChildren();
        plots.forEach((q,j)=>{if(q.group===c.group)plot.add(new Option(names[j],String(j)))});
        plot.dataset.group=c.group;
      }
      plot.value=String(i);
    }
    group.onchange=()=>{
      const old=plots[Number(plot.value)],first=plots.findIndex(q=>q.group===group.value);
      const match=old.title?plots.filter(q=>q.group===group.value&&q.title===old.title):[];
      choose(match.length===1?plots.indexOf(match[0]):first);
    };
    plot.onchange=()=>choose(Number(plot.value));
    return {node,select};
  }
  function manualCells(layout){
    const {rows,cols,rect}=layout,out=[],width=rect.width/cols,height=rect.height/rows;
    for(let row=0;row<rows;row++){
      const groupBox={x:rect.x,y:rect.y+height*row,width:rect.width,height};
      for(let col=0;col<cols;col++){
        const crop={x:rect.x+width*col,y:groupBox.y,width,height};
        out.push({row,col,group:String(row),groupBox,groupLabel:'第 '+(row+1)+' 行 / Row '+(row+1),
          title:'第 '+(col+1)+' 列 / Column '+(col+1),rect:crop,crop,x:'',y:'',ticks:[],shared:[],manualGrid:true});
      }
    }
    return out;
  }
  function layoutControl(layout,draw){
    const box=document.createElement('details');box.className='hist-layout';
    const ui=(tag,zh,en)=>PaperUI.set(document.createElement(tag),zh,en);
    box.append(ui('summary',layout?'调整行列和外框':'按行列框选一组直方图',layout?'Adjust grid':'Select a regular grid'));
    const form=document.createElement('form');
    form.append(ui('p','填写行列数，再沿小图阵列的外缘拖一个框。共用轴和组标题可留在框外。','Enter the grid dimensions and draw around the plots, leaving outer labels outside.'));
    function dimension(zh,en,value){
      const label=ui('label',zh,en),input=document.createElement('input');
      Object.assign(input,{type:'number',min:'1',max:'32',step:'1',required:true,value:String(value||'')});label.append(input);form.append(label);
      return input;
    }
    const rows=dimension('行','Rows',layout?.rows),cols=dimension('列','Columns',layout?.cols);
    const start=ui('button','在原图框选','Draw grid bounds');start.type='submit';form.append(start);
    form.onsubmit=e=>{e.preventDefault();const r=rows.valueAsNumber,c=cols.valueAsNumber;
      if(r*c<2||r*c>120){cols.setCustomValidity('请选择 2–120 个小图 / Select 2–120 plots');cols.reportValidity();return}
      draw(r,c)};
    form.oninput=()=>cols.setCustomValidity('');
    box.append(form);return box;
  }
  window.HistogramGrid={detect,annotate,navigator,manualCells,layoutControl};
})();
