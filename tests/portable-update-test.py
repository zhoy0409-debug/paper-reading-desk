"""Exercise staged updates without downloading or running a release."""
import hashlib
import io
import os
import sys
import tempfile
import threading
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
    early_eof = update.URLError(update.ssl.SSLEOFError("Peer closed the connection"))
    with patch.object(update,"latest",side_effect=[early_eof,(number,[asset])]) as check, patch.object(update.time,"sleep"):
        u.work("check")
    assert check.call_count == 2 and u.status()["phase"]=="available"
    with patch.object(update,"fetch",return_value=io.BytesIO(data.replace(b"test file",b"test fail"))) as corrupt:
        u.work("install")
    corrupt.assert_called_once()
    assert u.status()["phase"]=="error" and not (u.store/"pending").exists()
    dest = u.store / number
    dest.mkdir()
    (dest / "previous-installation").write_text("previous")
    replace = os.replace
    def locked(source, target):
        if Path(source).name == "app" and Path(target) == dest:
            exc = PermissionError("Directory temporarily in use")
            exc.winerror = 5
            raise exc
        replace(source, target)

    with patch.object(update,"fetch",return_value=io.BytesIO(data)), patch.object(update.os,"replace",locked), patch.object(update.time,"sleep"):
        u.work("install")
    assert u.status()["phase"]=="error" and not (u.store/"pending").exists()
    assert (dest/"previous-installation").read_text()=="previous"

    attempts = []
    def briefly_locked(source, target):
        if Path(source).name == "app" and Path(target) == dest:
            attempts.append(1)
            if len(attempts) <= 2:
                locked(source, target)
        replace(source, target)

    with patch.object(update,"fetch",side_effect=[io.BytesIO(data[:40]),io.BytesIO(data)]) as download, patch.object(update.os,"replace",briefly_locked), patch.object(update.time,"sleep") as delay:
        u.work("install")
    assert u.status()["phase"]=="ready" and len(attempts)==3 and delay.call_count==3
    assert download.call_count==2  # A dropped transfer retries. A sharing lock reuses the verified file.
    assert (u.store/"pending").read_text()==number and not (u.store/"active").exists()
    with patch.object(update,'VERSION',number):
        newer=update.Updater(u.store/number,base)
        assert newer.enabled
        newer.started()
    assert (u.store/"active").read_text()==number and not (u.store/"pending").exists()
assert not update.Updater().enabled

if os.name == "nt":
    with tempfile.TemporaryDirectory() as directory:
        stage = Path(directory) / "app"
        stage.mkdir()
        file = stage / "module.py"
        file.write_text("complete")
        destination = stage.with_name("installed")
        with file.open("rb") as held:
            try:
                os.replace(stage, destination)
            except PermissionError as exc:
                assert exc.winerror in (5, 32, 33)
            else:
                raise AssertionError("Expected an open file to hold the staged directory")
            timer = threading.Timer(0.35, held.close)
            timer.start()
            try:
                update.replace_when_available(stage, destination)
            finally:
                timer.join()
        assert (destination / file.name).read_text()=="complete"
    print("PASS real Windows file sharing lock released during installation")
print("PASS connection and truncated-download recovery, digest verification, bounded file-lock retries, previous install recovery and staged activation")
