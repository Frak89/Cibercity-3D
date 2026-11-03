uniform float uGloss;
varying vec3 vN;
varying vec3 vWP;
varying vec4 vCol;
/* Player car: dark metallic paint lit by the city: ambient fog, neon rim light, sliding light streaks. */
void main(){
    vec3 v = normalize(uEye - vWP);
    vec3 n = normalize(vN);
    if (dot(n, v) < 0.0) n = -n;            // two-sided: the loft faces are not all wound the same way
    float d = length(uEye - vWP);
    vec3 base = vCol.rgb;
    vec3 amb = uFog * 0.9 + vec3(0.05, 0.05, 0.07);
    float up = n.y * 0.5 + 0.5;
    vec3 lit = base * (amb + up * 0.25 + vec3(0.6, 0.65, 0.8) * uFlash);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    vec3 rim = mix(uNeonA, uNeonB, step(0.0, n.x)) * fres * 0.55;
    // reflections of city lights sliding over the body
    vec3 r = reflect(-v, n);
    float band = smoothstep(0.92, 1.0, sin(r.y * 22.0 + r.x * 7.0 + uTime * 0.3) * 0.5 + 0.5);
    vec3 refl = (mix(uFog * 1.4, uSkyTop, clamp(r.y, 0.0, 1.0)) + mix(uWinA, uNeonA, band) * band * 0.7) * uGloss;
    vec3 col = lit + rim * uGloss + refl * (0.25 + 0.6 * fres);
    col = mix(col, base * 2.4, vCol.a);
    col = applyFog(col, d, vWP.y);
    gl_FragColor = vec4(col, 1.0);
}
