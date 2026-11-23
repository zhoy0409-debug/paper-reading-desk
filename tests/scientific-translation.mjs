import assert from 'node:assert/strict';
import {translatePassage} from '../dist/scientific-translation.js';
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
console.log('PASS · unseen subjects, reversed groups, isolate IDs, concentration bounds and source fallback');