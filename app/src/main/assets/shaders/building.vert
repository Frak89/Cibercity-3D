attribute vec3 aPos;
attribute vec2 aCenter;
attribute vec3 aNorm;
attribute vec2 aUV;
attribute vec4 aMisc;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uCamZ;
uniform float uL;
varying vec3 vN;
varying vec2 vUV;
varying vec4 vMisc;
varying vec3 vWP;
void main(){
    float z = mod(aCenter.y - uCamZ + uL * 0.08, uL) - uL * 0.08;
    vec3 wp = vec3(aCenter.x, 0.0, z) + aPos;
    vN = aNorm; vUV = aUV; vMisc = aMisc; vWP = wp;
    gl_Position = uVP * vec4(wp, 1.0);
}
