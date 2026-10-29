"""
Menyiapkan 4 sprite sheet karakter Banua Fruit Blast.

Masukan : %USERPROFILE%/Downloads/Buatkan_sprite_sheet_4_frame_2026102205394X.jpg
          (4 berkas, tiap berkas berisi grid 2x2 frame)
Keluaran: public/sprites/banua/<nama>_sheet.png
          - 512x512, grid 2x2 sel 256x256, latar transparan
          - tiap frame di-trim ke bounding box isi, lalu diratahkan alasnya
Salinan asli disimpan di docs/sprites-original-banua/ untuk bukti.

Pemetaan nama ditentukan dari analisis tanda tangan warna (mean RGB, rasio
gelap, saturasi, histogram hue) yang membandingkan tiap sheet dengan foto
referensi Anoa/Tarsius/Maleo/Kuskus di Downloads.

Jalankan: python scripts/prepare-banua-sprites.py
"""
from collections import deque
import os
import shutil

import numpy as np
from PIL import Image

SRC_DIR = os.path.join(os.path.expanduser("~"), "Downloads")
OUT_DIR = os.path.join("public", "sprites", "banua")
BAK_DIR = os.path.join("docs", "sprites-original-banua")
CELL = 256
PAD = 10
ALPHA_THR = 70

# sheet -> (nama karakter, nama berkas sumber)
SHEETS = {
    "anoa": "Buatkan_sprite_sheet_4_frame_20261022053942.jpg",
    "tarsius": "Buatkan_sprite_sheet_4_frame_20261022053943.jpg",
    "maleo": "Buatkan_sprite_sheet_4_frame_20261022053945.jpg",
    "kuskus": "Buatkan_sprite_sheet_4_frame_20261022053947.jpg",
}


def strip_light_background(im: Image.Image) -> tuple[Image.Image, int]:
    """Buang latar terang yang menyambung ke tepi gambar (flood fill 4 arah)."""
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.int16)
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)

    light = (lum > 186) & (sat < 0.24)
    h, w = light.shape
    seen = np.zeros_like(light)
    q: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if light[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if light[y, x] and not seen[y, x]:
                seen[y, x] = True
                q.append((y, x))

    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))

    out = arr.copy()
    out[:, :, 3] = np.where(seen, 0, 255)
    return Image.fromarray(out, "RGBA"), int(seen.sum())


def prune_alpha(im: Image.Image, thr: int = ALPHA_THR) -> Image.Image:
    arr = np.array(im)
    arr[arr[:, :, 3] < thr, 3] = 0
    return Image.fromarray(arr, "RGBA")


def trim_to_cell(tile: Image.Image) -> Image.Image:
    """Potong ke isi, skala ke sel, tempel rata bawah-tengah."""
    alpha = tile.split()[-1].point(lambda v: 255 if v >= ALPHA_THR else 0)
    bbox = alpha.getbbox()
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    if bbox is None:
        return cell
    content = tile.crop(bbox)
    cw, ch = content.size
    scale = min((CELL - 2 * PAD) / cw, (CELL - 2 * PAD) / ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    content = content.resize((nw, nh), Image.LANCZOS)
    cell.paste(content, ((CELL - nw) // 2, (CELL - nh) // 2), content)
    return cell


def process(name: str, filename: str) -> None:
    src = os.path.join(SRC_DIR, filename)
    if not os.path.exists(src):
        print(f"LEWAT {name}: tidak ada {src}")
        return

    im = Image.open(src).convert("RGBA")
    im, removed = strip_light_background(im)
    im = prune_alpha(im)
    w, h = im.size

    sheet = Image.new("RGBA", (CELL * 2, CELL * 2), (0, 0, 0, 0))
    boxes = []
    for idx in range(4):
        col, row = idx % 2, idx // 2
        tile = im.crop(
            (col * w // 2, row * h // 2, (col + 1) * w // 2, (row + 1) * h // 2)
        )
        cell = trim_to_cell(tile)
        sheet.paste(cell, (col * CELL, row * CELL))
        boxes.append(cell.split()[-1].getbbox())

    dst = os.path.join(OUT_DIR, f"{name}_sheet.png")
    sheet.save(dst, "PNG", optimize=True)
    shutil.copy2(src, os.path.join(BAK_DIR, f"{name}_original{os.path.splitext(filename)[1]}"))

    empty = sum(1 for b in boxes if b is None)
    print(
        f"{name:9s} {filename[-10:]} -> {sheet.size} bg_removed={removed}px "
        f"frames={len(boxes) - empty}/4 terisi"
    )
    if empty:
        print(f"  PERINGATAN {name}: {empty} frame kosong")


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(BAK_DIR, exist_ok=True)
    for name, filename in SHEETS.items():
        process(name, filename)


if __name__ == "__main__":
    main()
