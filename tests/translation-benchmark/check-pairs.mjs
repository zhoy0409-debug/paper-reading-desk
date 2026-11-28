import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const [root,pairsFile,output]=process.argv.slice(2);
const sci=await import(pathToFileURL(path.resolve(root,'dist/scientific-translation.js')));
const validators=fs.existsSync(path.join(root,'dist/translation-facts.js'))?await import(pathToFileURL(path.resolve(root,'dist/translation-facts.js'))):null;
const entries=[];
for(const [type,source,good,bad] of JSON.parse(fs.readFileSync(pairsFile,'utf8'))){
  for(const [gold,target] of [[true,good],[false,bad]]){
    const result=validators?validators.validateScientific(source,target,{from:'en'}):await sci.translatePassage(source,'en',async()=>target);
    const accepted=validators?!result.issues.some(i=>i.severity==='severe'):!result.warnings.length;
    entries.push({type,source,target,gold,accepted,issues:result.issues});
  }
}
fs.writeFileSync(output,JSON.stringify(entries,null,2));
console.log('n',entries.length,'false accepts',entries.filter(r=>!r.gold&&r.accepted).length,'false rejects',entries.filter(r=>r.gold&&!r.accepted).length);
