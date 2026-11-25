const assert=require('node:assert/strict');
globalThis.PaperOutline=require('../dist/paper-outline.js');
const D=require('../dist/reading-map-data.js');
const figs=[{id:'f2',matchKey:'F:2',label:'Figure 2',caption:'Figure 2: Mouse model. (a) Survival curves of mice. (b) Lung burden after treatment.',page:4,authorPassages:[],questionAims:[]}];
const md=`# 脑图
- **研究背景** ⟦p.1｜Infections caused by this pathogen are difficult to treat⟧
  - 可选药少
- 结果
  - 模块：小鼠模型 ⟦Fig2⟧
    - 明显减轻损伤 ⟦p.9｜the drug reduced lung injury in every treated animal⟧
    - 编造的一条 ⟦p.3｜words that the authors never actually wrote here⟧`;
const tree=D.parse(md,figs);
assert.deepEqual(tree.children.map(c=>c.text),['**研究背景**','结果']);
assert.equal(tree.children[1].children[0].fig,'f2');
const rows=[{text:'Infections caused by this pathogen are diffi-',page:1},{text:'cult to treat in hospitals.',page:1},{text:'We saw that the drug reduced lung injury in every treated animal.',page:4}];
const s=D.verify(tree,rows);
assert.equal(s.ok,2);assert.equal(s.miss,1);
const leaf=tree.children[1].children[0].children;
assert.equal(leaf[0].page,4,'the real page replaces the claimed one');
assert.equal(leaf[1].check,'miss');
const plain=D.parse('## 研究目的\n- 验证疗效\n  - 体内\n## 结果\n1. Fig2 药效',figs);
assert.deepEqual(plain.children.map(c=>c.text),['研究目的','结果']);
assert.equal(plain.children[0].children[0].children[0].text,'体内');
assert.equal(plain.children[1].children[0].fig,'f2');
const body=[{text:'Introduction',page:1},{text:'The mechanism of this drug remains unclear in clinical isolates from hospitals.',page:1},{text:'Here we investigated how the drug acts on resistant bacteria in infected mice.',page:1},
 {text:'Discussion',page:8},{text:'A limitation of this study is that only one mouse model of infection was used.',page:8},{text:'References',page:9}];
const local=D.local({rows:body,figures:figs,question:'Q',sections:[{title:'',figures:figs}]});
assert.deepEqual(local.children.map(c=>c.key),['background','aim','results','limits','talk']);
assert.equal(local.children[2].children[0].children.filter(c=>c.panel).length,2);
assert.ok(local.children[0].children[0].quote.startsWith('The mechanism'));
assert.ok(D.prompt({rows:body,title:'T',figures:figs}).includes('[p.8]'));
console.log('PASS local outline from source sentences, Markdown import and quotation checks.');

assert.equal(leaf[1].page,undefined,'unverified quotes have no source link');
assert.match(D.prompt({rows:body,title:'T',figures:figs,lang:'en'}),/English reading map/);
const longPaper=Array.from({length:95},(_,i)=>({page:i+1,text:'Public source material. '.repeat(250)}));
const excerpt=D.excerpt(longPaper);
assert.ok(excerpt.includes('[p.1]')&&excerpt.includes('[p.95]')&&excerpt.length<19500);
const zh=D.local({rows:[{page:1,text:'引言'},{page:1,text:'邻域嵌入是一类用于展示高维数据结构的降维方法。'}],figures:[],sections:[],question:'问题'});
assert.equal(zh.children[0].key,'background');
