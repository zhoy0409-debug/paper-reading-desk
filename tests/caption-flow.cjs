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
const legend={...cap,inLegendSection:true,lastFont:'regular'};
const manuscript=[
  {text:'the regional sample is shown.',font:'regular',base:68},
  {text:'n = 12 independent sites.',font:'italic',base:91},
  {text:'Source data are provided separately.',font:'regular',base:111},
  {text:'Editorial Summary',font:'bold',base:126},
  {text:'This is a separate article section.',font:'body',base:142}
].map(row=>({...row,x0:80,y0:row.base-9,size:10}));
assert.equal(flow.nextPage(legend,manuscript,{height:800}),manuscript.slice(0,3).map(r=>r.text).join(' '));
const runs=flow.panelSections(intro+' '+tail);
assert.deepEqual([...runs.keys()],['a','b','c','d','e','f']);
assert.equal(runs.get('b').text,'First comparison (A) and time course (B) (n=10)');
const cols=flow.panelSections('Sensor results. a First series. b, c Light measurements for both groups. n = 6 per group. d Calibration.');
assert.equal(cols.get('c').text,'Light measurements for both groups. n = 6 per group.');
const mixed='Fig. 4 | Optical readings. a The first detector. b The voltage trace. Signals for red (c) and blue (d) in the sample (P < 0.0001). e Final reading. Source data are provided in the appendix.';
const signals=flow.panelSections(mixed);
assert.deepEqual([...signals.keys()],['a','b','c','d','e']);
assert.equal(signals.get('b').text,'The voltage trace.');
assert.equal(signals.get('c').specific,'Signals for red in the sample (P < 0.0001).');
assert.equal(signals.get('d').specific,'Signals for blue in the sample (P < 0.0001).');
assert.equal(signals.get('c').text,signals.get('d').text);
assert.equal(signals.get('e').text,'Final reading.');
const cross=flow.panelSections('Fig. 2 | a Red signal. b Blue signal. As shown in (c) and (d), the response varies. c First control. d Second control.');
assert.match(cross.get('b').text,/As shown/);
assert.equal(cross.get('c').text,'First control.');
console.log('PASS continuous panel headings, shared captions and verified page breaks');
