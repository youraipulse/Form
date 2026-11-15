import {loopShader,encodeLoop} from './loop-export.js';
import {frostedGlassShader} from './frosted-glass.js';
import {ShaderMount,liquidMetalFragmentShader,heatmapFragmentShader,toProcessedLiquidMetal,toProcessedHeatmap,getShaderColorFromString as color} from '@paper-design/shaders';
import './style.css';
const cleanMetal=liquidMetalFragmentShader.replace(/color \+= 1\. \/ 256\.[^;]+;/g,'').replace('void main()', 'uniform bool u_customPalette; uniform vec4 u_palette0; uniform vec4 u_palette1; uniform vec4 u_palette2; uniform vec4 u_palette3; uniform vec4 u_palette4; void main()').replace('color = vec3(r, g, b);', `color = vec3(r, g, b);
  if (u_customPalette) {
    // Color the reflected light, preserving the original luminance/contrast.
    float luminance=clamp(dot(color,vec3(.2126,.7152,.0722)),0.,1.);
    float tone=luminance*4.;
    vec3 pigment;
    if(tone<1.) pigment=mix(u_palette0.rgb,u_palette1.rgb,smoothstep(0.,1.,tone));
    else if(tone<2.) pigment=mix(u_palette1.rgb,u_palette2.rgb,smoothstep(0.,1.,tone-1.));
    else if(tone<3.) pigment=mix(u_palette2.rgb,u_palette3.rgb,smoothstep(0.,1.,tone-2.));
    else pigment=mix(u_palette3.rgb,u_palette4.rgb,smoothstep(0.,1.,tone-3.));
    vec3 tintedLight=clamp(pigment*luminance*1.35,0.,1.);
    color=mix(tintedLight,vec3(luminance),smoothstep(.72,.99,luminance)*.5);
    // Keep a small amount of the original spectral separation at reflections.
    color=clamp(color+(vec3(r,g,b)-vec3(luminance))*.18,0.,1.);
  }
`);
const cleanHeat=heatmapFragmentShader.replace('precision highp float;', 'precision highp float; uniform mediump vec2 u_resolution;').replace(/color \+= \.02 \*[^;]+;/g,'').replace(/heat \+= [^;]+;/g,'').replace('float heat = clamp(inner + outer, 0., 1.);', 'vec2 screenUV = gl_FragCoord.xy / u_resolution; float haloFade = smoothstep(0., .18, screenUV.x) * smoothstep(0., .18, 1. - screenUV.x) * smoothstep(0., .18, screenUV.y) * smoothstep(0., .18, 1. - screenUV.y); float heat = max(0., (clamp(inner + outer * haloFade, 0., 1.) - .025) / .975);');
const loopShaders={metal:loopShader(cleanMetal,'metal'),heat:loopShader(cleanHeat,'heat'),glass:loopShader(frostedGlassShader,'glass')};
const $=id=>document.getElementById(id);const host=$('shader');
let mode='heat',mount,source,processed={},busy=false,paused=false,transparent=false,palette=0,loadId=0;
const state={lightSize:1,haze:.4,frost:.42,backlight:1.1,thickness:.5,speed:1.17,scale:.78,distortion:0,contour:1,repetition:4.35,softness:1,dispersion:.10,angle:315,innerGlow:.55,outerGlow:.3,noise:.015};
const materialStates={
 metal:{...state},
 glass:{...state},
 heat:{...state,speed:1.5,scale:.65,innerGlow:.41,outerGlow:.49,contour:.46,angle:306}
};
const presetByMode={metal:0,heat:0,glass:0};
Object.assign(state,materialStates[mode]);

