uniform vec3 uOrigin;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform float uWet;
varying vec3 vWP;
/* Endless grass around the circuit (mowed stripes near the track, wild grass farther). */
void main(){
    vec2 w = vWP.xz + uOrigin.xz;
    float d = length(vWP - uEye);
    float big = fbm(w * 0.006), fine = vnoise(w * 1.7);
    vec3 col = mix(vec3(0.14, 0.31, 0.07), vec3(0.30, 0.47, 0.12), big);
    col *= 0.88 + 0.25 * fine * (1.0 - smoothstep(20.0, 120.0, d));
    col *= 0.94 + 0.06 * step(0.5, fract(w.x / 12.0));
    col *= 0.55 + 0.6 * max(normalize(uSunDir).y, 0.0) * uSunCol;
    col *= 1.0 - 0.2 * uWet;
    col += headLight(vWP) * col * 2.0;
    col = applyFog(col, d, 0.0);
    gl_FragColor = vec4(col, 1.0);
}
