(() => {
'use strict';
const url='https://www.nature.com/articles/s41467-026-75428-4';
const structureClip = {
  src:'./media/structure-explainer.mp4',poster:'./media/structure-explainer-poster.jpg',
  title:'30 秒看懂：结构图是一张快照',caption:'用几何示意认识结构证据和功能证据的区别。',
  transcript:'结构图像照片：能看见物体在哪里、是什么形状。两张快照即使不同，也不能单独证明中间怎样运动。再检查功能读数，问预测的那一步有没有真的改变。两条证据回答的是不同的问题。'
};
const src=(n,location)=>({label:'Pang 等 · 图 '+n,location,figure:'F:'+n});
const edition={
  title:'Pang 等 · Nature Communications · 2026',
  root:{title:'为什么这种候选药只对某些细菌明显有效？',summary:'作者的解答不是「药把入口堵住了」，而是「货物进了运输机器，却在下一站交不出去」。他们用不同类型的证据拆开这两种解释。'},
  branches:[
    {id:'spectrum',title:'先看它对谁有效',category:'比较结果',summary:'在这组菌中，鲍曼不动杆菌对 abaucin 最敏感。',
     source:src(1,'图 1 · 受测样本比较'),href:url+'#Fig1',
     diagram:{title:'先分清比较对象',caption:'图 1 用三类菌比较 abaucin 的抗菌活性。',steps:['受测的目标菌样本','论文中的其他细菌作比较','在所测范围内呈选择性']},
     children:[{id:'spectrum-limit',title:'哪些读数体现了选择性？',summary:'比较 A、B、C 中同一种药的 MIC。鲍曼不动杆菌的数值最低，表示抑制其生长所需的 abaucin 浓度最低。',source:src(1,'图 1 · 各类受测样本'),href:url+'#Fig1'}]},
    {id:'structure',title:'画面里，机器像是卡住了',category:'结构线索',summary:'结构图给出了运输机器被候选药占据时的状态。它让「机器被卡住」变得可检验，但快照本身不能证明全过程。',
     source:src(3,'图 3a · 两种结构状态'),href:url+'#Fig3',
     diagram:{title:'看结构图时，把快照和过程分开',caption:'原创概念示意，不是论文结构模型。',steps:['看状态：机器呈什么形态','比较状态：有什么不同','问过程：货物还交得出去吗？']},
     video:structureClip,
     children:[{id:'snapshot',title:'30 秒：怎么看结构图？',summary:'这张图展示的是有代表性的状态，不是把运输全过程拍成了录像。',source:src(3,'图 3a · 结构状态对照'),href:url+'#Fig3',video:structureClip}]},
    {id:'handoff',title:'再看：货物究竟卡在哪一步？',category:'功能证据',summary:'作者把「货物还能不能进入」和「能不能交给下一个接手者」分开。两条证据合起来，更支持交接受阻。',
     source:src(5,'图 5 · 结构与交接证据'),href:url+'#Fig5',
     diagram:{title:'把「结合」和「转交」拆开',caption:'原创过程示意。不包含实验步骤或定量结果。',steps:['货物进入','运输机器暂时持有','向下一站交接']},
     children:[{id:'handoff-limit',title:'为什么结构图还不够？',summary:'结构看状态，功能读数看交接有没有发生。作者用两类证据回答不同的问题，而不是拿同一张图证明两件事。',source:src(5,'图 5 · 原文读数'),href:url+'#Fig5'}]},
    {id:'animal',title:'从细菌到动物，证据还差哪一步？',category:'适用边界',summary:'作者在动物研究中也报告了效应。这把证据从体外推进到临床前，但还不能说对人有效。',
     source:src(2,'图 2 · 动物研究结果'),href:url+'#Fig2',
     diagram:{title:'证据往前走了一步',caption:'原创证据层级示意，不是疗效对照图。',steps:['体外比较','动物研究','人体疗效尚未建立']},
     children:[{id:'animal-limit',title:'组会一句话怎么讲？',summary:'这项研究提供了选择性活性和作用方式的证据，并往临床前走了一步，不能当作临床疗效。',source:src(2,'图 2 · 结果范围'),href:url+'#Fig2'}]}
  ]
};
window.PaperReadingEditions=Object.freeze({get(id){return String(id).toLowerCase()==='10.1038/s41467-026-75428-4'?edition:null;},example:edition});
})();
