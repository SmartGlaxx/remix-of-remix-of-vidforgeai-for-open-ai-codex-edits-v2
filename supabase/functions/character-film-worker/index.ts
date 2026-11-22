import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { admin, serviceKey, loadFilm, filmServices, kick } from "../_shared/filmRuntime.ts";
import { advanceFilm } from "../_shared/filmEngine.ts";
Deno.serve(async request=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  const cronFailure=authenticateCronRequest(request);
  if(cronFailure&&request.headers.get("Authorization")!==`Bearer ${serviceKey}`)return new Response("Unauthorized",{status:401,headers:corsHeaders});
  const body=await request.json().catch(()=>({}));
  const ids:string[]=body.id&&/^[0-9a-f-]{36}$/i.test(body.id)?[body.id]:((await admin.from("character_films").select("id").in("state",["running","assembling"]).order("updated_at").limit(2)).data??[]).map(r=>r.id);
  let processed=0;
  for(const id of ids){
    const token=crypto.randomUUID();const {data:claimed}=await admin.rpc("claim_character_film",{p_id:id,p_token:token});if(!claimed)continue;
    try {const {film}=await loadFilm(id);await advanceFilm(filmServices(id,film.owner_id));processed++;}
    catch {await admin.from("character_films").update({error:"Worker interrupted; saved attempts will be reconciled, never blindly resubmitted.",updated_at:new Date().toISOString()}).eq("id",id);}
    finally {await admin.from("character_films").update({lease_token:null,lease_until:null}).eq("id",id).eq("lease_token",token);}
    const {film,shots}=await loadFilm(id);
    const inFlight=shots.some(s=>["submitting","checking","queued","generating","saving"].includes(s.state));
    if(film.state==="assembling"&&!film.chapters.some(c=>c.state==="queued")||film.state==="running"&&!inFlight&&shots.some(s=>s.state==="pending"&&!s.frame_job_id))kick(id);
  }
  return Response.json({processed},{headers:corsHeaders});
});