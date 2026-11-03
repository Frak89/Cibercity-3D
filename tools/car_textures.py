#!/usr/bin/env python3
"""PBR texture set + MTL for the HD OBJ (models/ampy_kage_gt_hd). Patterns match the in-game shader (car_hd.frag)."""
import json, pathlib
import numpy as np
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
out = root / 'models/ampy_kage_gt_hd'
tex = out / 'textures'
tex.mkdir(parents=True, exist_ok=True)
N = 1024
y, x = np.mgrid[0:N, 0:N] / N
rng = np.random.default_rng(2077)

def srgb(c):
    return np.clip(np.power(np.clip(c, 0, 1), 1 / 2.2), 0, 1)

def save(name, arr, gray=False):
    a = (np.clip(arr, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(a, 'L' if gray else 'RGB').save(tex / name, optimize=True)
    return 'textures/' + name

def normal_from_height(h, strength=2.0):
    gy, gx = np.gradient(h)
    n = np.dstack([-gx * strength * N / 64, -gy * strength * N / 64, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5

def noise(scale, octaves=4):
    acc = np.zeros((N, N)); amp = 1.0; tot = 0
    for o in range(octaves):
        s = int(scale * 2 ** o)
        g = rng.random((s + 1, s + 1))
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((N, N), Image.BICUBIC)
        acc += amp * np.asarray(img) / 255.0; tot += amp; amp *= 0.5
    return acc / tot

def solid(rgb):
    return np.ones((N, N, 3)) * np.array(rgb)

PAINT = [0.42, 0.02, 0.04]; NEON_A = [0.0, 1.0, 0.89]; NEON_B = [1.0, 0.23, 0.78]
maps = {}

# carbon fibre twill (8 cells per tile)
q = np.dstack([x * 8, y * 8])
a = (np.floor(q[..., 0]) + np.floor(q[..., 1])) % 2
w = np.abs(np.where(a > 0.5, q[..., 0] % 1, q[..., 1] % 1) - 0.5)
h = (0.4 + 0.6 * w) * (0.7 + 0.3 * a)
maps['carbon'] = dict(kd=srgb(solid([0.06, 0.06, 0.07]) * (0.55 + 0.9 * h)[..., None]), rough=0.3 - 0.15 * a, metal=0.2, nrm=normal_from_height(h, 1.2))
# leather with accent stitching
grain = noise(120, 3)
st = (np.abs((y * 6) % 1 - 0.5) < 0.02) & ((x * 90) % 1 > 0.5)
kd = solid([0.05, 0.045, 0.05]) * (0.9 + 0.25 * grain)[..., None]
kd[st] = np.array(NEON_B) * 0.9
maps['leather'] = dict(kd=srgb(kd), rough=0.55 + 0.1 * grain, metal=0.0, nrm=normal_from_height(grain * 0.6 - st * 0.4, 1.5))
# alcantara / suede
fz = noise(200, 2)
maps['alcantara'] = dict(kd=srgb(solid([0.035, 0.035, 0.04]) * (0.85 + 0.3 * fz)[..., None]), rough=0.95, metal=0.0, nrm=normal_from_height(fz * 0.3, 1))
# tyre: one tread period across u, profile across v (crown 0.3–0.7)
crown = np.clip((y - 0.30) / 0.08, 0, 1) * np.clip((0.70 - y) / 0.08, 0, 1)
groove = (((x + (y - 0.5) * 3) % 1) > 0.82) | (((y * 5) % 1) > 0.92)
h = 1 - crown * groove * 0.8
maps['tyre'] = dict(kd=srgb(solid([0.025, 0.025, 0.025]) * h[..., None]), rough=0.9, metal=0.0, nrm=normal_from_height(h, 3))
# drilled brake disc: 48 × 3 holes around
qx, qy = (x * 48) % 1 - 0.5, (y * 3) % 1 - 0.5
hole = np.sqrt(qx ** 2 + qy ** 2) < 0.2
h = 1 - hole * 0.9
maps['brake_disc'] = dict(kd=srgb(solid([0.35, 0.35, 0.37]) * h[..., None]), rough=0.35, metal=0.9, nrm=normal_from_height(h, 2))
# hex grille
gx_, gy_ = x * 10, y * 6
gx_ = gx_ + (np.floor(gy_) % 2) * 0.5
hexm = np.sqrt((gx_ % 1 - 0.5) ** 2 + (gy_ % 1 - 0.5) ** 2) > 0.36
maps['grille'] = dict(kd=srgb(solid([0.03, 0.03, 0.035]) * (0.15 + 0.85 * hexm)[..., None]), rough=0.5, metal=0.3, nrm=normal_from_height(hexm * 1.0, 2))
# carpet
cn = noise(300, 2)
maps['carpet'] = dict(kd=srgb(solid([0.03, 0.03, 0.035]) * (0.8 + 0.3 * cn)[..., None]), rough=1.0, metal=0.0, nrm=normal_from_height(cn * 0.4, 1))
# HUD screen (emissive)
bars = (((x * 18) % 1) > 0.5) & ((1 - y) < 0.25 + 0.6 * rng.random(18)[np.minimum(17, (x * 18).astype(int))])
ring = np.abs(np.sqrt(((x - 0.22) * 3) ** 2 + (y - 0.5) ** 2) - 0.32) < 0.02
em = np.array(NEON_A) * (0.25 + ring[..., None] * 1.2) + np.array(NEON_B) * bars[..., None] * 0.6
em *= (0.85 + 0.15 * np.sin(y * 300))[..., None]
maps['screen'] = dict(kd=srgb(em * 0.3), rough=0.3, metal=0.0, ke=srgb(em))
# metallic paint with fine flake
flake = noise(400, 1)
maps['paint'] = dict(kd=srgb(solid(PAINT) * (0.95 + 0.1 * flake)[..., None]), rough=0.18 + 0.05 * flake, metal=0.55, nrm=normal_from_height(flake * 0.05, 1))
# simple materials
simple = {
    'trim_black': ([0.02, 0.02, 0.025], 0.6, 0.0, None), 'chrome': ([0.30, 0.31, 0.35], 0.12, 1.0, None), 'glass': ([0.02, 0.03, 0.05], 0.05, 0.0, None),
    'headlight': ([0.85, 0.95, 1.0], 0.2, 0.0, [0.85, 0.95, 1.0]), 'taillight': ([1.0, 0.06, 0.12], 0.2, 0.0, [1.0, 0.06, 0.12]),
    'neon': (NEON_A, 0.3, 0.0, NEON_A), 'caliper': (NEON_B, 0.35, 0.2, None), 'dashboard': ([0.025, 0.027, 0.035], 0.7, 0.0, None),
    'aluminium': ([0.6, 0.6, 0.62], 0.35, 1.0, None), 'engine_neon': (NEON_B, 0.3, 0.0, NEON_B), 'interior_neon': (NEON_A, 0.3, 0.0, [c * 0.8 for c in NEON_A]),
}
names = json.load(open(out / 'materials.json'))
mtl = ['# AMPY KAGE GT HD — PBR materials (Blender / Unity / Unreal: import the OBJ, materials and textures load automatically)\n']
for name in names:
    mtl.append(f'\nnewmtl {name}')
    if name in maps:
        mp = maps[name]
        mtl.append(f'Kd 1 1 1\nmap_Kd {save(name + "_basecolor.png", mp["kd"])}')
        r = mp['rough'] if isinstance(mp['rough'], np.ndarray) else np.full((N, N), mp['rough'])
        mt = mp['metal'] if isinstance(mp['metal'], np.ndarray) else np.full((N, N), mp['metal'])
        mtl.append(f'Pr {float(np.mean(r)):.3f}\nmap_Pr {save(name + "_roughness.png", r, True)}')
        mtl.append(f'Pm {float(np.mean(mt)):.3f}\nmap_Pm {save(name + "_metallic.png", mt, True)}')
        if 'nrm' in mp:
            f = save(name + '_normal.png', mp['nrm'])
            mtl.append(f'norm {f}\nmap_Bump -bm 1.0 {f}')
        if 'ke' in mp:
            mtl.append(f'Ke 1 1 1\nmap_Ke {save(name + "_emissive.png", mp["ke"])}')
        mtl.append('Ns 200\nillum 2')
    else:
        c, rgh, mtv, ke = simple[name]
        mtl.append(f'Kd {c[0]:.4f} {c[1]:.4f} {c[2]:.4f}\nPr {rgh:.3f}\nPm {mtv:.3f}\nNs {int((1 - rgh) * 400)}')
        if ke: mtl.append(f'Ke {ke[0] * 2.4:.3f} {ke[1] * 2.4:.3f} {ke[2] * 2.4:.3f}')
        if name == 'glass': mtl.append('d 0.25\nTr 0.75\nNi 1.5')
        mtl.append('illum 2')
(out / 'ampy_kage_gt_hd.mtl').write_text('\n'.join(mtl) + '\n')
print('textures:', len(list(tex.iterdir())))
