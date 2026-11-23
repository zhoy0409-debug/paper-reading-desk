"""Stable entry point for the Windows portable edition. Keep the browser origin across upgrades."""
import argparse
import hashlib
import os
import re
import subprocess
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RESTART = 75


def read_version(marker):
    try:
        value = marker.read_text(encoding="ascii").strip()
    except FileNotFoundError:
        return ""
    if not re.fullmatch(r"\d{1,5}\.\d{1,5}\.\d{1,5}", value):
        raise ValueError("Invalid portable version marker")
    return value


def launch(port, no_browser):
    import msvcrt
    store = ROOT / ".reading-desk-updates"
    try:
        store.mkdir(exist_ok=True)
        handle = (store / "launcher.lock").open("a+b")
    except PermissionError:
        install_id = hashlib.sha256(str(ROOT).casefold().encode()).hexdigest()[:24]
        store = Path(os.environ["LOCALAPPDATA"]) / "ReadingDesk" / "updates" / install_id
        store.mkdir(parents=True, exist_ok=True)
        handle = (store / "launcher.lock").open("a+b")
    with handle as lock:
        lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            if not no_browser:
                webbrowser.open(f"http://127.0.0.1:{port}/")
            return 0
        while True:
            previous = read_version(store / "active")
            pending = read_version(store / "pending")
            version = pending or previous
            folder = store / version if version else ROOT
            env = dict(os.environ, READING_DESK_PORTABLE=str(ROOT), READING_DESK_UPDATE_STORE=str(store))
            command = [str(folder / "runtime" / "python.exe"), str(folder / "preview.py"), "--port", str(port)]
            if no_browser:
                command.append("--no-browser")
            try:
                result = subprocess.run(command, env=env, cwd=folder).returncode
            except OSError:
                if not pending:
                    raise
                result = 1
            if result == RESTART:
                no_browser = True
                continue
            if result and pending and read_version(store / "pending") == pending:
                (store / "pending").unlink()
                print("Update could not start. Reopening the previous version.", flush=True)
                continue
            return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4187)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    sys.exit(launch(args.port, args.no_browser))
