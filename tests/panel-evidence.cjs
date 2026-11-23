// Small attribution cases which are difficult to isolate in a published PDF.
const assert = require('node:assert/strict');
global.window = global;
require('../dist/panel-reading.js');
require('../dist/panel-labels.js');
require('../dist/paper-figure-context.js');
require('../dist/marked-plots.js');
require('../dist/study-design.js');
require('../dist/model-reading.js');
require('../dist/reading-evidence.js');
require('../dist/panel-geometry.js');

const chart={label:'left',axis:'Training error (%)',curveLabels:['10-layer','40-layer']};
const withCaption=t=>PaperPanelReading.build({caption:t,page:1},chart,'',null);
const reported=withCaption('Figure 3. The deeper model shows lower training error.');
assert.match(reported.narration,/40 层网络.+10 层网络更低/);
for(const unverified of [
  'Figure 3. The deeper model might have lower training error.',
  'Figure 3. The deeper model has higher test error and lower training error.',
  'Figure 3. The deeper model has higher training error only in some runs.',
]){
  assert.equal(withCaption(unverified).narration,'');
}
const region={x0:0,y0:0,x1:100,y1:80},rotated={text:'Signal (mV)',x0:3,x1:7,y0:20,y1:55};
const ticks=[{text:'0',x0:10,y0:53,y1:58,base:57},{text:'2',x0:10,y0:26,y1:31,base:30}];
assert.equal(PaperPanelGeometry.axisIn(region,[rotated],ticks),'Signal (mV)');
assert.equal(PaperPanelGeometry.axisIn(region,[rotated,{...rotated,text:'Other'}],ticks),undefined);
assert.equal(PaperPanelGeometry.axisIn(region,[rotated],ticks.slice(0,1)),undefined);

// An alphabetic sequence alone must not claim the previous page.
const label=(text,x,y)=>({text,font:'bold',size:10,base:y+8,x0:x,x1:x+7,y0:y,y1:y+10});
const layout={viewport:{width:600,height:800},words:[label('a',45,65),label('b',300,65),label('c',45,350)],lines:[]};
const ink=[{kind:'image',x0:50,y0:90,x1:560,y1:620}];
const caption='Fig. 2. Recorded signals. a Red. b Green. c Blue.';
assert.equal(PaperPanelGeometry.precedingPlate(caption,layout,[]),null);
assert.equal(PaperPanelGeometry.precedingPlate(caption+' d Grey.',layout,ink),null);
assert.equal(PaperPanelGeometry.precedingPlate(caption,{...layout,words:[...layout.words,label('a',70,400)]},ink),null);
assert.equal(PaperPanelGeometry.precedingPlate(caption,{...layout,lines:[{text:'An intervening paragraph with enough continuous text to occupy a normal column of the paper.',x0:45,x1:300,y0:210,y1:220}]},ink),null);
assert.equal(PaperPanelGeometry.precedingPlate(caption,layout,ink).panels.length,3);

function read(caption, body = []) {
  const figure = {page: 3, matchKey: 'F:2', panels: ['a', 'b', 'c'].map(id => ({id, label: id.toUpperCase()})), caption};
  const rows = body.map(text => ({text, page: 2, mentions: ['F:2']}));
  PaperReadingEvidence.enrich({model: {rows}}, {figures: [figure]}, {});
  return figure.panels.map(panel => panel.reading);
}
const [a,b,c] = read('Figure 2. (a) Accuracy increased from 82% to 90%. (b) Paired measurements are reported as mean ± SD, n = 12 patients. (c) Heatmap of RNA expression.',
  ['Figure 2b shows paired samples from the participating patients.']);
const bare=read('Fig. 2 | Measurements. a Response distributions in the presence of noise. b Accuracy increased from 70% to 82%. c Heatmap of scores.',
  ['A different pattern is reported in Supplementary Fig. 2a.']);
