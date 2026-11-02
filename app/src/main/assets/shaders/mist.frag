uniform float uMist;
uniform vec2 uRes;
varying vec2 vUV;
/* Drifting ground mist / fog banks over the whole frame (alpha-blended). */
void main(){
    vec2 p = vUV * vec2(uRes.x / uRes.y, 1.0);
    float n1 = fbm(p * 2.2 + vec2(uTime * 0.035, uTime * 0.008));
    float n2 = fbm(p * 4.5 - vec2(uTime * 0.06, -uTime * 0.01) + n1);
    float band = smoothstep(0.85, 0.15, vUV.y);           // denser low, near the street
    float m = (n1 * 0.65 + n2 * 0.45) * (0.45 + 0.75 * band);
    m = smoothstep(0.18, 0.8, m) * uMist;
    vec3 col = uFog * 1.7 + vec3(0.05) + uNeonA * 0.03 + vec3(0.6, 0.65, 0.8) * uFlash;
    gl_FragColor = vec4(col, m * 0.92);
}
