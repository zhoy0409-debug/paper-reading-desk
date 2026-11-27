const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { chromium } = require("playwright-core");
const engine = process.argv[2];
const py = process.argv[3];
const run = process.argv[4] || engine;
const records = JSON.parse(fs.readFileSync("samples.json", "utf8")).samples;
const outputPath = run + "-raw.json";
const output = { engine, samples: [], resources: [], consoleErrors: [] };
const save = () => fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
const stopfile = path.resolve(run + "-memory.done");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let monitor;
  try {
    output.chrome = browser.version();
    const cdp = await browser.newBrowserCDPSession();
    const info = await cdp.send("SystemInfo.getProcessInfo");
    const pid = info.processInfo.find(p => p.type === "browser").id;
    const page = await browser.newPage();
    page.on("response", r => output.resources.push({url: r.url(), status: r.status()}));
    page.on("pageerror", e => output.consoleErrors.push(String(e.stack || e)));
    await page.goto("http://127.0.0.1:8254/");
    fs.rmSync(stopfile, {force: true});
    monitor = spawn(py, ["memory.py", String(pid), run + "-memory.jsonl", stopfile], {stdio: "inherit"});
    await delay(900);
    output.startUtcMs = Date.now();
    output.cold = await page.evaluate(async engine => {
      const start = performance.now();
      let targetToken;
      if (engine === "bergamot") {
        const { BatchTranslator } = await import("/bergamot/translator.js");
        const translator = new BatchTranslator({
          workers: 1, cacheSize: 0, downloadTimeout: 120000, useNativeIntGemm: false,
          registryUrl: new URL("/bergamot/models.json", location.href).href,
        });
        window.translateSample = async text => (await translator.translate({from:"en", to:"zh", text, html:false, priority:0})).target.text;
      } else {
        const { env, pipeline } = await import("/runtime/transformers.min.js");
        env.allowRemoteModels = false;
        env.allowLocalModels = true;
        env.useBrowserCache = false;
        env.localModelPath = "/models/";
        env.backends.onnx.wasm.wasmPaths = "/runtime/";
        env.backends.onnx.wasm.numThreads = 1;
        const pipe = await pipeline("translation", "Xenova/opus-mt-en-zh", {quantized:true});
        // The original OPUS-MT model requires an input language tag. The model's
        // authentic Unigram vocabulary assigns ID 5 to >>cmn_Hans<<. Encode it as
        // one token even when the Transformers.js tokenizer splits it.
        const tag = ">>cmn_Hans<<";
        targetToken = pipe.tokenizer.model.tokens_to_ids.get(tag);
        if (!Number.isInteger(targetToken)) throw Error("missing Marian Chinese language tag");
        const { Tensor } = await import("/runtime/transformers.min.js");
        window.translateSample = async text => {
          const inputs = pipe.tokenizer(text);
          const prepend = (tensor, head) => new Tensor("int64", BigInt64Array.from([BigInt(head), ...tensor.data]), [1,tensor.dims[1]+1]);
          const ids = prepend(inputs.input_ids, targetToken);
          const mask = prepend(inputs.attention_mask, 1);
          const tokens = await pipe.model.generate(ids, {num_beams:engine === "opus4" ? 4 : 1, do_sample:false, max_new_tokens:180}, null, {attention_mask: mask});
          return pipe.tokenizer.batch_decode(tokens, {skip_special_tokens:true})[0];
        };
      }
      const result = await window.translateSample("The sample was measured twice.");
      return { ms: performance.now() - start, warmup: result, targetToken };
    }, engine);
    console.log(engine, "cold", JSON.stringify(output.cold)); save();
    for (const item of records) {
      const result = await page.evaluate(async text => {
        const start = performance.now();
        const output = await window.translateSample(text);
        return { output, ms: performance.now() - start };
      }, item.text);
      output.samples.push({id:item.id, ...result});
      save();
      console.log(engine, item.id, Math.round(result.ms));
    }
    output.finishUtcMs = Date.now();
  } catch (error) {
    output.error = String(error.stack || error);
    console.error(output.error); process.exitCode = 1;
  } finally {
    save(); fs.writeFileSync(stopfile, "");
    if (monitor) await Promise.race([new Promise(r => monitor.once("exit", r)), delay(2200)]);
    await browser.close();
  }
})();
