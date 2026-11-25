import { createClient } from "npm:@supabase/supabase-js@2";
import { STITCH_ENDPOINT, stitchEnvelope } from "./stitchContract.ts";
import type { Film, Shot, FilmServices } from "./filmEngine.ts";
import type { Assembly } from "./filmWorkflow.ts";
import { filmAnimationRequest } from "./filmAnimationRequest.ts";
export const backend=Deno.env.get("SUPABASE_URL")??"";
export const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
export const admin=createClient(backend,serviceKey);
export async function wakeFilm(id?:string) {
  const r=await fetch(`${backend}/functions/v1/character-film-worker`,{method:"POST",headers:{Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"},body:JSON.stringify({id}),signal:AbortSignal.timeout(120000)});
  await r.text();
}
export function kick(id?:string) { EdgeRuntime.waitUntil(wakeFilm(id).catch(()=>{})); }
export async function loadFilm(id:string) {
  const {data:film,error}=await admin.from("character_films").select().eq("id",id).single();
  if(error||!film)throw new Error("Film not found");
  const {data:shots,error:shotError}=await admin.from("character_film_shots").select().eq("film_id",id).eq("owner_id",film.owner_id).order("index");
  if(shotError)throw shotError;
  return {film:film as Film,shots:(shots??[]) as Shot[]};
}
async function rpcVideo(endpoint:string,path:string,body?:object) {
  const r=await fetch(`https://api.runpod.ai/v2/${endpoint}/${path}`,{method:body?"POST":"GET",headers:{Authorization:`Bearer ${Deno.env.get("RUNPOD_API_KEY")??""}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const data=await r.json();
  if(!r.ok)throw new Error(`Assembly service returned ${r.status}`);
  return data;
}
export async function signed(bucket:string,path:string,expires=86400) {
  const {data,error}=await admin.storage.from(bucket).createSignedUrl(path,expires);
  if(error||!data)throw new Error("Could not prepare saved media");return data.signedUrl;
}
export function filmServices(id:string,owner:string):FilmServices {
  return {
    load:()=>loadFilm(id),
    async film(values){const {error}=await admin.from("character_films").update({...values,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",owner);if(error)throw error;},
    async shot(shotId,values){const {error}=await admin.from("character_film_shots").update(values).eq("id",shotId).eq("film_id",id).eq("owner_id",owner);if(error)throw error;},
    async animate(shot){
      const {data:current}=await admin.from("character_animation_jobs").select().eq("request_id",shot.request_id).eq("owner_id",owner).maybeSingle();
      const context=await loadFilm(id);
      const previous=context.shots.find(s=>s.index===shot.index-1);
      const body=current?{action:"status",id:current.id,owner_id:owner}:filmAnimationRequest(shot,owner,context.film.audio_mode,previous);
      const response=await fetch(`${backend}/functions/v1/character-animation`,{method:"POST",headers:{Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(100000)});
      const result=await response.json();if(!result.job)throw new Error(result.error??"Could not check the clip attempt");return result.job;
    },
    async frame(shot,previous){
      if(shot.frame_path)return {path:shot.frame_path};
      const endpoint=Deno.env.get("RUNPOD_GATEWAY_ENDPOINT_ID");
      if(!endpoint)return {error:"Continuation frame service is not configured. Saved clips are retained."};
      if(!shot.frame_job_id){
        // Non-video utility job only; never resubmits a Pruna prediction.
        const result=await rpcVideo(endpoint,"run",{input:{route:"capscify/extract-frame",params:{video_url:await this.video(previous.video_path??"")}}});
        return {job_id:result.id};
      }
      const result=await rpcVideo(endpoint,`status/${encodeURIComponent(shot.frame_job_id)}`);
      if(!["COMPLETED","FAILED","CANCELLED"].includes(result.status))return {job_id:shot.frame_job_id};
      const output=result.output?.output??result.output;
      if(result.status!=="COMPLETED"||!output?.last_frame_url)return {error:"Continuation frame extraction is unavailable on the deployed gateway. Deploy the extract-frame utility before continuing; existing clips remain saved."};
      const target=`${owner}/film-${id}-frame-${shot.index}.jpg`;
      const u=new URL(output.last_frame_url);
      if(u.protocol!=="https:"||!isOutputHost(u.hostname))throw new Error("Unexpected frame host");
      const r=await fetch(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error("Frame saving failed");
      const bytes=await r.arrayBuffer();if(bytes.byteLength>10*1024*1024)throw new Error("Frame too large");
      const {error}=await admin.storage.from("character-inputs").upload(target,bytes,{contentType:"image/jpeg",upsert:true});if(error)throw error;
      return {path:target,job_id:shot.frame_job_id};
    },
    async stitch(a:Assembly,inputs,narration){
      if(!a.job_id){
        try {
          const envelope=stitchEnvelope({video_clips:inputs,voiceover_url:narration});
          // Narration replaces scene speech, instead of merely ducking a second voice.
          if(narration)envelope.input.params.preserve_clip_audio=false;
          const result=await rpcVideo(STITCH_ENDPOINT,"run",{...envelope,webhook:`${backend}/functions/v1/character-film?callback=${id}`});
          if(!result.id)return {state:"checking",error:"Stitch submission has no job ID; reconcile before retrying."};
          return {job_id:result.id,state:"queued"};
        }catch{return {state:"checking",error:"Assembly submission uncertain. Saved clips retained; no automatic resubmission."};}
      }
      const result=await rpcVideo(STITCH_ENDPOINT,`status/${encodeURIComponent(a.job_id)}`);
      if(["FAILED","CANCELLED","TIMED_OUT"].includes(result.status))return {state:"failed",error:"Stitch failed. Retry assembly from saved clips."};
      if(result.status!=="COMPLETED")return {job_id:a.job_id,state:"queued"};
      const out=result.output?.output??result.output;
      const video=out?.final_video_url??out?.video_url??out?.url;
      return video?{job_id:a.job_id,state:"saving",output_url:video}:{state:"failed",error:"Stitch completed without a video; saved clips retained."};
    },
    async save(source,key){
      const u=new URL(source);if(u.protocol!=="https:"||!isOutputHost(u.hostname))throw new Error("Unexpected assembly output host");
      const path=`${owner}/film-${id}-${key}.mp4`;
      const exists=await admin.storage.from("film-media").info(path);if(exists.data)return path;
      const r=await fetch(u,{signal:AbortSignal.timeout(60000)});if(!r.ok||!r.body)throw new Error("Could not retrieve assembly");
      // Stream large films instead of holding a 30-minute MP4 in edge memory.
      const upload=await fetch(`${backend}/storage/v1/object/film-media/${path}`,{method:"POST",headers:{Authorization:`Bearer ${serviceKey}`,apikey:serviceKey,"Content-Type":"video/mp4","x-upsert":"false"},body:r.body,duplex:"half",signal:AbortSignal.timeout(90000)} as RequestInit);
      const result=await upload.text();if(!upload.ok&&!result.includes("Duplicate"))throw new Error("Saving final film failed; retained source can be retried.");return path;
    },
    async video(path){if(!path.startsWith(`${owner}/`))throw new Error("Foreign clip");return path.includes(`film-${id}-`)?signed("film-media",path):admin.storage.from("videos").getPublicUrl(path).data.publicUrl;},
    async audio(path){if(!path.startsWith(`${owner}/narration-`))throw new Error("Foreign narration");return signed("film-media",path);},
  };
}
function isOutputHost(host:string){return host==="ipfs.filebase.io"||host.endsWith(".s3.filebase.com")||host==="replicate.delivery"||host.endsWith(".replicate.delivery")||host===new URL(backend).hostname;}