const palettes=[['#fff','#0a0a0a','#3448ff','#ee33a3','#ffaf4a'],['#ffe9c4','#692326','#ed8139','#ffd275','#fff4d4'],['#9145ff','#241069','#7735ff','#d44dff','#f1cbff'],['#62f028','#063b28','#0dcf74','#99ff32','#e8ffc1']];
const customColors={metal:null,heat:null,glass:null};
const glassPalettes=[['#526068','#e4f5ff','#a7c6d1'],['#62594c','#fff1d4','#dfccb2'],['#575268','#eee5ff','#c9b9e7'],['#4c625c','#e5fff3','#b0d9cb']];
function presetColors(index=palette){if(mode==='glass')return glassPalettes[index];return mode==='metal'?[
['#0a0a0a','#3448ff','#ee33a3','#ffaf4a','#ffffff'],
['#391a0c','#995028','#e6a14b','#ffce7d','#fff2d7'],
['#241069','#7735ff','#9145ff','#d44dff','#f1cbff'],
['#031b14','#0d6041','#269f69','#8fdba0','#efffe8']
][index]:(index===0?['#171450','#3730cf','#9824e8','#ff3250','#ffac32','#fff3b0']:palettes[index].slice(1))}
function activeColors(){return customColors[mode]??presetColors()}
function renderColors(){const colors=activeColors();const labels=mode==='glass'?['Glass','Backlight','Edge']:mode==='metal'?['Deep shadow','Shadow','Midtone','Reflection','Highlight']:colors.map((_,i)=>'Color '+(i+1));$('color-editor').innerHTML=colors.map((c,i)=>`<div class="editable-color"><input type="color" value="${c}" aria-label="${labels[i]}" data-color="${i}"><label for="hex-${i}">${labels[i]}</label><input id="hex-${i}" class="color-hex" aria-label="${labels[i]} HEX" value="${c.toUpperCase()}" maxlength="7" spellcheck="false" data-hex="${i}"></div>`).join('');
const apply=(i,value)=>{customColors[mode]=[...activeColors()];customColors[mode][i]=value;swatches();update()};
document.querySelectorAll('[data-color]').forEach(e=>e.oninput=()=>{const i=+e.dataset.color;apply(i,e.value);$('hex-'+i).value=e.value.toUpperCase()});
document.querySelectorAll('[data-hex]').forEach(e=>e.onchange=()=>{const v=e.value.trim(),i=+e.dataset.hex;if(/^#[0-9a-f]{6}$/i.test(v)){e.setCustomValidity('');apply(i,v);document.querySelector('[data-color="'+i+'"]').value=v}else{e.setCustomValidity('Use #RRGGBB');e.reportValidity()}})
}
$('reset-colors').onclick=()=>{customColors[mode]=null;renderColors();swatches();update()};
function applyQuality(){if(!mount)return;const r=host.getBoundingClientRect(),edge=+$('quality').value;mount.setMaxPixelCount(edge*edge);mount.setMinPixelRatio(edge/Math.max(1,r.width,r.height))}
$('quality').onchange=applyQuality;
const defaults={u_fit:1,u_scale:state.scale,u_rotation:0,u_originX:.5,u_originY:.5,u_offsetX:0,u_offsetY:0,u_worldWidth:0,u_worldHeight:0};
function uniforms(image=processed[mode]){const bg=transparent?[0,0,0,0]:color($('background').value);const p=palettes[palette];return {...defaults,u_loop:false,u_loopPhase:0,u_loopCycles:1,u_loopStart:0,u_scale:state.scale,u_image:image,u_colorBack:bg,u_angle:state.angle,u_contour:state.contour,...(mode==='glass'?{u_frost:state.frost,u_lightSize:state.lightSize,u_haze:state.haze,u_backlight:state.backlight,u_thickness:state.thickness,u_glass:color(activeColors()[0]),u_light:color(activeColors()[1]),u_rim:color(activeColors()[2])}:mode==='metal'?{u_colorTint:color('#ffffff'),u_customPalette:true,...Object.fromEntries(activeColors().map((c,i)=>['u_palette'+i,color(c)])),u_repetition:state.repetition,u_shiftRed:state.dispersion*(palette===2?.5:.7),u_shiftBlue:state.dispersion*(palette===2?1.5:1.3),u_softness:state.softness,u_distortion:state.distortion,u_shape:0,u_isImage:true}:{u_colors:activeColors().map(color),u_colorsCount:activeColors().length,u_innerGlow:state.innerGlow,u_outerGlow:state.outerGlow})}}
function motionSpeed(){return state.speed*(mode==='glass'?3:1)}
function speed(){mount?.setSpeed(busy||paused||document.hidden?0:motionSpeed());$('pause').textContent=paused?'▶':'Ⅱ';$('pause').ariaLabel=paused?'Play animation':'Pause animation'}
function status(s=''){ $('status').textContent=s }
async function imageFromBlob(blob){const url=URL.createObjectURL(blob);try{const im=new Image();im.src=url;await im.decode();return im}finally{URL.revokeObjectURL(url)}}
async function setMode(next){if(busy)return;if(next!==mode){materialStates[mode]={...state};presetByMode[mode]=palette;mode=next;palette=presetByMode[mode];Object.assign(state,materialStates[mode])}const id=++loadId;status('Preparing material…');try{if(!processed[mode]){if(mode==='glass'&&processed.metal)processed.glass=processed.metal;else {const result=mode!=='heat'?await toProcessedLiquidMetal(source):await toProcessedHeatmap(source);const im=await imageFromBlob(result.pngBlob||result.blob);if(id!==loadId)return;processed[mode]=im}}mount?.dispose();mount=new ShaderMount(host,loopShaders[mode],uniforms(),{alpha:true,antialias:false,preserveDrawingBuffer:true},paused?0:motionSpeed(),0,Math.min(devicePixelRatio,1.75),2400000,['u_image']);speed();renderControls();renderColors();swatches();applyQuality();document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));$('material-label').textContent=mode==='glass'?'Frosted glass':mode==='metal'?'Liquid metal':'Heatmap';status()}catch(e){console.error(e);status('Could not prepare this logo. Try a transparent PNG.')}}
function update(){mount?.setUniforms(uniforms());speed()}
const fields={lightSize:['Light size',.25,2.5,.01],haze:['Atmosphere',0,1,.01],frost:['Frost',0,1,.01],backlight:['Backlight',0,2,.01],thickness:['Thickness',0,1,.01],speed:['Motion',0,1.5,.01],scale:['Size',.2,1.15,.01],distortion:['Distortion',0,1,.01],contour:['Contour',0,1,.01],repetition:['Stripes',1,8,.1],softness:['Softness',0,1,.01],dispersion:['Iridescence',0,1,.01],angle:['Direction',0,360,1],innerGlow:['Inner glow',0,1,.01],outerGlow:['Outer glow',0,1,.01],noise:['Grain',0,.3,.005]};
function renderControls(){const names=mode==='glass'?['speed','scale','frost','backlight','lightSize','haze','thickness','angle']:mode==='metal'?['speed','scale','distortion','softness','contour','dispersion']:['speed','scale','innerGlow','outerGlow','contour','angle'];$('controls').innerHTML=names.map(n=>{const [label,min,max,step]=fields[n];return `<div class="control"><label for="${n}">${label}<output id="out-${n}">${state[n].toFixed(n==='angle'?0:2)}</output></label><input id="${n}" type="range" min="${min}" max="${max}" step="${step}" value="${state[n]}"></div>`}).join('');for(const n of names)$(n).oninput=e=>{state[n]=+e.target.value;$('out-'+n).value=state[n].toFixed(n==='angle'?0:2);update()}}
function swatches(){
 const names=mode==='glass'?['Clear frost','Warm frost','Violet frost','Mint frost']:['Spectrum','Amber','Violet','Green'];
 $('swatches').innerHTML=names.map((name,i)=>{const colors=mode==='glass'?glassPalettes[i]:palettes[i];return `<button aria-label="${name} preset" title="${name}" class="${i===palette&&!customColors[mode]?'active':''}" style="background:linear-gradient(135deg,${colors.join(',')})" data-palette="${i}"></button>`}).join('');
 document.querySelectorAll('[data-palette]').forEach(b=>b.onclick=()=>{palette=+b.dataset.palette;customColors[mode]=null;renderColors();if(mode==='metal'){Object.assign(state,palette===2?{angle:315,repetition:6.17,distortion:.69,contour:.48,softness:.8,dispersion:.08}:{angle:315,repetition:4.35,distortion:0,contour:1,softness:1,dispersion:.10});renderControls()}swatches();update()})
}swatches();
$('background').value='#141414';$('workspace').style.background='#141414';
$('background').oninput=()=>{$('workspace').style.background=$('background').value;update()};$('transparent').onclick=()=>{transparent=!transparent;$('transparent').setAttribute('aria-pressed',transparent);$('workspace').classList.toggle('checker',transparent);update()};$('pause').onclick=()=>{paused=!paused;speed()};document.addEventListener('visibilitychange',speed);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$('upload').onclick=()=>$('file').click();
async function load(file){if(busy||!file)return;if(file.size>15*1024*1024){status('Use a logo smaller than 15 MB.');return}try{status('Reading logo…');const url=URL.createObjectURL(file);let im;try{im=new Image();im.src=url;await im.decode()}finally{URL.revokeObjectURL(url)}const c=document.createElement('canvas');const factor=file.type==='image/svg+xml'?1600/Math.max(im.naturalWidth,im.naturalHeight):Math.min(1,1600/Math.max(im.naturalWidth,im.naturalHeight));c.width=Math.max(1,Math.round(im.naturalWidth*factor));c.height=Math.max(1,Math.round(im.naturalHeight*factor));const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0,c.width,c.height);const pixels=ctx.getImageData(0,0,c.width,c.height);let left=c.width,right=0,top=c.height,bottom=0,alpha=false;for(let i=3;i<pixels.data.length;i+=4)if(pixels.data[i]<250){alpha=true;break}if(!alpha){status('Use SVG or PNG with a transparent background.');return}for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels.data[(y*c.width+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}if(right<left){status('This image is empty.');return}const cropped=document.createElement('canvas');const w=right-left+1,h=bottom-top+1,pad=Math.ceil(Math.max(w,h)*.08);cropped.width=w+pad*2;cropped.height=h+pad*2;const crop=cropped.getContext('2d');crop.drawImage(c,left,top,w,h,pad,pad,w,h);crop.globalCompositeOperation='source-in';crop.fillStyle='#000';crop.fillRect(0,0,cropped.width,cropped.height);const blob=await new Promise(r=>cropped.toBlob(r));source=new File([blob],'logo.png',{type:'image/png'});processed={};$('filename').textContent=file.name;await setMode(mode)}catch(e){console.error(e);status('Could not read this image. Try another SVG or PNG.')}}
$('file').onchange=e=>{load(e.target.files[0]);e.target.value=''};let drag=0;window.addEventListener('dragenter',e=>{e.preventDefault();drag++;document.body.classList.add('drag')});window.addEventListener('dragleave',()=>{if(!--drag)document.body.classList.remove('drag')});window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>{e.preventDefault();drag=0;document.body.classList.remove('drag');load(e.dataTransfer.files[0])});
function download(blob,name){if(!blob)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)}
function fitCanvas(){const r=$('workspace').getBoundingClientRect(),ratio=+$('ratio').value;const w=Math.min(r.width-32,(r.height-96)*ratio);host.style.width=w+'px';host.style.height=(w/ratio)+'px';host.style.aspectRatio=ratio;applyQuality()}new ResizeObserver(()=>requestAnimationFrame(fitCanvas)).observe($('workspace'));$('ratio').onchange=fitCanvas;
function exporting(on){busy=on;document.querySelectorAll('aside button, aside input, aside select, #upload, #pause, #ratio').forEach(b=>b.disabled=on)}
$('png').onclick=()=>{if(!mount||busy)return;const was=mount.getCurrentFrame();mount.setFrame(was);const canvas=host.querySelector('canvas');canvas.toBlob(b=>download(b,`logo-${mode}.png`),'image/png')};
$('video').onclick=async()=>{if(!mount||busy)return;exporting(true);status('Preparing seamless loop...');try{const blob=await encodeLoop({mount,canvas:host.querySelector('canvas'),mode,speed:motionSpeed(),transparent,onProgress:p=>status(`Rendering loop · ${p}%`)});download(blob,`logo-${mode}-loop.webm`);status('Seamless loop saved')}catch(e){console.error(e);status(e.message||'Video export failed')}finally{exporting(false);speed()}};
source=new File([`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><path fill="black" d="M300 40 540 180v240L300 560 60 420V180zm0 78L128 218v164l172 100 172-100V218zm0 75 106 62v90l-106 62-106-62v-90z" fill-rule="evenodd"/></svg>`],'form.svg',{type:'image/svg+xml'});
setMode(mode);window.__form={get state(){return {mode,paused,busy,transparent,parameters:{...state},pixels:host.querySelector('canvas')?.width*host.querySelector('canvas')?.height}},get mount(){return mount}};




