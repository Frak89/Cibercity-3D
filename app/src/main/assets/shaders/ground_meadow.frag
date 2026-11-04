uniform float uCamX;
uniform float uCamZ;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
varying vec3 vWP;
/* The past: an endless green meadow with dirt patches, clover, little flowers and wind waves in the grass. */
void main(){
    vec2 w = vWP.xz + vec2(uCamX, uCamZ);
    float d = length(vWP - uEye);
    float big = fbm(w * 0.012), mid = vnoise(w * 0.15), fine = vnoise(w * 2.3);
    vec3 grass = mix(vec3(0.16, 0.34, 0.07), vec3(0.32, 0.50, 0.12), big);
    grass = mix(grass, vec3(0.42, 0.52, 0.16), smoothstep(0.55, 0.8, mid) * 0.5);
    grass *= 0.85 + 0.3 * fine * (1.0 - smoothstep(20.0, 120.0, d));
    // wind waves rolling over the grass
    grass *= 0.92 + 0.1 * sin(w.x * 0.08 + w.y * 0.05 - uTime * 1.6) * smoothstep(0.3, 0.7, big);
    // dirt patches and a worn trail
    float dirt = smoothstep(0.62, 0.72, fbm(w * 0.03 + 7.0));
    vec3 col = mix(grass, vec3(0.36, 0.28, 0.17) * (0.8 + 0.4 * fine), dirt * 0.8);
    // flowers (only near the camera)
    vec2 fc = floor(w * 1.7);
    float fl = step(0.985, h21(fc)) * (1.0 - smoothstep(0.08, 0.2, length(fract(w * 1.7) - 0.5))) * (1.0 - smoothstep(15.0, 45.0, d));
    vec3 fcol = mix(vec3(1.0, 0.95, 0.3), vec3(0.95, 0.5, 0.85), step(0.5, h21(fc + 3.1)));
    col = mix(col, fcol, fl * (1.0 - dirt));
    col *= 0.55 + 0.6 * max(normalize(uSunDir).y, 0.0) * uSunCol;
    col = applyFog(col, d, 0.0);
    gl_FragColor = vec4(col, 1.0);
}
