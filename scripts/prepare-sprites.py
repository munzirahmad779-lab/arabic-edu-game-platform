"""
Menyiapkan sprite karakter untuk game adu-tarik-dino.

Masukan : %USERPROFILE%/Downloads/{anoa,maleo,tarsius,yaki}_sheet.png (2x2 grid)
Keluaran: public/sprites/characters/<nama>.png
          - 512x512, grid 2x2 sel 256x256
          - tiap frame di-trim ke bounding box isi lalu diberi alas bawah
          - latar belakang opaque dibuang (flood fill dari tepi)

Jalankan: python scripts/prepare-sprites.py
"""
from collections import deque
import os
import shutil

import numpy as np
from PIL import Image

NAMES = ["anoa", "maleo", "tarsius", "yaki"]
SRC = os.path.join(os.path.expanduser("~"), "Downloads")
OUT = os.path.join("public", "sprites", "characters")
BAK = os.path.join("docs", "sprites-original")
CELL = 256
PAD = 12


def strip_opaque_background(im: Image.Image) -> tuple[Image.Image, int]:
    """Hapus latar terang yang menyatu ke tepi; kembalikan (gambar, jumlah piksel)."""
    arr = np.array(im).astype(np.int16)
    rgb = arr[:, :, :3]
    lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = (mx - mn) / np.maximum(mx, 1)

    corners = [arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]]
    opaque_corners = sum(1 for c in corners if c[3] > 200)
    if opaque_corners == 0:
        return im, 0  # sudah transparan penuh

    light = (lum > 185) & (sat < 0.22) & (arr[:, :, 3] > 0)
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

    out = np.array(im)
    out[seen, 3] = 0
    return Image.fromarray(out, "RGBA"), int(seen.sum())


def prune_alpha(im: Image.Image, thr: int = 70) -> Image.Image:
    """Buang haze/tepi semi-transparan agar bbox tidak melebar."""
    arr = np.array(im)
    arr[arr[:, :, 3] < thr, 3] = 0
    return Image.fromarray(arr, "RGBA")


def trim_to_square(tile: Image.Image) -> Image.Image:
    """Potong ke isi, lalu tempel di sel persegi dengan alas bawah rata."""
    bbox = tile.split()[-1].point(lambda v: 255 if v >= 70 else 0).getbbox()
    if bbox is None:
        return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    content = tile.crop(bbox)
    cw, ch = content.size
    scale = min((CELL - 2 * PAD) / cw, (CELL - 2 * PAD) / ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    content = content.resize((nw, nh), Image.LANCZOS)
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.paste(content, ((CELL - nw) // 2, CELL - nh - PAD // 2), content)
    return cell


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(BAK, exist_ok=True)
    for name in NAMES:
        src = os.path.join(SRC, f"{name}_sheet.png")
        if not os.path.exists(src):
            print(f"LEWAT {name}: tidak ada {src}")
            continue
        im = Image.open(src).convert("RGBA")
        im, removed = strip_opaque_background(im)
        im = prune_alpha(im)
        w, h = im.size

        sheet = Image.new("RGBA", (CELL * 2, CELL * 2), (0, 0, 0, 0))
        sizes = []
        for idx in range(4):
            col, row = idx % 2, idx // 2
            tile = im.crop((col * w // 2, row * h // 2, (col + 1) * w // 2, (row + 1) * h // 2))
            cell = trim_to_square(tile)
            sheet.paste(cell, (col * CELL, row * CELL))
            sizes.append(cell.split()[-1].getbbox())

        dst = os.path.join(OUT, f"{name}_sheet.png")
        sheet.save(dst, "PNG", optimize=True)
        shutil.copy2(src, os.path.join(BAK, f"{name}_original.png"))
        print(f"{name}: {w}x{h} -> {sheet.size} bg_removed={removed}px frames={sizes}")


if __name__ == "__main__":
    main()
