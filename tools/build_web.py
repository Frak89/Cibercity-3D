#!/usr/bin/env python3
"""Builds docs/index.html (GitHub Pages / desktop browser screensaver) from the
shared GLSL shaders in app/src/main/assets/shaders and web/cybercity.js."""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
shaders = {p.name: p.read_text() for p in sorted((root / 'app/src/main/assets/shaders').iterdir())}
tpl = (root / 'web/template.html').read_text()
engine = (root / 'web/cybercity.js').read_text()
html = tpl.replace('/*SHADERS*/', 'const SHADERS=' + json.dumps(shaders) + ';').replace('/*ENGINE*/', engine)
out = root / 'docs/index.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html)
print('wrote', out, len(html), 'bytes')

# NEON RUN mini game
gtpl = (root / 'web/game_template.html').read_text()
game = (root / 'web/game.js').read_text()
ghtml = gtpl.replace('/*SHADERS*/', 'const SHADERS=' + json.dumps(shaders) + ';').replace('/*ENGINE*/', engine).replace('/*CARHD*/', (root / 'web/car_hd.js').read_text()).replace('/*CARRENDER*/', (root / 'web/car_render.js').read_text()).replace('/*GAME*/', game)
gout = root / 'docs/game.html'
gout.write_text(ghtml)
print('wrote', gout, len(ghtml), 'bytes')

# AMPY KAGE GT showroom
stpl = (root / 'web/showroom_template.html').read_text()
shtml = (stpl.replace('/*SHADERS*/', 'const SHADERS=' + json.dumps(shaders) + ';').replace('/*ENGINE*/', engine)
         .replace('/*CARHD*/', (root / 'web/car_hd.js').read_text()).replace('/*CARRENDER*/', (root / 'web/car_render.js').read_text())
         .replace('/*SHOWROOM*/', (root / 'web/showroom.js').read_text()))
(root / 'docs/showroom.html').write_text(shtml)
print('wrote docs/showroom.html', len(shtml), 'bytes')
