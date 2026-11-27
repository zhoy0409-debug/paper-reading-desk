import assert from 'node:assert/strict';
import {mapChinese} from '../dist/scientific-translation.js';
const title='Attraction–Repulsion Spectrum in Neighbor Embeddings';
assert.equal(await mapChinese(title,async()=>{throw Error('Exact terms already known')}),'邻域嵌入中的吸引力与排斥力谱');
const known=async()=>{throw Error('Phrase must be grounded in the supplied terms')};
assert.equal(await mapChinese('We provide a unifying account of neighbor embedding (NE) algorithms.',known),'用统一框架解释邻域嵌入（NE）算法。');
assert.equal(await mapChinese('We study how changing the attractive forces between kNN graph neighbors affects the spectrum of t-SNE embeddings.',known),'考察 t-SNE 的一系列嵌入结果如何随 kNN 图上的近邻点之间的吸引力变化。');
assert.equal(await mapChinese('We examined the role of ILC2s in immune adaptation during the recovery phase post-stroke.',known),'考察 ILC2s 在卒中恢复期免疫适应中的作用。');

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

const collapsed=async()=>'比较了骨质疏松症和骨质疏松症。';
collapsed.withTerms=async parts=>parts.filter(p=>typeof p!=='string').map(p=>p.value).join('、')+'。';
assert.match(await mapChinese('Osteoclastogenesis and osteogenesis were evaluated in osteoporosis.',collapsed),/^破骨细胞形成、成骨作用、骨质疏松症/);
const nervous='The two canonical pathways intersect with each other to coordinate cellular communication.';
const translated=await mapChinese(nervous,async()=>'两条佳能通路相交，以协调细胞通信。');
assert.match(translated,/经典通路发生交叉作用，以协调细胞间通讯/);
assert.match(await mapChinese('The review identified limited in vivo validation.',async()=>'该综述指出了有限的体内验证。'),/体内验证有限/);
assert.match(await mapChinese('Conformational hijacking of lipoprotein transporter LolDF enables precision antimicrobial activity against Acinetobacter baumannii',known),/劫持脂蛋白转运蛋白 LolDF 的构象.*鲍曼不动杆菌.*精准抗菌作用/);
