"""Exercise staged updates without downloading or running a release."""
import hashlib
import io
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import portable_update as update

number = "2.4.1"
def bundle():
    buf = io.BytesIO()
    with ZipFile(buf, "w") as z:
        for name in ("preview.py", "portable_update.py", "dist/index.html", "runtime/python.exe", "VERSION"):
            z.writestr("Reading-Desk/" + name, number if name=="VERSION" else "test file")
    return buf.getvalue()

data = bundle()
asset = {"name": update.ASSET, "state":"uploaded","size":len(data),"digest":"sha256:"+hashlib.sha256(data).hexdigest(),
         "browser_download_url":f"https://github.com/{update.REPO}/releases/download/v{number}/{update.ASSET}"}
with tempfile.TemporaryDirectory() as directory:
    base = Path(directory)
    (base/"portable_launcher.py").touch()
    u = update.Updater(base,base)
    u.store.mkdir()
    with patch.object(update,"latest",return_value=(number,[asset])):
        u.work("check")
    assert u.status()["phase"]=="available"
    with patch.object(update,"fetch",return_value=io.BytesIO(data.replace(b"test file",b"test fail"))):
        u.work("install")
    assert u.status()["phase"]=="error" and not (u.store/"pending").exists()
    with patch.object(update,"fetch",return_value=io.BytesIO(data)):
        u.work("install")
    assert (u.store/"pending").read_text()==number and not (u.store/"active").exists()
    with patch.object(update,'VERSION',number):
        newer=update.Updater(u.store/number,base)
        assert newer.enabled
        newer.started()
    assert (u.store/"active").read_text()==number and not (u.store/"pending").exists()
assert not update.Updater().enabled
print("PASS stable release check, digest verification, retry, staged activation and installed version")
