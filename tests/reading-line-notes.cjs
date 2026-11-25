const assert=require('node:assert/strict');
const N=require('../dist/reading-line-notes.js');
const make=(say,sentences={},panels=['a','b'])=>({lens:{F:{say}},figures:{F:{sentences}},queue:panels.map(p=>JSON.stringify(['F',p]))});
let s=make('My line');
assert.equal(N.offer(s,'F').kind,'fill');
assert.equal(N.add(s,'F','a'),true);
assert.equal(s.figures.F.sentences.a,'My line');
assert.equal(N.add(s,'F','b'),false,'one panel only');
assert.equal(s.figures.F.sentences.b,undefined);
assert.deepEqual(N.offer(s,'F'),{kind:'synced',panel:'a'});
s.lens.F.say='Better line';
assert.equal(N.follow(s,'F'),'a');
assert.equal(s.figures.F.sentences.a,'Better line');
s.lens.F.say='';N.follow(s,'F');
assert.equal('a' in s.figures.F.sentences,false,'clearing restores the built-in note');
s.lens.F.say='Again';N.follow(s,'F');
assert.equal(s.figures.F.sentences.a,'Again','retyping keeps the link');
s.figures.F.sentences.a='Typed by hand';N.edited(s,'F','a');
s.lens.F.say='Other';
assert.equal(N.follow(s,'F'),'');
assert.equal(s.figures.F.sentences.a,'Typed by hand');
for(const own of ['Mine','']){
  s=make('Line',{a:own});
  assert.equal(N.add(s,'F','a'),false);
  assert.equal(s.figures.F.sentences.a,own,'typed or cleared notes stay');
}
s=make('Line');N.add(s,'F','a');s.figures.F.sentences.a='Restored by undo';s.lens.F.say='New';
assert.equal(N.follow(s,'F'),'');
assert.equal(s.figures.F.sentences.a,'Restored by undo');
s=make('Line');N.add(s,'F','a');N.removed(s,'F','a');
assert.equal('a' in s.figures.F.sentences,false);
assert.equal(N.add(s,'F','b'),true,'can move to another panel');
s=make('Line',{a:'Mine'});N.removed(s,'F','a');
assert.equal(s.figures.F.sentences.a,'Mine');
s=make('',{b:' From basket '});
assert.deepEqual(N.offer(s,'F'),{kind:'take',panel:'b',text:'From basket'});
s=make('Taken',{a:'Taken'});
assert.equal(N.add(s,'F','b'),false,'the same text is not repeated');
assert.equal(N.offer(s,'F').kind,'none');
assert.equal(N.offer(make('Line',{},[]),'F').kind,'none');
assert.equal(N.offer({},'F').kind,'none');
console.log('PASS line to note, follow, hand edits kept, removal and reuse.');

{
  const decks=require('../dist/reading-deck-store.js');
  const keys=['A','B'].map(letter=>JSON.stringify(['fig',letter]));
  const [first,second]=keys.map(key=>decks.slide('panel',{key,figure:'fig'}));
  const custom=decks.slide('text',{body:'Notes for the audience'});
  const slides=[first,custom,second];
  assert.equal(decks.merge(slides,keys.slice().reverse()),true);
  assert.deepEqual(slides,[second,custom,first]);
  assert.equal(decks.merge(slides,keys.slice().reverse()),false);
}
