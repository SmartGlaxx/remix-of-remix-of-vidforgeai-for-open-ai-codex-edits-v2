import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { Webhook } from "npm:standardwebhooks@1.0.0";
import { PRESET, VIDEO_MODELS, providerInput, LTX_ENDPOINT, isRunpodJob, runpodState, ownsImage, shouldSubmit, providerState, canSave, imageError } from "./contract.ts";

const schema = z.discriminatedUnion("action", [
  z.object({action:z.literal("submit"),request_id:z.string().uuid(),duration:z.number().int().min(1).max(PRESET.duration).default(PRESET.duration),image_path:z.string().max(250),prompt:z.string().max(4000).refine(s=>s.trim().length>0),model:z.enum(["pruna","seedance","ltx"]).default("pruna"),owner_id:z.string().uuid().optional()}),
  z.object({action:z.literal("list"),owner_id:z.string().uuid().optional()}),
  z.object({action:z.literal("status"),id:z.string().uuid(),owner_id:z.string().uuid().optional()}),
]);
const url = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const admin = createClient(url, serviceKey);
const table = "character_animation_jobs";
const json = (data: unknown, status=200) => new Response(JSON.stringify(data), {status,headers:{...corsHeaders,"Content-Type":"application/json"}});
async function provider(path: string, init: RequestInit = {}) {
  const token = Deno.env.get("REPLICATE_API_TOKEN");
  if (!token) throw new Error("Replicate token is missing. Add REPLICATE_API_TOKEN securely.");
  return fetch("https://api.replicate.com/v1"+path, {...init,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...init.headers},signal:AbortSignal.timeout(25000)});
}
async function runpod(path: string, init: RequestInit = {}) {
  const key = Deno.env.get("RUNPOD_API_KEY");
  if (!key) throw new Error("LTX engine is not configured.");
  return fetch(`https://api.runpod.ai/v2/${LTX_ENDPOINT}`+path,{...init,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},signal:AbortSignal.timeout(25000)});
}
async function applyRunpod(job: any, data: any) {
  const out = data.output?.output ?? data.output;
  const failed = ["FAILED","CANCELLED","TIMED_OUT"].includes(data.status);
  const next = await patch(job.id,{state:runpodState(data.status),output_url:out?.video_url ?? job.output_url,error:failed ? "LTX generation failed: "+String(data.error ?? data.status).slice(0,500) : null});
  if (data.status === "COMPLETED" && !out?.video_url) return patch(job.id,{state:"failed",error:"LTX finished but returned no video."});
  return data.status === "COMPLETED" ? save(next) : next;
}
async function patch(id: string, values: Record<string, unknown>) {
  const {data,error} = await admin.from(table).update({...values,updated_at:new Date().toISOString()}).eq("id",id).neq("state","ready").select().maybeSingle();
  if (error) throw new Error("Could not save animation status.");
  if (data) return data;
  const {data:ready,error:readError} = await admin.from(table).select().eq("id",id).single();
  if (readError) throw new Error("Could not read animation status.");
  return ready;
}
async function save(job: any) {
  if (!canSave(job)) return job;
  const path = `${job.owner_id}/character-${job.id}.mp4`;
  try {
    // Stable object path makes parallel webhook/status saves converge on one take.
    const {data:found} = await admin.storage.from("videos").list(job.owner_id,{search:`character-${job.id}.mp4`});
    if (!found?.some(f=>f.name===`character-${job.id}.mp4`)) {
      const parsed = new URL(job.output_url);
      const runpodOut = isRunpodJob(job.prediction_id) && parsed.protocol === "https:";
      if (!runpodOut && (parsed.protocol !== "https:" || !(parsed.hostname === "replicate.delivery" || parsed.hostname.endsWith(".replicate.delivery")))) throw new Error("Unexpected output host.");
      const response = await fetch(job.output_url,{signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw new Error("Could not retrieve the generated video.");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 100*1024*1024 || !bytes.byteLength) throw new Error("Unexpected video size.");
      const {error} = await admin.storage.from("videos").upload(path,bytes,{contentType:"video/mp4",upsert:false});
      if (error && !String(error.message).toLowerCase().includes("already exists")) throw error;
    }
    return await patch(job.id,{state:"ready",video_path:path,error:null,completed_at:new Date().toISOString()});
  } catch {
    return await patch(job.id,{state:"save_failed",error:"Generation completed, but saving failed. Retry saving this same video; no new generation charge."});
  }
}
async function applyPrediction(job: any, prediction: any) {
  if (job.state === "ready") return job;
  if (job.prediction_id && job.prediction_id !== prediction.id) throw new Error("Prediction does not match this attempt.");
  const output = typeof prediction.output === "string" ? prediction.output : null;
  const next = await patch(job.id,{prediction_id:prediction.id,state:providerState(prediction.status),output_url:output ?? job.output_url,error:["failed","canceled"].includes(prediction.status) ? "Replicate generation failed: "+String(prediction.error ?? prediction.status).slice(0,500) : null});
  return prediction.status === "succeeded" ? save(next) : next;
}
async function refresh(job: any) {
  if (job.state === "ready" || job.state === "failed") return job;
  if (canSave(job)) return save(job);
  if (isRunpodJob(job.prediction_id)) {
    const response = await runpod(`/status/${encodeURIComponent(job.prediction_id.slice(7))}`);
    if (response.ok) return applyRunpod(job,await response.json());
    return job;
  }
  if (job.prediction_id) {
    const response = await provider(`/predictions/${job.prediction_id}`);
    if (response.ok) return applyPrediction(job,await response.json());
    return job;
  }
  // An uncertain submission is NEVER resubmitted. Recover the unique signed input or verified webhook instead.
  if (job.settings?.model === "ltx") return job.state === "checking" ? job : patch(job.id,{state:"checking",error:"Checking submission. No second LTX job will be submitted for this attempt."});
  if (job.signed_input_url && Date.now()-Date.parse(job.created_at)>30000) {
    const response = await provider("/predictions");
    if (response.ok) {
      const list = await response.json();
      const match = list.results?.find((p:any)=>p.input?.image===job.signed_input_url && p.input?.prompt===job.prompt);
      if (match) return applyPrediction(job,match);
    }
    return patch(job.id,{state:"checking",error:"Checking submission. No second prediction will be submitted for this attempt."});
  }
  return job;
}
async function view(job: any) {
  const {signed_input_url,output_url,...safe} = job;
  const {data} = await admin.storage.from("character-inputs").createSignedUrl(job.image_path,3600);
  return {...safe,image_url:data?.signedUrl,video_url:job.state === "ready" ? admin.storage.from("videos").getPublicUrl(job.video_path).data.publicUrl : null};
}
let signingKey: string | undefined;
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:corsHeaders});
  try {
    if (new URL(req.url).searchParams.get("webhook") === "1") {
      const raw = await req.text();
      if (!signingKey) {
        const response = await provider("/webhooks/default/secret");
        if (!response.ok) return json({error:"Webhook verification unavailable"},503);
        signingKey = (await response.json()).key;
      }
      if (!signingKey) return json({error:"Webhook verification unavailable"},503);
      let prediction: any;
      try { prediction = new Webhook(signingKey).verify(raw,Object.fromEntries(req.headers)); }
      catch { return json({error:"Invalid webhook signature"},401); }
      const id = new URL(req.url).searchParams.get("job");
      const {data:job} = await admin.from(table).select().eq("id",id).single();
      if (!job || prediction.input?.prompt !== job.prompt || prediction.input?.image !== job.signed_input_url) return json({error:"Unknown prediction"},404);
      const next = await applyPrediction(job,prediction);
      // A finished clip is the next shot's prerequisite: wake its film instead of waiting for the next sweep.
      const {data:linked} = await admin.from("character_film_shots").select("film_id").eq("request_id",job.request_id).maybeSingle();
      if (linked?.film_id) EdgeRuntime.waitUntil(fetch(`${url}/functions/v1/character-film-worker`,{method:"POST",headers:{Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"},body:JSON.stringify({id:linked.film_id}),signal:AbortSignal.timeout(120000)}).then(r=>r.text()).catch(()=>{}));
      return json({ok:next.state !== "save_failed"},next.state === "save_failed" ? 503 : 200);
    }
    const bearer = req.headers.get("Authorization")?.replace(/^Bearer /i,"");
    if (!bearer) return json({error:"Sign in to animate an image."},401);
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({error:"Provide a valid image, prompt, and request ID."},400);
    const body = parsed.data;
    // The durable film worker calls with the service key and names its owner; a browser keeps its own session.
    let owner: string;
    if (bearer === serviceKey && serviceKey) {
      if (!body.owner_id) return json({error:"Internal animation calls must name their owner."},400);
      owner = body.owner_id;
    } else {
      const {data:{user},error:authError} = await admin.auth.getUser(bearer);
      if (authError || !user) return json({error:"Sign in to animate an image."},401);
      owner = user.id;
    }
    if (body.action === "list") {
      const {data,error} = await admin.from(table).select().eq("owner_id",owner).order("created_at",{ascending:false}).limit(100);
      if (error) throw error;
      return json({jobs:await Promise.all((data ?? []).map(view))});
    }
    if (body.action === "status") {
      const {data:job} = await admin.from(table).select().eq("id",body.id).eq("owner_id",owner).single();
      if (!job) return json({error:"Animation not found."},404);
      return json({job:await view(await refresh(job))});
    }
    const {data:existing} = await admin.from(table).select().eq("request_id",body.request_id).maybeSingle();
    if (!shouldSubmit(existing)) {
      if (existing.owner_id !== owner) return json({error:"Animation not found."},404);
      return json({job:await view(existing)});
    }
    if (!ownsImage(owner,body.image_path)) return json({error:"Choose your own uploaded illustration."},400);
    if (body.model !== "ltx" && !Deno.env.get("REPLICATE_API_TOKEN")) return json({error:"Replicate token is missing. Add REPLICATE_API_TOKEN securely."},503);
    const file = await admin.storage.from("character-inputs").info(body.image_path);
    if (file.error || !file.data) return json({error:"Upload your illustration first."},400);
    const invalid = imageError(file.data.contentType ?? file.data.metadata?.mimetype ?? "",Number(file.data.size ?? file.data.metadata?.size ?? 0));
    if (invalid) return json({error:invalid},400);
    const signed = await admin.storage.from("character-inputs").createSignedUrl(body.image_path,86400);
    if (!signed.data) return json({error:"Could not prepare the illustration."},503);
    const settings = {...PRESET,duration:body.duration,model:body.model};
    const {data:job,error} = await admin.from(table).insert({owner_id:owner,request_id:body.request_id,image_path:body.image_path,prompt:body.prompt,settings,signed_input_url:signed.data.signedUrl}).select().single();
    if (error) {
      if (error.code === "23505") {
        const {data:duplicate} = await admin.from(table).select().eq("request_id",body.request_id).eq("owner_id",owner).single();
        return duplicate ? json({job:await view(duplicate)}) : json({error:"Animation not found."},404);
      }
      throw error;
    }
    if (body.model === "ltx") {
      try {
        const response = await runpod("/run",{method:"POST",body:JSON.stringify({input:providerInput("ltx",body.duration,signed.data.signedUrl,body.prompt)})});
        const data = await response.json().catch(()=>({}));
        if (!response.ok || !data.id) return json({job:await view(await patch(job.id,{state:response.status>=500 ? "checking" : "failed",error:"The LTX engine is unavailable or paused. Check it is switched on, then generate another take."}))});
        const started = await patch(job.id,{prediction_id:"runpod:"+data.id,state:runpodState(data.status ?? "IN_QUEUE")});
        return json({job:await view(started)});
      } catch {
        return json({job:await view(await patch(job.id,{state:"checking",error:"Checking submission after a network interruption. This attempt will not be charged again."}))});
      }
    }
    try {
      const response = await provider(`/models/${VIDEO_MODELS[body.model].endpoint}/predictions`,{method:"POST",body:JSON.stringify({input:providerInput(body.model,body.duration,signed.data.signedUrl,body.prompt),webhook:`${url}/functions/v1/character-animation?webhook=1&job=${job.id}`,webhook_events_filter:["completed"]})});
      if (!response.ok) {
        const message = response.status === 402 ? "Replicate billing needs credit. Add credit to Replicate, then deliberately generate another take." : response.status === 401 || response.status === 403 ? "Replicate rejected the token. Replace it securely." : response.status === 422 ? (body.model==="seedance" ? "Seedance rejected the image or direction (it often blocks faces). Try Pruna for this image." : "Replicate rejected the image or motion direction.") : "Replicate is temporarily unavailable.";
        // 5xx may have accepted work: remain uncertain, do not retry POST.
        return json({job:await view(await patch(job.id,{state:response.status>=500 ? "checking":"failed",error:message}))});
      }
      const prediction = await response.json();
      return json({job:await view(await applyPrediction(job,prediction))});
    } catch {
      return json({job:await view(await patch(job.id,{state:"checking",error:"Checking submission after a network interruption. This attempt will not be charged again."}))});
    }
  } catch { return json({error:"Could not check or save the animation. Your input is preserved; try checking again."},503); }
});
