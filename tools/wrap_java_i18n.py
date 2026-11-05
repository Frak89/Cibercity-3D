#!/usr/bin/env python3
"""Wraps user-visible Italian string literals of the Android sources in L.t(...). Idempotent."""
import re, sys, pathlib, json
root = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / 'tools'))
from i18n_dict import PAIRS
seen = {}
for a, b in PAIRS: seen.setdefault(a, b)
keys = sorted(seen, key=lambda k: -len(k))
pat = re.compile('|'.join(((r'(?<![^\W\d_])' if k[0].isalpha() else '') + re.escape(k) + (r'(?![^\W\d_])' if k[-1].isalpha() else '')) for k in keys))
def tr(s): return pat.sub(lambda m: seen[m.group(0)], s)
def unesc(s): return json.loads('"' + s + '"') if '\\u' in s or '\\"' in s or '\\n' in s else s
lit = re.compile(r'"((?:[^"\\\n]|\\.)*)"')
SKIP_BEFORE = re.compile(r'(case\s*|equals\(\s*|get(String|Int|Boolean|Long|Float)\(\s*|put(String|Int|Boolean|Long|Float)\(\s*|L\.t\(\s*|Log\.\w\(\s*[^,]*,\s*|startsWith\(\s*|contains\(\s*|optString\(\s*|getJSON\w*\(\s*|has\(\s*|asset\(\s*[^,]*,\s*|prog\([^)]*)$')
n = 0
for f in (root / 'app/src/main/java/it/ampy/cybercity').rglob('*.java'):
    if f.name == 'L.java': continue
    src = f.read_text(); out = []; last = 0; changed = False
    for m in lit.finditer(src):
        s = m.group(1)
        try: val = unesc(s)
        except Exception: val = s
        if tr(val) == val: continue
        before = src[max(0, m.start() - 60):m.start()]
        line_start = src.rfind('\n', 0, m.start()) + 1
        if src[line_start:m.start()].lstrip().startswith(('//', '*', '/*')): continue
        if SKIP_BEFORE.search(before): continue
        if before.rstrip().endswith('L.t('): continue
        out.append(src[last:m.start()]); out.append('L.t(' + m.group(0) + ')'); last = m.end(); changed = True; n += 1
    if changed:
        out.append(src[last:]); new = ''.join(out)
        pkg = re.search(r'^package ([\w.]+);', new, re.M).group(1)
        if pkg != 'it.ampy.cybercity' and 'import it.ampy.cybercity.L;' not in new:
            new = re.sub(r'(^package [\w.]+;\n)', r'\1\nimport it.ampy.cybercity.L;\n', new, count=1, flags=re.M)
        f.write_text(new)
print('wrapped', n, 'literals')
