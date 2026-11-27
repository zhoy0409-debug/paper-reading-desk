"""Sample the Windows private commit and working set of one browser tree."""
import ctypes
import json
import sys
import time
from ctypes import wintypes as wt
from pathlib import Path


root, output, stopfile = int(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
k32 = ctypes.WinDLL("kernel32", use_last_error=True)
psapi = ctypes.WinDLL("psapi", use_last_error=True)
size = ctypes.c_size_t


class Process(ctypes.Structure):
    _fields_ = [("size", wt.DWORD), ("cnt", wt.DWORD), ("pid", wt.DWORD),
                ("heap", size), ("module", wt.DWORD), ("threads", wt.DWORD),
                ("parent", wt.DWORD), ("priority", wt.LONG), ("flags", wt.DWORD),
                ("exe", wt.WCHAR * 260)]


class Memory(ctypes.Structure):
    _fields_ = [("cb", wt.DWORD), ("faults", wt.DWORD)] + [
        (name, size) for name in ("peakWs", "ws", "peakPool", "pool", "peakNonPool", "nonPool",
                                  "pagefile", "peakPagefile", "private")]


k32.CreateToolhelp32Snapshot.restype = wt.HANDLE
k32.CreateToolhelp32Snapshot.argtypes = [wt.DWORD, wt.DWORD]
k32.Process32FirstW.argtypes = k32.Process32NextW.argtypes = [wt.HANDLE, ctypes.POINTER(Process)]
k32.OpenProcess.restype = wt.HANDLE
k32.OpenProcess.argtypes = [wt.DWORD, wt.BOOL, wt.DWORD]
k32.CloseHandle.argtypes = [wt.HANDLE]
psapi.GetProcessMemoryInfo.argtypes = [wt.HANDLE, ctypes.POINTER(Memory), wt.DWORD]


def snapshot():
    snap = k32.CreateToolhelp32Snapshot(2, 0)
    p = Process()
    p.size = ctypes.sizeof(p)
    ok = k32.Process32FirstW(snap, ctypes.byref(p))
    parents = {}
    while ok:
        parents[p.pid] = p.parent
        ok = k32.Process32NextW(snap, ctypes.byref(p))
    k32.CloseHandle(snap)
    ids = {root}
    while more := {pid for pid, parent in parents.items() if parent in ids} - ids:
        ids.update(more)
    ws = private = observed = 0
    for pid in ids:
        h = k32.OpenProcess(0x0400 | 0x0010, False, pid)
        if not h:
            continue
        m = Memory()
        if psapi.GetProcessMemoryInfo(h, ctypes.byref(m), ctypes.sizeof(m)):
            ws += m.ws
            private += m.private
            observed += 1
        k32.CloseHandle(h)
    return {"utc_s": time.time(), "ws": ws, "private": private, "processes": observed}


with output.open("w", encoding="utf-8", buffering=1) as f:
    while not stopfile.exists():
        print(json.dumps(snapshot()), file=f)
        time.sleep(.1)
