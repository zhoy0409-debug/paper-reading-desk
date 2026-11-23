"""Install verified stable releases alongside the running portable edition."""
import hashlib
import json
import os
import re
import shutil
import stat
import tempfile
import threading
from pathlib import Path, PureWindowsPath
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler
from zipfile import ZipFile

REPO = "zhoy0409-debug/paper-reading-desk"
ASSET = "Reading-Desk-Windows-x64.zip"
LATEST = f"https://api.github.com/repos/{REPO}/releases/latest"
MAX_ARCHIVE = 350 * 1024 * 1024
MAX_EXPANDED = 900 * 1024 * 1024
APP = Path(__file__).resolve().parent
VERSION = (APP / "VERSION").read_text(encoding="ascii").strip()


def version(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d{1,5}\.\d{1,5}\.\d{1,5}", value):
        raise ValueError("Invalid release version")
    return tuple(map(int, value.split(".")))


def official(url):
    parts = urlsplit(url)
    return parts.scheme == "https" and parts.hostname in {
        "api.github.com", "github.com", "release-assets.githubusercontent.com",
        "objects.githubusercontent.com", "github-releases.githubusercontent.com"
    } and not parts.username and not parts.password and parts.port in (None, 443)


class ReleaseRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not official(newurl):
            raise ValueError("Unexpected release host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url):
    if not official(url):
        raise ValueError("Unexpected release URL")
    return build_opener(ReleaseRedirect()).open(Request(url, headers={"User-Agent": "Reading-Desk/" + VERSION}), timeout=45)


def latest():
    with fetch(LATEST) as response:
        info = json.loads(response.read(1024 * 1024))
    tag = info["tag_name"]
    number = tag[1:]
    version(number)
    if tag != "v" + number or info["prerelease"] or info["draft"]:
        raise ValueError("Expected a stable release")
    return number, info["assets"]


def release_asset(number, assets):
    url = f"https://github.com/{REPO}/releases/download/v{number}/{ASSET}"
    hits = [a for a in assets if a["name"] == ASSET and a["state"] == "uploaded"
            and a["browser_download_url"] == url and 0 < a["size"] <= MAX_ARCHIVE]
    if len(hits) != 1 or not re.fullmatch(r"sha256:[0-9a-f]{64}", hits[0].get("digest") or ""):
        raise ValueError("Verified Windows package unavailable")
    return hits[0]


def unpack(archive, target, number):
    seen = set()
    with ZipFile(archive) as package:
        if len(package.infolist()) > 30000 or sum(e.file_size for e in package.infolist()) > MAX_EXPANDED:
            raise ValueError("Unexpected bundle size")
        for item in package.infolist():
            parts = item.filename.rstrip("/").split("/")
            if parts[0] != "Reading-Desk" or "\\" in item.filename or (item.external_attr >> 16) & 0o170000 == stat.S_IFLNK:
                raise ValueError("Unexpected bundle layout")
            for name in parts:
                if name in {"", ".", ".."} or name.endswith((".", " ")) or re.search(r'[<>:"|?*\x00-\x1f]',name) or getattr(os.path, "isreserved", lambda s: PureWindowsPath(s).is_reserved())(name):
                    raise ValueError("Invalid package entry")
            key = "/".join(parts).casefold()
            if key in seen:
                raise ValueError("Duplicate package entry")
            seen.add(key)
            dest = target.joinpath(*parts[1:])
            dest.parent.mkdir(parents=True, exist_ok=True)
            if item.is_dir():
                dest.mkdir(exist_ok=True)
            else:
                with package.open(item) as src, dest.open("xb") as out:
                    shutil.copyfileobj(src, out)
    if not all((target / n).is_file() for n in ("preview.py", "portable_update.py", "dist/index.html", "runtime/python.exe", "VERSION")):
        raise ValueError("Incomplete application bundle")
    if (target / "VERSION").read_text(encoding="ascii").strip() != number:
        raise ValueError("Bundle version mismatch")


def mark(store, name, value):
    fd, tmp = tempfile.mkstemp(dir=store)
    try:
        with os.fdopen(fd, "w", encoding="ascii") as out:
            out.write(value)
        os.replace(tmp, store / name)
    finally:
        Path(tmp).unlink(missing_ok=True)


class Updater:
    def __init__(self, app=APP, root=None):
        root = root or os.environ.get("READING_DESK_PORTABLE")
        base = Path(root).resolve() if root else None
        self.store = Path(os.environ.get("READING_DESK_UPDATE_STORE") or base / ".reading-desk-updates").resolve() if base else None
        self.enabled = bool(base and (base / "portable_launcher.py").is_file()
                            and app in (base, self.store / VERSION))
        self.lock = threading.RLock()
        self.asset = None
        self.state = {"enabled": self.enabled, "current": VERSION, "phase": "idle"}

    def started(self):
        if self.enabled and (self.store / "pending").is_file() and (self.store / "pending").read_text().strip() == VERSION:
            mark(self.store, "active", VERSION)
            (self.store / "pending").unlink()

    def change(self, **changes):
        with self.lock:
            self.state.update(changes)

    def status(self):
        with self.lock:
            return dict(self.state)

    def begin(self, action):
        with self.lock:
            phase = self.state["phase"]
            if not self.enabled or phase in ("checking", "downloading", "verifying", "ready", "restarting"):
                return self.status()
            if action == "install" and (not self.asset or phase not in ("available", "error")):
                return self.status()
            self.change(phase="checking" if action == "check" else "downloading", received=0)
            threading.Thread(target=self.work, args=(action,), daemon=True).start()
            return self.status()

    def work(self, action):
        try:
            if action == "check":
                self.asset = None
                number, assets = latest()
                newer = version(number) > version(VERSION)
                if newer:
                    self.asset = release_asset(number, assets)
                self.change(phase="available" if newer else "current", latest=number)
                return
            asset = self.asset
            with tempfile.TemporaryDirectory(dir=self.store) as staging:
                stage = Path(staging)
                archive = stage / "bundle.zip"
                received = 0
                digest = hashlib.sha256()
                with fetch(asset["browser_download_url"]) as response, archive.open("xb") as out:
                    while chunk := response.read(256 * 1024):
                        received += len(chunk)
                        if received > asset["size"]:
                            raise ValueError("Size mismatch")
                        digest.update(chunk)
                        out.write(chunk)
                        self.change(received=received, total=asset["size"])
                self.change(phase="verifying")
                if received != asset["size"] or digest.hexdigest() != asset["digest"][7:]:
                    raise ValueError("Release verification failed")
                next_app = stage / "app"
                next_app.mkdir()
                number = self.state["latest"]
                unpack(archive, next_app, number)
                destination = self.store / number
                # An interrupted, already unpacked installation can be retried.
                if destination.exists():
                    destination.rename(stage / "superseded")
                next_app.rename(destination)
                mark(self.store, "pending", number)
            self.change(phase="ready")
        except Exception as exc:
            print("Reading Desk update:", type(exc).__name__, str(exc), flush=True)
            self.change(phase="error", operation=action)

    def restart(self):
        with self.lock:
            if self.state["phase"] != "ready" or not self.enabled:
                return False
            self.change(phase="restarting")
            return True
