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
