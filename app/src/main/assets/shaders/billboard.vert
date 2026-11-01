attribute vec3 aPos;
attribute vec2 aCenter;
attribute vec2 aUV;
attribute vec4 aMisc;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uCamZ;
uniform float uL;
varying vec2 vUV;
varying vec4 vMisc;
varying float vDist;
varying float vY;
void main(){
    float z = mod(aCenter.y - uCamZ + uL * 0.08, uL) - uL * 0.08;
    vec3 wp = vec3(aCenter.x, 0.0, z) + aPos;
    vUV = aUV; vMisc = aMisc; vY = wp.y;
    vDist = length(wp - uEye);
    gl_Position = uVP * vec4(wp, 1.0);
}
