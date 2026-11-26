import { readyShots, orderedInputs, type Assembly, type FilmDirection } from "./filmWorkflow.ts";
import { assertPreparedShot, requiresExtraction, type EventDirection, type FrameCheck, type Preparation, type SceneRecord } from "./automaticDirection.ts";
export type Shot = FilmDirection & {id:string;request_id:string;state:string;animation_id?:string;video_path?:string;frame_path?:string;board_start_path?:string;board_end_path?:string;frame_job_id?:string;error?:string;direction?:EventDirection;frame_check?:FrameCheck|null;correction_attempts?:number};
export type Film = {id:string;owner_id:string;state:string;seconds:number;script?:string;image_path?:string;scenes?:SceneRecord[];preparation?:Preparation|null;audio_mode:string;narration:{chapter:number;path:string;seconds:number}[];chapters:Assembly[];final_video_path?:string;error?:string};
export interface FilmServices {
  load():Promise<{film:Film;shots:Shot[]}>;
  film(values:Partial<Film>):Promise<void>;
  shot(id:string,values:Partial<Shot>):Promise<void>;
  animate(shot:Shot):Promise<{id:string;state:string;video_path?:string;error?:string}>;
  frame(shot:Shot,previous:Shot):Promise<{path?:string;job_id?:string;error?:string}>;
  stitch(a:Assembly,inputs:{url:string;shot_index:number}[],narration?:string):Promise<{job_id?:string;state:string;output_url?:string;error?:string}>;
  save(url:string,key:string):Promise<string>;
  video(path:string):Promise<string>;
  audio(path:string):Promise<string>;
}
// One bounded tick; authoritative state lives in the database, never in a browser loop.
export async function advanceFilm(s:FilmServices) {
  let {film,shots}=await s.load();
  if(!["running","assembling"].includes(film.state))return;
  // Inspect existing attempts first, but never create a new request ID during recovery.
  for(const shot of shots.filter(x=>["submitting","checking","queued","generating","saving"].includes(x.state)).slice(0,2)) {
    const job=await s.animate(shot);
    await s.shot(shot.id,{animation_id:job.id,state:job.state,video_path:job.video_path,error:job.error});
    if(["failed","save_failed"].includes(job.state)) {
      await s.film({state:job.error?.toLowerCase().includes("billing")?"billing_paused":"attention",error:`Shot ${shot.index+1}: ${job.error??"Generation needs attention"}`});return;
    }
  }
  ({film,shots}=await s.load());
  for(const candidate of readyShots(shots)) {
    if((await s.load()).film.state!=="running")return;
    let shot=shots.find(x=>x.index===candidate.index);
    if(!shot)continue;
    const previous=shots.find(x=>x.index===shot.index-1);
    assertPreparedShot(shot,previous);
    if(requiresExtraction(shot)) {
      if(!previous?.video_path)continue;
      const frame=await s.frame(shot,previous);
      await s.shot(shot.id,{frame_path:frame.path,frame_job_id:frame.job_id,error:frame.error});
      if(frame.error){await s.film({state:"attention",error:frame.error});return;}
      if(!frame.path)continue;
      shot={...shot,image_path:frame.path,frame_path:frame.path};
    }
    await s.shot(shot.id,{state:"submitting"});
    if((await s.load()).film.state!=="running")return;
    const job=await s.animate(shot);
    await s.shot(shot.id,{animation_id:job.id,state:job.state,video_path:job.video_path,error:job.error});
    if(["failed","save_failed"].includes(job.state)){await s.film({state:job.error?.toLowerCase().includes("billing")?"billing_paused":"attention",error:`Shot ${shot.index+1}: ${job.error??"Generation needs attention"}`});return;}
  }
  ({film,shots}=await s.load());
  if(!["running","assembling"].includes(film.state)||!shots.every(x=>x.state==="ready"&&x.video_path))return;
  await s.film({state:"assembling"});
  const saved=new Map<number,string>();
  for(const shot of shots)if(shot.video_path)saved.set(shot.index,await s.video(shot.video_path));
  const chapters=film.chapters.map(a=>({...a}));
  if(chapters.every(a=>a.state==="ready")) {
    if(chapters.length===1){await s.film({state:"ready",final_video_path:chapters[0].video_path,error:undefined});return;}
    const final=chapters.find(a=>a.key==="final");
    if(!final)chapters.push({key:"final",indices:chapters.map((_,i)=>i),state:"pending"});
  }
  const assembly=chapters.find(a=>a.state!=="ready");
  if(!assembly)return;
  if(assembly.state==="failed"||assembly.state==="checking"&&!assembly.job_id){await s.film({state:"attention",error:assembly.error??"Assembly submission needs reconciliation; no automatic resubmission."});return;}
  const isFinal=assembly.key==="final";
  const sources=isFinal?new Map(await Promise.all(chapters.filter(a=>a.key!=="final").map(async(a,i)=>[i,await s.video(a.video_path??"")] as const))):saved;
  const narration=!isFinal&&film.audio_mode==="uploaded"?film.narration.find(n=>`chapter-${n.chapter}`===assembly.key):undefined;
  try {
    if(assembly.output_url) {
      assembly.video_path=await s.save(assembly.output_url,assembly.key);assembly.state="ready";
    } else {
      // Write intent before any paid POST. A crash without a job ID remains uncertain.
      if(assembly.state==="pending"){assembly.state="checking";await s.film({chapters});}
      const result=await s.stitch(assembly,orderedInputs(assembly,sources),narration?await s.audio(narration.path):undefined);
      Object.assign(assembly,result);
      if(result.state==="failed"){await s.film({chapters,state:"attention",error:result.error??"Stitch failed. Saved clips are retained."});return;}
      if(result.output_url){assembly.output_url=result.output_url;assembly.state="saving";}
    }
    await s.film({chapters});
    if(assembly.state==="ready"&&(isFinal||chapters.length===1))await s.film({state:"ready",final_video_path:assembly.video_path,error:undefined});
  } catch {
    assembly.state=assembly.output_url?"save_failed":"checking";
    await s.film({chapters,state:"attention",error:assembly.output_url?"Retry saving the existing completed assembly.":"Stitch submission interrupted. Reconcile the existing job; do not regenerate clips."});
  }
}