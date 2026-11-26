const assert=require('node:assert/strict');
global.window=global;
global.location={hostname:'reader.example'};
require('../dist/reader-access.js');

(async()=>{
  const requested=[];
  global.fetch=async url=>{
    requested.push(url);
    if(url.hostname!=='www.ebi.ac.uk')throw Error('Unreachable');
    return {ok:true,json:async()=>({resultList:{result:[
      {pmid:'40233748',title:'Matching publication',abstractText:'<p>Abstract</p>'},
      {pmid:'12345678',title:'Another publication'}
    ]}})};
  };
  const exact=await ReaderAccess.search('PMID: 40233748');
  assert.deepEqual(exact.literature.map(r=>r.url),['https://pubmed.ncbi.nlm.nih.gov/40233748/']);
  assert.equal(exact.literature[0].abstract,'Abstract');
  assert.equal(requested[0].searchParams.get('id'),'40233748');
  assert.equal(requested[1].searchParams.get('query'),'EXT_ID:40233748 AND SRC:MED');
  requested.length=0;
  const general=await ReaderAccess.search('calibration');
  assert.equal(general.search.count,2);
  assert.deepEqual(requested.map(url=>url.hostname),['api.crossref.org','www.ebi.ac.uk']);
  assert.equal(new URL(ReaderAccess.scholarURL('A & B')).searchParams.get('wd'),'A & B');
  console.log('Exact PMID, fallback index and Chinese search links passed');
})().catch(err=>{console.error(err);process.exitCode=1});
