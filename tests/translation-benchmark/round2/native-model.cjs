// Run manually with a dedicated test profile. Chrome may download its own language pack.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright-core');

async function main() {
  const [url, profile, output] = process.argv.slice(2);
  if (!url || !profile || !output) throw Error('Usage: node native-model.cjs READER_URL TEST_PROFILE OUTPUT_JSON');
  const inputs = fs.readFileSync(path.join(__dirname, 'fresh.jsonl'), 'utf8').trim().split('\n').map(line=>JSON.parse(line));
  const context = await chromium.launchPersistentContext(profile, {
    channel:'chrome',
    headless:true,
    ignoreDefaultArgs:['--disable-component-update','--disable-background-networking']
  });
  try {
    const page = await context.newPage();
    await page.goto(url);
    await page.setContent('<button type="button">Start the local translator</button>');
    await page.evaluate(async()=>{
      const trial = window.trial = {availability:await Translator.availability({sourceLanguage:'en',targetLanguage:'zh'}), samples:[]};
      document.querySelector('button').onclick = async()=>{
        const started = performance.now();
        const controller = new AbortController();
        const timer = setTimeout(()=>controller.abort(),105000);
        try {
          window.localTranslator = await Translator.create({sourceLanguage:'en',targetLanguage:'zh',signal:controller.signal});
          trial.readyMs = Math.round(performance.now()-started);
          trial.englishTest = await localTranslator.translate('The blue light passed through the glass.');
        } catch(error) {
          trial.error = {name:error.name,message:error.message};
        } finally {
          clearTimeout(timer);
          trial.finished = true;
        }
      };
    });
    await page.getByRole('button').click();
    await page.waitForFunction(()=>window.trial.finished,null,{timeout:118000});
    if (await page.evaluate(()=>!!window.localTranslator)) {
      for (const {id,source} of inputs) {
        await page.evaluate(async({id,source})=>{
          const started=performance.now();
          const text=await localTranslator.translate(source);
          window.trial.samples.push({id,text,ms:Math.round(performance.now()-started)});
        },{id,source});
      }
    }
    const trial=await page.evaluate(()=>window.trial);
    fs.writeFileSync(output,JSON.stringify(trial,null,2)+'\n');
    assert.equal(trial.samples.length,inputs.length,JSON.stringify(trial.error));
    console.log('Completed',trial.samples.length,'local translations, engine ready in',trial.readyMs,'ms');
  } finally {
    await context.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
