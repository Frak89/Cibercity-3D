attribute vec2 aPos;    // offsets from the water centre
uniform mat4 uVP;
uniform vec3 uWaterC;   // centre x, surface y, centre z (world; uWaterRel = 1 → already camera relative)
uniform float uWaterRel;
uniform float uCamX;
uniform float uCamZ;
uniform float uWrapX;
uniform float uL;
uniform float uZOff;
varying vec3 vWP;
void main(){
    float cx = uWaterC.x, cz = uWaterC.z;
    if (uWaterRel < 0.5) {
        cx = uWrapX > 0.0 ? mod(cx - uCamX + uWrapX * 0.5, uWrapX) - uWrapX * 0.5 : cx;
        cz = mod(cz - uCamZ + uL * uZOff, uL) - uL * uZOff;
    }
    vWP = vec3(cx + aPos.x, uWaterC.y, cz + aPos.y);
    gl_Position = uVP * vec4(vWP, 1.0);
}
