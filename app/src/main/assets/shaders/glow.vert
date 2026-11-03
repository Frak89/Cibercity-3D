attribute vec3 aPos;
attribute vec2 aUV;
attribute vec4 aCol;
uniform mat4 uVP;
uniform mat4 uModel;
varying vec2 vUV;
varying vec4 vCol;
varying vec3 vWP;
void main(){
    vec4 wp = uModel * vec4(aPos, 1.0);
    vWP = wp.xyz; vUV = aUV; vCol = aCol;
    gl_Position = uVP * wp;
}
