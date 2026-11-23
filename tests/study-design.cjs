// Run with node tests/study-design.cjs
const {strict:assert}=require('node:assert');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const options=[path.join(__dirname,'../dist/study-design.js'),path.join(__dirname,'dist/study-design.js')];
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(options.find(fs.existsSync),'utf8'),ctx);
const model=ctx.window.StudyDesignReading;
const read=(caption,abstract='')=>model.explain({caption,page:2,designContext:model.studyContext(abstract)});
const sequence=s=>read(s).filter(f=>f.key==='order');
assert.match(sequence('Treatment started before exposure.')[0].en,/preceded exposure|treatment followed by exposure/);
assert.match(sequence('Treatment began after infection.')[0].en,/Intervention followed|infection followed by treatment/);
assert.match(sequence('Sampling was performed after cooling.')[0].en,/cooling followed by sampling/);
assert.match(sequence('Validation was performed after training.')[0].en,/training followed by validation/);
assert.equal(sequence('It is unclear whether sampling was performed after cooling.').length,0);
assert.equal(sequence('Treatment and infection were recorded.').length,0);
assert.equal(read('Two unrelated image metrics.', 'Treatment began after infection.').filter(f=>f.key==='order').length,0);
assert.ok(read('Body weight at 48 hours.').every(f=>!f.en.includes('regained')));
assert.equal(read('A study of paired measurements.','Prior studies used a crossover design.').filter(f=>f.key==='allocation').length,0);
assert.match(read('Each subject completed three visits.', 'We used a randomized crossover design.').find(f=>f.key==='allocation').en,/same participant/);
console.log('PASS evidence scope, order direction, crossover, uncertainty and non-biomedical events.');

const sampling=(q,lines)=>model.samplingWindow(q,'Cells',lines.map(text=>({kind:'整图图注',text,page:2})));
const q='这些细胞的取样跨了多长时间？';
assert.match(sampling(q,['Cells were sampled at seven time points between 0 days and 4 months.']).zh,/0 天到 4 个月/);
assert.match(sampling('Over what period were samples collected?',['Samples were collected from 2 to 6 weeks.']).en,/2 weeks to 6 weeks/);
assert.equal(sampling(q,['Samples were collected. They were stored from 2 to 6 weeks.']),null);
assert.equal(sampling('为什么选择这段采样时间？',['Cells were sampled from 2 to 6 weeks.']),null);
assert.equal(sampling(q,['Cells were sampled from 2 to 6 weeks.','Cells were sampled from 3 to 9 weeks.']),null);
