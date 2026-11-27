"""Check the distributed video frames, captions and posters against a real reader capture."""
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
TOUR = ROOT / "dist/media/tour"
ENCODER = os.environ.get("FFMPEG", "ffmpeg")


def pixels(file, filters, mode, seconds=None):
    seek = [] if seconds is None else ["-ss", str(seconds)]
    return subprocess.check_output([ENCODER, "-v", "error", *seek, "-i", str(file), "-frames:v", "1",
                                    "-vf", filters, "-pix_fmt", mode, "-f", "rawvideo", "pipe:1"])


def fingerprint(file, seconds=None):
    gray = pixels(file, "scale=33:18:flags=area", "gray", seconds)
    assert len(gray) == 33 * 18
    bits = "".join("1" if gray[y*33+x] > gray[y*33+x+1] else "0" for y in range(18) for x in range(32))
    return f"{int(bits, 2):0144x}"


def check_axis(file, region, seconds=None):
    left, top, width, height = region
    rgb = pixels(file, f"format=rgb24,crop={width}:{height}:{left}:{top}", "rgb24", seconds)
    assert len(rgb) == width * height * 3
    ink, border = [], []
    for offset in range(0, len(rgb), 3):
        r, g, b = rgb[offset:offset+3]
        y, x = divmod(offset//3, width)
        if max(r, g, b) < 108:
            ink.append((x,y))
        if b-r > 65 and b-g > 35 and b > 145:
            border.append((x,y))
    rows = [y for y in range(height) if sum(by == y for _, by in border) >= width*.62]
    assert ink and len(rows) >= 2, f"Missing blue frame or axis text in {file.name} at {seconds}"
    ink_x, ink_y = zip(*ink)
    middle = [x for x,y in border if min(rows)+1 <= y <= max(rows)-1]
    gaps = [min(ink_y)-min(rows), max(rows)-max(ink_y), min(ink_x)-min(middle), max(middle)-max(ink_x)]
    assert all(0 <= gap <= 5 for gap in gaps), f"{file.name} at {seconds}: glyph-to-border gaps {gaps}"
    return gaps


def time_of(value):
    hours, minutes, seconds = value.split(":")
    return 3600*int(hours)+60*int(minutes)+float(seconds)


def main():
    checks = json.loads((ROOT/"tests/fixtures/tour-scenes.json").read_text(encoding="utf-8"))
    for lang in ("en","zh"):
        video=TOUR/f"tour-{lang}.mp4"
        chapters=json.loads((TOUR/f"chapters-{lang}.json").read_text(encoding="utf-8"))
        times=[(time_of(a),time_of(b)) for a,b in re.findall(r"([\d:.]+) --> ([\d:.]+)",(TOUR/f"tour-{lang}.vtt").read_text(encoding="utf-8"))]
        assert times[0][0]==0 and times[-1][1]==chapters["duration"]==60
        assert all(start < end for start,end in times)
        assert all(a[1]==b[0] for a,b in zip(times,times[1:]))
        for chapter in chapters["chapters"]:
            assert chapter["start"] in {a for a,_ in times}
        for seconds, expected in checks[lang]["scenes"].items():
            actual=fingerprint(video,float(seconds))
            distance=(int(actual,16)^int(expected,16)).bit_count()
            # Encoding shifts a few near-white pixel gradients in the map and slide screens.
            assert distance <= 28, f"{lang} scene at {seconds}s differs from the verified screen ({distance} bits)"
        region=checks[lang]["axisRegion"]
        for seconds in (8,12,15.9):
            gaps=check_axis(video,region,seconds)
        check_axis(TOUR/f"cover-{lang}.webp",region)
        print(f"{lang}: verified {len(checks[lang]['scenes'])} recorded scenes, caption boundaries and axis frame. Border gaps {gaps} px.")


if __name__ == "__main__":
    main()
