const assert = require('node:assert/strict');
global.window = global;
require('../dist/figure-elements.js');
const {explain, labels} = FigureElements;
require('../dist/literature-reader.js');

const caption='Exaggeration values ρ were distributed on a log-scale. Dots mark the maximum of each curve.';
const source=method=>({kind:'小图图注',en:'Panel caption',text:'Distance correlation between '+method+' and t-SNE',page:12});
const ctx={caption,page:12,reading:{sources:[source('UMAP')]}};
const part={text:'Exaggeration factor (',x0:.31,x1:.60,y0:.70,y1:.76};
const end={text:')',x0:.63,x1:.66,y0:.70,y1:.76};
const other={...end,y0:.84,y1:.90};
const joined=labels([part,end,other],caption);
assert.deepEqual(joined.map(w=>w.text),['Exaggeration factor (ρ)',')']);
assert.equal(joined[0].x1,end.x1);
assert.equal(labels([part,end],'No mathematical symbol in the caption')[0].text,'Exaggeration factor');
assert.equal(labels([part,other],caption).length,2);
assert.match(explain(joined[0], ctx)[2],/横轴按对数排列/);
assert.match(explain(joined[0],{...ctx,reading:{sources:[source('FA2')]}})[2],/ForceAtlas2/);
assert.equal(explain({text:'ForceAtlas2'},ctx),null);
assert.match(explain({text:'Distance correlation',rotate:true},ctx)[2],/同一批样本/);
assert.match(explain({text:'Fashion MNIST'},{...ctx,series:true,peak:true,estimate:{x:6.7,y:.99}})[2],/Fashion MNIST.*6\.7.*0\.99/);
assert.equal(explain({text:'Fashion MNIST'},ctx),null);

const tableWords=[
 {text:'MIC (μg/mL)',x0:.6,x1:.98,y0:.1,y1:.15},
 {text:'DrugA',x0:.63,x1:.74,y0:.16,y1:.2},{text:'DrugB',x0:.82,x1:.95,y0:.16,y1:.2}
];
const table={page:2,reading:{sources:[]},caption:'Clinical isolates',row:'Row: Isolate-7 | species | 1 | 8',words:tableWords};
for(const [x,value,drug] of [[.68,'1','DrugA'],[.87,'8','DrugB']]){
 const card=explain({text:value,x0:x,x1:x+.01,y0:.32,y1:.36},table);
 assert.match(card[2],new RegExp(drug+' 对 Isolate-7'));assert.match(card[2],new RegExp(value+' μg/mL'));
}
const terms=[{kind:'小图图注',text:'The treatment effect was estimated. Sample entropy measures the irregularity of a time series.',page:4}];
assert.equal(explain({text:'Sample entropy'},{page:2,caption:'',reading:{sources:terms}}).quote,'Sample entropy measures the irregularity of a time series.');
assert.equal(explain({text:'sample size'},{page:2,caption:'',reading:{sources:terms}}),null);
assert.equal(explain({text:'Time (min)'},{page:2,caption:''})[2].includes('分钟'),true);
assert.match(explain({text:'20 µm'},{page:2,caption:'Micrograph with a scale bar.'})[2],/40 µm/);
assert.equal(explain({text:'20 µm'},{page:2,caption:'Applied displacement.'}),null);
const lookup=FigureElements.paperPassages([
 {key:'results',rows:[{page:2,text:'We recorded travel time for each visit.'},{page:6,text:'Travel time is the interval between departure and arrival.'}]},
 {key:'references',rows:[{page:1,text:'Novel label denotes a citation title.'}]}
]);
assert.equal(lookup('travel time',2)[4],6);
assert.match(lookup('travel time',2).quote,/between departure and arrival/);
assert.equal(lookup('novel label',1),null);
const localReading={id:'a',reading:{sources:[{kind:'小图图注',page:4,text:'Arm B represents the calibrated detector.'}]}};
const experiment={caption:'(A) Arm B represents the calibrated detector. (B) Arm B represents a reference.',
 page:3,captionPage:4,matchKey:'F:3',panels:[localReading,{id:'b'}],
 authorPassages:[{page:2,text:'The reference reading is highest in Fig. 3B.'}]};
const sources=FigureElements.panelSources(experiment,localReading);
assert(!sources.some(s=>s.text.includes('reference')));
const key=explain({text:'Arm B'},{caption:experiment.caption,page:3,sources,series:true});
assert.deepEqual([key[1],key[4],key.quote],['Legend · Arm B',4,'Arm B represents the calibrated detector.']);
assert.equal(FigureElements.labelPassage('Arm B',sources,()=>{throw Error('nearer page overrode local evidence')},3).quote,key.quote);
assert.equal(explain({text:'Scratch'},{caption:'Wound closure in a scratch assay.',page:1}),null);
console.log('PASS element-specific cards, label geometry, method roles, matched evidence, units and table columns.');
