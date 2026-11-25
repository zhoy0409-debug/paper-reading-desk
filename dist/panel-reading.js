(() => {
  'use strict';
  const tidy=s=>String(s||'').normalize('NFKC').replace(/(\p{L})-\s+(\p{Ll})/gu,'$1$2').replace(/\s+/g,' ').trim();
  const pair=(zh,en)=>({zh,en});
  const quantity='(-?\\d+(?:\\.\\d+)?\\s*%?)';
  const metricNames={accuracy:'准确率',recall:'召回率',precision:'精确率',sensitivity:'灵敏度',specificity:'特异度',concentration:'浓度',intensity:'信号强度',expression:'表达量',survival:'生存率'};
  function plainResult(text) {
    const hit=text.match(new RegExp('\\b('+Object.keys(metricNames).join('|')+')\\s+(increased|decreased|rose|fell)\\s+from\\s+'+quantity+'\\s+to\\s+'+quantity+'(?=[\\s,.;)]|$)','i'));
    const cn=text.match(/(准确率|召回率|精确率|灵敏度|特异度|生存率)(?:从|由)\s*(\d+(?:\.\d+)?\s*%)\s*(?:升至|提高到|降至|降低到|变为|增至)\s*(\d+(?:\.\d+)?\s*%)/);
    if((cn||hit) && !/\b(?:if|whether|hypothes\w*|expected|might|could|would|not)\b|如果|预计|假设/i.test(text)){
      // Quantities without units could have a unit outside the match. Use only explicitly percent results here.
      const a=cn?cn[2]:hit[3],b=cn?cn[3]:hit[4];
      if(a.includes('%')&&b.includes('%')){
        const delta=Number((parseFloat(b)-parseFloat(a)).toFixed(8));
        const metric=cn?Object.keys(metricNames).find(k=>metricNames[k]===cn[1]):hit[1].toLowerCase();
        return pair('原文报告'+metricNames[metric]+'从 '+a.trim()+' 变为 '+b.trim()+'，两者相差 '+Math.abs(delta)+' 个百分点。先对照图例确定两个值各对应哪一组。',
          'The reported '+metric+' changes from '+a.trim()+' to '+b.trim()+', a difference of '+Math.abs(delta)+' percentage points. Check which condition each value describes.');
      }
    }
  }
  const methods=[
    [/\btransport assay\b|转运测定/i,'这里看被测物的转移情况。先用图例认出每组条件，再在同一种读数里对照哪些组能检测到转移。','This assay tracks transfer. Identify the conditions in the legend and compare the same readout across them.'],
    [/\b(?:ATPase|enzymatic|enzyme) activit(?:y|ies)\b|酶活性/i,'这里读的是酶促反应有多快。先看坐标轴的单位，再比各组的反应速率。同一蛋白有多少，需要另外的读数。','Read the reaction rate and its units, then compare rates across groups. Protein abundance is a separate measurement.'],
    [/\bcryo[ -]?EM structures?\b|冷冻电镜结构/i,'先在不同视图中找同一结构，再比较标出的区域在空间上怎样排列。图上直接展示的是形状和位置，动作的先后要从其他证据核对。','Identify the same structure in each view before comparing positions. These images show spatial arrangements; a sequence of events needs separate evidence.'],
    [/psychometric functions?|心理测量函数/i,'横向改变刺激，纵向读观察者作出某个回答的比例。在相同回答比例下比较曲线的横向位置，可以看出达到这个比例分别需要怎样的刺激。','Read response probability as the stimulus changes. Compare curves at the same response probability to see which stimulus value is needed in each condition.'],
    [/discrimination thresholds?|辨别阈(?:值|限)/i,'辨别阈值指达到实验判别标准所需的刺激差异。在同一任务和判定标准下，阈值越低，表示越小的差异也能辨认。','The discrimination threshold is the difference needed to reach the response criterion. At the same criterion, a lower threshold means a smaller difference is detectable.'],
    [/laplacian eigenmaps/i,'这种画法把原始数据中互为近邻的样本尽量排在附近。先沿着点带看样本怎样逐渐过渡，再对照其他画法是否同样保留这条过渡。','Laplacian eigenmaps place nearby samples close together. Follow the local transitions and compare them with the other layouts.'],
    [/forceatlas\s*2/i,'把样本看成网络里的点，连边的点彼此吸引。先看连得紧的一群点落在哪里，再比较其他布局中这些点是否仍聚在一起。','ForceAtlas2 lays out a network using forces between nodes. Compare where groups of connected samples fall across layouts.'],
    [/\bt[\s-]?sne\b/i,'看一个点周围有哪些邻居。t-SNE 尽量让原始特征相近的样本在图上靠近；两个点团之间的空白有多宽，不能直接换算成原始差异有多大。','Read the local neighbours. t-SNE tries to place similar samples nearby. The width of an empty gap is not a scale for differences in the original data.'],
    [/\bumap\b/i,'UMAP 先找每个样本在原始数据中的近邻，再把这张近邻关系图铺在平面上。读图时先看哪些样本混在一起、哪些形成局部点群。','UMAP builds a neighbourhood graph and lays it out in a plane. Look first at which samples mix locally and which form groups.'],
    [/crop.{0,14}resize.{0,15}flip/i,'截取局部后，图像会被缩放，还可能左右翻转。先找同一处轮廓作参照，再分辨哪些差异来自取景、哪些来自朝向。','The crop is resized and may be flipped. Track a landmark to separate changes in framing from changes in orientation.'],
    [/crop.{0,10}resize|裁切.{0,6}缩放/i,'这里从原图截取一部分，再缩放到输出尺寸。与原图对照，看哪些物体仍在、哪些背景已被裁掉；物体看起来变大也可能只来自缩放。','A portion of the image is cropped and resized. Compare what remains in the frame and how much context was lost.'],
    [/gaussian blur|高斯模糊/i,'每个像素和邻近像素按距离加权平均，细小纹理和锐利边缘会变软。可以对照原图看轮廓还保留了多少。','Gaussian blur averages neighbouring pixels with distance-dependent weights. Compare fine textures and edges with the original image.'],
    [/gaussian noise|高斯噪声/i,'像素上加入随机扰动。对照原图中本来平滑的区域，观察多出来的明暗起伏。','Random changes are added to pixel values. Inspect fluctuations in regions that are smooth in the original.'],
    [/cutout/i,'图像的一块区域被遮住。请对照原图看丢失了哪些局部线索，哪些轮廓仍能辨认。','A patch is masked. Compare the local cues that disappear with the outline that remains visible.'],
    [/sobel/i,'这个滤波器突出像素强度变化快的位置，所以轮廓通常比平坦区域更显眼。','The Sobel filter highlights changes in pixel intensity, making edges stand out from flat areas.'],
    [/color distort.{0,12}jitter/i,'同一画面的颜色被扰动。对照原图看色彩外观的变化，物体在画面里的位置可作为对照线索。','Colour jitter alters colour appearance. Use the positions of objects as landmarks when comparing the images.'],
    [/colou?r distort.{0,12}drop/i,'这里去掉了原有的色彩信息。对照原图看哪些物体仍可凭形状或明暗区分，哪些原本要靠颜色辨认。','Colour information is dropped. Compare which features remain distinguishable by shape or brightness alone.'],
    [/\brotate\b|旋转/i,'同一画面改变了朝向。对照原图追踪同一物体；屏幕坐标改变并不表示物体本身发生变化。','Rotation changes orientation. Trace the same object across the images.'],
    [/\bROC\b|receiver operating characteristic/i,'沿曲线移动相当于改变判定阈值。读同一横坐标时，纵坐标越高，表示在相同假阳性率下检出的阳性越多。','Moving along the ROC curve changes the threshold. At a fixed false-positive rate, a higher true-positive rate means more positives are detected.'],
    [/kaplan.meier|生存曲线/i,'先选定同一个随访时点，再比较各组曲线的高度。纵轴是截至该时点仍未发生所定义事件的估计概率。','Compare the curves at the same follow-up time. Their heights estimate the probabilities of remaining event-free to that time.'],
    [/heat\s*maps?|热图/i,'每一格对应一对行、列标签。先在色标上找到颜色所代表的量和值，再沿同一行比较不同条件。如果按行标准化，同一种颜色表达的是各行内部的相对位置。','Match each cell to its row and column, then read the colour scale. For row-standardized values, colours are relative to the values within that row.'],
    [/dose.response|剂量.{0,2}反应/i,'按剂量从低到高跟踪同一个读数，找出开始变化和趋于平稳的位置。比较两条曲线时，在同一剂量下读出各自的响应。','Follow the response from low to high dose. When comparing curves, read both at the same dose and look for a plateau.'],
    [/fluorescence intensity|荧光强度/i,'这里量的是发光信号强弱。先对照背景或基线，再比较各组在同一通道中的强度；若做过归一化，数值表示相对信号。','This readout measures emitted signal. Compare groups in the same channel against the stated baseline and check whether the intensity was normalized.'],
    [/fold[ -]change|倍数变化/i,'先找归一化时使用的参照组，再读每组相对于参照改变了多少倍。若坐标取了对数，应按图示的对数底数还原倍数。','Identify the reference used for normalization. Fold change is a ratio to that reference; if the axis is logarithmic, interpret it on the stated log scale.'],
    [/box.?plots?|箱线图/i,'先按图注确认箱体、横线和须分别代表什么，再比较各组的中心与分散程度。箱体重叠与否本身不能替代统计检验。','Check how the caption defines the box, centre line and whiskers before comparing group location and spread.'],
    [/western blot|immunoblot|免疫印迹/i,'先按泳道找出样本，再看同一目标蛋白对应条带的位置与强弱。判断变化幅度时，要核对上样对照以及作者报告的定量。','Match lanes to samples, then compare bands for the same target. Check loading controls and reported quantification before judging the size of a change.'],
    [/micrograph|microscopy|显微图/i,'先用标尺确定实际大小，再按图例找同一通道和相同条件的视野。代表性视野能显示形态，组间差异的大小还要看多个样本的定量。','Use the scale bar and channel legend before comparing fields. A representative image shows morphology; group-level differences need sample-level measurements.']
  ];
  function timeText(value,unit){return value+({day:'天',month:'个月',week:'周',hour:'小时',year:'年'}[unit.toLowerCase().replace(/s$/,'')]||unit)}
  function sharedData(cap) {
    const single=/single.cell RNA.seq|单细胞转录/i.test(cap);
    const embedding=/embeddings?|降维布局/i.test(cap);
    if(embedding&&single && !/pseudobulk|aggregat(?:ed|ion)|cluster (?:means|centroids)|sample.level/i.test(cap)){
      const origin=/human brain organoids?/i.test(cap)?'人脑类器官':/mouse cortex/i.test(cap)?'小鼠大脑皮层':'样本';
      const n=cap.match(/\bsample size\s+(?:n\s*=\s*)?(\d+(?:[ ,]\d{3})*)/i);
      const t=cap.match(/\bbetween\s+(\d+)\s+(days?|months?|weeks?|hours?|years?)\s+and\s+(\d+)\s+(days?|months?|weeks?|hours?|years?)/i);
      return pair('整图比较的是'+origin+'的单细胞基因表达数据。'+(n?'图注给出的总样本量是 '+n[1].replace(/[ ,]/g,'')+'。':'')+(t?'取样从'+timeText(t[1],t[2])+'到'+timeText(t[3],t[4])+'。':'')+'图上每个点代表一个细胞；点的位置由表达特征计算得到。',
        'The figure compares layouts of single-cell gene-expression data. '+(n?'The caption reports a total sample size of '+n[1]+'. ':'')+(t?'Samples span '+t[1]+' '+t[2]+' to '+t[3]+' '+t[4]+'. ':'')+'A point represents a cell; its position is computed from its expression profile.');
    }
    if(/histograms? of pixel intensit/i.test(cap))return pair('整图把像素按强度分段统计。横向看像素的明暗水平，纵向看各区间出现得有多频繁。'+(/all axes have the same range/i.test(cap)?'作者说明坐标范围相同，可以直接对照各图的峰值位置和分布宽窄。':''),
      'These histograms count how frequently pixel intensities fall into different ranges.'+(/all axes have the same range/i.test(cap)?' The axes share a range, so the positions and widths of the peaks can be compared directly.':''));
    if(/illustrations? of.{0,32}(?:augmentation|transform)/i.test(cap))return pair('整图用图像实例展示不同的输入变换。这里可以直接比较画面发生了什么改变；要判断哪种处理能提高模型准确率，还需看性能数据。','These are examples of input transformations. Inspect the visual change here, and use performance measurements to judge its effect on accuracy.');
    return null;
  }
  function axisReading(axis){
    const printed=axis.trim(),stem=printed.replace(/\s*[(\[].*?[)\]]\s*$/,'').toLowerCase();
    const measures={'training error':['训练集错误率','training examples'],'test error':['测试集错误率','test examples'],
      'testing error':['测试集错误率','test examples'],'validation error':['验证集错误率','validation examples']};
    const measure=measures[stem];
    if(measure&&/%/.test(printed))return pair('纵轴是'+measure[0]+'（%），表示该数据集中有多少比例的样本被判错。曲线越低，判错的比例越小。',
      'The y-axis is the percentage of '+measure[1]+' classified incorrectly. A lower curve means fewer mistakes on that set.');
    return pair('原图把纵轴标为「'+printed+'」。在相同横坐标处，沿这根轴比较各组的读数。',
      'The printed y-axis reads “'+printed+'”. Compare the values at the same horizontal position.');
  }
  function micTable(words,box){
    const local=words.filter(t=>t.x0>=box.x0-1&&t.x1<=box.x1+1&&t.y0>=box.y0-1&&t.y1<=box.y1+1);
    const headers=local.filter(t=>/^MIC\s*\(\s*[µμ]g\s*\/\s*mL\s*\)$/i.test(t.text.trim()));
    if(headers.length!==1)return null;
    const h=headers[0],rows=[],measurements=local.filter(t=>t.base>h.base&&/^\s*[><≥≤]=?\s*\d+(?:\.\d+)?\s*$/.test(t.text));
    if(measurements.length<2||measurements.some(t=>t.x0<h.x0-h.size||t.x1>h.x1+h.size))return null;
    const names=local.filter(t=>t.base>h.base+1&&t.base<measurements[0].base&&t.x0>=h.x0-h.size&&t.x1<=h.x1+h.size&&/^[\p{L}][\p{L} -]+$/u.test(t.text));
    if(names.length!==1)return null;
    for(const t of measurements){
      const label=local.filter(v=>Math.abs(v.base-t.base)<h.size*.35&&v.x1<t.x0-1).sort((a,b)=>a.x0-b.x0).map(v=>v.text.trim()).join(' ').replace(/-\s+/g,'-');
      if(!/[\p{L}]/u.test(label)||rows.some(r=>r.label===label))return null;
      rows.push({label,value:t.text.trim().replace(/^([><≥≤])\s*/,'$1 ')});
    }
    return {drug:names[0].text,rows};
  }
  function build(figure,p,part,passage) {
    const cap=tidy(figure.caption), printed=tidy(p.printedTitle),text=tidy(part);
    const sources=[],rows=[];
    const source=(kind,en,value,page)=>{if(value&&!sources.some(s=>s.text===value&&s.page===page))sources.push({kind,en,text:value,page})};
    const row=(role,en,content)=>{if(content)rows.push({role,en,zh:content.zh,enText:content.en})};
    source('图内标注','Printed label',printed,figure.page);
    const captionPage=figure.captionPanelPages?.[p.id]||figure.captionPage||figure.page;
    source('小图图注','Panel caption',text,captionPage);
    const group=p.groupCaption;
    if(group)source('组内共用图注 · '+group.label,'Shared panel caption · '+group.label,group.text,captionPage);
    if(passage)source(passage.shared?'组内共用正文 · '+passage.shared:'提及本小图的正文',passage.shared?'Joint panel reference · '+passage.shared:'Panel-specific text',passage.text,passage.page);
    if(p.mic){
      const m=p.mic,values=m.rows.map(r=>r.label+'　'+r.value+' μg/mL').join(' / ');
      row('表内实际测量','What the table measures',pair('作者分别测了 '+m.drug+' 对表中各受测菌株的最低抑菌浓度（MIC）。这个量表示在试验条件下抑制可见生长所需的最低药物浓度。','The minimum inhibitory concentration (MIC) is the lowest drug concentration that prevents visible growth under the test conditions. Each row is a tested bacterial isolate or group.'));
      row('逐行读数','Read each row',pair(values,values));
      if(m.rows.every(r=>r.value.startsWith('> ')&&r.value===m.rows[0].value)){
        const v=m.rows[0].value.slice(2);
        row('大于号怎么读','Read the greater-than sign',pair('到 '+v+' μg/mL，表中这些受测菌株仍有可见生长。实验给出 MIC 的下限，确切 MIC 待定。','Visible growth persisted at '+v+' μg/mL for these isolates. The table gives a lower bound for the MIC. Its exact value is unresolved.'));
      }
      if(passage?.shared)row('正文如何引用','How the text cites this panel',pair('作者在第 '+passage.page+' 页合引 '+passage.shared+'。下面可打开这句原文，核对哪些结论涉及两张表。','On p.'+passage.page+' the authors cite '+passage.shared+' together. Open the shared passage below to check its scope.'));
      source('图内表格','Printed table',m.drug+' · MIC (μg/mL) · '+values,figure.page);
      return {kind:'table',rows,sources,narration:m.drug+' · MIC · '+values};
    }
    // Separate the chemical drawing from the two state-specific structural closeups.
    const chemical=cap.match(/\b([a-z])\s+Chemical structure of ([\w-]+)\./);
    const states=cap.match(/Detailed interactions between ([\w-]+) and key residues in the ([\w-]+) state \(([a-z])\) and ([\w-]+) state \(([a-z])\) of ([\w-]+)/i);
    if(/cryo[-‐‑ ]?EM density maps/i.test(text)&&/cartoon representation/i.test(text)&&/wide[- ]cavity/i.test(text)&&/narrow[- ]cavity/i.test(text)){
      row('图中展示什么','What the panel shows',pair('把宽腔和窄腔两组图并排看。每组的密度图来自冷冻电镜重建，旁边的带状图显示作者怎样把蛋白结构放入密度。先看腔体开口，再比较蛋白各部分的位置。','Compare the wide and narrow cavities. Each density map comes from a cryo-EM reconstruction. The adjacent ribbon drawing shows how the authors fit the protein structure into that density. Compare the opening and the positions of the protein domains.'));
      row('这张图能说明什么','What this comparison shows',pair('这里可以辨认两种不同的构象。它们先后怎样变化，需要时间或功能证据来判断。','The comparison distinguishes two conformations. Their order in the transport cycle requires timing or functional evidence.'));
      return {kind:'structure',title:['两种腔体形状有何不同？','How do the two cavities differ?'],rows,sources,narration:rows[0].zh};
    }
    if(chemical&&p.id===chemical[1]){
      const sentence=chemical[0].slice(2);
      row('读这张结构式','Reading the chemical drawing',pair('这是 '+chemical[2]+' 的化学结构式。线表示原子间的化学键，图中给部分基团着色，便于在旁边的结合位点图中找到它们。','This is the chemical structure of '+chemical[2]+'. Lines represent bonds between atoms. Compare the labelled groups with the adjacent binding-site views.'));
      source('小图图注','Panel caption',sentence,captionPage);
      return {kind:'structure',title:['药物分子长什么样？','What does the molecule look like?'],rows,sources,narration:rows[0].zh};
    }
    if(states&&[states[3],states[5]].includes(p.id)){
      const state=p.id===states[3]?states[2]:states[4],name=({'wide-cavity':'宽腔','narrow-cavity':'窄腔'})[state]||state;
      row('在比什么','What to compare',pair('这格放大 '+states[6]+' 的'+name+'状态，显示 '+states[1]+' 在结合腔中与哪些残基相邻。对照另一格，可以看见同一配体在另一种腔体构象中的位置。','This close-up shows '+states[1]+' and nearby residues of '+states[6]+' in the '+state+' state. Compare it with the other state to see how the ligand sits within each cavity.'));
      row('证据范围','What the view establishes',pair('两幅结构可比较空间位置。单凭这两幅图无法读出状态转变的先后或结合强度。','The structures show spatial relationships. The sequence of transitions and the binding strength require separate evidence.'));
      source('两格共用图注','Shared caption',states[0],captionPage);
      return {kind:'structure',title:[name+'状态下药物在哪里？','Where is the drug in the '+state+' state?'],rows,sources,narration:rows[0].zh};
    }
    if(p.checkedGuide){
      const g=p.checkedGuide;
      if(p.id==='a'&&text){
        sources.length=0;
        source('小图图注','Panel caption',text.split(/(?<=[.!?。])\s/)[0],captionPage);
      }
      return {kind:'checked',title:g.title,rows:g.rows,narration:g.narration,axis:g.axis,sources};
    }
    if(p.axis){
      source('图内纵轴','Printed y-axis',p.axis,figure.page);
      if(Array.isArray(p.curveLabels)){
        const labels=p.curveLabels,joined=labels.join(' / ');
        if(labels.length>=2)row('在比什么','What is compared',pair('本图和图注共同标出了 '+joined+'。沿横轴选同一个位置，比较这些曲线的高度。',
          'Both the plot and caption identify '+joined+'. Compare their heights at the same horizontal position.'));
        row('纵轴读什么','Vertical axis',axisReading(p.axis));
        const stem=p.axis.replace(/\s*[(\[].*?[)\]]\s*$/,'').toLowerCase();
        const sentences=cap.split(/(?<=[.。!?])\s+(?=[A-Z])/u);
        const directional=sentences.filter(s=>s.toLowerCase().includes(stem)&&/\b(?:higher|lower|greater|smaller)\b/i.test(s)&&
          !/\b(?:if|might|could|would|not|hypothes\w*|expect\w*)\b/i.test(s));
        const layers=labels.map(t=>/^(\d+)[ -]layers?$/i.exec(t)).filter(Boolean).map(m=>Number(m[1])).sort((a,b)=>a-b);
        let outcome;
        if(directional.length===1){
          const sentence=directional[0],hit=sentence.match(/^The (deeper|shallower) (?:network|model) (?:has|shows) (higher|lower) (.+?)[.!]?$/i);
          if(hit&&layers.length===2&&labels.length===2&&layers[0]!==layers[1]){
            const terms=hit[3].toLowerCase().replace(/[.!]$/,'').split(/,?\s+and\s+(?:(?:thus|also)\s+)?/);
            if(terms.includes(stem)){
              const deeper=hit[1].toLowerCase()==='deeper',higher=hit[2].toLowerCase()==='higher';
              const [a,b]=deeper?[layers[1],layers[0]]:layers;
              outcome=pair('作者报告，'+a+' 层网络的这项读数比 '+b+' 层网络更'+(higher?'高':'低')+'。'+(/error/.test(stem)?'对应的是这个数据集上的分类错误比例。':''),
                'The authors report a '+(higher?'higher':'lower')+' '+stem+' for the '+a+'-layer network than for the '+b+'-layer network.');
            }
          }
          source('作者报告的比较','Reported comparison',sentence,figure.captionPage||figure.page);
        }
        row('结果说明什么','What the result supports',outcome||pair('原图可用于比较这些曲线。差值、统计显著性和原因需要核对相应原文或数值。',
          'The curves allow a visual comparison. Check the article or numerical data for the size, significance and explanation of a difference.'));
        source('整图图注','Full figure caption',cap,figure.captionPage||figure.page);
        return {kind:'axis',axis:p.axis,rows,sources,narration:outcome?.zh||''};
      }
      row('纵轴读什么','Vertical axis',axisReading(p.axis));
    }
    const context=sharedData(cap);
    let focus=null,interpretation=null;
    if(printed){
      const setting=printed.match(/^=\s*([-+−]?\d+(?:\.\d+)?)$/);
      if(setting){
        focus=pair('这张小图标出的设定值为 '+setting[1]+'。原 PDF 的符号没有进入文字层，请在图上核对等号左侧。','This panel shows a setting of '+setting[1]+'. Check the symbol before the equals sign on the image.');
        if(/embedding/i.test(cap))interpretation=pair('对照其他设定下同一批样本的排列，看相近样本是连成一带，还是分成几个团。这里改变的是数据的布局方式。','Compare the arrangement of the same samples at other settings. Look for continuous bands or separate groups as the layout changes.');
      }else if(/^(?:with|without)\s+colou?r distortion[. ]*$/i.test(printed)){
        const withColor=!/^without/i.test(printed);
        focus=pair(withColor?'这一栏对裁切图做了颜色扰动。对照未扰动的一栏，看同一幅原图的不同裁块是否仍有相似的亮度分布。':'这一栏保留裁切图原有的颜色。对照做了颜色扰动的一栏，看仅靠亮度分布还能多容易地认出来自同一原图的裁块。',
          withColor?'These crops undergo colour distortion. Compare their intensity distributions with those of the unaltered crops.':'These crops retain their original colours. Compare with the distorted condition to see how informative the intensity distributions are.');
      }else focus=pair('图中标作「'+printed+'」。','The printed condition is “'+printed+'”.');
    }
    if(/^original(?: image)?\.?$/i.test(printed)&&/augmentation/i.test(cap)){
      focus=pair('这是变换前的原图，可用来逐一对照其他小图。选定一处边缘、一块纹理和一片背景，跟踪它们在各个处理后的变化。','Use the unmodified input as the reference. Follow one edge, one texture and one patch of background through the transformations.');
    }
    const candidates=methods.filter(([re])=>re.test(text));
    const panelMethod=candidates.length===1&&!/compared (?:with|to)|versus|\bwithout\b|\bnot\b|而非|未采用/i.test(text)?candidates[0]:null;
    const method=panelMethod||methods.find(([re])=>re.test(printed));
    const refMethod=window.FigureElements?.reference(text);
    if(refMethod)interpretation=FigureElements.distanceGuide(refMethod);
    else if(method)interpretation=pair(method[1],method[2]);
    const direct=plainResult(text)||(!passage?.shared&&plainResult(passage?.text||''));
    const conditions=text.match(/^(.{3,110}?)\s+(?:in the presence of|in the absence of|with and without|before and after)\s+([^.;]{3,145})(?=[.;]|$)/i);
    if(conditions){
      const measure=conditions[1].trim(),condition=conditions[2].trim();
      const wording=/in the absence of/i.test(conditions[0])?'未加入':/with and without/i.test(conditions[0])?'加入及未加入':/before and after/i.test(conditions[0])?'前后的条件涉及':'体系中含有';
      focus=pair('作者在这张图中观察「'+measure+'」，'+wording+'「'+condition+'」。请结合图例找到实际比较的组别。','The panel describes “'+measure+'”. The stated conditions are in the caption below.');
    }else if(text)focus=null;
    if(!focus&&!text&&passage)focus=pair('正文明确提到了小图 '+p.label+'，可用这句原文核对作者关注的比较。','The article explicitly refers to panel '+p.label+' in the quoted passage.');
    row('这张看什么','What to inspect',focus);
    if(text && !plainResult(text)){
      const lead=text.split(/(?<=[。！？])\s*|(?<=\.)\s+(?=[A-Z])/u)[0];
      row('原文怎样描述这张图','Panel-specific description',pair(lead,''));
    }
    row('怎么读','How to read it',interpretation);
    if(group){
      const lead=group.text.split(/(?<=[.!?。])\s+(?=[A-Z])/u)[0];
      let zh=lead,en=lead;
      if(/\babsolute values?\b/i.test(group.text)){
        zh='按绝对值比较时，数值体现偏离零的大小，正负方向已被去掉。';
        en+=' Absolute values show the size of a departure from zero and omit its sign.';
      }
      row('这些小图一起说明什么','Shared panel description',pair(zh,en));
    }
    if(text){
      const contrast=text.match(/\b(?:plotting|comparing)\s+([^.;]{3,130}?)\s+(?:against|with|versus)\s+([^.;]{3,130})(?=[.;]|$)/i);
      if(contrast)row('哪两项放在一起比','What is compared',pair('这里把「'+contrast[1].trim()+'」与「'+contrast[2].trim()+'」相比较。先依据图例找到同一条件的两个读数，再看差异的方向。','The caption compares “'+contrast[1].trim()+'” with “'+contrast[2].trim()+'”. Match the two measurements before interpreting their difference.'));
      const unit=text.match(/\beach (?:data )?point (?:is for|represents|corresponds to|denotes)\s+([^.;]{3,115})(?=[.;]|$)/i);
      if(unit)row('一个点代表什么','What a point represents',pair('作者说明，每个点对应「'+unit[1].trim()+'」。这决定了图上的一个点能代表哪一层观测。','Each point corresponds to “'+unit[1].trim()+'”. This is the observation represented by a plotted point.'));
      const spread=/\b(mean|median)\b.{0,24}(?:±|\+\/-|with|and)\s*(?:the\s+)?(SD|SEM|standard deviation|standard error(?: of the mean)?|95% (?:confidence intervals?|CI))\b/i.exec(text);
      if(spread){
        const center=spread[1].toLowerCase()==='median'?'中位数':'平均数',term=spread[2];
        const sd=/^(?:sd|standard deviation)$/i.test(term),ci=/95%/.test(term);
        row('数值与误差','Estimate and uncertainty',pair('先比较各条件的'+center+'。'+(sd?'这里的 '+term+' 表示各个观测值的离散程度。':ci?'这里的 95% 区间表示估计的不确定性。':'这里的 '+term+' 表达均值估计的不确定性。'),
          'Compare the '+spread[1].toLowerCase()+' across conditions. '+(sd?'The spread describes variability among observations.':'The interval or error describes uncertainty in the estimate.')));
      }
      if(!interpretation&&!direct){
        const compare=text.match(/\b(?:versus|compared (?:with|to)|relative to)\s+([^.;]{2,85})/i);
        if(compare)row('比较对象','Comparison',pair('原文将「'+compare[1].trim()+'」列为比较对象。先核对图例里的两组，再按读数和单位判断差异的方向与大小。','The stated comparator is “'+compare[1].trim()+'”. Identify both groups in the legend and use the reported readout and unit to judge direction and size.'));
      }
      const n=text.match(/(?:\bsample size\s*[:=]?\s*(?:n\s*=\s*)?|\bn\s*=\s*)(\d[\d,]*)\s*(independent experiments|biological replicates|technical replicates|patients|participants|animals|cells|samples)\b/i);
      if(n){
        const units={'independent experiments':'次独立实验','biological replicates':'个生物学重复','technical replicates':'个技术重复','patients':'名患者','participants':'名参与者','animals':'只动物','cells':'个细胞','samples':'个样本'};
        row('读数来自哪里','What was counted',pair('图注明确计入 '+n[1]+' '+units[n[2].toLowerCase()]+'。图上误差或分散程度应按这个计数单位理解。','The caption counts '+n[1]+' '+n[2]+'. Interpret variability at the stated unit.'));
      }
      if(/\bpaired (?:samples|measurements|observations)\b|\bmatched pairs\b|配对(?:样本|测量)/i.test(text)){
        row('怎样比较','Paired comparison',pair('图注写明观测值是配对的。先看同一对里的两个值怎样变化，再看各对是否大多朝同一个方向变化。','The observations are paired. Compare the two values within each pair, then check whether the direction is consistent across pairs.'));
      }
    }
    if(direct)row('读到的变化','Reported change',direct);
    const reported=text.match(/(?:^|[.!?]\s+)([A-Z][^.;:]{0,64}?)\s+(reduced|increased)\s+([^.;:]{2,75}?)\s+to (?:levels|values) (?:comparable|similar) to ([^.;:]{2,72}?)(?=[.;]|$)/);
    let comparison;
    if(reported&&!/\b(?:if|whether|could|would|might|not|may|no|data (?:in|are)|representative of)\b/i.test(reported[0])){
      const [,condition,verb,measure,reference]=reported;
      comparison=pair('作者报告，「'+condition+'」使「'+measure+'」'+(verb==='reduced'?'降低':'升高')+'，达到与「'+reference+'」相近的水平。','The authors report that “'+condition+'” '+verb+' “'+measure+'” to levels similar to “'+reference+'”.');
      row('作者报告的比较','Reported comparison',comparison);
    }
    if(context)row('整图共用的读法','Shared figure context',context);
    if(context || (!text&&!passage))source('整图图注','Full figure caption',cap,captionPage);
    if(passage&&!text&&!direct)row(passage.shared?'作者对这组小图的表述':'作者对这张图的表述',passage.shared?'Shared statement':'Author’s statement',pair(passage.text,''));
    if(!interpretation&&!direct&&!text&&!passage&&!group)row('还要核对什么','What to verify',pair(printed?'只定位到图内文字。请对照原页的图例和图注，核对比较组、测量指标和变化方向。':'尚未定位到这块裁切的单独说明。请在原页核对小图字母和图注。','Check the printed panel and its caption for the groups, measurement and direction of change.'));
    if(figure.authorPassages?.length&&context){
      const hit=figure.authorPassages[0];
      source('作者对整图的解释','Author interpretation of the figure',hit.text,hit.page);
      if(/stronger attraction.{0,55}better represented.{0,30}trajectory.{0,35}stronger repulsion.{0,55}better represented.{0,30}cluster structure/i.test(hit.text)){
        row('作者怎样解释整组对照','Authors’ figure-level interpretation',pair('作者比较这些布局后认为，较强的吸引作用更容易看出连续的发育变化，较强的排斥作用则让细胞分群更清楚。这是对同一批细胞不同画法的比较，单个点的位置不能证明一个细胞后来变成了哪个细胞。','The authors report that stronger attraction highlights developmental continuity, while stronger repulsion highlights clusters. These layouts compare the same cells; a point position does not establish a cell’s subsequent fate.'));
      }
    }
    const shortRead=interpretation?.zh.match(/^[^。！？]+[。！？]?/)?.[0];
    const display=/^=\s*\d/.test(printed)?'图中设定值为 '+printed.slice(1).trim():printed?'「'+printed+'」':'';
    const complete=text.match(/^.*?[。！？](?=\s|$)|^.*?\.(?=\s+[A-Z]|$)/u)?.[0];
    const narration=direct?direct.zh.split('。')[0]+'。':comparison?comparison.zh:conditions?focus.zh.split('。')[0]+'。':shortRead?(display&&!text?display+'，':'')+shortRead:complete||'';
    const narrationEn=direct?.en||comparison?.en||(conditions?focus?.en:'')||interpretation?.en||complete||'';
    return {rows,sources,narration,narrationEn};
  }
  function passages(rows,figure) {
    const number=figure.matchKey?.split(':')[1];const out=new Map();
    if(!/^[A-Z]*\d+$/.test(number||''))return out;
    const ref=new RegExp('(?:\\bFig(?:ure)?s?\\.?\\s*|图\\s*)'+number+'(?:\\s*\\(([a-z])\\)|([a-z])\\b)','gi');
    for(let i=0;i<rows.length;i++){
      const r=rows[i];if(r.fig||!r.mentions?.some(k=>k===figure.matchKey||(k.startsWith(figure.matchKey)&&/^[A-Z]$/.test(k.slice(figure.matchKey.length)))))continue;
      let start=i,end=i;
      while(start>0&&i-start<7&&rows[start-1].page===r.page&&!rows[start-1].fig&&!rows[start-1].heading&&!/[.!?。]$/.test(rows[start-1].text))start--;
      while(end+1<rows.length&&end-i<7&&rows[end+1].page===r.page&&!rows[end+1].fig&&!rows[end+1].heading&&!/[.!?。]$/.test(rows[end].text))end++;
      const para=tidy(rows.slice(start,end+1).map(x=>x.text).join(' '));
      for(const sentence of para.split(/(?<=[。!?])\s*|(?<=\.)\s+(?=[A-Z])/u)){
        const hits=[...sentence.matchAll(ref)];
        if(hits.length!==1||sentence.length<20||sentence.length>700)continue;
        const m=hits[0],tail=sentence.slice(m.index+m[0].length);
        if(/(?:supp(?:lement(?:al|ary)?)?\.?|extended\s+data|appendix|补充|扩展)\s*$/i.test(sentence.slice(0,m.index)))continue;
        const id=(m[1]||m[2]).toLowerCase(),ids=[id];
        const list=tail.match(/^(?:\s*(?:,?\s+and\b|,|[-–—])\s*\(?[a-z]\b\)?)+/i)?.[0]||'';
        for(const extra of list.matchAll(/(,?\s+and\b|,|[-–—])\s*\(?([a-z])\b/gi)){
          const last=extra[2].toLowerCase().charCodeAt(0),first=ids.at(-1).charCodeAt(0);
          if(/[-–—]/.test(extra[1])&&last>first){for(let c=first+1;c<=last;c++)ids.push(String.fromCharCode(c))}
          else ids.push(extra[2].toLowerCase());
        }
        if(ids.some(k=>!figure.panels.some(p=>p.id===k))||/^\s*(?:[-–—]|,\s*\d|\bor\b)/i.test(tail.slice(list.length)))continue;
        // Different figure or table references in the same sentence can refer to another measurement.
        const remaining=sentence.slice(0,m.index)+' '+tail;
        if(/(?:\b(?:fig(?:ure)?s?|tables?)\.?\s*\d|[图表]\s*\d)/i.test(remaining))continue;
        for(const k of ids)if(!out.has(k)||ids.length===1&&out.get(k).shared)out.set(k,{text:sentence,page:r.page,shared:ids.length>1?ids.join(' + ').toUpperCase():''});
      }
    }
    return out;
  }
  window.PaperPanelReading={build,passages,micTable};
})();
