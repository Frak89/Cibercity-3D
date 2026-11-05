/* KAGE fleet (drone / boat / galleon). Player & AI: uModel. Traffic (uTraffic = 1): every copy carries its lane like car.vert. */
attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec4 aCol;    // rgb + emissive
attribute vec4 aAnim;   // code = mode + 8 * slot, a, b, c
attribute vec4 aLane;   // traffic: origin x, y, z, speed
attribute vec4 aDir;    // traffic: dir x, dir z, phase (m), seed
uniform mat4 uVP;
uniform mat4 uModel;
uniform float uTime;
uniform float uRotA;     // rotor angle (rad)
uniform float uPropA;    // propeller angle (rad)
uniform float uSail;     // sail billow 0..1
uniform float uSailYaw;  // yard bracing (rad)
uniform float uSailSide; // which side the fore-aft sails fill (-1..1)
uniform float uFlut;     // flutter amount
uniform float uSteer;    // steering angle for steered parts (rad)
uniform float uTraffic;
uniform float uScale;
uniform float uBob;      // traffic: 0 drones (hover bob + nose down), 1 boats (waves)
uniform float uCamX;
uniform float uCamZ;
uniform float uWrapX;
uniform float uL;
uniform float uZOff;
uniform vec3 uNeonA;
uniform vec3 uNeonB;
uniform float uLocks;    // KAGE NEXUS: lock lights with index <= uLocks are lit
uniform vec3 uPaint;     // player: unused (colours baked); traffic: ignored too (per-instance palette)
varying vec3 vN;
varying vec3 vWP;
varying vec4 vCol;
varying vec2 vMode;      // mode, slot
varying float vFade;
varying vec3 vLoc;

vec2 rot2(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
vec3 paintOf(float s){
    float k = floor(fract(s * 13.37) * 7.0);
    if (k < 1.0) return vec3(0.03, 0.03, 0.035);
    if (k < 2.0) return vec3(0.9, 0.9, 0.92);
    if (k < 3.0) return vec3(0.75, 0.05, 0.08);
    if (k < 4.0) return vec3(0.8, 0.58, 0.16);
    if (k < 5.0) return vec3(0.04, 0.2, 0.5);
    if (k < 6.0) return vec3(0.5, 0.18, 0.8);
    return vec3(0.6, 0.62, 0.66);
}
void main(){
    float slot = floor(aAnim.x / 8.0 + 0.01), mode = aAnim.x - slot * 8.0;
    vec3 p = aPos, n = aNorm;
    float seed = aDir.w;
    float rA = uRotA, pA = uPropA, sail = uSail, yaw = uSailYaw;
    if (uTraffic > 0.5) { rA = uTime * 55.0 + seed * 20.0; pA = uTime * 40.0 + seed * 9.0; sail = 0.7; yaw = 0.0; }
    if (mode > 0.5 && mode < 2.5) {          // rotors about y
        float a = mode < 1.5 ? -rA : rA;
        vec2 q = rot2(p.xz - aAnim.yz, a) + aAnim.yz; p.xz = q; n.xz = rot2(n.xz, a);
    } else if (mode > 2.5 && mode < 3.5) {   // propeller about z (pivot x, y) · aAnim.w = 1: wheel about x (pivot y, z)
        if (aAnim.w > 0.5) { vec2 q = rot2(p.yz - aAnim.yz, pA) + aAnim.yz; p.yz = q; n.yz = rot2(n.yz, pA); }
        else { vec2 q = rot2(p.xy - aAnim.yz, pA) + aAnim.yz; p.xy = q; n.xy = rot2(n.xy, pA); }
        if (aAnim.w > 2.5) { vec2 pv = vec2(0.0, aAnim.z); p.xz = rot2(p.xz - pv, -uSteer) + pv; n.xz = rot2(n.xz, -uSteer); }
    } else if (mode < 0.5 && aAnim.w > 1.5 && aAnim.w < 2.5) {   // steered part: yaw about (x, z) = (a, b)
        p.xz = rot2(p.xz - aAnim.yz, -uSteer) + aAnim.yz; n.xz = rot2(n.xz, -uSteer);
    } else if (mode > 3.5 && mode < 4.5) {   // square sail: billow forward, then brace about the mast
        float u = clamp(aAnim.y, 0.0, 1.0), v = clamp(aAnim.z, 0.0, 1.0);
        p.z += sail * 1.6 * sin(3.14159 * u) * (0.25 + 0.75 * sin(3.14159 * v)) + sin(uTime * 2.3 + u * 4.0 + v * 3.0) * 0.06 * uFlut;
        vec2 q = rot2(p.xz - vec2(0.0, aAnim.w), -yaw) + vec2(0.0, aAnim.w); p.xz = q; n.xz = rot2(n.xz, -yaw);
    } else if (mode > 4.5 && mode < 5.5) {   // fore-aft sail / flag
        float u = clamp(aAnim.y, 0.0, 1.0);
        p.x += aAnim.w * (u * sin(uTime * 2.6 + u * 6.0 - aPos.y * 0.2) * 0.6 * (0.3 + uFlut) + uSailSide * sin(3.14159 * u) * 2.2 * sail);
    }
    vec3 c = aCol.rgb; float e = aCol.a;
    if (mode > 6.5) e *= step(0.9, fract(uTime * 1.1 + aAnim.y));
    if (mode < 0.5 && aAnim.y > 0.5 && aAnim.w < 1.5) e *= 0.05 + 0.95 * step(aAnim.y, uLocks + 0.5);
    vec4 wp;
    if (uTraffic > 0.5) {
        if (slot > 0.5 && slot < 1.5) c = paintOf(seed);
        if (slot > 2.5 && slot < 3.5) c = mix(uNeonA, uNeonB, step(0.5, fract(seed * 7.31)));
        vec3 d = vec3(aDir.x, 0.0, aDir.y);
        float t = mod(aDir.z + aLane.w * uTime, uL);
        vec3 h = aLane.xyz + d * t;
        h.x = uWrapX > 0.0 ? mod(h.x - uCamX + uWrapX * 0.5, uWrapX) - uWrapX * 0.5 : h.x;
        h.z = mod(h.z - uCamZ + uL * uZOff, uL) - uL * uZOff;
        float hy = atan(d.x, d.z);
        p *= uScale;
        // attitude: drones lean into the flight and bob, boats ride the swell
        float pit = uBob < 0.5 ? 0.12 : -0.03 + 0.025 * sin(uTime * 1.7 + seed * 30.0);
        float rol = uBob < 0.5 ? 0.04 * sin(uTime * 0.9 + seed * 40.0) : 0.03 * sin(uTime * 1.3 + seed * 17.0);
        p.yz = rot2(p.yz, pit); n.yz = rot2(n.yz, pit);
        p.xy = rot2(p.xy, rol); n.xy = rot2(n.xy, rol);
        p.xz = rot2(p.xz, -hy); n.xz = rot2(n.xz, -hy);
        h.y += uBob < 0.5 ? sin(uTime * 0.8 + seed * 50.0) * 0.5 : 0.08 * sin(uTime * 1.9 + seed * 11.0);
        wp = vec4(h + p, 1.0);
        vFade = 1.0;
    } else {
        wp = uModel * vec4(p, 1.0);
        n = (uModel * vec4(n, 0.0)).xyz;
        vFade = 1.0;
    }
    vLoc = aPos;
    vN = n; vWP = wp.xyz; vCol = vec4(c, e); vMode = vec2(mode, slot);
    gl_Position = uVP * wp;
}
