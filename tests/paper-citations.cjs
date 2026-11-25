const assert=require('node:assert/strict');
const C=require('../dist/paper-citations.js');
const row=(text,page=9,extra={})=>({text,page,...extra});
const style=[
  row('We follow Kobak and Berens (2019) as shown in Figure 2.',3,{mentions:['F:2']}),
  row('References'),
  row('Dmitry Kobak and Philipp Berens. The art of using t-SNE for single-cell transcriptomics. Nature'),
  row('Communications, 10:5416, 2019.'),
  row('Dmitry Kobak and George Linderman. Initialization is critical for preserving global data structure. Nature Biotechnology, 2021.'),
  row('Sabina Kanton, Michael Boyle, Zhisong He, et al. Organoid single-cell genomic atlas uncovers human-specific features. Nature, 574:418–422, 2019.'),
  row('Laurens van der Maaten and Geoffrey Hinton. Visualizing data using t-SNE. Journal of Machine Learning Research, 9:2579–2605, 2008.'),
  row('Appendix A'),
  row('Not a reference at all, though it is long enough. 2019.')
];
const p=C.build(style);
assert.equal(p.entries.length,4);
assert.equal(p.entries[0].title,'The art of using t-SNE for single-cell transcriptomics');
assert.match(p.entries[0].text,/Nature Communications/);
const titles=t=>p.find(t).map(h=>h.entry.title.split(' ')[0]);
assert.deepEqual(titles('as before (Kobak and Berens, 2019; Kanton et al., 2019).'),['The','Organoid']);
assert.deepEqual(titles('van der Maaten and Hinton (2008) showed this'),['Visualizing']);
assert.deepEqual(titles('Kobak and Linderman (2021)'),['Initialization']);
assert.deepEqual(titles('Nobody et al. (2019) and Kanton et al. (2015)'),[],'unknown names and years stay unlinked');
assert.deepEqual(p.find('Sampled at p.10 (Figure 2019)'),[]);
const fig=p.forFigure({matchKey:'F:2',caption:'Cells (Kanton et al., 2019). Next sentence.',page:2});
assert.equal(fig.length,2);
assert.equal(fig[0].uses[0].quote,'Cells (Kanton et al., 2019).');
assert.equal(fig[1].uses[0].where,'near');

const n=C.build([row('Body'),row('REFERENCES'),row('1. Smith J, Lee K. A very long first title here. J Test. 2001;1:2.'),row('continued line'),row('2. Wu X. Second paper about something. Cell 2010. doi:10.1016/j.cell.2010.01.001.'),row('[3] Zed A. Third paper in the list now. Nature 2011.')]);
assert.equal(n.entries.length,3);
assert.deepEqual(n.find('known [1, 3] and [2–3]').map(h=>h.entry.number),[1,3,2,3]);
assert.equal(n.entries[1].url,'https://doi.org/10.1016/j.cell.2010.01.001');
const twin=C.build([row('References'),row('A Kim and B Roe. First same-year title goes here. X, 2020.'),row('A Kim and B Roe. Second same-year title goes here. Y, 2020.')]);
assert.equal(twin.find('Kim and Roe (2020)').length,0,'two candidates are not guessed');
assert.deepEqual(C.build([]).entries,[]);
console.log('PASS author–year and numbered citations, sentence context, and no link when ambiguous.');
