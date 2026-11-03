attribute vec3 aPos;
attribute vec3 aNorm;
attribute vec2 aUV;
attribute float aMat;
uniform mat4 uVP;
uniform mat4 uModel;
uniform vec3 uMatCol[20];
uniform vec4 uMatPar[20];   // roughness, metalness, emissive, pattern id
varying vec3 vN;
varying vec3 vWP;
varying vec2 vUV;
varying vec3 vCol;
varying vec4 vPar;
void main(){
    int m = int(aMat + 0.5);
    vCol = uMatCol[m];
    vPar = uMatPar[m];
    vec4 wp = uModel * vec4(aPos, 1.0);
    vWP = wp.xyz;
    vN = (uModel * vec4(aNorm, 0.0)).xyz;
    vUV = aUV;
    gl_Position = uVP * wp;
}
