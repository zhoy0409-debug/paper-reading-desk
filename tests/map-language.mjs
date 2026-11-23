import assert from 'node:assert/strict';
import {mapChinese} from '../dist/scientific-translation.js';

const sentence='Intensity increased by 25% in ROI.';
const output=await mapChinese(sentence,async text=>{
  if(text===sentence)return '区域内的强度增加了 52%。';
  if(text==='Intensity increased by')return '强度增加了';
  if(text==='in')return '在';
  throw Error('Unexpected test input '+text);
});
assert.match(output,/强度增加了/);assert.match(output,/25%/);assert.match(output,/ROI/);assert.doesNotMatch(output,/52/);
await assert.rejects(mapChinese('A comparison of two methods.',async value=>value));
console.log('PASS Chinese map text, preserved quantities and identifiers, untranslated prose rejected');
