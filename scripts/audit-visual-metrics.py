"""
Ukur bukti animasi & karakter visual dari screenshot audit.

- anim-1..3.png  -> persentase piksel berubah (proxy animasi)
- 02-step.png    -> warna dominan + kecerahan (deskripsi visual kuantitatif)

Jalankan:  python scripts/audit-visual-metrics.py
Output:    docs/papaninteraktif-audit/visual-metrics.json + ringkasan konsol
"""

import json
import os
from collections import Counter

from PIL import Image, ImageChops

ROOT = os.path.join(os.getcwd(), "docs", "papaninteraktif-audit")


def changed_ratio(a: str, b: str, threshold: int = 10) -> float:
    im1 = Image.open(a).convert("RGB")
    im2 = Image.open(b).convert("RGB")
    if im1.size != im2.size:
        im2 = im2.resize(im1.size)
    diff = ImageChops.difference(im1, im2).convert("L")
    hist = diff.histogram()
    changed = sum(hist[threshold + 1 :])
    total = im1.size[0] * im1.size[1]
    return round(100.0 * changed / total, 3) if total else 0.0


def dominant_colors(path: str, top: int = 5):
    im = Image.open(path).convert("RGB")
    im.thumbnail((160, 160))
    q = im.quantize(colors=top, method=Image.Quantize.MEDIANCUT)
    palette = q.getpalette() or []
    counts = Counter(q.getdata())
    out = []
    for idx, cnt in counts.most_common(top):
        r, g, b = palette[idx * 3 : idx * 3 + 3]
        out.append({"hex": f"#{r:02x}{g:02x}{b:02x}", "share": round(cnt / sum(counts.values()), 3)})
    return out


def brightness(path: str):
    im = Image.open(path).convert("L")
    im.thumbnail((160, 160))
    px = list(im.getdata())
    mean = sum(px) / len(px)
    var = sum((p - mean) ** 2 for p in px) / len(px)
    return round(mean, 1), round(var**0.5, 1)


def main():
    results = {}
    dirs = sorted(d for d in os.listdir(ROOT) if os.path.isdir(os.path.join(ROOT, d)))
    for slug in dirs:
        d = os.path.join(ROOT, slug)
        entry = {}

        # Utamakan frame gameplay (deep-anim), fallback ke frame probe biasa.
        frames = [os.path.join(d, f"deep-anim-{i}.png") for i in (1, 2, 3)]
        if not all(os.path.exists(f) for f in frames):
            frames = [os.path.join(d, f"anim-{i}.png") for i in (1, 2, 3)]
        if all(os.path.exists(f) for f in frames):
            entry["anim_pct_1_2"] = changed_ratio(frames[0], frames[1])
            entry["anim_pct_2_3"] = changed_ratio(frames[1], frames[2])

        anim_json = os.path.join(d, "anim.json")
        if os.path.exists(anim_json):
            with open(anim_json, encoding="utf-8") as fh:
                data = json.load(fh)
            entry["canvas"] = data.get("canvasInfo", [])
            entry["game_url"] = data.get("target")

        base = os.path.join(d, "02-step.png")
        if os.path.exists(base):
            entry["dominant_colors"] = dominant_colors(base)
            mean, sd = brightness(base)
            entry["brightness"] = mean
            entry["contrast_sd"] = sd

        if entry:
            results[slug] = entry
            flag = ""
            if "anim_pct_1_2" in entry:
                flag = f" anim={entry['anim_pct_1_2']}%/{entry['anim_pct_2_3']}%"
            print(f"{slug:42s} canvas={len(entry.get('canvas', []))}{flag}")

    with open(os.path.join(ROOT, "visual-metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(results, fh, indent=2)

    print(f"\n{len(results)} game dianalisis -> visual-metrics.json")


if __name__ == "__main__":
    main()
