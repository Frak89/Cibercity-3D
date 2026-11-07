#!/usr/bin/env python3
"""Builds docs/index.html (GitHub Pages / desktop browser screensaver) from the
shared GLSL shaders in app/src/main/assets/shaders and web/cybercity.js."""
import json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
import re, subprocess, sys as _sys
subprocess.run([_sys.executable, str(root / 'tools/gen_i18n.py')], check=True)
I18N = (root / 'web/i18n.js').read_text()
def i18n(html): return re.sub(r'(<body[^>]*>)', lambda m: m.group(1) + '\n<script>' + I18N.replace('</', '<\\/') + '</script>', html, count=1)
shaders = {p.name: p.read_text() for p in sorted((root / 'app/src/main/assets/shaders').iterdir())}
tpl = (root / 'web/template.html').read_text()
engine = (root / 'web/vehicles.js').read_text() + '\n' + (root / 'web/fleet_audio.js').read_text() + '\n' + (root / 'web/realsky.js').read_text() + '\n' + (root / 'web/xeno.js').read_text() + '\n' + (root / 'web/starship.js').read_text() + '\n' + (root / 'web/pilot.js').read_text() + '\n' + (root / 'web/cybercity.js').read_text()
html = tpl.replace('/*SHADERS*/', 'const SHADERS=' + json.dumps(shaders) + ';').replace('/*ENGINE*/', engine)
out = root / 'docs/index.html'
out.parent.mkdir(exist_ok=True)
out.write_text(i18n(html))
print('wrote', out, len(html), 'bytes')

# NEON RUN mini game
gtpl = (root / 'web/game_template.html').read_text()
game = (root / 'web/game.js').read_text()
ghtml = gtpl.replace('/*SHADERS*/', 'const SHADERS=' + json.dumps(shaders) + ';').replace('/*ENGINE*/', engine).replace('/*CARHD*/', (root / 'web/car_hd.js').read_text()).replace('/*CARRENDER*/', (root / 'web/car_render.js').read_text()).replace('/*ENGINEFX*/', (root / 'web/engine_fx.js').read_text()).replace('/*GAME*/', game).replace('/*FLEET*/', (root / 'web/fleet_game.js').read_text()).replace('/*NEXUS*/', (root / 'web/nexus.js').read_text()).replace('/*ONFOOT*/', (root / 'web/onfoot.js').read_text()).replace('/*XENO*/', (root / 'web/xeno_game.js').read_text()).replace('/*STAR*/', (root / 'web/starship_game.js').read_text()).replace('/*GEAR*/', (root / 'web/gear.js').read_text()).replace('/*MONO*/', (root / 'web/monolith.js').read_text()).replace('/*TECH*/', (root / 'web/tech.js').read_text()).replace('/*AOS*/', (root / 'web/ampyos.js').read_text()).replace('/*AOBJ*/', (root / 'web/ampyobj.js').read_text()).replace('/*STORY*/', (root / 'web/story.js').read_text()).replace('/*EDIT*/', (root / 'web/editor.js').read_text()).replace('/*PHOTO*/', (root / 'web/photo.js').read_text()).replace('/*NET*/', (root / 'web/net.js').read_text()).replace('/*MUSIC*/', (root / 'web/music.js').read_text()).replace('/*POWER*/', (root / 'web/power.js').read_text()).replace('/*SAVE*/', (root / 'web/save.js').read_text()).replace('/*TROPHY*/', (root / 'web/trophies.js').read_text()).replace('/*PEOPLE*/', (root / 'web/people.js').read_text())
gout = root / 'docs/game.html'
gout.write_text(i18n(ghtml))
(root / 'app/src/main/assets/web').mkdir(parents=True, exist_ok=True)
(root / 'app/src/main/assets/web/game.html').write_text(i18n(ghtml))
print('wrote', gout, len(ghtml), 'bytes')

# AMPY KAGE GT showroom
stpl = (root / 'web/showroom_template.html').read_text()
shtml = (stpl.replace('/*SHADERS*/', 'const SHADERS=' + json.dumps(shaders) + ';').replace('/*ENGINE*/', engine)
         .replace('/*CARHD*/', (root / 'web/car_hd.js').read_text()).replace('/*CARRENDER*/', (root / 'web/car_render.js').read_text())
         .replace('/*ENGINEFX*/', (root / 'web/engine_fx.js').read_text()).replace('/*SHOWROOM*/', (root / 'web/showroom.js').read_text()).replace('/*SFLEET*/', (root / 'web/showroom_fleet.js').read_text()))
(root / 'docs/showroom.html').write_text(i18n(shtml))
(root / 'app/src/main/assets/web/showroom.html').write_text(i18n(shtml))
print('wrote docs/showroom.html', len(shtml), 'bytes')

# KAGE CIRCUIT (11 km race track)
ttpl = (root / 'web/track_template.html').read_text()
thtml = (ttpl.replace('/*SHADERS*/', 'const SHADERS=' + json.dumps(shaders) + ';').replace('/*ENGINE*/', engine)
         .replace('/*CARHD*/', (root / 'web/car_hd.js').read_text()).replace('/*CARRENDER*/', (root / 'web/car_render.js').read_text())
         .replace('/*ENGINEFX*/', (root / 'web/engine_fx.js').read_text()).replace('/*GAME*/', game).replace('/*TRACK*/', (root / 'web/track.js').read_text()))
(root / 'docs/track.html').write_text(i18n(thtml))
print('wrote docs/track.html', len(thtml), 'bytes')
(root / 'app/src/main/assets/web').mkdir(parents=True, exist_ok=True)
(root / 'app/src/main/assets/web/track.html').write_text(i18n(thtml))
print('copied track.html into the Android assets')
