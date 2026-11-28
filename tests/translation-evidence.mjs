import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateScientific} from '../dist/translation-facts.js';
import {chemicalNames, symbolicKeys} from '../dist/translation-anchors.js';

for (const file of ['./translation-benchmark/control-pairs.json','./translation-benchmark/round2/contrast-pairs.json']) {
  const pairs=JSON.parse(fs.readFileSync(new URL(file,import.meta.url),'utf8'));
  for(const [label,source,good,bad] of pairs){
    assert.equal(validateScientific(source,good).status,'checked',label+' rejected an equivalent translation');
    assert.equal(validateScientific(source,bad).status,'review',label+' missed a changed fact');
  }
}
const polymer='Poly(ethylene-co-(vinyl acetate))';
assert.deepEqual(chemicalNames(polymer+' was weighed.').map(v=>v.original),[polymer]);
assert.equal(chemicalNames('A polynomial model was used in PET imaging.').length,0);
assert.equal(chemicalNames('The term poly(unclosed was printed.').length,0);
const source='The sample contained poly(vinyl acetate).';
const terms=[{original:'poly(vinyl acetate)',value:'聚乙酸乙烯酯'}];
assert.equal(validateScientific(source,'样品含聚乙酸乙烯酯。',{terms}).status,'checked');
assert.equal(validateScientific(source,'样品含聚乙烯。',{terms}).issues[0].sourceEvidence,'poly(vinyl acetate)');
assert.deepEqual(symbolicKeys('There is more than a single explanation.'),[]);
assert.deepEqual(symbolicKeys('Readings below q and at least k.'),['<q','≥k']);
assert.deepEqual(symbolicKeys('至少有 k 个观测值'),['≥k']);
const bounded='At least k observations per window were required.';
assert.equal(validateScientific(bounded,'每个窗口至少需要 k 个观测值。').status,'checked');
assert.equal(validateScientific(bounded,'整个数据集至少需要 k 个观测值。').status,'review');
assert.equal(validateScientific(bounded,'每个窗口至少需要 k 个样本。').status,'review');
assert.equal(validateScientific('至少 k 个观测值。','At most k observations.',{from:'zh'}).status,'review');
const incorrect=validateScientific('Group A received 7 mg and group B received 11 mg.','A 组接受 11 mg，B 组接受 7 mg。');
assert.ok(incorrect.issues.some(i=>i.code==='group'&&i.sourceEvidence.includes('7 mg')&&i.targetEvidence.includes('11 mg')));
console.log('PASS paired controls, chemical identity, symbolic bounds and actionable evidence');
