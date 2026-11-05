/* ECO, the glitched parallel city: falling alien glyph code, tearing bands, dead pixels, a sick green vignette. Full-screen overlay. */
uniform vec2 uRes;
uniform float uEco;     // 0..1 presence of the effect
uniform float uBurst;   // transit flash / glitch burst 0..1
void main(){
    vec2 fc = gl_FragCoord.xy, uv = fc / uRes;
    float t = uTime;
    // glyph rain: columns of cells falling at their own speed
    vec2 cs = vec2(13.0, 17.0) * max(1.0, uRes.y / 900.0);
    vec2 cell = floor(fc / cs), sub = fract(fc / cs);
    float colH = h21(vec2(cell.x, 4.7)), spd = 0.12 + colH * 0.35, rows = uRes.y / cs.y;
    float head = fract(t * spd + colH * 7.0) * (rows + 24.0);
    float dy = head - (rows - cell.y);                 // cells below the head (screen top = high rows)
    float trail = dy > 0.0 ? exp(-dy / (5.0 + colH * 9.0)) : 0.0;
    // glyph bitmap 3 x 5 that changes now and then
    vec2 gp = floor(sub * vec2(3.0, 5.0));
    float gh = h21(cell + floor(t * (2.0 + colH * 6.0)) * 0.37);
    float bit = step(0.48, h21(gp + gh * 17.0 + cell * 0.13));
    float inside = step(0.12, sub.x) * step(sub.x, 0.88) * step(0.08, sub.y) * step(sub.y, 0.92);
    float on = bit * inside * trail * step(0.35, colH + 0.3 * sin(t * 0.2 + cell.x));
    vec3 col = mix(uNeonA * 0.9, vec3(0.85, 1.0, 0.9), step(dy, 1.0) * step(0.0, dy)) * on;
    float a = on * 0.55;
    // horizontal tearing bands
    float bandT = floor(t * 7.0), by = h21(vec2(bandT, 1.3)), bh = 0.004 + 0.03 * h21(vec2(bandT, 8.1));
    float band = step(abs(uv.y - by), bh) * step(0.55, h21(vec2(bandT, 3.3)));
    col += band * mix(uNeonB, uNeonA, step(0.5, fract(uv.x * 7.0 + t))) * 0.8; a = max(a, band * 0.45);
    // dead pixel blocks
    vec2 bl = floor(uv * vec2(24.0, 14.0)); float dead = step(0.985, h21(bl + floor(t * 5.0) * 1.7));
    col = mix(col, vec3(0.0), dead); a = max(a, dead * 0.9);
    // vignette + slow breathing green
    float v = length(uv - 0.5);
    col += uNeonA * smoothstep(0.35, 0.85, v) * (0.18 + 0.08 * sin(t * 0.7)); a = max(a, smoothstep(0.4, 0.9, v) * 0.6);
    // transit burst: noise snow and white
    float sn = h21(fc * 0.37 + floor(t * 30.0));
    col = mix(col, vec3(0.7, 1.0, 0.85) * sn + vec3(uBurst * 0.6), uBurst); a = max(a, uBurst);
    gl_FragColor = vec4(col, clamp(a * uEco + uBurst * (1.0 - uEco), 0.0, 1.0));
}