assert.ok(bare[0].sources.some(s=>s.kind==='小图图注'&&s.text.includes('Response distributions')));
assert.ok(!bare[0].sources.some(s=>s.kind==='提及本小图的正文'));
assert.match(bare[1].narration,/12 个百分点/);
assert.equal(PaperPanelReading.build({caption:'Fig. 2. Overview.',page:3},{label:'A',printedTitle:'T1'},'',null).narration,'');
assert.match(a.narration, /8 个百分点/);
assert.ok(!a.sources.some(s => /12 patients|paired samples/.test(s.text)));
assert.ok(b.rows.some(r => r.zh.includes('12 名患者')));
assert.ok(b.rows.some(r => r.zh.includes('离散程度')));
assert.ok(b.rows.some(r => r.zh.includes('同一对')));
assert.ok(b.sources.some(s => s.page === 2 && s.text.includes('paired samples')));
assert.ok(c.rows.some(r => r.zh.includes('色标')));
assert.ok(!c.rows.some(r => r.zh.includes('12 名患者')));

for (const text of ['The outcomes are compared in Figure 2a–c.', 'Figure 2a and b show the same comparison.', 'Figure 2a differs from Figure 3 in accuracy.']) {
  const guides = read('Figure 2. Values for all conditions.', [text]);
  assert.ok(guides.every(g => !g.sources.some(s => s.kind === '提及本小图的正文')));
}
assert.ok(!read('Figure 2. (a) If accuracy increased from 40% to 60%, the test would pass.')[0].rows.some(r => r.role === '读到的变化'));
assert.match(read('图2。 (a) 准确率由 83% 升至 86.5%。')[0].narration, /3.5 个百分点/);
assert.ok(!read('Figure 2. (a) and (b) Shared sample size n = 14 patients.')[0].rows.some(r => r.role === '读数来自哪里'));
const grouped=read('Figure 2. A-C) The accuracy of baseline (A), model (B), and reference (C) was recorded. D) Each point represents one participant.');
for(const guide of grouped.slice(0,3)){
  assert.ok(guide.sources.some(s=>s.kind==='组内共用图注 · A–C'&&s.text.includes('was recorded')));
  assert.ok(!guide.sources.some(s=>s.kind==='小图图注'));
}
assert.ok(grouped[3].rows.some(r=>r.role==='一个点代表什么'&&r.zh.includes('one participant')));
assert.ok(!read('Figure 2. Pseudobulk embeddings of single-cell RNA-seq data.')[0].rows.some(r => r.zh.includes('每个点代表一个细胞')));

const box = {x: .1, y: .1, width: .2, height: .2}, mark = {x:.12,y:.12,width:.02,height:.02};
const manual = {regions: [mark], forBox: box, label: 'II'};
const figure = {panels: []};
assert.equal(PaperPanelLabels.plan('keep', box, figure, {}, manual, 0), null);
assert.equal(PaperPanelLabels.plan('replace', box, figure, {}, manual, 0).label, 'II');
assert.equal(PaperPanelLabels.plan('replace', {...box,width:.26}, figure, {}, manual, 0).known, false);
assert.deepEqual(PaperPanelLabels.plan('replace', {x:.2,y:.2,width:.06,height:.06}, figure, {}, manual, 0).masks, []);
assert.equal(PaperPanelLabels.letters(26), 'AA');
const capitals=read('Figure 2. Optical measurements. A Calibrated intensity. B–C Voltage distributions. D Detector response.');
assert.ok(capitals[0].sources.some(s=>s.kind==='小图图注'&&s.text==='Calibrated intensity.'));
for(const guide of capitals.slice(1,3))assert.ok(guide.sources.some(s=>s.kind==='组内共用图注 · B–C'&&s.text.includes('Voltage distributions')));
require('../dist/composite-plate.js');
assert.match(CompositePlate.labelGuide('Time (s)',[],9)[2],/时间/);
assert.equal(CompositePlate.labelGuide('Time (s)',[],9)[4],9);
const line=(text,x,y)=>({text,x0:x,x1:x+210,y0:y-8,y1:y+2,base:y,size:8});
const columns=[line('Fig. 1 | Optical response.',26,40),line('B–C Detector response.',304,40),line('A Excitation intensity.',26,50),line('D Reference spectrum.',304,50)];
assert.equal(CompositePlate.columnCaption(columns[0],columns,{width:600}).text,'Fig. 1 | Optical response. A Excitation intensity. B–C Detector response. D Reference spectrum.');
assert.equal(CompositePlate.columnCaption(columns[0],[...columns.slice(0,3),line('Partial text',304,50)],{width:600}),undefined);
console.log('PASS: attributed panel evidence, original-language quantities, grouped references, units and crop-bound label masks.');
