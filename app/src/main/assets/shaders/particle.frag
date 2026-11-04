varying vec4 vCol;
varying float vKind;
varying float vSeed;
/* Exhaust particles drawn as point sprites: soft turbulent smoke puffs (alpha blended)
   and backfire flames (additive: white-blue core, orange tongue). */
void main(){
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    if (vKind < 0.5) {
        float n = vnoise(q * 2.6 + vSeed * 31.0) * 0.6 + vnoise(q * 5.3 - vSeed * 17.0) * 0.4;
        float a = (1.0 - smoothstep(0.25, 1.0, r)) * (0.45 + 0.75 * n) * vCol.a;
        gl_FragColor = vec4(vCol.rgb * (0.8 + 0.4 * n), a);
    } else {
        float n = vnoise(q * 3.0 + vec2(vSeed * 40.0, uTime * 9.0));
        float core = exp(-r * r * 9.0);
        float tongue = (1.0 - smoothstep(0.2, 1.0, r + (n - 0.5) * 0.5));
        vec3 c = vCol.rgb * tongue * 0.9 + vec3(0.6, 0.75, 1.0) * core * 0.7;
        gl_FragColor = vec4(c * vCol.a, 1.0);
    }
}
