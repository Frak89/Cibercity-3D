uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uSunStripes;
varying vec3 vDir;

void main(){
    vec3 d = normalize(vDir);
    float y = d.y;
    vec3 col = mix(uFog * 1.15, uSkyTop, smoothstep(-0.05, 0.55, y));
    // stars
    vec2 sp = d.xz / (abs(y) + 0.25) * 260.0;
    float st = step(0.9965, h21(floor(sp)));
    col += vec3(0.8, 0.85, 1.0) * st * smoothstep(0.12, 0.5, y) * (0.5 + 0.5 * sin(uTime * 3.0 + h21(floor(sp) + 3.0) * 40.0));
    // moon / sun
    float dd = distance(d, normalize(uSunDir));
    float disk = smoothstep(0.075, 0.070, dd);
    if (uSunStripes > 0.5) {
        float sy = (d.y - uSunDir.y) / 0.075;
        float stripe = step(0.0, sin(sy * 26.0 + uTime * 1.5)) + step(0.25, sy);
        disk *= clamp(stripe, 0.0, 1.0);
        col += mix(uSunCol, uNeonB, smoothstep(0.07, -0.07, d.y - uSunDir.y)) * disk * 1.4;
    } else {
        col += uSunCol * disk * 1.2;
    }
    col += uSunCol * 0.35 * exp(-dd * 7.0);
    // slow haze bands
    float band = h21(vec2(floor(y * 40.0 + uTime * 0.02), 1.0));
    col += uFog * 0.06 * band * smoothstep(0.35, 0.0, y);
    gl_FragColor = vec4(col, 1.0);
}
