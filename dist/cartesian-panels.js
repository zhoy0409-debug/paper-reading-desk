(() => {
  'use strict';
  const width=b=>b.x1-b.x0, height=b=>b.y1-b.y0;
  const cx=b=>(b.x0+b.x1)/2, cy=b=>(b.y0+b.y1)/2;
  const union=(a,b)=>({x0:Math.min(a.x0,b.x0),y0:Math.min(a.y0,b.y0),x1:Math.max(a.x1,b.x1),y1:Math.max(a.y1,b.y1)});
  const inside=(b,r)=>b.x0>=r.x0-1 && b.x1<=r.x1+1 && b.y0>=r.y0-1 && b.y1<=r.y1+1;
  const numeric=t=>/^[−+-]?\d+(?:[.]\d+)?$/.test(t.trim());
  function findPlots(cap,captions,words,axes,objects,view) {
    const floor=cap.line.y0;
    const near=objects.filter(o=>o.kind==='vec' && o.y1<floor+1 && o.y0>floor-view.height*.45);
    const walls=near.filter(o=>width(o)<2.2 && height(o)>view.height*.04 && floor-o.y1<view.height*.085);
    const frames=[];
    for(const wall of walls){
      const bottom=near.find(o=>height(o)<2.2 && width(o)>view.width*.09 && Math.abs(o.x0-cx(wall))<2 && Math.abs(cy(o)-wall.y1)<2);
      if(!bottom || frames.some(f=>Math.abs(f.x0-cx(wall))<2 && Math.abs(f.y0-wall.y0)<2))continue;
      const f={x0:cx(wall),y0:wall.y0,x1:bottom.x1,y1:cy(bottom)};
      if(f.x0<cap.line.x0-6 || f.x1>cap.line.x1+12)continue;
      const ticks=words.filter(t=>numeric(t.text)&&cx(t)>=f.x0-2&&cx(t)<=f.x1+2&&t.y0>=f.y1-1&&t.y0<f.y1+t.size*1.7);
      if(new Set(ticks.map(t=>Math.round(cx(t)))).size>=3)frames.push(f);
    }
    frames.sort((a,b)=>a.x0-b.x0);
    if(![2,3].includes(frames.length) || frames.some((f,i)=>i&&(f.x0<=frames[i-1].x1+4||Math.abs(f.y1-frames[0].y1)>5||Math.abs(f.y0-frames[0].y0)>6)))return null;
    // Explicit panel letters belong to the existing lettered-panel detector.
    if(/\([a-c]\)/i.test(cap.caption)||words.some(t=>/^[([]?[a-c][)\].:]?$/i.test(t.text.trim())&&
      frames.some(f=>Math.abs(t.x0-f.x0)<width(f)*.28&&Math.abs(t.y1-f.y0)<16)))return null;
    const panels=[];
    for(const [i,frame] of frames.entries()){
      const w=width(frame), h=height(frame);
      const left=i?(frames[i-1].x1+frame.x0)/2:Math.max(0,frame.x0-w*.3);
      const right=i+1<frames.length?(frame.x1+frames[i+1].x0)/2:Math.min(view.width,frame.x1+w*.3);
      const vertical=axes.filter(a=>cx(a)>=left&&cx(a)<=right&&a.y0>=frame.y0-2&&a.y1<=frame.y1+2&&
        ((a.x1<frame.x0+1&&frame.x0-a.x1<w*.25)||(a.x0>frame.x1-1&&a.x0-frame.x1<w*.25)));
      vertical.sort((a,b)=>cx(a)-cx(b));
      if(!vertical.length || !vertical.some(a=>cx(a)<frame.x0))return null;
      const labels=words.filter(t=>t.x0>=left-1 && t.x1<=right+1 && t.y0>=frame.y0-Math.min(16,h*.16) && t.y1<floor+1 && t.size<cap.line.size*1.35);
      const beneath=labels.filter(t=>t.y0>frame.y1 && Math.abs(cx(t)-cx(frame))<w*.32 && /\p{L}{2}/u.test(t.text));
      if(beneath.length!==1)return null;
      const title=labels.find(t=>t.y1<frame.y0+1 && Math.abs(cx(t)-cx(frame))<w*.24 && /\p{L}{2}/u.test(t.text));
      const bounds=[...labels,...vertical].reduce(union,frame);
      const rect={x0:Math.max(left,bounds.x0-2),x1:Math.min(right,bounds.x1+2),y0:Math.max(0,bounds.y0-2),y1:Math.min(floor+.35,bounds.y1+2)};
      if(captions.some(c=>c!==cap && inside(c.line,rect)))return null;
      const position=i===0?'left':i===frames.length-1?'right':'middle';
      panels.push({position,label:{left:'左图',right:'右图',middle:'中图'}[position],rect,frame,vertical,horizontal:beneath[0],titleWord:title,labels,axis:vertical.find(a=>cx(a)<frame.x0).text});
    }
    return {panels,crop:panels.map(p=>p.rect).reduce(union)};
  }
  function chartMarks(plot,paths,caption){
    const {frame,labels,vertical,horizontal,titleWord}=plot;
    const keys=CurveReading.legend(paths,labels,plot.rect).filter(k=>inside(k.box,frame));
    // A key consists of a printed stroke next to text. Preserve both as distinct targets.
    const marks=[], used=new Set();
    const role=(word,kind,details={})=>{
      used.add(word);
      marks.push({text:word.text,box:word,chart:{kind,...details}});
    };
    const powerBase=labels.find(t=>/^[×x]\s*10$/i.test(t.text.trim()) && t.y0>frame.y1 && t.x0>frame.x1-width(frame)*.22);
    const power=powerBase&&labels.find(t=>/^[−+-]?\d{1,2}$/.test(t.text)&&Math.abs(t.x0-powerBase.x1)<1.6&&t.size<powerBase.size*.9&&t.base<powerBase.base-1);
    const xName=horizontal.text, yName=plot.axis;
    const names=keys.map(k=>k.name);
    const summary={xName,yName,axes:vertical.map(a=>a.text),title:titleWord?.text||'',names,caption,exponent:power?Number(power.text.replace('−','-')):null};
    role(horizontal,'x');
    for(const a of vertical)role(a,'y',{side:cx(a)<frame.x0?'left':'right'});
    if(titleWord)role(titleWord,'title');
    for(const k of keys){
      const label=labels.find(t=>k.name.startsWith(t.text.trim()) && inside(t,k.box) && Math.abs(cy(t)-cy(k.box))<t.size*.7);
      if(!label||used.has(label))continue;
      const info={name:k.name,color:k.color,dash:k.dash};
      const textRuns=labels.filter(t=>inside(t,k.box)&&t.x0>=label.x0-.2&&Math.abs(t.base-label.base)<label.size*.3);
      const textBox=textRuns.reduce(union,label);
      for(const run of textRuns)used.add(run);
      role({...textBox,text:k.name},'legend',info);
      const b=k.stroke;
      const half=Math.min(label.size*.48,width(b)*.27);
      role({x0:b.x0-.2,x1:b.x1+.2,y0:cy(b)-half,y1:cy(b)+half,text:k.name},'symbol',info);
    }
    // Text attached to a plotted point may have a separate numeric PDF text run.
    for(const t of labels){
      if(used.has(t)||!inside(t,frame)||!/\p{L}{2}/u.test(t.text))continue;
      let label=t;
      if(/[-−–]$/.test(t.text)){
        const next=labels.find(s=>numeric(s.text)&&Math.abs(s.x0-t.x1)<t.size*.22 && Math.abs(s.base-t.base)<t.size*.22);
        if(next){label={...union(t,next),text:t.text+next.text};used.add(next);}
      }
      role(label,'point');
    }
    // Associate a numeric tick with the adjacent axis, including right-side scales.
    const powers=new Map();
    const raised=new Set();
    for(const base of labels.filter(w=>w.text.trim()==='10')){
      const sup=labels.find(w=>w!==base&&/^[−+-]?\d{1,2}$/.test(w.text)&&w.size<base.size*.92&&
        w.base<base.base-base.size*.15&&w.base>base.base-base.size*.85&&Math.abs(w.x0-base.x1)<base.size*.35);
      if(sup){powers.set(base,sup);raised.add(sup)}
    }
    for(const original of labels){
      const sup=powers.get(original);
      const exp=sup?Number(sup.text.replace('−','-')):null;
      const word=sup?{...original,...union(original,sup),text:'10'+String(exp).replace(/[-0-9]/g,c=>'⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)])}:original;
      if(raised.has(original)||used.has(original)||original===power||!numeric(original.text))continue;
      if(word.y0>=frame.y1-1 && word.y0<frame.y1+word.size*1.7 && cx(word)>=frame.x0-2 && cx(word)<=frame.x1+2){
        role(word,'tick',{axis:xName,horizontal:true,exp});
      }else if(cy(word)>=frame.y0-2 && cy(word)<=frame.y1+2){
        const right=word.x0>=frame.x1-.5 && word.x0-frame.x1<1.65*word.size;
        const left=word.x1<=frame.x0+.5 && frame.x0-word.x1<1.65*word.size;
        const axis=vertical.find(a=>right?cx(a)>frame.x1:left&&cx(a)<frame.x0);
        if(axis)role(word,'tick',{axis:axis.text,right,exp});
      }
    }
    for(const m of marks)m.chart.context=summary;
    return marks;
  }
  function explanation(word,page){
    const a=word.chart,c=a.context,t=word.text,kind=a.kind;
    const card=(zh,en,body,eng)=>[zh+' · '+t,en+' · '+t,body,eng,page];
    const percent=/%|percent/i.test(t),validation=/validation/i.test(t),test=/test/i.test(t);
    const dataset=(c.caption.match(/\b(ImageNet|CIFAR[-−]\d+|SVHN)\s+validation/i)||[])[1];
    const source=validation?'验证集':test?'测试集':'训练集';
    const engSource=validation?'validation set':test?'test set':'training set';
    const exponent=c.exponent;
    if(kind==='category')return card('横轴组名','Horizontal-axis group','横轴用 '+t+' 标识这一组。与相邻的对照组在同一纵轴尺度上比较，可读出两组测量值的差异。','The horizontal axis uses '+t+' as a group identifier. Compare its values with the adjacent control on the same vertical scale.');
    if(kind==='tick'){
      const scale=a.horizontal?'横轴':a.right?'右纵轴':'左纵轴';
      const val=a.exp!=null?10**a.exp:Number(t.replace('−','-'));
      const multiplied=a.horizontal&&exponent!=null&&Math.abs(exponent)<=12;
      const value=multiplied?Number((val*10**exponent).toPrecision(12)):(a.exp!=null?val:t);
      const reading=String(value)+(/%/.test(a.axis)?'%':'');
      const suffix=multiplied?'（图中标注 ×10^'+exponent+'）':'';
      return card('刻度','Axis tick',scale+'「'+a.axis+'」在这个位置读作 '+reading+suffix+'。',
        'This tick on the '+(a.horizontal?'horizontal':a.right?'right vertical':'left vertical')+' axis ('+a.axis+') reads '+reading+(multiplied?' after applying the printed scale factor':'')+'.');
    }
    if(kind==='x'){
      let zh,en;
      if(/parameters?/i.test(t)){zh='横轴是模型中需要学习的参数总数。';en='The horizontal axis counts the parameters learned by the model. ';}
      else if(/flops?/i.test(t)){zh='横轴是模型完成一次推理所需的浮点运算次数。';en='The horizontal axis counts floating-point operations for inference. ';}
      else if(/^epochs?$/i.test(t)){zh='每个 epoch 表示训练数据完整学习一轮。沿横轴向右，可以比较模型随训练轮次增加的变化。';en='One epoch is one pass through the training data. Follow the axis to see how the model changes across training epochs. ';}
      else{zh='横轴按 '+t+' 排列观测值。在相同的横坐标比较各组的 '+c.yName+'。';en='Observations are ordered by '+t+'. At the same horizontal position compare '+c.yName+' across groups. ';}
      if(exponent!=null && exponent>=-12&&exponent<=12){const value=10**exponent;zh+='刻度 1 对应 '+value.toLocaleString('zh-CN')+'，刻度 2 对应 '+(2*value).toLocaleString('zh-CN')+'。';en+='A tick of 1 means '+value.toLocaleString('en-US')+' and 2 means '+(2*value).toLocaleString('en-US')+'.';}
      return card('横轴','Horizontal axis',zh,en);
    }
    if(kind==='y'){
      const side=c.axes.length>1?(a.side==='right'?'右侧':'左侧'):'';
      if(/error/i.test(t)&&percent){
        const top=/top[- ]1/i.test(c.caption);
        return card(side+'纵轴','Vertical axis',side+'纵轴表示'+(dataset?dataset+' ':'')+source+'中'+(top?'第一预测类别判错':'预测错误')+'的样本百分比。位置越低，错分的样本比例越小。',
        'This axis is the percentage of '+(dataset?dataset+' ':'')+engSource+' examples '+(top?'whose top-ranked prediction is wrong.':'classified incorrectly.')+' Lower values mean fewer errors.');
      }
      if(/training loss/i.test(t))return card(side+'纵轴','Vertical axis',side+'纵轴衡量模型在训练数据上的损失值。用这一侧的刻度读取训练损失曲线，越低表示训练目标的损失越小。','Read the training-loss curve against this axis. Lower values mean a smaller loss on the training objective.');
      return card(side+'纵轴','Vertical axis',side+'刻度给出 '+t+'。在同一个 '+c.xName+' 位置，对比各组的纵向读数。','This scale gives '+t+'. Compare groups at the same '+c.xName+' position.');
    }
    if(kind==='legend'||kind==='symbol'){
      const [zhColor,enColor]=CurveReading.colorNames(a.color);
      const [zhStyle,enStyle]=a.open?['空心色框','open box']:a.swatch?(a.line?['线段','line sample']:a.solidBox?(a.open===false?['填充色块','filled box']:['方块','square']):['标记','marker']):CurveReading.style(a.dash);
      const metric=c.axes.find(v=>a.name.toLowerCase().includes(v.toLowerCase().replace(/\s*\([^)]*\)/g,'').trim()));
      const scale=metric?metric:c.axes.length===1?c.yName:'';
      const group=a.name.match(/^(.*?)\s+with\s+(.+)$/i);
      const groupName=group&&({'constant depth':'固定深度','stochastic depth':'随机深度'}[group[2].toLowerCase()]||group[2]);
      const metricName=group&&({'test error':'测试错误率','training loss':'训练损失'}[group[1].toLowerCase()]||group[1]);
      const side=metric&&c.axes.length===2?(metric===c.axes[0]?['左侧','left ']:['右侧','right ']):['',''];
      const condition=/^control(?: group)?$/i.test(a.name)?['这是用作比较基准的对照组。','This is the reference group for the comparison. ']:
        /^intervention(?: group)?$/i.test(a.name)?['这是接受研究干预的组，可与同一条件下的对照组比较。','This group received the study intervention. Compare it with the control under the same conditions. ']:
        /^no scratch$/i.test(a.name)?['这是未抓挠组，与 Scratch 组对读。','This is the no-scratching group. Compare it with Scratch. ']:
        /^scratch$/i.test(a.name)?['这是抓挠组，与 No scratch 组对读。','This is the scratching group. Compare it with No scratch. ']:['',''];
      return card(kind==='symbol'?'图例符号':'图例',kind==='symbol'?'Legend symbol':'Legend',
        zhColor+'色'+zhStyle+(a.triangle?'和三角标记':'')+'代表 '+a.name+'。'+(group?'它显示'+groupName+'组的'+metricName+'。':condition[0])+
        (scale?'沿'+side[0]+'纵轴 '+scale+' 读出这一组的数值。':'在图中找同色标记，可辨认属于这一组的观测值。'),
        'The '+enColor+' '+enStyle+(a.swatch?'':' line')+(a.triangle?' with triangular markers':'')+' identifies '+a.name+'. '+(group?'It shows '+group[1]+' for the '+group[2]+' group. ':condition[1])+
        (scale?'Read its values on the '+side[1]+scale+' axis.':'Match this key to the marks of the same colour in the plot.'));
    }
    const model=t.match(/\b([A-Za-z][A-Za-z0-9]*)\s*[-−–]\s*(\d{2,4})\b/);
    const depth=t.match(/(\d+)[-−– ]layers?\b/i);
    if(kind==='title')return card('本图组别','Panel group','这幅小图展示 '+t+'。'+(depth?'这里比较的是 '+depth[1]+' 层网络。':'')+'图例列出的条件共用横轴 '+c.xName+'。','This panel shows '+t+'. '+(depth?'The network has '+depth[1]+' layers. ':'')+'The conditions in the legend share the '+c.xName+' axis.');
    const architecture=model&&/\b(?:networks?|resnets?|densenets?|layers?)\b/i.test(c.caption)&&/Net$/i.test(model[1]);
    const modelZh=architecture?model[2]+' 层的 '+model[1]+' 模型':t;
    return card('数据点标注','Data label','图中标注的是 '+modelZh+'。沿横向读 '+c.xName+'，沿纵向读 '+c.yName+'。',
      'This label identifies '+(architecture?'the '+model[2]+'-layer '+model[1]+' model':t)+'. Read '+c.xName+' horizontally and '+c.yName+' vertically.');
  }
  // PDF text matrices bound the font em, not the ink. Read the final crop's
  // pixels once and use the dominant ink colour to exclude crossing curves.
  function fitInk(marks,canvas,textMask,printedLabels=false){
    const W=canvas.width,H=canvas.height;
    if(W<10||H<10)return;
    const artwork=canvas.getContext('2d').getImageData(0,0,W,H).data;
    for(const m of marks.filter(m=>m.chart||printedLabels&&textMask&&m.text)){
      const symbol=m.chart?.kind==='symbol', vertical=m.chart?m.chart.kind==='y':m.rotate;
      let data=!symbol&&textMask?.width===W&&textMask.height===H?textMask.data:artwork;
      const em=(vertical?(m.x1-m.x0)*W:(m.y1-m.y0)*H);
      const pad=Math.max(1,Math.min(3,em*.07));
      const l=Math.max(0,Math.floor(W*m.x0-pad)),r=Math.min(W,Math.ceil(W*m.x1+pad));
      const t=Math.max(0,Math.floor(H*m.y0-pad)),b=Math.min(H,Math.ceil(H*m.y1+pad));
      const colors=new Map();
      function key(i){
        const red=data[i],green=data[i+1],blue=data[i+2];
        const high=Math.max(red,green,blue),low=Math.min(red,green,blue);
        if(high-low<32)return high<148?'gray':'';
        if(low>165)return '';
        return [red,green,blue].map(v=>v-low>(high-low)*.55?'1':'0').join('');
      }
      for(let y=t;y<b;y++)for(let x=l;x<r;x++){
        const k=key(4*(y*W+x));if(k)colors.set(k,(colors.get(k)||0)+1);
      }
      // Some PDFs convert lettering to ordinary vector paths. Its PDF text
      // box still locates the word, but the separate glyph layer is empty.
      // On a light plot margin, fit the box to the printed strokes instead.
      if(!colors.size&&printedLabels&&data!==artwork){
        data=artwork;
        let paper=0,ink=0;
        for(let y=t;y<b;y++)for(let x=l;x<r;x++){
          const i=4*(y*W+x);
          if(Math.min(data[i],data[i+1],data[i+2])>235)paper++;
          if(key(i)==='gray')ink++;
        }
        const area=(b-t)*(r-l);
        if(paper>area*.5&&ink>area*.025)colors.set('gray',ink);
      }
      const target=[...colors].sort((a,b)=>b[1]-a[1])[0]?.[0];
      if(!target)continue;
      let x0=r,x1=l,y0=b,y1=t;
      for(let y=t;y<b;y++)for(let x=l;x<r;x++){
        if(key(4*(y*W+x))!==target)continue;
        x0=Math.min(x0,x);x1=Math.max(x1,x+1);y0=Math.min(y0,y);y1=Math.max(y1,y+1);
      }
      if(x1<=x0||y1<=y0||(!symbol&&(vertical?y1-y0:x1-x0)<.65*(vertical?b-t:r-l)))continue;
      if(symbol&&y1-y0>=7){
        // A centred, steadily widening marker on a horizontal stroke.
        const span=row=>{
          let lo=x1,hi=x0;
          for(let x=x0;x<x1;x++)if(key(4*(row*W+x))===target){lo=Math.min(lo,x);hi=Math.max(hi,x)}
          return hi>=lo&&Math.abs(lo+hi-x0-x1)<(x1-x0)*.18?hi-lo+1:0;
        };
        const profile=Array.from({length:y1-y0},(_,i)=>span(y0+i)).filter(w=>w>0&&w<(x1-x0)*.7);
        const [a,b,c,d]=[.12,.32,.75,.9].map(f=>profile[Math.floor(f*(profile.length-1))]);
        if(a&&a<b&&b<c&&c<=d&&d>2*a&&d<(x1-x0)*.7)
          for(const other of marks)if(other.chart?.context===m.chart.context&&other.chart.name===m.chart.name)other.chart.triangle=true;
      }
      Object.assign(m,{x0:x0/W,x1:x1/W,y0:y0/H,y1:y1/H});
    }
  }
  window.CartesianPanels={findPlots,chartMarks,explanation,fitInk};
})();
