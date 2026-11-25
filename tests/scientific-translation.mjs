import assert from 'node:assert/strict';
import {translatePassage,selectionTranslation} from '../dist/scientific-translation.js';
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
