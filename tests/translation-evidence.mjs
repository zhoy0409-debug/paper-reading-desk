import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateScientific} from '../dist/translation-facts.js';
import {chemicalNames, symbolicKeys} from '../dist/translation-anchors.js';
import {claimIssues,recoverClaimWording} from '../dist/translation-claims.js';

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

const predicates = [
  ['Height was inversely associated with frost damage.', '高度与冻害呈反比。','高度与冻害呈负相关。'],
  ['Duration was positively correlated with spending.','持续时间与支出成正比。','持续时间与支出呈正相关。'],
  ['Night lighting was used as a proxy for activity.','夜间照明是活动的代名词。','夜间照明是活动的替代指标。'],
  ['The cohort was monitored for incident CKD.','监测队列中的事件 CKD。','监测队列中的新发 CKD。'],
  ['Odds increased across successive quarters of exposure.','暴露水平各季度的比值逐渐增加。','暴露水平各四分位组的比值逐渐增加。'],
];
for(const [source,changed,good] of predicates){
  assert.equal(recoverClaimWording(source,changed),good);
  assert.equal(claimIssues(source,good).length,0);
  assert.ok(claimIssues(source,changed).some(i=>i.sourceEvidence&&i.targetEvidence));
}
for(const [source,good] of [
  ['Force is inversely proportional to distance.','力与距离成反比。'],
  ['Cost was positively correlated with risk but inversely proportional to volume.','成本与风险正相关，与体积成反比。'],
  ['The incident UV beam was measured.','测量入射紫外光束。'],
  ['Quarterly risks increased during successive quarters of the year.','风险在这一年的连续几个季度上升。'],
  ['The term is a synonym and is sometimes used as a proxy for wealth.','这一术语是一个代名词，有时用作财富的代理指标。'],
  ['There were fewer than five invalid readings.','无效读数不足五次。']
]){
  assert.equal(recoverClaimWording(source,good),good);
  assert.equal(claimIssues(source,good).length,0);
}
assert.ok(claimIssues('We observed fewer faults at the higher load.','我们观察了较高负载下的故障。').some(i=>i.code==='direction'));
assert.equal(claimIssues('We observed fewer faults at the higher load.','较高负载下的故障更少。').length,0);
assert.ok(claimIssues('The threshold is independent of speed.','阈值取决于速度。').some(i=>i.code==='relation'));
assert.equal(claimIssues('The threshold is independent of speed.','速度不影响阈值。').length,0);
console.log('PASS association strength, measured proxies, clinical outcomes and missing comparative predicates');

const {restorePrintedUnits}=await import('../dist/translation-facts.js');
const dimension='Sensors recorded 81.4 Wh/m² under shade.';
const changedUnit='在遮阴条件下，传感器记录了81.4瓦特/平方米。';
assert.ok(validateScientific(dimension,changedUnit).issues.some(e=>e.code==='quantity'));
const restored=restorePrintedUnits(dimension,changedUnit);
assert.match(restored,/81\.4 Wh\/m²/);
assert.equal(validateScientific(dimension,restored).status,'checked');
assert.equal(validateScientific('Storage was 9 km³.','储量为9立方千米。').status,'checked');
assert.equal(validateScientific('Storage was 9 km³.','储量为9平方千米。').status,'review');
assert.equal(validateScientific('The gain was 1.4–2.6%.','增幅为1.4%至2.6%。').status,'checked');
assert.equal(validateScientific('At least two valid days were required.','至少需要两天有效记录。').status,'checked');
assert.equal(validateScientific('The values fall along the line.','各值落在直线上。').status,'checked');
assert.equal(validateScientific('The values fell after cooling.','冷却后，各值有所上升。').status,'review');
assert.equal(validateScientific('It is significant that the counts match.','值得注意的是，计数一致。').status,'checked');
assert.equal(validateScientific('The monthly yield was reported.','报告了月均产量。').status,'review');
assert.equal(validateScientific('The monthly average yield was reported.','报告了月均产量。').status,'checked');
const duplicated='两个表的读数为7瓦特/平方米和7瓦时/平方米。';
assert.equal(restorePrintedUnits('The meters read 7 Wh/m² and 7 W/m².',duplicated),duplicated);
const converted='记录了3600焦耳。';
assert.equal(restorePrintedUnits('The reading was 1 Wh.',converted),converted);
assert.equal(validateScientific('The reading was 1 Wh.',converted).status,'checked');
console.log('PASS dimensional equivalence, shared ranges, guarded unit recovery and comparison scope');
