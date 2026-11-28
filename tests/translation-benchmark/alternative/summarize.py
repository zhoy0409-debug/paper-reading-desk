"""Join the frozen checks, blinded reviews, model outputs and measured resource use."""
import collections
import hashlib
import json
import math
import statistics
from pathlib import Path
from urllib.parse import urlsplit


def load(file):
    return json.loads(Path(file).read_text(encoding="utf-8"))


def sha(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


corpus = load("samples.json")
scores = load("blind-scores.json")
key = load("blinding-key.json")
report = dict(sample_source_sha256=sha("samples.json"), scoring_method=scores["method"],
              baseline_commit="05af935721a85fac61d84bd0da0332f034b1d321",
              hardware="Intel Core Ultra 7 155H, Windows x64",
              source_license="CC BY 4.0", documents=corpus["documents"], engines={}, samples=[])
moz = load("web/bergamot/models.json")["enzh"]
moz_hashes = {}
for role, item in moz.items():
    expected = item["expectedSha256Hash"]
    assert sha(Path("web/bergamot") / Path(item["name"]).name) == expected
    moz_hashes[role] = expected
hf = load("hf-metadata.json")
onnx_hashes = {}
for item in hf["siblings"]:
    filename = item["rfilename"]
    if item.get("lfs") and filename in ("onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx"):
        expected = item["lfs"]["sha256"]
        assert sha(Path("web/models/Xenova/opus-mt-en-zh") / filename) == expected
        onnx_hashes[filename] = expected
report["verified_artifacts"] = {
    "bergamot": {"runtime":"0.4.9", "model":"2.1", "model_sha256":moz_hashes},
    "opus": {"upstream":"Helsinki-NLP/opus-mt-en-zh", "upstream_revision":"408d9bc410a388e1d9aef112a2daba955b945255",
             "conversion":"Xenova/opus-mt-en-zh","conversion_revision":hf["sha"],"onnx_sha256":onnx_hashes,
             "transformers_js":"2.17.2","onnxruntime_web":"1.14.0","target_tag":">>cmn_Hans<<","target_id":5}}
primary = {}
for engine in ("bergamot", "opus"):
    runs = []
    for label in (engine, engine + "-2", engine + "-3"):
        run = load(label + "-raw.json")
        assert len(run["samples"]) == len(corpus["samples"]) and not run["consoleErrors"]
        assert not run.get("error")
        assert all(x["status"] == 200 for x in run["resources"])
        assert all(urlsplit(x["url"]).hostname == "127.0.0.1" for x in run["resources"])
        entries = [json.loads(x) for x in Path(label + "-memory.jsonl").read_text().splitlines()]
        before = [x for x in entries if x["utc_s"] < run["startUtcMs"] / 1000]
        during = [x for x in entries if run["startUtcMs"] / 1000 <= x["utc_s"] <= run["finishUtcMs"] / 1000]
        assert before and during and all(x["processes"] >= 2 for x in before + during)
        memory = {}
        for field in ("ws", "private"):
            base = round(statistics.median(x[field] for x in before))
            peak = max(x[field] for x in during)
            memory[field] = dict(baseline_bytes=base, peak_bytes=peak, increase_bytes=peak - base)
        resources = sorted({urlsplit(x["url"]).path[1:] for x in run["resources"] if urlsplit(x["url"]).path != "/"})
        total_files = sum((Path("web") / x).stat().st_size for x in resources)
        runs.append(dict(label=label, cold_ms=round(run["cold"]["ms"], 2), warmup=run["cold"]["warmup"],
                         hot_ms=[round(x["ms"], 2) for x in run["samples"]], memory=memory,
                         observed_memory_samples=len(during), browser=run["chrome"]))
        if label == engine:
            first = run["samples"]
            primary[engine] = {a["id"]:a["output"] for a in first}
        assert all(primary[engine][a["id"]] == a["output"] for a in run["samples"])
    hot = sorted(x for r in runs for x in r["hot_ms"])
    model_only = sum((Path("web") / x).stat().st_size for x in resources if
                     (x.endswith((".bin", ".spm")) if engine == "bergamot" else x.startswith("models/")))
    report["engines"][engine] = dict(
        measured_files={x:(Path("web")/x).stat().st_size for x in resources},
        engine_and_model_bytes=total_files, model_and_tokenizer_bytes=model_only,
        median_cold_ms=round(statistics.median(r["cold_ms"] for r in runs), 1),
        median_hot_ms=round(statistics.median(hot), 1), hot_p95_ms=hot[math.ceil(len(hot)*.95)-1],
        median_peak_ws_increase_mib=round(statistics.median(r["memory"]["ws"]["increase_bytes"] for r in runs)/2**20, 1),
        median_peak_private_increase_mib=round(statistics.median(r["memory"]["private"]["increase_bytes"] for r in runs)/2**20, 1),
        identical_across_three_runs=len(first), runs=runs)
for sample in corpus["samples"]:
    rid = sample["id"]
    entry = dict(**sample)
    for engine in ("bergamot","opus"):
        grade, note = scores["rows"][rid]["A" if key[rid] == engine else "B"]
        entry[engine] = dict(translation=primary[engine][rid], grade=grade, note=note)
    report["samples"].append(entry)
for engine, obj in report["engines"].items():
    obj["grades"] = dict(collections.Counter(x[engine]["grade"] for x in report["samples"]))
    print(engine, json.dumps({k:v for k,v in obj.items() if k not in ("runs","measured_files")}, ensure_ascii=False))
if Path("opus4-scores.json").exists() and Path("opus4-raw.json").exists():
    supplemental = load("opus4-raw.json")
    assert len(supplemental["samples"]) == len(corpus["samples"]) and not supplemental["consoleErrors"]
    assert not supplemental.get("error") and all(x["status"] == 200 for x in supplemental["resources"])
    followup = load("opus4-scores.json")
    for record, original in zip(report["samples"], supplemental["samples"], strict=True):
        assert record["id"] == original["id"]
        grade, remark = followup[record["id"]]
        record["opus4"] = dict(translation=original["output"], grade=grade, note=remark, ms=round(original["ms"],1))
    times = sorted(x["ms"] for x in supplemental["samples"])
    report["opus_default_beams_sensitivity"] = dict(
        basis="上游默认四束。追加一次独立浏览器进程；该轮单独核对，未遮蔽模型身份。",
        cold_ms=round(supplemental["cold"]["ms"],1), median_hot_ms=round(statistics.median(times),1),
        hot_p95_ms=round(times[math.ceil(.95*len(times))-1],1),
        grades=dict(collections.Counter(row[0] for row in followup.values())))
    print("opus4", json.dumps(report["opus_default_beams_sensitivity"], ensure_ascii=False))
Path("comparison.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
