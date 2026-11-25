// Reference coordinates are in PDF points, measured independently of the reader.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const truth=require('./fixtures/cartesian-points.json');
const [url,paper,filename,output]=process.argv.slice(2);
const reference=truth[paper];
const snapshot=async(page,name)=>{if(output)await page.screenshot({path:path.join(output,name+'.png')});};
// Standard PDF fonts have renderer-specific outlines (notably the foot of "1").
// Use the independent PDF position to locate the coloured point label, then measure
// its visible glyphs on the unannotated canvas, independently of the hit layer.
function colouredLabelEdges(el,{n,dx,dy}){
  const W=el.width,H=el.height;
  const x0=Math.floor((n[0]-dx*.75)*W),x1=Math.ceil((n[2]+dx*1.25)*W);
  const y0=Math.floor((n[1]-dy*.25)*H),y1=Math.ceil((n[3]+dy*.25)*H);
  const w=x1-x0,h=y1-y0,data=el.getContext('2d').getImageData(x0,y0,w,h).data;
  const byColour=new Map();
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=4*(y*w+x),rgb=[data[i],data[i+1],data[i+2]];
    if(Math.max(...rgb)-Math.min(...rgb)<100)continue;
    const key=rgb.indexOf(Math.max(...rgb));
    const v=byColour.get(key)||{count:0,l:w,r:0,t:h,b:0};
    v.count++;v.l=Math.min(v.l,x);v.r=Math.max(v.r,x+1);v.t=Math.min(v.t,y);v.b=Math.max(v.b,y+1);byColour.set(key,v);
  }
  const v=[...byColour.values()].sort((a,b)=>b.count-a.count)[0];
  if(!v||v.r-v.l<w*.75)return null;
  const b=el.getBoundingClientRect();
  return [b.x+(x0+v.l)*b.width/W,b.y+(y0+v.t)*b.height/H,b.x+(x0+v.r)*b.width/W,b.y+(y0+v.b)*b.height/H];
}
async function verify(page){
  const results=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('reading-desk.guide.v1','{"home":1,"read":1,"hint-panel":1}'));
  const entry=new URL(url);entry.searchParams.set('lang','zh');
  await page.goto(entry.href);
  await page.locator('input[type=file][id$="-main"]').setInputFiles(path.resolve(filename));
  await page.locator('.lens-cell[data-figure^="F:'+(paper==='dense'?3:4)+'@"]').click({timeout:90000});
  const tabs=page.locator('.st-dock .frw-panel-tab');
  const whole=page.locator('.frw-visual .figure-click-layer');
  const wholeNote=page.locator('.frw-visual .figure-click-note');
  const sampleName=reference.panels[0].swatch.text;
  for(const role of ['图例符号','图例']){
    const key=whole.getByRole('button',{name:role+' · '+sampleName,exact:true}).first();
    await key.click({timeout:12000});
    assert((await wholeNote.locator('p').innerText()).includes(sampleName));
    await wholeNote.getByRole('button',{name:'收起'}).click();
  }
  const stage=page.locator('.rq-stage:visible'),canvas=stage.locator('canvas'),tip=stage.locator('.rq-callout:visible');
  const d=page.locator('.pc-dialog[open]'),zoom=page.locator('.rq-zoom:visible');
  const [W,H]=reference.size;
  async function bounds(adjust){
    await page.locator('.rq-crop:visible').click();
    await d.locator('.pc-surface:visible').waitFor();
    await d.getByRole('button',{name:'查看整页'}).click();
    await d.locator('.pc-surface:visible').waitFor();
    const box=d.locator('.pc-box');
    if(adjust){
      await box.locator('[data-edge=w]').focus();await page.keyboard.press('Shift+ArrowLeft');
      await box.locator('[data-edge=s]').focus();await page.keyboard.press('Shift+ArrowDown');
    }
    // The full-page editor presents its selection in page percentages, regardless of browser zoom.
    const b=await box.evaluate(el=>['left','top','width','height'].map(k=>parseFloat(el.style[k])/100));
    await d.getByRole('button',{name:adjust?'应用裁切':'取消',exact:true}).click();
    return b;
  }
  const expected={
    x:paper==='dense'?[/参数总数.*10,000,000/,/浮点运算.*10,000,000,000/]:[/训练数据.*一轮/,/训练数据.*一轮/],
    y:paper==='dense'?/ImageNet.*第一预测类别.*百分比/:/左侧.*测试集.*百分比/,
    rightY:/右侧.*训练数据.*损失/,
    group:paper==='dense'?/121 层.*DenseNet/: [/152.*SVHN.*152 层/,/1202.*CIFAR.*1202 层/],
    split:/50 层.*ResNet/,
    legend:paper==='dense'?/红色.*ResNets.*validation error/:/红色.*Constant Depth.*test error/i,
    swatch:paper==='dense'?/红色.*ResNets.*validation error/:/红色.*Constant Depth.*test error/i,
    lossLegend:/绿色.*Stochastic Depth.*training loss/i,lossSwatch:/绿色.*Stochastic Depth.*training loss/i,
    blue:paper==='dense'?/蓝色.*DenseNets.*validation error/:/蓝色.*Stochastic Depth.*左侧纵轴 test error/i,
    blueSwatch:paper==='dense'?/蓝色.*DenseNets.*validation error/:/蓝色.*Stochastic Depth.*左侧纵轴 test error/i,
    magenta:/品红色.*Constant Depth.*右侧纵轴 training loss/i,magentaSwatch:/品红色.*Constant Depth.*右侧纵轴 training loss/i,
  };
  for(const [side,items] of reference.panels.entries()){
    const name=side?'右图':'左图';
    const select=tabs.filter({hasText:new RegExp('^'+name+'$')});
    await select.click({timeout:20000});await canvas.waitFor();
    assert.equal(await tabs.count(),3);
    let crop=await bounds(false);
    for(const mode of ['fit','zoom','crop','cropZoom']){
      if(mode==='crop'){
        const old=crop;crop=await bounds(true);
        assert(crop[0]<old[0] && crop[3]>old[3],'crop must move across two page boundaries');
      }
      if(mode==='zoom'||mode==='cropZoom'){
        await zoom.click();assert.equal(await zoom.getAttribute('aria-pressed'),'true');
      }
      for(const [key,{text,box}] of Object.entries(items)){
        if(await tip.count())await page.keyboard.press('Escape');
        await stage.evaluate(el=>el.scrollTop=0);
        await stage.locator('.rq-legend-symbol').first().waitFor();
        const n=[(box[0]/W-crop[0])/crop[2],(box[1]/H-crop[1])/crop[3],(box[2]/W-crop[0])/crop[2],(box[3]/H-crop[1])/crop[3]];
        await canvas.evaluate(async(el,n)=>{
          const sheet=el.closest('.rq-sheet'),v=sheet.closest('.rq-viewport');
          await Promise.all(sheet.getAnimations().map(a=>a.finished.catch(()=>{})));
          if(v.classList.contains('rq-magnified')){
            const c=el.getBoundingClientRect(),b=v.getBoundingClientRect();
            v.scrollBy({left:c.x+c.width*(n[0]+n[2])/2-b.x-b.width/2,top:c.y+c.height*(n[1]+n[3])/2-b.y-b.height/2,behavior:'instant'});
          }
          await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        },n);
        const c=await canvas.boundingBox(),original=[c.x+c.width*n[0],c.y+c.height*n[1],c.x+c.width*n[2],c.y+c.height*n[3]];
        const pt={x:(original[0]+original[2])/2,y:(original[1]+original[3])/2};
        const hit=await page.evaluate(({x,y})=>{
          const e=document.elementFromPoint(x,y)?.closest('.rq-hit');
          if(!e)return null;
          const r=e.getBoundingClientRect();
          return {title:e.title,edges:[r.left,r.top,r.right,r.bottom]};
        },pt);
        const description=paper+' '+name+' '+mode+' '+key;
        assert(hit?.title.includes(text),description+': '+JSON.stringify(hit));
        const ink=paper==='dense'&&['split','group'].includes(key)
          ?await canvas.evaluate(colouredLabelEdges,{n,dx:1/(crop[2]*W),dy:1/(crop[3]*H)}):null;
        await page.mouse.click(pt.x,pt.y);
        await tip.waitFor({timeout:3000}).catch(error=>{throw Error(description+' at '+JSON.stringify(pt)+': '+error.message)});
        const body=await tip.locator('p').innerText();
        assert.match(body,Array.isArray(expected[key])?expected[key][side]:expected[key]);
        assert.equal(await page.locator('.rq-ask:visible').count(),0);
        const edges=hit.edges.map((v,i)=>v-(ink||original)[i]);
        const delta=Math.max(...edges.map(Math.abs));
        results.push({side:name,mode,key,title:hit.title,body,delta:+delta.toFixed(2),
          edges:edges.map(v=>+v.toFixed(2)),pdfiumDifference:+Math.max(...hit.edges.map((v,i)=>Math.abs(v-original[i]))).toFixed(2)});
        if(output)fs.writeFileSync(path.join(output,paper+'-results.json'),JSON.stringify(results,null,2));
        if(mode==='cropZoom'&&!side&&['group','swatch','rightY'].includes(key)){
          await tip.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{}))));
          await snapshot(page,paper+'-'+key);
        }
      }
    }
  }
  assert.deepEqual(errors,[]);
  const worst=results.toSorted((a,b)=>b.delta-a.delta)[0];
  console.log(paper,results.length,'clicks; greatest edge difference to source PDF (CSS px)',worst);
  assert(worst.delta<=2,'Ink bounds differ from the independent PDF reference by more than 2 CSS pixels');
}
(async()=>{const b=await chromium.launch({channel:'msedge'});try{await verify(await b.newPage({viewport:{width:1600,height:1000}}));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
