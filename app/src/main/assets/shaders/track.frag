uniform vec3 uOrigin;
uniform float uWet;          // 0 dry .. 1 flooded
uniform float uHalfW;        // half width of the asphalt
uniform float uLapLen;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
varying vec3 vWP;
varying vec3 vTrk;
/* Race track surface: asphalt with rubbered racing line, white edge lines, red/white kerbs, gravel / grass
   run-off, start-finish checker, pit lane markings, wet sheen with sky reflections. */
void main(){
    float s = vTrk.x, lat = vTrk.y, kerb = vTrk.z, al = abs(lat);
    vec2 w = vWP.xz + uOrigin.xz;
    float d = length(vWP - uEye);
    float fine = vnoise(w * 3.1), mid = vnoise(w * 0.35);
    vec3 asph = vec3(0.13, 0.135, 0.145) * (0.8 + 0.35 * fine) * (0.9 + 0.2 * mid);
    asph *= 1.0 - 0.25 * smoothstep(3.5, 0.0, abs(lat - 0.0)) * (1.0 - smoothstep(0.0, 1.0, kerb * 0.0));   // rubbered line
    vec3 col = asph;
    // edge lines
    col = mix(col, vec3(0.85), smoothstep(0.16, 0.10, abs(al - (uHalfW - 0.35))) * step(al, uHalfW));
    // kerbs (red / white blocks) where the corner asks for them, otherwise painted run-off
    float onKerb = step(uHalfW, al) * step(al, uHalfW + 1.6);
    vec3 kc = mix(vec3(0.85, 0.08, 0.08), vec3(0.92), step(0.5, fract(s / 3.0)));
    col = mix(col, mix(vec3(0.13, 0.36, 0.12) * (0.8 + 0.3 * fine), kc, kerb), onKerb);
    // beyond: gravel trap (fast-corner outside) or grass
    float out1 = step(uHalfW + 1.6, al);
    vec3 grav = vec3(0.55, 0.50, 0.42) * (0.75 + 0.4 * fine);
    vec3 grass = mix(vec3(0.15, 0.33, 0.08), vec3(0.28, 0.46, 0.12), vnoise(w * 0.05)) * (0.85 + 0.25 * fine);
    col = mix(col, mix(grass, grav, kerb), out1);
    // pit lane (lat > 14): asphalt with yellow lines and box markings
    float pit = step(14.0, lat) * step(lat, 31.0);
    vec3 pitc = asph * 1.08;
    pitc = mix(pitc, vec3(0.9, 0.75, 0.1), smoothstep(0.12, 0.06, abs(lat - 15.0)) + smoothstep(0.12, 0.06, abs(lat - 30.0)));
    float box = step(abs(fract(s / 18.0) - 0.5), 0.36) * step(abs(lat - 25.5), 4.0) * (1.0 - step(abs(fract(s / 18.0) - 0.5), 0.33) * step(abs(lat - 25.5), 3.8));
    col = mix(col, pitc, pit * (1.0 - onKerb));
    // start / finish checker and grid slots
    float sf = step(abs(mod(s + 1.0, uLapLen) - 1.0), 1.0) * step(al, uHalfW);
    col = mix(col, vec3(0.9 * mod(floor(lat) + floor(s + 1.0), 2.0) + 0.03), sf);
    float gs = mod(uLapLen - s, uLapLen);
    float slot = step(gs, 64.0) * step(0.5, gs) * smoothstep(0.12, 0.05, abs(fract(gs / 8.0) - 0.06) * 8.0) * step(abs(abs(lat) - 3.2), 1.6);
    col = mix(col, vec3(0.85), slot * 0.8);
    // lighting
    vec3 L = normalize(uSunDir);
    col *= 0.55 + 0.6 * max(L.y, 0.0) * uSunCol;
    // wet: darker, glossy, reflecting the sky
    float wet = uWet * (1.0 - out1 * 0.6);
    vec3 v = normalize(uEye - vWP);
    float fres = pow(1.0 - max(v.y, 0.0), 4.0);
    col *= 1.0 - 0.35 * wet;
    col += (uSkyTop * 1.2 + uFog * 0.6) * fres * wet * 0.9;
    col += uSunCol * pow(max(dot(reflect(-v, vec3(0, 1, 0)), L), 0.0), 60.0) * wet * 0.6;
    col += headLight(vWP) * col * 3.0;
    col = applyFog(col, d, 0.0);
    gl_FragColor = vec4(col, 1.0);
}
