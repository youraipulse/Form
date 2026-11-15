// Refracted analytic backlights, rough transmission and Fresnel reflections.
export const frostedGlassShader = `#version 300 es
precision highp float;
uniform mediump vec2 u_resolution;
uniform mediump float u_scale,u_imageAspectRatio;
out vec4 fragColor;
uniform sampler2D u_image;
uniform float u_time,u_frost,u_backlight,u_thickness,u_angle,u_haze,u_lightSize;
uniform vec4 u_colorBack,u_glass,u_light,u_rim;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float softRing(vec2 p,float radius,float width){return exp(-pow((length(p)-radius)/width,2.));}
vec3 behind(vec2 p,float rough){
 float t=u_time*.23;
 vec2 a=vec2(.14*sin(t*.72),.24*cos(t*.65));
 vec2 b=vec2(-.2*cos(t*.61),-.25*sin(t*.76));
 float size=u_lightSize;
 float width=(.012+rough*.075)*size;
 float ring=softRing(p-a,(.105+.015*sin(t*.5))*size,width);
 float rear=softRing((p-b)*vec2(.9,1.1),.17*size,width*1.5);
 float disk=exp(-dot(p-b,p-b)/((.005+rough*.022)*size*size));
 float scatter=exp(-dot(p-a,p-a)/((.025+rough*.05)*size*size));
 return u_light.rgb*(ring*.56+rear*.23+disk*.34+scatter*.1)*u_backlight;
}
void main(){
 // Fragment coordinates avoid half-precision UV stepping at 2K/4K.
 float boxWidth=min(u_resolution.x/u_imageAspectRatio,u_resolution.y)*u_imageAspectRatio;
 vec2 boxSize=vec2(boxWidth,boxWidth/u_imageAspectRatio);
 vec2 uv=(gl_FragCoord.xy-.5*u_resolution)/boxSize/u_scale+.5;
 uv.y=1.-uv.y;
 vec2 footprint=fwidth(uv)*.38;
 vec4 field=texture(u_image,uv);
 float mask=(field.g*4.+texture(u_image,uv+footprint).g+texture(u_image,uv-footprint).g+texture(u_image,uv+vec2(footprint.x,-footprint.y)).g+texture(u_image,uv+vec2(-footprint.x,footprint.y)).g)/8.;
 vec2 texel=1./vec2(textureSize(u_image,0));
 // The Poisson field supplies a continuous curved face and rounded glass lip.
 vec2 delta=max(texel*16.,vec2(.006));
 vec2 slope=vec2(textureLod(u_image,uv+vec2(delta.x,0.),4.).r-textureLod(u_image,uv-vec2(delta.x,0.),4.).r,textureLod(u_image,uv+vec2(0.,delta.y),4.).r-textureLod(u_image,uv-vec2(0.,delta.y),4.).r)/max(delta.x+delta.y,.0001);
 vec2 bend=slope*(.085+.1*u_thickness);
 bend=bend/(1.+length(bend)*.7);
 vec3 normal=normalize(vec3(-bend,1.));
 vec3 ray=refract(vec3(0.,0.,-1.),normal,1./1.46);
 vec2 offset=ray.xy*(.16+.23*u_thickness)/max(.25,abs(ray.z));
 float angle=radians(u_angle);mat2 rot=mat2(cos(angle),-sin(angle),sin(angle),cos(angle));
 vec2 p=rot*(uv-.5);
 vec3 transmission=behind(p+rot*offset,u_frost);
 // Subtle second internal reflection gives the backlight real depth.
 transmission+=behind(p-rot*offset*.58+vec2(.012,-.02),min(1.,u_frost+.22))*.18;
 float cosView=clamp(normal.z,0.,1.);
 float fresnel=.035+.965*pow(1.-cosView,5.);
 float rim=pow(clamp(field.r,0.,1.),7.);
 float key=pow(max(0.,dot(normal,normalize(vec3(-.7+.3*sin(u_time*.13),.8,1.1)))),24.);
 float strip=exp(-pow((normal.x*.8+normal.y*.5-.32)/(.05+.12*u_frost),2.));
 float reflection=key*.18+strip*.045;
 // A rounded bevel bends the backlight into localized bright/dark ribbons.
 float edgeHeight=clamp(textureLod(u_image,uv,2.).r,0.,1.);
 float bevelBand=smoothstep(.24,.62,edgeHeight)*(1.-smoothstep(.9,.995,edgeHeight));
 vec2 movingKey=normalize(vec2(cos(u_time*.19+.8),sin(u_time*.19+.8)));
 float bevelFacing=pow(max(0.,dot(normalize(slope+vec2(.00001)),movingKey)),5.);
 float bevelWidth=.105+.055*u_frost;
 float crest=exp(-pow((edgeHeight-(.73+.035*sin(u_time*.17)))/bevelWidth,2.));
 float groove=exp(-pow((edgeHeight-.51)/(.05+.04*u_frost),2.));
 vec3 bevelTransmission=behind(p+rot*offset*1.8,u_frost*.65);
 float bevelStrength=.25+.75*u_thickness;
 transmission*=1.-groove*bevelFacing*.32*bevelStrength;
 transmission+=bevelTransmission*bevelBand*bevelFacing*.45*bevelStrength;
 reflection+=crest*bevelFacing*(.035+.095*u_thickness)*(1.-smoothstep(.9,.995,edgeHeight));
 // Thickness-dependent selective absorption plus frosted surface scattering.
 float glassValue=max(u_glass.r,max(u_glass.g,u_glass.b));
 vec3 glassHue=u_glass.rgb/max(glassValue,.08);
 float opticalPath=.35+u_thickness*1.45+rim*.65;
 vec3 absorption=exp(-(vec3(1.)-glassHue)*opticalPath*1.5);
 absorption*=mix(.35,1.,smoothstep(0.,.18,glassValue));
 float incident=dot(transmission,vec3(.2126,.7152,.0722));
 vec3 transmitted=transmission*mix(vec3(1.),absorption,.28+.16*u_thickness)*(1.-fresnel);
 // Frost scatters a little incident light into the glass color: opposing hues remain readable.
 float scattering=.5+.3*u_frost;
 float scatterZone=1.-smoothstep(.07,.38,incident);
 transmitted=mix(transmitted,glassHue*incident*.95,scatterZone*scattering);
 vec3 bodyColor=u_glass.rgb*(.016+.04*u_frost+.028*u_thickness)*(1.+incident*.6);
 vec3 edgeColor=mix(u_rim.rgb,glassHue,.18+.2*fresnel);
 // One broad, faint bevel reflection; no pixel-wide contour stroke.
 vec3 reflected=edgeColor*reflection*(.65+.35*fresnel);
 float grain=(hash(gl_FragCoord.xy)-.5)*.009*u_frost*(1.-smoothstep(.65,.95,edgeHeight));
 vec2 screenUV=gl_FragCoord.xy/u_resolution;
 float frameFade=smoothstep(0.,.12,screenUV.x)*smoothstep(0.,.12,1.-screenUV.x)*smoothstep(0.,.12,screenUV.y)*smoothstep(0.,.12,1.-screenUV.y);
 vec3 atmosphere=behind(p,1.)*u_haze*.38*frameFade;
 vec3 atmosphereTint=mix(vec3(1.),mix(absorption,glassHue,.18),mask*.6);
 vec3 surface=(transmitted+bodyColor+reflected+grain)*mask+atmosphere*atmosphereTint*(1.-mask*.55);
 surface=clamp(surface,0.,1.);
 float density=mask*(.045+.065*u_frost);
 float energy=max(surface.r,max(surface.g,surface.b));
 float alpha=clamp(density+energy*.8,0.,.92);
 vec3 result=surface+u_colorBack.rgb*u_colorBack.a*(1.-alpha);
 float outAlpha=alpha+u_colorBack.a*(1.-alpha);
 fragColor=vec4(result,outAlpha);
}`;
