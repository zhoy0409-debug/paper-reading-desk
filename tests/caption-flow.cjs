const assert=require('node:assert/strict');
const flow=require('../dist/caption-flow.js');
const intro='Figure 2. Comparisons. (A-B) First comparison (A) and time course (B) (n=10) (C) Control samples (n=12)';
const lines=[
  {x0:81,y0:54,base:62,size:10,text:'(D-E) Spectrum of the first two samples.'},
  {x0:81,y0:68,base:76,size:10,text:'(F) Spectrum of the reference material.'},
  {x0:81,y0:700,base:708,size:8,text:'Page footer.'}
];
const cap={caption:intro,line:{x0:80,size:10},anchor:{endY:723}};
const tail=flow.nextPage(cap,lines,{height:800});
assert.equal(tail,lines.slice(0,2).map(l=>l.text).join(' '));
assert.equal(flow.nextPage({...cap,anchor:{endY:200}},lines,{height:800}),undefined);
assert.equal(flow.nextPage(cap,lines.slice(1),{height:800}),undefined);
const runs=flow.panelSections(intro+' '+tail);
assert.deepEqual([...runs.keys()],['a','b','c','d','e','f']);
assert.equal(runs.get('b').text,'First comparison (A) and time course (B) (n=10)');
const cols=flow.panelSections('Sensor results. a First series. b, c Light measurements for both groups. n = 6 per group. d Calibration.');
assert.equal(cols.get('c').text,'Light measurements for both groups. n = 6 per group.');
console.log('PASS continuous panel headings, shared captions and verified page breaks');
