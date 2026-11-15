const TAU=6.283185307179586;
export function loopShader(shader,mode){
 shader=shader.replace(/precision (highp|mediump) float;/, '$& uniform bool u_loop; uniform float u_loopPhase,u_loopCycles,u_loopStart;');
 if(mode==='metal'){
  shader=shader.replace('float t = .3 * (u_time + firstFrameOffset);','float t = u_loop ? .3*(u_loopStart+firstFrameOffset)+u_loopPhase/6.28318530718*u_loopCycles : .3*(u_time+firstFrameOffset);');
  shader=shader.replace('snoise(uv - t)','snoise(u_loop ? uv-vec2(.3*(u_loopStart+2.8))+.65*vec2(cos(u_loopPhase*u_loopCycles),sin(u_loopPhase*u_loopCycles)) : uv-t)');
 }else if(mode==='heat'){
  shader=shader.replace('float t = .1 * u_time;', 'float t = u_loop ? .1*u_loopStart+u_loopPhase/6.28318530718*u_loopCycles : .1*u_time;');
 }else{
  // Integer harmonics close every moving light and reflection over the same period.
  const angles=[['t*.72',1,0],['t*.65',1,0],['t*.61',1,1.1],['t*.76',1,1.1],['t*.5',2,.4],['u_time*.13',1,0],['u_time*.19+.8',1,.8],['u_time*.17',1,0]];
  for(const [original,harmonic,offset] of angles)for(const fn of ['sin','cos'])shader=shader.replaceAll(fn+'('+original+')',fn+'(u_loop ? u_loopPhase*'+harmonic+'.*u_loopCycles+'+offset.toFixed(2)+' : '+original+')');
 }
 return shader;
}
export function loopSettings(mode,speed,start){return {u_loop:speed>0,u_loopPhase:0,u_loopStart:start/1000,u_loopCycles:speed===0?0:mode==='metal'?Math.max(1,Math.round(speed*1.8)):mode==='glass'?Math.max(1,Math.round(speed/1.5)):1}}
export async function encodeLoop({mount,canvas,mode,speed,transparent,onProgress}){
 const {Output,WebMOutputFormat,BufferTarget,CanvasSource,Quality,canEncodeVideo}=await import('mediabunny');
 const width=canvas.width,height=canvas.height,quality=new Quality({bitrate:Math.max(8000000,width*height*3)});
 const codec=await canEncodeVideo('vp9',{width,height,quality,frameRate:30})?'vp9':await canEncodeVideo('vp8',{width,height,quality,frameRate:30})?'vp8':null;
 if(!codec)throw Error('Video encoding is unavailable. Try Chrome or Edge.');
 const output=new Output({format:new WebMOutputFormat(),target:new BufferTarget()});
 const source=new CanvasSource(canvas,{codec,quality,alpha:transparent?'keep':'discard',keyFrameInterval:6});
 output.addVideoTrack(source,{frameRate:30});
 const saved=mount.getCurrentFrame();mount.setSpeed(0);
 const settings=loopSettings(mode,speed,saved);mount.setUniforms(settings);
 try{
  await output.start();
  for(let i=0;i<180;i++){
   if(canvas.width!==width||canvas.height!==height)throw Error('Preview resized during export. Please try again.');
   mount.setUniforms({u_loopPhase:TAU*i/180});mount.setFrame(saved);
   await source.add(i/30,1/30,{keyFrame:i===0});
   if(i%6===0){onProgress(Math.round(i/180*100));await new Promise(r=>setTimeout(r,0))}
  }
  source.close();await output.finalize();
  return new Blob([output.target.buffer],{type:'video/webm'});
 }catch(error){await output.cancel();throw error}
 finally{mount.setUniforms({u_loop:false,u_loopPhase:0});mount.setFrame(saved)}
}
