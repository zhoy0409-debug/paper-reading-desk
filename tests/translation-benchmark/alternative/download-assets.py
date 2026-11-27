"""Fetch public, pinned model files for local QA. Nothing is installed into the product."""
import base64
import hashlib
import io
import json
import tarfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
WEB = ROOT / "web"
MODEL = "Xenova/opus-mt-en-zh"
REV = "046f55aec303cdee3e0318604406d4df20f1e8ea"
ASSETS = (
    "README.md", "config.json", "tokenizer.json", "tokenizer_config.json",
    "generation_config.json", "special_tokens_map.json",
    "onnx/encoder_model_quantized.onnx", "onnx/decoder_model_merged_quantized.onnx",
)

def get(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers={"User-Agent":"Paper-Reading-Desk-Local-QA/1"}),timeout=60) as response:
                return response.read()
        except OSError:
            if attempt==2: raise
            time.sleep(2**attempt)

registry = json.loads((ROOT / "hf-metadata.json").read_text("utf-8"))
assert registry["sha"] == REV
entries = {f["rfilename"]:f for f in registry["siblings"]}
def asset(name):
    entry = entries[name]
    dest = WEB / "models" / MODEL / name
    def check(data):
        if entry.get("lfs"):
            return hashlib.sha256(data).hexdigest() == entry["lfs"]["sha256"]
        git_blob = ("blob %d" % len(data)).encode() + bytes([0]) + data
        return hashlib.sha1(git_blob).hexdigest() == entry["blobId"]
    if dest.exists() and check(dest.read_bytes()): return
    data = get(f"https://huggingface.co/{MODEL}/resolve/{REV}/{name}?download=true")
    if len(data)!=entry["size"] or not check(data): raise ValueError(name + ": hash/size mismatch")
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(data)
    print(name, len(data), hashlib.sha256(data).hexdigest(), flush=True)

def runtime():
    package=json.loads((ROOT/"npm-metadata.json").read_text("utf-8"))
    data=get(package["dist"]["tarball"])
    assert "sha512-"+base64.b64encode(hashlib.sha512(data).digest()).decode()==package["dist"]["integrity"]
    runtime=WEB/"runtime"
    runtime.mkdir(parents=True,exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(data),mode="r:gz") as packed:
        for item in packed:
            if not item.isfile(): continue
            name=Path(item.name).name
            if item.name in ("package/dist/transformers.min.js","package/LICENSE") or (name.startswith("ort-wasm") and name.endswith(".wasm")):
                (runtime/name).write_bytes(packed.extractfile(item).read())
                print("runtime", name, item.size, flush=True)
    assert (runtime/"transformers.min.js").exists() and list(runtime.glob("*.wasm"))

if __name__=="__main__":
    with ThreadPoolExecutor(max_workers=3) as pool:
        tasks=[pool.submit(runtime)]+[pool.submit(asset,n) for n in ASSETS]
        for task in tasks:task.result()
