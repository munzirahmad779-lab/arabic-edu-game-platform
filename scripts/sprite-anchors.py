"""
Menghitung titik pegangan tali tiap karakter dari alpha sprite.

Untuk tiap karakter:
  - cari baris yang paling melebar (tali/pegangan) di 4 frame
  - ambil sisi mayoritas (R/L) dan median tinggi tangan pada sisi itu
Keluaran: components/games/adu-tarik-dino/anchors.ts
"""
import os
import statistics

import numpy as np
from PIL import Image

NAMES = ["anoa", "tarsius", "maleo", "yaki"]
CELL = 256
OUT_TS = os.path.join("components", "games", "adu-tarik-dino", "anchors.ts")


def widest_row(cell: np.ndarray) -> tuple[int, int, int]:
    a = cell > 40
    rows = []
    for y in range(CELL):
        xs = np.where(a[y])[0]
        if len(xs):
            rows.append((y, int(xs.min()), int(xs.max())))
    if not rows:
        return (CELL // 2, 0, CELL - 1)
    ymin = rows[0][0]
    ymax = rows[-1][0]
    lo = ymin + int((ymax - ymin) * 0.25)
    hi = ymax - int((ymax - ymin) * 0.12)
    wide = max(r[2] - r[1] for r in rows)
    cand = [r for r in rows if lo <= r[0] <= hi and (r[2] - r[1]) >= wide * 0.72]
    return max(cand, key=lambda r: r[2] - r[1]) if cand else max(rows, key=lambda r: r[2] - r[1])


def main() -> None:
    lines = [
        "/** Titik pegangan tali per karakter (fraksi sel 0..1).",
        " *  Dihasilkan otomatis oleh scripts/sprite-anchors.py - jangan diedit manual. */",
        "",
        'export interface Anchor { handX: number; handY: number; side: "L" | "R"; top: number }',
        "",
        "export const ANCHORS: Record<string, Anchor> = {",
    ]
    for name in NAMES:
        path = os.path.join("public", "sprites", "characters", f"{name}_sheet.png")
        im = Image.open(path).convert("RGBA")
        sides: list[str] = []
        ys: list[int] = []
        xs: list[int] = []
        tops: list[int] = []
        for f in range(4):
            cx, cy = (f % 2) * CELL, (f // 2) * CELL
            cell = np.array(im.crop((cx, cy, cx + CELL, cy + CELL)))[:, :, 3]
            y, x0, x1 = widest_row(cell)
            a = cell > 40
            col = np.where(a.any(1))[0]
            tops.append(int(col.min()) if len(col) else 0)
            centers = []
            for yy in range(CELL):
                xs_ = np.where(a[yy])[0]
                if len(xs_):
                    centers.append((int(xs_.min()) + int(xs_.max())) / 2)
            body_cx = statistics.median(centers) if centers else CELL / 2
            side = "R" if (x1 - body_cx) >= (body_cx - x0) else "L"
            sides.append(side)
            ys.append(y)
            xs.append(x1 if side == "R" else x0)

        major = max(set(sides), key=sides.count)
        keep = [i for i, s in enumerate(sides) if s == major]
        hand_y = statistics.median(ys[i] for i in keep)
        hand_x = statistics.median(xs[i] for i in keep)
        top = min(tops)
        print(name, "sides", sides, "-> handY", round(hand_y / CELL, 4), "handX", round(hand_x / CELL, 4), major)
        lines.append(
            f'  {name}: {{ handX: {round(hand_x / CELL, 4)}, handY: {round(hand_y / CELL, 4)}, side: "{major}", top: {round(top / CELL, 4)} }},'
        )
    lines.append("};")
    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    print("ditulis", OUT_TS)


if __name__ == "__main__":
    main()
