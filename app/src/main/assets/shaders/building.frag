varying vec3 vN;
varying vec2 vUV;
varying vec4 vMisc;
varying vec3 vWP;

void main(){
    float vDist = length(vWP - uEye); // per-pixel: interpolating it across big quads is wrong
    float seed = vMisc.x, id = sid(vMisc.x), kind = vMisc.y, fw = vMisc.z, top = vMisc.w;
    vec3 base = vec3(0.016, 0.018, 0.028) + uFog * 0.06;
    vec3 nA = mix(uNeonA, uNeonB, step(0.5, fract(seed * 7.31)));
    vec3 col;
    if (kind > 2.5) {
        // quay wall: dark concrete panels, wet stain at the waterline, neon edge at street level
        vec3 c = vec3(0.045, 0.048, 0.056) + uFog * 0.05;
        c *= 0.75 + 0.25 * step(0.08, fract(vUV.x / 6.0));
        c += uFog * 0.08 * smoothstep(-1.0, -1.6, vWP.y);
        c += nA * exp(-abs(vWP.y - top) * 7.0) * 1.1;
        c += nA * exp(-abs(vWP.y + 1.0) * 9.0) * 0.25 * (0.5 + 0.5 * sin(vUV.x * 0.8 + uTime));
        col = c;
    } else if (vN.y > 0.5) {
        vec2 g = abs(fract(vUV * 0.2) - 0.5);
        col = base * 0.7 + nA * 0.06 * step(0.46, max(g.x, g.y));
        float blink = step(0.82, fract(uTime * 0.6 + seed * 3.1));
        col += vec3(1.0, 0.12, 0.1) * blink * smoothstep(1.4, 0.0, length(vUV)) * 3.0;
        if (kind > 0.5) col += nA * 0.22;
    } else {
        float density = 0.22 + 0.5 * fract(seed * 3.71);
        vec2 cs = kind > 1.5 ? vec2(1.25, 1.5) : vec2(1.9, 2.7);
        vec2 q = vUV / cs;
        vec2 c = floor(q);
        vec2 f = fract(q);
        float m = step(0.16, f.x) * step(f.x, 0.84) * step(0.24, f.y) * step(f.y, 0.80);
        float r = h21(c * 0.731 + vec2(id * 1.37, floor(dot(vN, vec3(3.0, 0.0, 7.0)) + 0.5) * 11.0));
        float lit = step(1.0 - density, r);
        float flick = h21(c + vec2(floor(uTime * 0.08 + r * 20.0), id));
        lit *= step(0.035, flick);
        float pal = fract(r * 13.7 + seed);
        vec3 wc = pal < 0.62 ? uWinA : (pal < 0.86 ? uWinB : uWinC);
        wc *= 0.5 + 0.9 * fract(r * 91.1);
        // whole lit floors (offices)
        float floorLit = step(0.93, h21(vec2(c.y * 1.3, id)));
        vec3 detail = base + m * max(lit, floorLit) * wc;
        float lod = smoothstep(55.0, 210.0, vDist);
        vec3 far = base + wc * density * 0.30;
        col = mix(detail, far, lod);
        col *= 0.7 + 0.3 * smoothstep(0.0, top, vWP.y);
        if (kind > 0.5) {
            float e = min(vUV.x, fw - vUV.x);
            float pulse = 0.78 + 0.22 * sin(uTime * 2.0 + seed * 10.0);
            col += nA * (exp(-e * 2.2) * 0.9 + exp(-max(0.0, top - vWP.y) * 1.1) * 1.5) * pulse;
            float band = exp(-abs(fract(vWP.y / 23.0 + seed) - 0.5) * 70.0);
            col += nA * band * 0.7 * step(0.45, fract(seed * 5.1));
        }
        // street-level shop glow
        col += mix(uNeonA, uWinA, fract(seed * 9.0)) * exp(-vWP.y * 0.22) * 0.55;
    }
    col = applyFog(col, vDist, vWP.y);
    gl_FragColor = vec4(col, 1.0);
}
