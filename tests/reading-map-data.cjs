const assert=require('node:assert/strict');
globalThis.PaperOutline=require('../dist/paper-outline.js');
const D=require('../dist/reading-map-data.js');
const dated=[
  'Surveying distant astronomical sources', 'A. Author and the Survey Collaboration',
  '(Received 21 January 2016; published 11 February 2016)',
  'Multiple observatories collected independent astronomical measurements of this event.',
  'I. INTRODUCTION','Previous optical measurements provided the first independent source positions.',
  'II. RESULTS','The new observations resolved the differences between earlier measurements.'
].map(text=>({text,page:1}));
const datedSentences=D.sentences(dated);
assert(datedSentences.some(s=>s.text.startsWith('Multiple observatories')&&!s.text.includes('Received')));
assert(datedSentences.some(s=>s.section==='introduction'&&s.text.startsWith('Previous optical')));
assert(!datedSentences.some(s=>/Received|Survey Collaboration/.test(s.text)));
const observational=[...dated.slice(0,6),{text:'In this report, we report the first direct observation of a distant astronomical event.',page:1}];
const observed=D.local({rows:observational,figures:[],sections:[],question:''});
assert(!observed.children.some(b=>b.key==='aim'));
assert.equal(observed.children.find(b=>b.key==='finding').children[0].page,1);
const figs=[{id:'f2',matchKey:'F:2',label:'Figure 2',caption:'Figure 2: Mouse model. (a) Survival curves of mice. (b) Lung burden after treatment.',page:4,authorPassages:[],questionAims:[]}];
const md=`# 脑图
- **研究背景** ⟦p.1｜Infections caused by this pathogen are difficult to treat⟧
  - 可选药少
- 结果
  - 模块：小鼠模型 ⟦Fig2⟧
    - 明显减轻损伤 ⟦p.9｜the drug reduced lung injury in every treated animal⟧
    - 编造的一条 ⟦p.3｜words that the authors never actually wrote here⟧`;
const tree=D.parse(md,figs);
assert.deepEqual(tree.children.map(c=>c.text),['**研究背景**','结果']);
assert.equal(tree.children[1].children[0].fig,'f2');
const rows=[{text:'Infections caused by this pathogen are diffi-',page:1},{text:'cult to treat in hospitals.',page:1},{text:'We saw that the drug reduced lung injury in every treated animal.',page:4}];
const s=D.verify(tree,rows);
assert.equal(s.ok,2);assert.equal(s.miss,1);
const leaf=tree.children[1].children[0].children;
assert.equal(leaf[0].page,4,'the real page replaces the claimed one');
assert.equal(leaf[1].check,'miss');
globalThis.window=globalThis;
require('../dist/literature-reader.js');
const optical=[
 {id:'first',matchKey:'F:1',caption:'Figure 1. The detector efficiency increases under strong illumination.',panels:[{id:'a'},{id:'b'}]},
 {id:'second',matchKey:'F:2',caption:'Figure 2. The signal decays after the lamp turns off.'}
];
const repeat='The calibration used a constant reference voltage.';
const sourceRows=[{page:1,text:repeat},{page:2,text:'The signal decays after the lamp turns off.'},{page:3,text:repeat},{page:4,text:'Figure 1B shows the control trace for the calibration.'}];
const checked=(md)=>{const tree=D.parse('- '+md,optical);D.verify(tree,sourceRows,optical);return tree.children[0]};
assert.equal(checked('Both sites ⟦p.3｜'+repeat+'⟧').page,3);
assert.equal(checked('Both sites ⟦p.9｜'+repeat+'⟧').check,'miss');
assert.equal(checked('Bad join ⟦p.2｜after the lamp turns off. The calibration used⟧').check,'miss');
assert.equal(checked('Claim ⟦Fig1⟧ ⟦p.2｜The signal decays after the lamp turns off⟧').check,'scope');
assert.equal(checked('Claim ⟦Fig1A⟧ ⟦p.4｜Figure 1B shows the control trace⟧').check,'scope');
assert.equal(checked('Claim ⟦Fig1B⟧ ⟦p.4｜Figure 1B shows the control trace⟧').panel,'B');
assert.equal(checked('Claim ⟦Fig99⟧ ⟦p.1｜'+repeat+'⟧').check,'scope');
optical[0].panels[1].captionPart='The detector efficiency increases under strong illumination.';
sourceRows.push({page:6,text:optical[0].caption});
const sibling=checked('Claim ⟦Fig1A⟧ ⟦p.6｜efficiency increases under strong illumination⟧');
assert.equal(sibling.check,'scope');assert.equal(sibling.page,6);assert.equal(sibling.panel,undefined);
assert.equal(checked('Claim ⟦Fig1B⟧ ⟦p.6｜efficiency increases under strong illumination⟧').check,'ok');
assert.equal(checked('Plain note ⟦p.4｜Figure 1B shows the control trace⟧').fig,undefined);
sourceRows.push({page:5,text:'The two readings differed by −0.5 units (P < 0.05).'});
assert.equal(checked('Threshold ⟦p.5｜differed by -0.5 units (P < 0.05)⟧').check,'ok');
assert.equal(checked('Threshold ⟦p.5｜differed by 0.5 units (P > 0.05)⟧').check,'miss');
const plain=D.parse('## 研究目的\n- 验证疗效\n  - 体内\n## 结果\n1. Fig2 药效',figs);
assert.deepEqual(plain.children.map(c=>c.text),['研究目的','结果']);
assert.equal(plain.children[0].children[0].children[0].text,'体内');
assert.equal(plain.children[1].children[0].fig,'f2');
const body=[{text:'Introduction',page:1},{text:'The mechanism of this drug remains unclear in clinical isolates from hospitals.',page:1},{text:'Here we investigated how the drug acts on resistant bacteria in infected mice.',page:1},
 {text:'Discussion',page:8},{text:'A limitation of this study is that only one mouse model of infection was used.',page:8},{text:'References',page:9}];
