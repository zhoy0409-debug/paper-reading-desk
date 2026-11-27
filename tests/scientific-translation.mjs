import assert from 'node:assert/strict';
import {translatePassage,selectionTranslation} from '../dist/scientific-translation.js';
import {fields,resolveField,fieldTerms,customGlossary} from '../dist/discipline-glossary.js';
const unexpected=()=>{throw Error('A deterministic scientific construction fell through')};
for(const [source,checks] of [
  ['The MIC of meropenem against Klebsiella pneumoniae (K-14) was >128 μg/mL.',['meropenem','肺炎克雷伯菌','K-14','高于 128 μg/mL']],
  ['The MIC of compound-X against E. coli was ≤0.25 mg/L.',['compound-X','大肠埃希菌','不超过 0.25 mg/L']],
  ['MICs were measured for carbapenem-resistant (T-4) and carbapenem-susceptible (T-8) clinical isolates of A. baumannii in (d).',['图 d','耐碳青霉烯类的分离株（T-4）','敏感的分离株（T-8）']],
  ['The authors tested abaucin against E. coli.',['abaucin','大肠埃希菌']],
]){
  const result=await translatePassage(source,'en',unexpected);assert.deepEqual(result.warnings,[]);
  for(const s of checks)assert.ok(result.text.includes(s),s);
}
const tricky='No increase was seen with abaucin at 16 mg/L in (b).';
const preserved=await translatePassage(tricky,'en',async()=>'图 a 中 8 mg/L 时出现增长。');
assert.deepEqual(preserved.warnings,[tricky]);assert.ok(preserved.text.includes(tricky));
const expanded=await translatePassage('The MRI signal was measured.','en',async()=>'测量了磁共振成像信号。');
assert.deepEqual(expanded.warnings,[]);assert.match(expanded.text,/磁共振成像（MRI）/);
console.log('PASS · unseen subjects, reversed groups, isolate IDs, concentration bounds and source fallback');
const independent='Transmission electron microscopy (TEM) images of wild-type E. coli and the corresponding AbcD mutant strains without compound-X treatment.';
const caption=await selectionTranslation(independent,'en',unexpected);
assert.equal(caption.name,false);assert.match(caption.text,/透射电子显微镜（TEM）.*野生型 E\. coli.*AbcD 突变株.*未经 compound-X 处理/);
assert.doesNotMatch(caption.text,/扫描|分别/);
const name=await selectionTranslation('abaucin','en',unexpected);assert.equal(name.name,true);
const source='Signal intensity increased by 18% in ROI.';
const confirmed=await selectionTranslation(source,'en',async s=>s===source?'信号强度增加了 81%。':({'Signal intensity increased by':'信号强度增加了','in':'在'}[s]||s));
assert.match(confirmed.text,/18%/);assert.match(confirmed.text,/ROI/);
await assert.rejects(selectionTranslation('Selected measurements were repeated.','en',async s=>s));

const chart='Figure 5: Comparison of AlphaNet and BetaNet top-5 accuracies (multi-crop testing) on the Sample test dataset as a function of training epochs (right) and trainable parameters (left).';
const result=await selectionTranslation(chart,'en',unexpected);
assert.match(result.text,/图 5.*AlphaNet.*BetaNet.*Sample 测试集.*Top-5 准确率（多裁剪测试）.*右图横轴为训练轮次，左图横轴为模型参数量/);

const cohort=await selectionTranslation('Measurement of ABC1 protein in skin biopsies from healthy volunteers and lesional and non-lesional skin from PSO patients (n=8-11 per group)', 'en', unexpected);
assert.match(cohort.text,/活检.*ABC1 蛋白.*健康.*PSO 患者的皮损皮肤和非皮损皮肤.*每组 n = 8–11/);
const expression=await selectionTranslation('Measurement of M1 and M2 mRNA levels by qRT-PCR in B24 cells exposed to light (4 h) with or without CX91 treatment (8 nM). n = 7 independent experiments.', 'en', unexpected);
assert.match(expression.text,/qRT-PCR.*B24.*M1、M2.*4 h.*8 nM CX91.*未经.*7/);
const hypothesis=await selectionTranslation('We hypothesized that sensory neurons might be activated after exposure to mechanical stimuli, resulting in pain that causes tissue damage.','en',unexpected);
assert.match(hypothesis.text,/推测.*机械刺激.*感觉神经元.*疼痛.*组织损伤/);

for(const [field,term,wanted] of [
  ['medicine','vehicle control','溶媒对照'],['life','cell culture','细胞培养'],['engineering','vehicle control','车辆控制'],
  ['chemistry','isolated yield','分离收率'],['computing','recall','召回率'],['physics','angular momentum','角动量'],
  ['earth','precipitation','降水'],['chemistry','precipitation','沉淀'],['social','yield','收益率'],
  ['math','matrix rank','矩阵的秩'],['agriculture','yield','产量'],['humanities','case law','判例法']
]){
  assert.equal((await selectionTranslation(term,'en',unexpected,{field})).text,wanted);
}
assert.equal(new Set(fields.map(f=>f[0])).size,fields.length);
const legal=customGlossary('instrument = 法律文书\nC++ = 程序设计语言\nSEM = 结构方程模型');
assert.equal((await selectionTranslation('C++','en',unexpected,{field:legal})).text,'程序设计语言');
assert.equal((await selectionTranslation('SEM','en',unexpected,{field:legal})).text,'结构方程模型');
assert.throws(()=>customGlossary('instrument = 法律文书\nwrong'),/2/);
assert.equal((await selectionTranslation('SEM','en',unexpected,{context:'Values are expressed as mean ± SEM.'})).text,'均值标准误（SEM）');
assert.equal((await selectionTranslation('SEM','en',unexpected,{context:'The SEM images show the surface.'})).text,'扫描电子显微镜（SEM）');
assert.equal(resolveField('auto','A clinical study of drug treatment in patients.'),'medicine');
assert.equal(resolveField('auto','Reaction yield and solvent selection for catalysis.'),'chemistry');
assert.equal(resolveField('auto','Targets and comparisons.'),'general');
assert.deepEqual(fieldTerms('motor vehicle emissions','medicine').map(x=>x.value),['机动车']);
assert.deepEqual(fieldTerms('shamrock','life'),[]);
const tissue='Liver tissue from vehicle-treated, compound-X-treated, and drug-Y-treated rats.';
assert.match((await selectionTranslation(tissue,'en',unexpected,{field:'medicine'})).text,/溶媒对照组.*compound-X 组.*drug-Y 组.*大鼠.*肝组织/);
const dose='Levels of ABC in serum from sham, vehicle-treated, and peptide-Z-treated rats (n = 7, **P < 0.001; ns, not significant).';
assert.match((await selectionTranslation(dose,'en',unexpected,{field:'life'})).text,/模拟处理组.*溶媒对照组.*peptide-Z 组.*大鼠.*血清.*ABC 水平.*n = 7.*\*\*P < 0.001.*无统计学意义/);
const sentence='The vehicle control showed a stable response.';
const wrong=async ()=>'车辆控制显示稳定的反应。';
wrong.withTerms=async parts=>'观察到'+parts.find(p=>typeof p!=='string').value+'的反应稳定。';
assert.match((await selectionTranslation(sentence,'en',wrong,{field:'medicine'})).text,/溶媒对照/);
console.log('PASS field-specific and personal glossaries, context-dependent abbreviations, and panel readouts.');
