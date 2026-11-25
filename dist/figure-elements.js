(() => {
  'use strict';

  const clean = text => String(text || '').replace(/\s+/g, ' ').trim();
  const folded = text => clean(text).normalize('NFKC').toLowerCase();
  const contains = (sentence, label) => (' '+folded(sentence).replace(/[^\p{L}\p{N}]+/gu,' ')+' ').includes(' '+folded(label).replace(/[^\p{L}\p{N}]+/gu,' ').trim()+' ');

  // Some PDFs draw a math glyph as outlines between two text runs. Only
  // restore the symbol if the caption names it and the closing bracket aligns.
  function labels(words, caption) {
    const tail = new Set();
    const joined = words.map(w => {
      if (w.rotate || !/^exaggeration factor\s*\($/i.test(w.text.trim())) return w;
      const close = words.filter(v => v.text.trim()===')' && !v.rotate && v.x0>=w.x1-.002 && v.x0-w.x1<.06 && Math.abs(v.y0-w.y0)<(w.y1-w.y0)*.25);
      if (close.length!==1) return w;
      tail.add(close[0]);
      const symbol = /\bexaggeration\s+(?:values?|factors?|parameters?)\s*[(=]?\s*ρ/i.test(caption);
      return {...w, text:symbol?'Exaggeration factor (ρ)':'Exaggeration factor', x1:close[0].x1};
    });
    return joined.filter(w => !tail.has(w));
  }

  function reference(localCaption) {
    const m = clean(localCaption).match(/\bdistance correlations?\s+between\s+(UMAP|FA2|ForceAtlas2)\s+and\s+t[-‐‑–]SNE\b/i);
    return m ? (/umap/i.test(m[1])?'UMAP':'ForceAtlas2') : '';
  }

  function distanceGuide(method) {
    return {
      zh:'每条曲线对应一套数据。纵轴衡量同一批样本在 '+method+' 和 t-SNE 两种布局中的距离关系有多相似。沿同一条曲线向右读，可以看出改变 t-SNE 的夸大系数后，两种布局在何处最接近。',
      en:'Each curve represents a dataset. Its height measures how closely the distances among the same samples agree in the '+method+' and t-SNE layouts. Follow one curve to see which t-SNE setting gives the closest match.'
    };
  }

  function evidence(label, sources) {
    // Match a complete phrase in a sentence that actually defines the label.
    // A shared word or a bare occurrence in a list is insufficient.
    const name = clean(label);
    if (name.length<2 || !/[\p{L}]/u.test(name)) return null;
    const escaped = name.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
    const definition = new RegExp('(?:^|[^\\p{L}\\p{N}])'+escaped+'(?:\\s*[,（(][^()（）]{1,44}[）)]\\s*)?\\s+(?:is\\b|are\\b|denotes?\\b|represents?\\b|corresponds? to\\b|measures?\\b|was defined as\\b|indicates?\\b)|'+escaped+'(?:表示|代表|衡量|指的是)','iu');
    for (const s of sources) {
      const line = clean(s.text).split(/(?<=[.!?])\s+(?=[A-Z(])|(?<=。)/u).find(v=>v.length>=20 && v.length<=430 && definition.test(v));
      if (line) {
        const entry=[name,name,line,line,s.page];
        entry.localize=!/[\u3400-\u9fff]/u.test(line);
        entry.quote=line;
        return entry;
      }
    }
    return null;
  }

  function tableCell(word, words, row, page) {
    if (!row) return null;
    const t=clean(word.text), isolate=row.match(/(?:^|\n)Row:\s*([^|]+?)\s*\|/)?.[1];
    if (!isolate) return null;
    const make=(zh,en)=>[t,t,zh,en,page];
    if (folded(t)===folded(isolate)) return make(t+' 是这份临床分离株的编号。同一行列出了它的物种、基因检测结果和药物抑制其生长所需的浓度。',t+' identifies this clinical isolate. Its species, detected genes and susceptibility measurements are recorded across the same row.');
    if (/^bla/i.test(t)) return make('这是在 '+isolate+' 中检出的 β-内酰胺酶基因。它们描述这株菌的遗传背景。右侧两列的 MIC 则是对这株菌逐药测得的抑菌浓度。','These are β-lactamase genes detected in '+isolate+'. They describe its genetic background. The MIC columns report the drug concentrations measured for this same isolate.');
    if (/^[A-Z]\.\s+[a-z]+$|^[A-Z][a-z]+\s+[a-z]+$/.test(t)) return make(isolate+' 被鉴定为 '+t+'。同一物种可以有多株临床分离株，每个编号有各自的药敏读数。',isolate+' was identified as '+t+'. Isolates of the same species have separate susceptibility measurements under their own IDs.');
    if (/^[<>≥≤]?\s*\d+(?:\s*[-–]\s*\d+)?$/.test(t)) {
      const middle=(word.x0+word.x1)/2;
      const mic=words.find(v=>/\bMIC\s*\(\s*[µμu]g\s*\/\s*m[lL]\s*\)/i.test(v.text));
      if (!mic) return null;
      const headers=words.filter(v=>!v.rotate && v.y0>=mic.y1-.012 && v.y1<word.y0 && /^[A-Za-z][A-Za-z-]{2,}$/.test(v.text.trim()) && middle>=v.x0-.015 && middle<=v.x1+.015);
      if (headers.length!==1) return null;
      const drug=clean(headers[0].text);
      return make('这是 '+drug+' 对 '+isolate+' 的最低抑菌浓度（MIC），表中报告为 '+t+' μg/mL。'+(/^>/.test(t)?'大于号表示在列出的浓度仍有可见生长。':'MIC 是实验中能阻止可见生长的最低药物浓度。'),'The '+drug+' MIC for '+isolate+' is reported as '+t+' μg/mL. '+(/^>/.test(t)?'The greater-than sign means visible growth persisted at that concentration.':'MIC is the lowest drug concentration that prevents visible growth in this assay.'));
    }
    return null;
  }

  function explain(w, ctx) {
    const t=clean(w.text), {caption,reading={},page,captionPage=page,words=[],row,series,axis}=ctx;
    const sources=reading.sources||[], local=sources.find(s=>s.kind==='小图图注');
    const method=reference(local?.text), isRho=/^exaggeration factor\b/i.test(t);
    const card=(titleZh,titleEn,zh,en,src=page)=>[titleZh,titleEn,zh,en,src];
    const cell=tableCell(w,words,row,page);
    if (cell) return cell;
    if (method && (isRho || /^(distance correlation|UMAP|ForceAtlas2|FA2)$/i.test(t) || series)) {
      if (isRho) {
        const log=/log[- ]scale/i.test(caption);
        const fullRange=/[\[(]\s*1\s*[,–-]\s*100\s*[\])]/.test(caption);
        return card('横轴 · '+t,'Horizontal axis · '+t,
          'ρ 是 t-SNE 的夸大系数。ρ = 1 对应标准 t-SNE，增大它会加强近邻之间的吸引。'+(log?'横轴按对数排列，'+(fullRange?'从 1 到 10 和从 10 到 100 占相同宽度。':'相同的倍数变化占相同宽度。'):'')+'每条曲线的最高点给出这套数据与 '+method+' 布局最接近的 ρ。',
          'ρ scales the attraction between neighbours in t-SNE. A value of 1 gives standard t-SNE. '+(log?(fullRange?'The logarithmic axis gives 1 to 10 the same width as 10 to 100. ':'On this logarithmic axis equal ratios occupy equal widths. '):'')+'Follow one dataset’s curve to find the setting that most closely matches '+method+'.',captionPage);
      }
      if (/^distance correlation$/i.test(t)) return card('纵轴 · 距离相关性','Vertical axis · Distance correlation',
        '同一批样本各做一次 '+method+' 和 t-SNE 布局。纵轴越高，两种布局中的样本距离关系越一致。固定一个横轴位置，可比较不同数据集在同一 ρ 下与 '+method+' 的吻合程度。',
        'Each sample has coordinates in both layouts. Higher distance correlation means stronger agreement between their distance structures. At a fixed ρ, compare the heights for different datasets.',captionPage);
      if (series) {
        const peak=ctx.peak, measured=ctx.estimate?.x;
        if(measured){
          const value=ctx.estimate.y, heightZh=value==null?'':'，距离相关性约为 '+value.toFixed(2),heightEn=value==null?'':', with a distance correlation of about '+value.toFixed(2);
          return card((peak?'曲线最高点 · ':'图例 · ')+t,(peak?'Curve maximum · ':'Legend · ')+t,
            '按原图刻度估读，'+t+' 的曲线在 ρ ≈ '+measured+' 处达到最高'+heightZh+'。在作者比较的设置中，这时它的 t-SNE 布局与 '+method+' 的距离结构最吻合。',
            'Reading the plotted ticks, '+t+' peaks at ρ ≈ '+measured+heightEn+'. Of the tested settings, this t-SNE layout most closely matches the distance structure of '+method+' for this dataset.',captionPage);
        }
        return card((peak?'曲线最高点 · ':'图例 · ')+t,(peak?'Curve maximum · ':'Legend · ')+t,
          peak?'这个圆点标出 '+t+' 曲线的最高值。向下读 ρ，就是这些已测设置中 t-SNE 的距离结构与 '+method+' 最接近的那一个。':
            t+' 是这条曲线使用的数据集。沿同色线向右看，每个位置都是用同一套数据改变 t-SNE 的 ρ 后，与 '+method+' 布局比较得到的距离相关性。',
          peak?'This dot marks the maximum on the '+t+' curve. Its horizontal position gives the tested ρ at which t-SNE most closely matched '+method+' for this dataset.':
            'Follow the line keyed to '+t+'. Each point compares '+method+' with a t-SNE layout of that same dataset at the ρ shown below it.',captionPage);
      }
      if ((/^(?:ForceAtlas2|FA2)$/i.test(t)?'ForceAtlas2':t.toUpperCase())===method) return card(method+' · 比较参照',method+' · Reference layout',
        '这里用 '+method+' 生成参照布局。横向改变的是 t-SNE 的 ρ，每条线的高度表示同一套数据的 t-SNE 布局与这个参照的距离相关性。',
        method+' supplies the reference layout. Moving right changes ρ in t-SNE. A curve shows how the t-SNE layout for one dataset agrees with that reference.',captionPage);
    }
    if (/^UMAP$/i.test(t) && /embeddings?/i.test(caption) && /single.cell RNA.seq/i.test(caption) && reading.rows?.some(r=>r.en==='Shared figure context' && /represents a cell/.test(r.enText))) {
      return card('UMAP · 单细胞布局','UMAP · Single-cell layout','这里每个点代表一个细胞。UMAP 把基因表达特征相近的细胞放在邻近位置。'+(/time points/i.test(caption)?'对照图例的取样时间，可以看哪些时期的细胞在图中相邻。':''),
        'Each point is a cell. UMAP places cells with similar expression profiles near one another. '+(/time points/i.test(caption)?'Use the sampling-time legend to see which stages lie near each other.':''),captionPage);
    }
    if(/^(female|male|combined)$/i.test(t)&&/\bfemale\b/i.test(caption+' '+words.map(v=>v.text).join(' '))){
      const group={female:['雌性','female animals'],male:['雄性','male animals'],combined:['合并雌雄两组','both sexes pooled']}[t.toLowerCase()];
      const human=/\b(participants|patients|volunteers)\b/i.test(caption)&&!/\b(mice|mouse|rats?)\b/i.test(caption);
      return card(t,t,'本列汇总'+(human?group[0].replace('雌性','女性').replace('雄性','男性').replace('雌雄','男女'):group[0])+'的数据。沿纵轴读这一列各条件的测量值。','This category summarizes '+(human?group[1].replace('animals','participants'):group[1])+'. Read the vertical axis to compare the conditions in this category.');
    }
    if(/^relative expression$/i.test(t))return card(t,t,'纵轴表示相对于参照条件的表达水平。比较各组在同一尺度上的读数，读数越高，相对表达越高。','This axis measures expression relative to a reference condition. A higher value means higher relative expression.');
    if(/^mock$/i.test(t))return card(t,t,'Mock 是模拟处理对照，经历相应的对照操作，为比较实验处理后的读数提供基线。','Mock is the procedural control. Its measurement provides a baseline for comparing the experimental condition.');
    if(/^(no scratch|scratch)$/i.test(t))return card(t,t,/^no/i.test(t)?'No scratch 标出未抓挠条件的数据。与 Scratch 组比较，可读出两种条件下指标的差异。':'Scratch 标出抓挠条件的数据。与 No scratch 组对读，观察抓挠条件下指标的变化。',/^no/i.test(t)?'No scratch identifies measurements under the no-scratching condition. Compare them with Scratch.':'Scratch identifies measurements under the scratching condition. Compare them with No scratch.');
    if(/^bouts of scratching$/i.test(t))return card(t,t,'纵轴计数观察期内出现了多少阵抓挠行为。读数越高，记录到的抓挠阵次越多。','This axis counts scratching bouts during the observation period. Higher values mean more bouts.');
    if(/^spontaneous itch$/i.test(t))return card(t,t,'这个标题指自发性瘙痒。图中用观察到的抓挠行为来量化这一表现。','Spontaneous itch is the outcome. The figure uses observed scratching behavior to quantify it.');
    if(/^p\s*[=<>≤≥]\s*0?\.\d+$/i.test(t))return card(t,t,'这是图中标出的比较所对应的 P 值。它衡量在零假设及检验假定成立时，得到至少如此极端结果的概率。','This is the P value for the indicated comparison. Under the null hypothesis and test assumptions, it is the probability of a result at least this extreme.');
    const iteration=t.match(/^iter(?:ation)?s?\.?\s*(?:\(\s*1e(\d)\s*\))?$/i);
    if (iteration) {
      const n=iteration[1] && 10**Number(iteration[1]);
      return card(t,t,'这里数的是模型训练更新了多少次。'+(n?'刻度 1 代表 '+n.toLocaleString('en-US')+' 次更新，刻度 2 代表 '+(n*2).toLocaleString('en-US')+' 次。':'')+'在相同横坐标处比较各曲线，就对齐了训练进度。',
        'This axis counts training updates. '+(n?'A tick of 1 means '+n.toLocaleString('en-US')+' updates and 2 means '+(2*n).toLocaleString('en-US')+'. ':'')+'Compare curves at the same position to match training progress.');
    }
    const depth=t.match(/^(\d+)[ -]layers?$/i);
    if (depth && contains(caption,t) && /\bnetworks?\b/i.test(caption)) {
      const training=/^training error/i.test(axis||''),test=/^(?:test|testing) error/i.test(axis||'');
      return card(t,t,'这条线对应 '+depth[1]+' 层网络。'+(training?'纵向读它在训练集上的错误率。':test?'纵向读它在测试集上的错误率。':'')+'在同一横坐标处和另一条网络曲线比，可以看网络深度与读数的关系。',
        'This line represents the '+depth[1]+'-layer network. '+(training?'Its height gives training error. ':test?'Its height gives test error. ':'')+'Compare the other network at the same horizontal position.');
    }
    if (w.rotate && folded(axis)===folded(t)) {
      const entry=reading.rows?.find(r=>r.en==='Vertical axis' && r.enText && !/^The printed y-axis/i.test(r.enText));
      if (entry) return card(t,t,entry.zh,entry.enText);
    }
    if (series) return card('图例 · '+t,'Legend · '+t,'这段线的颜色和线型标识 '+t+'。'+(axis?'沿同样式的曲线读纵轴 '+axis+'。':'在图中沿对应曲线比较这一组的读数。'),
      'The colour and stroke identify '+t+'. '+(axis?'Follow this curve to read '+axis+' on the vertical axis.':'Follow the corresponding curve to compare readings for this group.'));
    const bar=t.match(/^(\d+(?:\.\d+)?)\s*([µμu]m|nm|mm)$/i);
    if (bar && /scale bars?|microscop|micrograph|显微|比例尺/i.test(caption)) return card('比例尺 · '+t,'Scale bar · '+t,'这段标尺对应 '+t+' 的实际长度。这个视野中，约两个标尺长的结构实际长度约为 '+(2*Number(bar[1]))+' '+bar[2]+'。','The bar spans '+t+' in this field. A feature twice as long is about '+(2*Number(bar[1]))+' '+bar[2]+' long.');
    const time=t.match(/^time\s*[\[(]\s*(h|min|s|days?)\s*[\])]$/i);
    if (time) {
      const unit={h:'小时',min:'分钟',s:'秒',day:'天',days:'天'}[time[1].toLowerCase()];
      return card(t,t,'这根轴用'+unit+'记录时间。两个位置的刻度差就是两次观察相隔的'+unit+'数。','This axis measures time in '+({h:'hours',min:'minutes',s:'seconds',day:'days',days:'days'}[time[1].toLowerCase()])+'. The difference between two ticks is the time elapsed between observations.');
    }
    const methodRow=reading.rows?.find(r=>r.en==='How to read it' && r.enText);
    if (methodRow && sources.some(s=>s.en==='Printed label' && folded(s.text)===folded(t)) &&
        !local && /\b(?:blur|sobel|cutout|noise|crop|flip|rotate|distort)\b/i.test(t)) return card(t,t,methodRow.zh,methodRow.enText);
    const definitions=ctx.lookupTerm?.(t,page);
    if(definitions?.length===1){
      const {full,page:sourcePage,text}=definitions[0];
      const entry=card(t,t,'本文将 '+full+' 简写为 '+t+'。',t+' stands for '+full+' in this paper.',sourcePage);
      entry.quote=text;return entry;
    }
    return evidence(t,sources.filter(s=>!/Printed|Full figure caption/.test(s.en||'')).concat({text:caption,page:captionPage}));
  }
  function passage(term,sources){
    for(const source of sources){
      const quote=clean(source.text).split(/(?<=[.!?])\s+(?=[A-Z(])|(?<=。)/u)
        .find(line=>line.length>=24&&line.length<=450&&contains(line,term));
      if(!quote)continue;
      const entry=[term+' · 原文说明',term+' · In the paper',quote,quote,source.page];
      entry.quote=quote;entry.localize=true;return entry;
    }
  }
  // Search the paper on demand when a label was not defined in its own figure.
  function paperPassages(sections){
    const sources=[],cache=new Map();
    const searchable=text=>' '+folded(text).replace(/[^\p{L}\p{N}]+/gu,' ').trim()+' ';
    for(const section of sections||[]){
      if(section.key==='references')continue;
      let page,lines=[],caption=false,headingTail=false;
      function flush(){
        const text=clean(lines.join(' '));lines=[];
        for(const sentence of text.split(/(?<=[.!?])\s+(?=[A-Z(])|(?<=。)/u)){
          if(sentence.length>=20&&sentence.length<=450)sources.push({page,text:sentence,index:searchable(sentence)});
        }
      }
      for(const row of section.rows||[]){
        if(row.page!==page){flush();page=row.page;caption=false;headingTail=false}
        if(!page||!row.text)continue;
        if(row.heading||row.fig||/^\d+(?:\.\d+)*\s+[A-Z][^.!?]{4,100}$/.test(row.text)){
          flush();caption=/^(?:fig(?:ure)?\.?|table|图|表)\s*S?\d+\s*$/iu.test(row.text);
          headingTail=!row.fig&&!caption;continue;
        }
        if(headingTail&&/^[a-z][a-z -]{1,53}$/.test(row.text))continue;
        headingTail=false;
        if(caption){caption=!/[.!?。！？]\s*$/.test(row.text);continue}
        lines.push(row.text);
      }
      flush();
    }
    return (term,page)=>{
      const key=page+'|'+folded(term);
      if(!cache.has(key)){
        const needle=searchable(term);
        const relevant=sources.filter(s=>s.index.includes(needle)).sort((a,b)=>Math.abs(a.page-page)-Math.abs(b.page-page));
        cache.set(key,evidence(term,relevant)||passage(term,relevant)||null);
      }
      return cache.get(key);
    };
  }
  function unresolved(term,page){
    const entry=[term,term,'已读出标注「'+term+'」，其在本图中的含义待核对。','The label reads “'+term+'”. Its meaning in this figure is unconfirmed.',page];
    entry.lookup=true;return entry;
  }
  function labelPassage(label,sources,lookup,page){
    const direct=lookup?.(label,page)||passage(label,sources);
    if(direct)return direct;
    // A diagram can wrap "SDF-1 expression" or a kinase's action across lines.
    // Only use a shorter match if there is one unambiguous named term in the label.
    const tokens=[...new Set((label.match(/[A-Za-zΑ-Ωα-ω][A-Za-zΑ-Ωα-ω\d]*(?:[-‐‑][A-Za-zΑ-Ωα-ω\d]+)*/gu)||[])
      .filter(t=>t.length>=3&&t.length<=26&&(/[A-Z].*[A-Z\d]|\d|[Α-Ωα-ω]/u.test(t))&&t!==label))];
    if(tokens.length!==1)return null;
    const term=tokens[0],matched=lookup?.(term,page)||passage(term,sources);
    if(!matched)return null;
    const entry=[label+' · '+term,label+' · '+term,matched[2],matched[3],matched[4]];
    entry.localize=matched.localize;entry.quote=matched.quote;return entry;
  }
  window.FigureElements={labels,reference,distanceGuide,explain,passage,paperPassages,unresolved,labelPassage};
})();