const local=D.local({rows:body,figures:figs,question:'Q',sections:[{title:'',figures:figs}]});
assert.deepEqual(local.children.map(c=>c.key),['background','aim','results','limits','talk']);
assert.equal(local.children[2].children[0].children.filter(c=>c.panel).length,2);
assert.ok(local.children[0].children[0].quote.startsWith('The mechanism'));
assert.ok(D.prompt({rows:body,title:'T',figures:figs}).includes('[p.8]'));
console.log('PASS local outline from source sentences, Markdown import and quotation checks.');

assert.equal(leaf[1].page,undefined,'unverified quotes have no source link');
assert.match(D.prompt({rows:body,title:'T',figures:figs,lang:'en'}),/English reading map/);
const longPaper=Array.from({length:95},(_,i)=>({page:i+1,text:'Public source material. '.repeat(250)}));
const excerpt=D.excerpt(longPaper);
assert.ok(excerpt.includes('[p.1]')&&excerpt.includes('[p.95]')&&excerpt.length<19500);
const zh=D.local({rows:[{page:1,text:'引言'},{page:1,text:'邻域嵌入是一类用于展示高维数据结构的降维方法。'}],figures:[],sections:[],question:'问题'});
assert.equal(zh.children[0].key,'background');

const context=[
  {page:1,text:'Previous measurements are summarized in the database of published observations.'},
  {page:1,text:'Optical sensors provide a common means of recording light across many wavelengths.'},
  {page:2,text:'A recent study identified a new sensor for measuring short pulses of light.'},
  {page:2,text:'However, its performance and calibration remain insufficiently characterized.'},
  {page:2,text:'In this study, we evaluated the sensor against a calibrated optical reference.'}
];
const outline=D.local({rows:context,figures:[],sections:[],question:'Sensors'});
const bg=outline.children.find(n=>n.key==='background').children,aims=outline.children.find(n=>n.key==='aim').children;
assert.deepEqual(bg.map(n=>n.role),['context','prior','gap']);
assert.deepEqual(aims.map(n=>n.role),['aim']);
for(const n of [...bg,...aims])assert(context.some(s=>s.page===n.page&&s.text===n.quote));

const reporting=[{text:'Introduction',page:2},
 {text:'We hypothesized that the detector would respond differently to the two light sources.',page:2},
 {text:'Here we find that the detector responds strongly under both experimental conditions.',page:2}];
const goals=D.local({rows:reporting,figures:[],sections:[],question:'Light'}).children.find(n=>n.key==='aim');
assert.deepEqual(goals.children.map(n=>n.quote),[reporting[1].text]);

const reviewRows=[
  {page:1,text:'Downloaded from: https://example.org'},
  {page:1,text:'(article starts on next page)'},
  {page:2,text:'Department of Engineering, Example University'},
  {page:2,text:'Optical sensors measure illumination across a broad range of wavelengths.'},
  {page:2,text:'Recent evidence demonstrates that the sensors respond to weak light.'},
  {page:2,text:'This review examines how detector materials govern the light response.'},
  {page:2,text:'Furthermore, it discusses possible uses in machine vision, while addressing technical barriers including drift and noise.'},
  {page:2,text:'KEYWORDS'},
  {page:2,text:'COPYRIGHT'},
  {page:2,text:'No use, distribution or reproduction is permitted which does not comply with these terms.'},
  {page:3,text:'However, when a sensor is damaged, its reported output decreases significantly.'}
];
const review=D.local({rows:reviewRows,figures:[],sections:[],question:'Sensors',review:true});
const background=review.children.find(n=>n.key==='background').children;
const scope=review.children.find(n=>n.key==='aim').children;
assert.deepEqual(background.map(n=>n.role),['context','prior','challenge']);
assert.deepEqual(scope.map(n=>n.role),['reviewAim','scope']);
assert.equal(scope[1].text,'This review discusses possible uses in machine vision.');
assert.equal(background[2].text,'Technical barriers include drift and noise.');
for(const n of [...background,...scope])assert(reviewRows.some(r=>r.text===n.quote&&r.page===n.page));
assert.doesNotMatch(D.excerpt(reviewRows),/permitted|these terms|Downloaded from/);
const observation={page:1,text:'However, a sensor exposed to more daylight produces a larger signal.'};
for(const review of [true,false]){
  const tree=D.local({review,rows:[...body.slice(0,1),reviewRows[3],observation],figures:[],sections:[],question:'Daylight'});
  assert(!tree.children.flatMap(n=>n.children).some(n=>n.role==='gap'&&n.quote===observation.text));
}
