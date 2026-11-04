uniform vec3 uSunDir;
uniform vec3 uSunCol;
varying vec3 vN;
varying vec3 vWP;
varying vec4 vCol;
/* Sunlit low-poly nature: lambert sun, sky / ground bounce, soft noise so flat faces are not flat colour. */
void main(){
    vec3 n = normalize(vN);
    vec3 v = normalize(uEye - vWP);
    if (dot(n, v) < 0.0) n = -n;
    vec3 L = normalize(uSunDir);
    float d = max(dot(n, L), 0.0);
    vec3 base = vCol.rgb * (0.88 + 0.24 * vnoise(vWP.xz * 3.0 + vWP.y * 2.0));
    vec3 amb = mix(vec3(0.16, 0.20, 0.12), uSkyTop * 0.9 + 0.08, n.y * 0.5 + 0.5);
    vec3 col = base * (amb + uSunCol * d * 0.95);
    col += base * 0.25 * pow(1.0 - max(dot(n, v), 0.0), 3.0) * vCol.a;     // translucent leaf rim
    col = applyFog(col, length(uEye - vWP), vWP.y);
    gl_FragColor = vec4(col, 1.0);
}
