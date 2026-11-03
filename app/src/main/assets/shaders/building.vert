attribute vec3 aPos;
attribute vec2 aCenter;
attribute vec3 aNorm;
attribute vec2 aUV;
attribute vec4 aMisc;
uniform mat4 uVP;
uniform vec3 uEye;
uniform float uCamZ;
uniform float uL;
uniform float uCamX;   // game: camera position on the torus world
uniform float uWrapX;  // > 0: wrap x too (game world), 0: no x wrap (screensaver)
uniform float uZOff;   // where the z wrap seam sits (0.08 screensaver, 0.5 game)
varying vec3 vN;
varying vec2 vUV;
varying vec4 vMisc;
varying vec3 vWP;
void main(){
    float z = mod(aCenter.y - uCamZ + uL * uZOff, uL) - uL * uZOff;
    float x = uWrapX > 0.0 ? mod(aCenter.x - uCamX + uWrapX * 0.5, uWrapX) - uWrapX * 0.5 : aCenter.x;
    vec3 wp = vec3(x, 0.0, z) + aPos;
    vN = aNorm; vUV = aUV; vMisc = aMisc; vWP = wp;
    gl_Position = uVP * vec4(wp, 1.0);
}
