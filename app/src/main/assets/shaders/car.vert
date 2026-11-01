attribute vec4 aLane;   // origin x, y, z, speed (m/s)
attribute vec4 aDir;    // dir x, dir z, trail length, seed
attribute vec2 aCorner; // x: 0 = tail, 1 = head ; y: side -1..1
uniform mat4 uV;
uniform mat4 uP;
uniform vec3 uEye;
uniform float uTime;
uniform float uCamZ;
uniform float uL;
uniform float uWidth;
varying vec2 vC;
varying float vAway;
varying float vDist;
varying float vSeed;
void main(){
    vec3 d = vec3(aDir.x, 0.0, aDir.y);
    float p = mod(aDir.w * 977.0 + aLane.w * uTime, 2.0 * uL);
    vec3 head = aLane.xyz + d * p;
    head.x = mod(head.x + 210.0, 420.0) - 210.0;
    head.z = mod(head.z - uCamZ + uL * 0.08, uL) - uL * 0.08;
    head.y += sin(uTime * 0.7 + aDir.w * 50.0) * 0.4;
    vec3 tail = head - d * aDir.z;
    vec3 h = (uV * vec4(head, 1.0)).xyz;
    vec3 t = (uV * vec4(tail, 1.0)).xyz;
    vec3 seg = h - t;
    vec3 P = mix(t, h, aCorner.x);
    vec3 perp = cross(seg, P);
    float pl = length(perp);
    perp = pl > 1e-4 ? perp / pl : vec3(1.0, 0.0, 0.0);
    float sl = length(seg);
    vec3 sdir = sl > 1e-4 ? seg / sl : vec3(0.0, 1.0, 0.0);
    float w = uWidth * (1.0 + 0.004 * length(P));
    P += perp * aCorner.y * w + sdir * (aCorner.x * 2.0 - 1.0) * w;
    vC = aCorner;
    vAway = step(0.0, dot(d, head - uEye));
    vDist = length(head - uEye);
    vSeed = aDir.w;
    gl_Position = uP * vec4(P, 1.0);
}
