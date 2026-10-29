from PIL import Image
import numpy as np, os

d = os.path.join(os.path.expanduser('~'), 'Downloads')
refs = ['Anoa.jpg', 'Tarsius.jpg', 'Maleo.jpg', 'kuskus.jpg']
sheets = [
    'Buatkan_sprite_sheet_4_frame_20261022053942.jpg',
    'Buatkan_sprite_sheet_4_frame_20261022053943.jpg',
    'Buatkan_sprite_sheet_4_frame_20261022053945.jpg',
    'Buatkan_sprite_sheet_4_frame_20261022053947.jpg',
]


def sig(path):
    im = Image.open(path).convert('RGB')
    small = im.resize((160, 90))
    a = np.array(small).astype(float)
    lum = a.mean(axis=2)
    m = lum < 232
    if m.sum() < 50:
        return None
    hsv = np.array(im.convert('HSV').resize((160, 90))).astype(float)[m]
    h = hsv[:, 0]
    s = hsv[:, 1] / 255.0
    v = hsv[:, 2] / 255.0
    sat = s > 0.18
    hue_hist = np.histogram(h[sat], bins=12, range=(0, 256))[0].astype(float)
    if hue_hist.sum() > 0:
        hue_hist /= hue_hist.sum()
    px = a[m]
    return {
        'hue': hue_hist,
        'mean': px.mean(axis=0),
        'std': px.std(axis=0),
        'dark': float((v < 0.45).mean()),
        'sat': float(sat.mean()),
        'cover': float(m.mean()),
    }


R = {n: sig(os.path.join(d, n)) for n in refs}
S = {n: sig(os.path.join(d, n)) for n in sheets}

print('REFERENSI')
for n in refs:
    x = R[n]
    print('  {:12s} mean={} std={} dark={:.2f} sat={:.2f}'.format(
        n, x['mean'].round(0), x['std'].round(0), x['dark'], x['sat']))
    print('               hue=', x['hue'].round(2))

print('\nSPRITE SHEET')
for n in sheets:
    x = S[n]
    print('  {:22s} mean={} std={} dark={:.2f} sat={:.2f}'.format(
        n[34:], x['mean'].round(0), x['std'].round(0), x['dark'], x['sat']))
    print('               hue=', x['hue'].round(2))

print('\nJARAK (semakin kecil semakin mirip)')
for rn in refs:
    a = R[rn]
    row = []
    for sn in sheets:
        b = S[sn]
        dist = (np.abs(a['hue'] - b['hue']).sum() * 2
                + np.abs(a['mean'] - b['mean']).mean() / 12
                + abs(a['dark'] - b['dark']) * 3
                + abs(a['sat'] - b['sat']) * 3)
        row.append((round(float(dist), 2), sn[34:50]))
    row.sort()
    print('  {:12s} -> {}'.format(rn, row))
