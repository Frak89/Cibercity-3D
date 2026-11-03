attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec4 aCol;   // rgb, a = emissive amount
uniform mat4 uVP;
uniform mat4 uModel;
varying vec3 vN;
varying vec3 vWP;
varying vec4 vCol;
void main(){
    vec4 wp = uModel * vec4(aPos, 1.0);
    vWP = wp.xyz;
    vN = normalize((uModel * vec4(aNorm, 0.0)).xyz);
    vCol = aCol;
    gl_Position = uVP * wp;
}
