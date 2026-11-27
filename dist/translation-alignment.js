// A back-translation is another fallible model output. Its only role here is to
// identify specific content to review; overlap never certifies semantic accuracy.
const stop=new Set(('the a an of on in at by as with for from to and or but if then this that these those it its their our we they which when where who was were is are be been being had have has do did does used using use also thus both shown shows show present presented based can could may might than between all other each such here figure table respectively measured observed found very').split(' '));
const equivalences=new Map(Object.entries({greater:'higher',increased:'higher',increase:'higher',larger:'higher',smaller:'lower',reduced:'lower',decrease:'lower',decreased:'lower',fewer:'less',samples:'sample',analysed:'analyzed',individuals:'people',persons:'people',subjects:'participants',datasets:'dataset',association:'relationship',correlation:'relationship',associations:'relationship',correlations:'relationship',results:'findings',versus:'compared',linked:'related',approximately:'about',obtained:'acquired'}));
function tokens(text){
  return (text.toLowerCase().match(/[a-z][a-z-]{2,}/g)||[]).filter(v=>!stop.has(v)).map(v=>{
    const word=equivalences.get(v)||v;
    return {word:v,stem:word.replace(/ies$/,'y').replace(/(?:ing|ed|s)$/,'').slice(0,7)};
  });
}
export function needsAlignment(source){
  const count=source.match(/\b[A-Za-z]{2,}\b/g)?.length||0;
  return count>=16&&/\b(?:and|although|whereas|versus|compared|between|except|both|each|during|whether|respectively|relative|without|using|rather than)\b/i.test(source);
}
export function checkAlignment(source,back){
  const a=tokens(source),b=tokens(back),seen=new Set(b.map(x=>x.stem));
  const missing=a.filter(w=>!seen.has(w.stem));
  const fraction=missing.length/(a.length||1);
  const consecutive=a.some((w,i)=>i>0&&!seen.has(w.stem)&&!seen.has(a[i-1].stem)&&w.word.length>=5);
  if(a.length>=7&&missing.length>=3&&consecutive&&(fraction>=.45||b.length<a.length*.70))
    return {code:'alignment',severity:'advisory',detail:[...new Set(missing.map(w=>w.word))].slice(0,4).join(', ')};
  return null;
}
