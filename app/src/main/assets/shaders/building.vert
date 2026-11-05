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
uniform float uGlitch;   // ECO world: floors shear and slip
uniform float uTime;
void main(){
    float z = mod(aCenter.y - uCamZ + uL * uZOff, uL) - uL * uZOff;
    float x = uWrapX > 0.0 ? mod(aCenter.x - uCamX + uWrapX * 0.5, uWrapX) - uWrapX * 0.5 : aCenter.x;
    vec3 wp = vec3(x, 0.0, z) + aPos;
    if (uGlitch > 0.0) {
        float band = floor(aPos.y / 9.0), tt = floor(uTime * 2.5 + aMisc.x * 13.0);
        float hs = fract(sin(dot(vec3(aCenter, band), vec3(12.9898, 78.233, 37.719)) + tt * 1.618) * 43758.5453);
        if (hs > 0.9) { wp.x += (hs - 0.95) * 40.0 * uGlitch; wp.z += (fract(hs * 7.13) - 0.5) * 8.0 * uGlitch; }
        wp.y *= 1.0 + uGlitch * 0.05 * sin(uTime * 0.6 + aCenter.x * 0.07 + aCenter.y * 0.05);
    }
    vN = aNorm; vUV = aUV; vMisc = aMisc; vWP = wp;
    gl_Position = uVP * vec4(wp, 1.0);
}
