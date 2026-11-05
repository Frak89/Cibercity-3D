/* Floor of the harbour lagoon: dark sand ripples, scattered stones, moving caustics from the surface. */
varying vec3 vWP;
uniform float uCamX;
uniform float uCamZ;
void main(){
    vec2 w = vWP.xz + vec2(uCamX, uCamZ);
    float t = uTime;
    float n = fbm(w * 0.12), ripple = 0.5 + 0.5 * sin(w.x * 0.9 + sin(w.y * 0.3) * 2.0 + n * 4.0);
    vec3 sand = mix(vec3(0.05, 0.06, 0.05), vec3(0.16, 0.17, 0.13), n) * (0.85 + 0.15 * ripple);
    float c1 = abs(sin(w.x * 0.37 + t * 0.9 + sin(w.y * 0.29 + t * 0.6) * 1.7)), c2 = abs(sin(w.y * 0.33 - t * 0.75 + sin(w.x * 0.21 - t * 0.4) * 1.9));
    float caus = pow(1.0 - c1 * c2, 6.0);
    vec3 col = sand * (0.35 + caus * 1.2) * vec3(0.55, 0.95, 1.0) + uNeonA * caus * 0.04;
    col += mix(uNeonA, uNeonB, step(0.5, h21(floor(w * 0.5)))) * step(0.996, h21(floor(w * 2.0))) * 0.8;   // glowing pebbles
    float vDist = length(vWP - uEye);
    col = applyFog(col, vDist, vWP.y);
    gl_FragColor = vec4(col, 1.0);
}
