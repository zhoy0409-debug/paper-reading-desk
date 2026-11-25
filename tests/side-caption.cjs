const assert = require('node:assert/strict');
const {locate} = require('../dist/side-caption.js');

const view={width:612,height:792};
const line=(text,x0,y0,x1)=>({text,x0,x1,y0,y1:y0+12,base:y0+10,size:10.9});
const body=(y)=>line('A full-width sentence of running prose that closes the band around the figure.',90,y,522);
const captionAt=(x,tag='2')=>{
  const rows=['Figure '+tag+': The role of affinities in a map.','Points are coloured by their class and','the scale bar is shared by both panels.'].map((t,i)=>line(t,x,100+i*14,x+200));
  return {rows,cap:{caption:rows.map(r=>r.text).join(' '),line:rows[0],anchor:{endY:rows.at(-1).y1}}};
};
const image=(x0,y0,x1,y1)=>({kind:'image',x0,y0,x1,y1});
const run=(c,objects,extra=[],captions=[c.cap])=>locate(c.cap,captions,[...c.rows,body(60),body(230),...extra],objects,view);

const right=captionAt(310);
const pair=[image(100,95,170,175),image(185,95,255,175)];
const title=line('Default map',115,84,165);
const found=run(right,pair,[title]);
assert.ok(found,'figure on the left of its caption');
assert.ok(found.x0<=100&&found.x1>=255&&found.x1<310&&found.y1<230&&found.y0<=84,'labels kept, caption and prose excluded');

const mirrored=run(captionAt(95),[image(330,95,400,175),image(415,95,490,175)]);
assert.ok(mirrored&&mirrored.x0>295&&mirrored.x1>=490,'figure on the right of its caption');

assert.equal(run(right,[]),null,'no drawing');
assert.equal(run(right,pair,[line('A neighbouring paragraph that is long enough to be running text',90,120,290)]),null,'prose beside the caption');
assert.equal(run(right,[image(100,85,180,140),image(100,175,180,225)]),null,'two separate drawings');
const middle=captionAt(210);
assert.equal(run(middle,[image(90,95,180,175),image(430,95,520,175)]),null,'drawings on both sides');
assert.equal(run(right,[image(100,300,250,400)]),null,'drawing below the prose belongs elsewhere');
const other=captionAt(95,'3');
assert.equal(run(right,pair,other.rows,[right.cap,other.cap]),null,'another caption occupies the lane');
const wide=captionAt(90);for(const r of wide.rows)r.x1=522;
assert.equal(run(wide,pair),null,'full-width caption');
console.log('PASS side captions on either side, with labels, and refusal on competing text, captions and drawings.');
