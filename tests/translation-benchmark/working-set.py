"""Sample total working set of this isolated browser and its descendants on Windows."""
import ctypes as c, ctypes.wintypes as w, json, sys, time
from pathlib import Path
root=int(sys.argv[1]); destination=Path(sys.argv[2])
k=c.WinDLL("kernel32",use_last_error=True); ps=c.WinDLL("psapi",use_last_error=True)
class Entry(c.Structure):
    _fields_=[("size",w.DWORD),("cnt",w.DWORD),("pid",w.DWORD),("heap",c.c_size_t),("module",w.DWORD),("threads",w.DWORD),("parent",w.DWORD),("pri",w.LONG),("flags",w.DWORD),("name",w.WCHAR*260)]
class Memory(c.Structure):
    _fields_=[("size",w.DWORD),("faults",w.DWORD),("peak",c.c_size_t),("working",c.c_size_t),("rest",c.c_size_t*6)]
k.CreateToolhelp32Snapshot.restype=w.HANDLE
k.OpenProcess.restype=w.HANDLE
k.CloseHandle.argtypes=[w.HANDLE]
k.Process32FirstW.argtypes=k.Process32NextW.argtypes=[w.HANDLE,c.POINTER(Entry)]
ps.GetProcessMemoryInfo.argtypes=[w.HANDLE,c.POINTER(Memory),w.DWORD]
peak=0;count=0
while True:
    snapshot=k.CreateToolhelp32Snapshot(2,0);e=Entry();e.size=c.sizeof(e);procs={}
    ok=k.Process32FirstW(snapshot,c.byref(e))
    while ok:
        procs[e.pid]=e.parent;ok=k.Process32NextW(snapshot,c.byref(e))
    k.CloseHandle(snapshot)
    if root not in procs:break
    ids={root}
    while True:
        extra={p for p,parent in procs.items() if parent in ids}-ids
        if not extra:break
        ids.update(extra)
    total=0
    for pid in ids:
        h=k.OpenProcess(0x410,False,pid)
        if not h:continue
        m=Memory();m.size=c.sizeof(m)
        if ps.GetProcessMemoryInfo(h,c.byref(m),m.size):total+=m.working
        k.CloseHandle(h)
    count+=1;peak=max(peak,total)
    destination.write_text(json.dumps({"peakWorkingSetBytes":peak,"samples":count,"sampleIntervalMs":400}),encoding="utf8")
    time.sleep(.4)
