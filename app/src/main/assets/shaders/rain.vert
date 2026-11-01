attribute vec3 aSeed;
attribute vec2 aCorner;
uniform mat4 uV;
uniform mat4 uP;
uniform vec3 uEye;
uniform float uTime;
uniform float uCamZ;
uniform float uRainSpeed;
varying vec2 vC;
varying float vDist;
void main(){
    vec3 pos;
    pos.x = uEye.x + (aSeed.x - 0.5) * 70.0;
    pos.y = uEye.y - 25.0 + mod(aSeed.y * 60.0 - uTime * uRainSpeed * (0.8 + aSeed.z * 0.4), 60.0);
    pos.z = mod(aSeed.z * 84.0 - uCamZ, 84.0) - 4.0;
    vec3 vel = vec3(-0.08, -1.0, 0.0);
    vec3 a = (uV * vec4(pos, 1.0)).xyz;
    vec3 b = (uV * vec4(pos + vel * 0.9, 1.0)).xyz;
    vec3 seg = b - a;
    vec3 P = mix(a, b, aCorner.x);
    vec3 perp = cross(seg, P);
    float pl = length(perp);
    perp = pl > 1e-4 ? perp / pl : vec3(1.0, 0.0, 0.0);
    P += perp * aCorner.y * 0.018;
    vC = aCorner;
    vDist = length(P);
    gl_Position = uP * vec4(P, 1.0);
}
