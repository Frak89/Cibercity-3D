varying vec2 vUV;
varying vec4 vMisc;
varying float vDist;
varying float vY;

/* 5x5 symmetric pseudo glyph (kanji / katakana feel) */
float glyph(vec2 cell, vec2 f){
    vec2 g = floor(f * 5.0);
    g.x = min(g.x, 4.0 - g.x);
    float on = step(0.52, h21(cell * 1.37 + g * 0.71));
    vec2 inner = fract(f * 5.0);
    return on * step(0.12, inner.x) * step(0.12, inner.y);
}

void main(){
    float seed = vMisc.x, id = sid(vMisc.x), kind = vMisc.y, ratio = vMisc.z;
    vec2 uv = vUV;
    float gt = floor(uTime * 9.0);
    float glitch = step(0.94, h21(vec2(gt, id)));
    uv.x += glitch * (h21(vec2(floor(uv.y * 14.0), gt)) - 0.5) * 0.25;
    vec3 cA = mix(uNeonA, uNeonB, fract(seed * 3.3));
    vec3 cB = mix(uNeonB, uWinA, fract(seed * 5.7));
    vec3 col;
    if (kind < 0.5) {
        // vertical scrolling glyph column
        vec2 grid = vec2(2.0, 2.0 * ratio);
        vec2 q = uv * grid + vec2(0.0, uTime * 0.8 + seed * 10.0);
        vec2 cell = floor(q);
        col = mix(cA, cB, uv.y) * glyph(cell + id, fract(q)) * 1.6;
    } else if (kind < 1.5) {
        // equalizer bars / ad pulses
        float bx = floor(uv.x * 12.0);
        float hgt = 0.25 + 0.7 * abs(sin(uTime * (1.5 + h21(vec2(bx, id)) * 3.0) + bx));
        float bar = step(uv.y, hgt) * step(0.15, fract(uv.x * 12.0));
        col = mix(cB, cA, uv.y / max(hgt, 0.01)) * bar * 1.3;
        col += cA * 0.15;
    } else {
        // pulsing ring logo with glyph caption
        vec2 p = (uv - vec2(0.5, 0.62)) * vec2(1.0, ratio);
        float r = length(p);
        float ring = smoothstep(0.03, 0.0, abs(r - 0.28 - 0.03 * sin(uTime * 3.0)));
        float core = smoothstep(0.13, 0.1, r) * (0.6 + 0.4 * sin(uTime * 5.0 + seed));
        vec2 q = vec2(uv.x * 6.0, uv.y * 6.0 * ratio);
        float cap = step(uv.y, 0.25) * glyph(floor(q) + id + floor(uTime * 0.5), fract(q));
        col = cA * (ring + core) * 1.5 + cB * cap * 1.4;
    }
    // frame + scanlines + panel background
    float fr = 1.0 - step(0.035, uv.x) * step(uv.x, 0.965) * step(0.02, uv.y) * step(uv.y, 0.98);
    col += cA * fr * 1.2;
    col += cA * 0.04;
    col *= 0.82 + 0.18 * sin(vUV.y * 300.0);
    col *= 1.0 - glitch * 0.5 * step(0.5, h21(vec2(gt, 7.0)));
    col = applyFog(col, vDist, vY);
    gl_FragColor = vec4(col, 1.0);
}
