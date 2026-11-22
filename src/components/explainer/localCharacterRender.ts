import { hostMarkup, schedule, type Beat, type Gesture } from "./characterScene";
import { teachingSpace } from "../../../supabase/functions/studio-render/design/teachingSpace";

async function image(markup:string, viewBox:string,w:number,h:number) {
  const src=URL.createObjectURL(new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="'+viewBox+'">'+markup+'</svg>'],{type:"image/svg+xml"}));
  try {const img=new Image();img.src=src;await img.decode();return img;}
  finally {URL.revokeObjectURL(src);}
}

function fitText(ctx:CanvasRenderingContext2D,text:string,width:number) {
  const lines:string[]=[];let current="";
  for(const word of text.split(/\s+/)){
    const next=current ? current+" "+word : word;
    if(current && ctx.measureText(next).width>width){lines.push(current);current=word;}
    else current=next;
  }
  if(current)lines.push(current);
  return lines;
}
export async function renderCharacter(beats:Beat[],voice:File|null,signal:AbortSignal,progress:(message:string)=>void) {
  const mime=["video/mp4","video/webm;codecs=vp9,opus","video/webm"].find(m=>typeof MediaRecorder!=="undefined" && MediaRecorder.isTypeSupported(m));
  if(!mime)throw new Error("Video export requires a browser with MediaRecorder support.");
  const canvas=document.createElement("canvas");canvas.width=1920;canvas.height=1080;
  const ctx=canvas.getContext("2d");
  if(!ctx || !canvas.captureStream)throw new Error("This browser does not support canvas recording.");
  const audio=voice ? new AudioContext() : null;
  let stream:MediaStream|undefined,recorder:MediaRecorder|undefined,frame=0;
  let source:AudioBufferSourceNode|undefined;
  try{
    if(audio)await audio.resume();
    const narration=voice && audio ? await audio.decodeAudioData(await voice.arrayBuffer()) : null;
    const duration=narration?.duration ?? Math.max(3,beats.reduce((n,b)=>n+b.line.split(/\s+/).length,0)/2.4);
    if(!Number.isFinite(duration)||duration<=0)throw new Error("The narration has no playable audio.");
    const scenes=schedule(beats,duration);
    const room=await image(teachingSpace.svg,"0 0 1280 720",1280,720);
    const frames=new Map<Gesture,CanvasImageSource[]>();
    // Cache a seamless articulated movement cycle per gesture before recording starts.
    const count=60;
    for(const action of new Set(beats.map(b=>b.action))){
      const sprites:CanvasImageSource[]=[];
      for(let i=0;i<count;i++){
        if(signal.aborted)throw new Error("Export cancelled.");
        sprites.push(await image(hostMarkup(action,i*2*Math.PI/count),"-160 -400 320 425",320,425));
      }
      frames.set(action,sprites);
    }
    function draw(t:number){
      const scene=scenes.find(s=>t<s.start+s.length)??scenes[scenes.length-1];
      const elapsed=Math.max(0,t-scene.start);
      ctx!.setTransform(1.5,0,0,1.5,0,0);
      ctx!.drawImage(room,0,0);
      ctx!.drawImage(frames.get(scene.action)![Math.floor(t*30)%count],140,76,384,510);
      ctx!.fillStyle="#263234";ctx!.textAlign="center";ctx!.font="bold 38px system-ui";
      const lines=fitText(ctx!,scene.line,510);
      const pages=Math.ceil(lines.length/5);
      const page=Math.min(pages-1,Math.floor(elapsed/scene.length*pages));
      const visible=lines.slice(page*5,page*5+5);
      visible.forEach((line,i)=>ctx!.fillText(line,824,308+(i-(visible.length-1)/2)*49,515));
    }
    draw(0);stream=canvas.captureStream(30);
    if(audio && narration){
      const output=audio.createMediaStreamDestination();
      source=audio.createBufferSource();source.buffer=narration;source.connect(output);
      stream.addTrack(output.stream.getAudioTracks()[0]);
    }
    if(signal.aborted)throw new Error("Export cancelled.");
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5500000});
    const chunks:Blob[]=[];
    return await new Promise<Blob>((resolve,reject)=>{
      function stopOnAbort(){reject(new Error("Export cancelled."));}
      signal.addEventListener("abort",stopOnAbort,{once:true});
      recorder!.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder!.onerror=()=>reject(new Error("Recording failed. Keep the tab visible and try again."));
      recorder!.onstop=()=>{
        signal.removeEventListener("abort",stopOnAbort);
        if(chunks.length)resolve(new Blob(chunks,{type:mime}));else reject(new Error("No video was recorded."));
      };
      recorder!.start();const start=performance.now(),audioStart=audio?.currentTime??0;source?.start(audioStart);
      let lastSecond=-1;
      function tick(){
        try {
          const t=audio ? audio.currentTime-audioStart : (performance.now()-start)/1000;
          if(document.hidden) throw new Error("Export paused because the tab was hidden. Keep this tab visible and export again.");
          if(Math.floor(t)!==lastSecond){lastSecond=Math.floor(t);progress("Rendering "+Math.min(lastSecond,Math.ceil(duration))+" / "+Math.ceil(duration)+" seconds…");}
          draw(t);if(t>=duration)recorder!.stop();else frame=requestAnimationFrame(tick);
        }catch(e){reject(e);}
      }
      tick();
    });
  }finally{
    cancelAnimationFrame(frame);
    if(recorder?.state==="recording")recorder.stop();
    stream?.getTracks().forEach(track=>track.stop());
    if(audio)await audio.close();
  }
}
