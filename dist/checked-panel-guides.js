// Reader's notes checked against the printed panels and caption in this PDF edition.
// literature-reader attaches these only after checking the file fingerprint and pages.
(() => {
  'use strict';
  const five=['五组从左至右是假处理（sham）、感染后仅给载体（vehicle）、abaucin、美罗培南（MEM）和哌拉西林（PIP）。先用 sham 看基线，再把三种治疗分别与 vehicle 比。','From left to right: sham, infected vehicle control, abaucin, meropenem (MEM) and piperacillin (PIP). Sham gives the baseline. Vehicle is the reference for comparing treatments.'];
  const four=['只比较感染后的四组：载体、abaucin、美罗培南（MEM）和哌拉西林（PIP）。','Four infected groups are shown: vehicle, abaucin, meropenem (MEM) and piperacillin (PIP).'];
  const entries={
    a:{title:['这组证据怎样连起来','How the outcomes fit together'],
      compare:['先认出假处理基线、感染载体对照和治疗组，再看后面每一种读数对应哪一组。','Identify the sham baseline, infected vehicle control and treatment groups. These groups are the reference points for the later panels.'],
      read:['流程图的箭头表示研究顺序。这里没有表示疗效大小的纵轴。','The arrows show the order of the study. There is no numerical efficacy axis.'],
      result:["A 给出研究顺序。先感染，随后给药，最后在同一终点比较肺组织、炎症和呼吸功能。", "A establishes the study order. Infection preceded treatment, then tissue injury, inflammation and breathing were compared at a common endpoint."]},
    b:{title:['在切片上辨认肺组织损伤','Recognising injury in lung sections'],compare:five,
      read:['看 H&E 染色切片里的白色肺泡腔、周围薄壁和深染细胞。下排放大上排虚线框内的区域，标尺为 20 µm。','In the H&E sections, look at the open air spaces, their thin walls and the dark-staining cells. The bottom row enlarges the boxed regions above. The scale bar is 20 µm.'],
      result:['载体组的肺泡间隔较厚，细胞聚集较多。abaucin 和 MEM 组的代表视野保留了更多开放气腔。每组整体差异可接着看 C 的评分。','The vehicle example has thicker septa and more densely packed cells. More air spaces remain open in the abaucin and MEM examples. Panel C quantifies injury across animals.']},
    c:{title:['肺组织损伤有多重？','How severe is the tissue injury?'],compare:five,axis:'Lung injury score',
      read:['纵轴是肺损伤评分，单位为分。研究者按切片上的病理改变打分，分数越高，组织损伤越重。B 给你看形态，C 把这种损伤量化。','The vertical axis is a lung injury score in points. More severe changes on the tissue sections receive higher scores. B shows the appearance. C puts a number on the injury.'],
      result:["按柱高粗读，感染溶媒组约 12 分，abaucin 组约 5 分，美罗培南组约 6 分。哌拉西林组接近感染溶媒组。B 中看到的组织差异，在 C 的评分中也能看到。", "Approximate scores are 12 for infected vehicle, 5 for abaucin and 6 for meropenem. Piperacillin is close to vehicle. The scores quantify the tissue differences illustrated in B."],
      say:'感染载体组的肺损伤评分约 12 分，abaucin 组约 5 分，后者组织损伤较轻。'},
    d:{title:['气道液体里能检出多少活菌？','How many viable bacteria are detected in airway fluid?'],compare:four,axis:'Log (CFU mL⁻¹)',
      read:['纵轴是支气管肺泡灌洗液（BALF）中每毫升菌落形成单位的对数。读的是可形成菌落的活菌负担，纵轴相同间距表示相同倍数的变化。','The vertical axis shows log colony-forming units per millilitre of bronchoalveolar lavage fluid (BALF). It measures viable bacterial burden. Equal steps on this scale represent equal fold changes.'],
      result:["与感染溶媒组相比，abaucin 和美罗培南组的灌洗液活菌负荷较低，哌拉西林组接近溶媒组。", "Viable bacterial burden in lavage fluid is lower with abaucin and meropenem than with infected vehicle. Piperacillin is close to vehicle."]},
    e:{title:['整肺的肉眼外观','Gross appearance of the lungs'],compare:four,
      read:['对照四张整肺照片的颜色和斑驳区域。下方尺子提供大小参照；照片本身没有定量纵轴。','Compare colour and patchiness in the four whole-lung photographs. The ruler provides a size reference. There is no quantitative vertical axis.'],
      result:["把照片作为定位线索。想看外观差异对应怎样的组织变化，读 B 的切片和 C 的评分；想比较各组的活菌负荷，读 D。", "Use the photos to orient the next comparison. B shows the tissue sections, C scores injury across animals, and D measures viable bacterial burden."]},
    f:{title:['气道液体中的 IL-1β','IL-1β in airway fluid'],compare:five,axis:'BALF IL-1β (pg mL⁻¹)',
      read:['纵轴是灌洗液中炎症信号蛋白白细胞介素-1β 的浓度，单位为 pg/mL。读的是单位体积内的蛋白量。','The vertical axis is the concentration of interleukin-1β, an inflammatory signalling protein, in lavage fluid, in pg/mL. It measures protein per unit volume.'],
      result:["abaucin 组的 IL-1β 浓度低于感染溶媒组。B、C 已经从形态和评分描述肺损伤，F 再从气道液体中读出一个局部炎症信号。", "IL-1β is lower with abaucin than with infected vehicle. B and C describe tissue injury. F adds a measure of local inflammation in airway fluid."]},
    g:{title:['气道液体中的 IL-6','IL-6 in airway fluid'],compare:five,axis:'BALF IL-6 (pg mL⁻¹)',
      read:["纵轴是灌洗液中白细胞介素-6 的浓度，单位为 pg/mL。先在 G 内比较感染溶媒组和给药组，再看 F 中另一种炎症蛋白是否有相同的变化方向。", "The vertical axis gives lavage-fluid interleukin-6 in pg/mL. Compare infected vehicle with treatment within G, then check whether the second inflammatory protein in F changes in the same direction."],
      result:['abaucin 和 MEM 组的 IL-6 较低，PIP 组仍接近载体组。与 F 并读，可见两种炎症指标在 abaucin 组均较载体组低。','IL-6 is lower in the abaucin and MEM groups, while PIP stays near vehicle. Read with F, two distinct inflammatory signals are lower with abaucin than with vehicle.']},
    h:{title:['测量时的小鼠体重','Body weight at measurement'],compare:five,axis:'Body Weight (g)',
      read:["纵轴是体重，单位为克。各柱汇总不同组小鼠在同一终点的体重，帮助读者判断肺部变化是否伴随整体状态的差异。", "The vertical axis gives body weight in grams. Each bar summarizes a separate group at the same endpoint, adding a whole-animal measure to the lung findings."],
      result:['abaucin 组平均体重高于载体组，仍低于 sham 组的图示水平。这支持治疗组在此时点体重保持得较好。','Mean weight is higher with abaucin than with vehicle and remains below the plotted sham mean. This supports better preservation of body weight at this time point.']},
    i:{title:['每分钟能通多少气？','How much air moves in a minute?'],compare:five,axis:'Minute Ventilation (mL)',
      read:['纵轴是每分钟通气量（MV），即一分钟内吸入或呼出的总气量，等于一次呼吸的气量乘以每分钟呼吸次数。原图轴标为 mL。这个指标同时受呼吸深浅和快慢影响。','Minute ventilation (MV) is the total volume of air moved in one minute: volume per breath multiplied by breaths per minute. The printed axis uses mL. Either deeper or faster breathing can change this readout.'],
      result:["按柱高粗读，感染溶媒组约 90，abaucin 组约 130，假处理组约 170。治疗组的通气量介于两者之间，提示呼吸功能部分改善。", "The bars read roughly 90 for infected vehicle, 130 for abaucin and 170 for sham. Ventilation in the treated group lies between the two controls, indicating partial improvement."],
      say:'abaucin 组的每分钟通气量高于感染载体组，仍低于假处理组的图示均值，提示通气部分改善。'}
  };
  function forPanel(id){
    const g=entries[id];if(!g)return null;
    const row=(role,en,[zh,enText])=>({role,en,zh,enText});
    return {title:g.title,axis:g.axis,rows:[row('在比什么','What is compared',g.compare),
      row(g.axis?'纵轴读什么':'看图位置',g.axis?'Vertical axis':'What to look at',g.read),
      row('结果说明什么','What the result supports',g.result)],narration:g.say||g.result[0].split('。')[0]+'。'};
  }
  // The reader attaches these concise Chinese notes only for the verified edition.
  // Each one is shown with the exact English sentence and page detected in that PDF.
  const contextNotes=[
    [/^Clinical isolates often display resistance to nearly all available antibiotics except tigecycline and polymyxins\b/i,'临床分离株对多种抗生素耐药，可用的治疗选择有限。'],
    [/^A recent machine-learning-guided screen identified abaucin\b/i,'前人利用机器学习筛选发现了 abaucin。它能选择性地作用于鲍曼不动杆菌，并影响脂蛋白转运。'],
    [/^However, its antibacterial efficacy and inhibitory mechanism remain insufficiently characterized/i,'abaucin 对这些细菌的抗菌效果如何？它通过什么机制发挥抑制作用？'],
    [/^In this study, we validated the potency and selectivity of abaucin against clinically isolated CRAB\b/i,'作者检验 abaucin 对临床分离的耐碳青霉烯鲍曼不动杆菌（CRAB）的活性和选择性，并在小鼠肺部感染模型中评估药效。'],
    [/^Here, we define the mechanism of abaucin\b/i,'作者还要解释 abaucin 如何通过脂蛋白转运蛋白 LolDF 发挥窄谱抗菌作用。'],
    [/^Further investigation using contemporary clinical isolates and structural elucidation of its target complex\b/i,'研究将临床分离株的药效证据与靶点结构联系起来，以评估 abaucin 的治疗潜力。']
  ];
  function contextNote(quote){return contextNotes.find(([pattern])=>pattern.test(quote))?.[1]}
  window.CheckedPanelGuides={forPanel,contextNote};
})();
