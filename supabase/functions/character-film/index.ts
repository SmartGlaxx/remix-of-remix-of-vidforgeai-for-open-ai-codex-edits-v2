// Client API for the long-film workflow. Planning is free; only "generate" authorizes the displayed budget.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { planCharacterFilm } from "../_shared/characterFilmPlan.ts";
import { assemblies, draftDirections, narrationMismatch, narrationSeconds, SAMPLE_SCRIPT } from "../_shared/filmWorkflow.ts";
import { ownsImage } from "../_shared/prunaContract.ts";
import { admin, kick, loadFilm, serviceKey, signed } from "../_shared/filmRuntime.ts";

import { openingTag, tightRegion } from "../_shared/frameMask.ts";
import { locateMovement } from "../_shared/filmPreparationRuntime.ts";
import { drawFrame } from "../_shared/shotBoard.ts";
import { assertPreparedShot, automaticBudget } from "../_shared/automaticDirection.ts";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare") }),
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("status"), id: z.string().uuid() }),
  z.object({ action: z.literal("plan"), request_id: z.string().uuid(), script: z.string().trim().min(1).max(20000), seconds: z.number().int().min(30).max(1800), image_path: z.string().max(250), audio_mode: z.enum(["native", "uploaded"]) }),
  z.object({ action: z.literal("create"), request_id: z.string().uuid(), script: z.string().trim().max(20000), topic: z.string().trim().max(300), seconds: z.number().int().min(30).max(1800), image_path: z.string().max(250), audio_mode: z.enum(["native", "uploaded"]), prepare_only: z.boolean().optional() }),
  z.object({ action:z.literal("board_frame"), id:z.string().uuid(), side:z.enum(["start","end"]) }),
  z.object({ action: z.literal("update_shot"), id: z.string().uuid(), line: z.string().trim().max(600).optional(), purpose: z.string().trim().max(300).optional(), visual: z.string().trim().max(2200).optional(), direction: z.string().trim().max(600).optional(), transition: z.enum(["cut", "continue"]).optional() }),
  z.object({ action: z.literal("generate"), id: z.string().uuid() }),
  z.object({ action: z.literal("stop"), id: z.string().uuid() }),
  z.object({ action: z.literal("resume"), id: z.string().uuid() }),
  z.object({ action: z.literal("retry_stitch"), id: z.string().uuid() }),
  z.object({ action: z.literal("retake"), shot_id: z.string().uuid() }),
  z.object({ action: z.literal("narration"), id: z.string().uuid(), chapter: z.number().int().min(0).max(15), path: z.string().max(250), seconds: z.number().int().min(1).max(600) }),
]);

function titleOf(script: string) {
  return script.trim().split(/\s+/).slice(0, 8).join(" ").slice(0, 80);
}

// The newest illustration this owner actually owns, so a ready draft never points at foreign media.
async function latestImage(owner: string) {
  const { data: job } = await admin.from("character_animation_jobs").select("image_path").eq("owner_id", owner).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (typeof job?.image_path === "string" && ownsImage(owner, job.image_path)) return job.image_path;
  const { data: files } = await admin.storage.from("character-inputs").list(owner, { limit: 1, sortOrder: { ascending: false } });
  const name = files?.[0]?.name;
  return typeof name === "string" && ownsImage(owner, `${owner}/${name}`) ? `${owner}/${name}` : "";
}

async function insertFilm(owner: string, values: { script: string; seconds: number; image_path: string; audio_mode: string; request_id: string }) {
  const plan = planCharacterFilm(values.seconds);
  const { data: film, error } = await admin.from("character_films").insert({
    owner_id: owner, request_id: values.request_id, title: titleOf(values.script), script: values.script,
    seconds: values.seconds, image_path: values.image_path, audio_mode: values.audio_mode,
    chapters: assemblies(values.seconds), state: "draft", estimated_usd: plan.estimatedUsd,
  }).select().single();
  if (error) throw error;
  const directions = draftDirections(values.script, values.seconds, values.image_path);
  const { error: shotError } = await admin.from("character_film_shots").insert(directions.map(d => ({
    film_id: film.id, owner_id: owner, index: d.index, chapter: d.chapter, duration: d.duration,
    line: d.line, purpose: d.purpose, visual: d.visual, action: d.action, transition: d.transition, image_path: d.image_path,
  })));
  if (shotError) throw shotError;
  return film.id as string;
}

async function present(id: string) {
  const { film, shots } = await loadFilm(id);
  const chapters = film.chapters ?? [];
  const real = chapters.filter(a => a.key !== "final");
  const current = chapters.find(a => a.state !== "ready");
  const saved = shots.filter(s => s.state === "ready" && s.video_path).length;
  const phase = film.state === "draft" ? (film.preparation?.phase === "ready" ? "Ready to render" : "Draft") : film.state === "preparing" ? ({script:"Writing narration",scene:"Inspecting the reference scene",direction:"Directing scenes",frames:film.preparation?.shot_style==="cuts"?"Preparing scene images":"Preparing paired frames",review:film.preparation?.shot_style==="cuts"?"Checking scene images":"Checking continuity",replan:"Replanning the action",ready:"Ready to render"}[film.preparation?.phase ?? "direction"]) : film.state === "ready" ? "Finished" : film.state === "assembling" ? (current?.key === "final" ? "Saving final film" : "Assembling chapters") : "Generating clips";
  const final_video_url = film.final_video_path ? await signed("film-media", film.final_video_path).catch(() => null) : null;
  return {
    film: { ...film, estimated_usd: Number(film.estimated_usd), final_video_url, mismatch: narrationMismatch(film.script, film.seconds), spoken_seconds: Math.round(narrationSeconds(film.script)) },
    shots,
    progress: { saved, total: shots.length, chapter: current && current.key !== "final" ? real.findIndex(a => a.key === current.key) + 1 : real.length, chapters: real.length, phase },
  };
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // RunPod notifies assembly completion here; the job ID must already belong to this film.
    const callback = new URL(request.url).searchParams.get("callback");
    if (callback) {
      if (!/^[0-9a-f-]{36}$/i.test(callback)) return json({ error: "Unknown assembly callback." }, 404);
      const body = await request.json().catch(() => ({}));
      const job_id = typeof body?.id === "string" ? body.id : "";
      const { film } = await loadFilm(callback).catch(() => ({ film: null as never }));
      if (!film || !film.chapters.some(a => a.job_id && a.job_id === job_id)) return json({ ok: true });
      kick(callback);
      return json({ ok: true });
    }

    const bearer = request.headers.get("Authorization")?.replace(/^Bearer /i, "");
    if (!bearer) return json({ error: "Sign in to create a film." }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(bearer);
    if (authError || !user) return json({ error: "Sign in to create a film." }, 401);
    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Choose a duration from 30 to 1,800 whole seconds and supply the film details." }, 400);
    const body = parsed.data;
    const owner = user.id;

    if (body.action === "prepare") {
      const { data: draft } = await admin.from("character_films").select("id").eq("owner_id", owner).eq("state", "draft").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const id = draft?.id ?? await insertFilm(owner, { script: SAMPLE_SCRIPT, seconds: 30, image_path: await latestImage(owner) || `${owner}/awaiting-illustration.png`, audio_mode: "native", request_id: crypto.randomUUID() });
      return json(await present(id));
    }
    if (body.action === "list") {
      const { data, error } = await admin.from("character_films").select("id,state,seconds,estimated_usd,title,created_at").eq("owner_id", owner).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return json({ films: data ?? [] });
    }
    if (body.action === "status") {
      const { data: owned } = await admin.from("character_films").select("id").eq("id", body.id).eq("owner_id", owner).maybeSingle();
      if (!owned) return json({ error: "Film not found." }, 404);
      return json(await present(body.id));
    }
    if (body.action === "plan" || body.action === "create") {
      if (!ownsImage(owner, body.image_path)) return json({ error: "Choose your own uploaded illustration." }, 400);
      const { data: file } = await admin.storage.from("character-inputs").info(body.image_path);
      if (!file) return json({ error: "Upload your illustration first." }, 400);
      const { data: duplicate } = await admin.from("character_films").select("id").eq("request_id", body.request_id).eq("owner_id",owner).maybeSingle();
      if (duplicate) return json(await present(duplicate.id));
      if(body.action==="create" && !body.script && !body.topic)return json({error:"Enter a topic or script."},400);
      if(body.action==="create" && body.audio_mode==="uploaded")return json({error:"Plan a draft and attach chapter narration before creating the video."},400);
      const id = await insertFilm(owner, { script: body.script || (body.action==="create"?body.topic:""), seconds: body.seconds, image_path: body.image_path, audio_mode: body.audio_mode, request_id: body.request_id });
      if(body.action==="create"){
        const {error}=await admin.from("character_films").update({state:"preparing",preparation:{phase:body.script?"scene":"script",chapter:0,authorized:!body.prepare_only,shot_style:"cuts",topic:body.topic,budget:automaticBudget(body.seconds)},estimated_usd:automaticBudget(body.seconds).max_video_clips*0.05}).eq("id",id).eq("owner_id",owner);
        if(error)throw error;
        kick(id);
      }
      return json(await present(id));
    }

    // Every remaining action re-checks ownership before touching a row.
    // Shot-scoped actions resolve their parent film first, so a foreign shot ID can never reach another owner's row.
    const shotParent = (body.action === "update_shot" || body.action === "board_frame") ? body.id : body.action === "retake" ? body.shot_id : "";
    let filmId = shotParent ? "" : "id" in body ? body.id : "";
    if (shotParent) {
      const { data: shot } = await admin.from("character_film_shots").select("film_id").eq("id", shotParent).eq("owner_id", owner).maybeSingle();
      if (shot) filmId = shot.film_id;
    }
    const { data: film } = filmId ? await admin.from("character_films").select().eq("id", filmId).eq("owner_id", owner).maybeSingle() : { data: null };
    if (!film) return json({ error: "Film not found." }, 404);

    if(body.action==="board_frame"){
      if(film.state!=="draft") return json({error:"Only drafts can generate storyboard frames"},409);
      const {shots}=await loadFilm(film.id);
      const shot=shots.find(s=>s.id===body.id);
      if(!shot)return json({error:"Shot not found"},404);
      const previous=shots.find(s=>s.index===shot.index-1);
      const root=owner+"/boards/";
      // Include the shot direction and source in the key so edits produce a fresh board.
      const revision=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([film.image_path,shot.visual,shot.action,shot.line,shot.transition,previous?.id])));
      const tag=Array.from(new Uint8Array(revision).slice(0,8),v=>v.toString(16).padStart(2,"0")).join("");
      const base=root+shot.id+"-"+tag;
      const start=base+"-start.png";
      let end = "";
      if(body.side==="start"){
        await drawFrame(owner,film.image_path,start,shot.visual+" Show the opening pose immediately before this action: "+shot.action);
        if(shot.transition==="cut"){
          const {error}=await admin.from("character_film_shots").update({image_path:start,board_start_path:start}).eq("id",shot.id).eq("owner_id",owner);
          if(error)throw error;
        }
        if(shot.transition==="continue"){
          const {error}=await admin.from("character_film_shots").update({board_start_path:start}).eq("id",shot.id).eq("owner_id",owner);
          if(error)throw error;
        }
      } else {
        const opening = shot.board_start_path ?? start;
        end = base + "-end-masked-" + await openingTag(opening) + ".png";
        if (!(await admin.storage.from("character-inputs").info(end)).data) {
          const suggested = shot.direction?.edit_region;
          const region = tightRegion(suggested) ? suggested : await locateMovement(opening, shot);
          await drawFrame(owner, opening, end, shot.visual + " Show the final pose immediately after this action completes: " + shot.action, region);
        }
        const {error}=await admin.from("character_film_shots").update({board_end_path:end}).eq("id",shot.id).eq("owner_id",owner);
        if(error)throw error;
      }
      return json({path:body.side==="start"?start:end,url:await signed("character-inputs",body.side==="start"?start:end)});
    }
    if (body.action === "update_shot") {
      if (film.state !== "draft") return json({ error: "This film has started; retake the shot to change it." }, 409);
      const { data: shot } = await admin.from("character_film_shots").select("id,index").eq("id", body.id).eq("film_id", film.id).maybeSingle();
      if (!shot) return json({ error: "Shot not found." }, 404);
      if(shot.index===0 && body.transition==="continue")return json({error:"The first shot opens the film"},400);
      const values: Record<string, unknown> = {board_start_path:null,board_end_path:null,frame_check:null,image_path:film.image_path};
      for (const key of ["line", "purpose", "visual", "transition"] as const) if (body[key]) values[key] = body[key] as string;
      if (body.direction) values.action = body.direction;
      // Manual direction editing leaves the automatic contract rather than retaining a stale passed review.
      values.direction=null;
      if (Object.keys(values).length) {
        const { error } = await admin.from("character_film_shots").update(values).eq("id", shot.id).eq("film_id", film.id);
        if (error) throw error;
      }
      return json(await present(film.id));
    }
    if (body.action === "generate") {
      if (film.state !== "draft") return json({ error: "This film is already running or finished." }, 409);
      if (!ownsImage(owner, film.image_path) || film.image_path.includes("awaiting-illustration")) return json({ error: "Upload your character illustration first." }, 400);
      const { data: file } = await admin.storage.from("character-inputs").info(film.image_path);
      if (!file) return json({ error: "Upload your character illustration first." }, 400);
      const {shots}=await loadFilm(film.id);
      if(film.preparation && film.preparation.phase!=="ready")return json({error:"Automatic preparation must finish before video submission."},409);
      for(const shot of shots)assertPreparedShot(shot,shots.find(previous=>previous.index===shot.index-1));
      if (film.audio_mode === "uploaded" && film.seconds >= 120 && !(film.narration ?? []).length) return json({ error: "Add the chapter narration audio before generating." }, 400);
      const { error } = await admin.from("character_films").update({ state: "running", error: null, updated_at: new Date().toISOString() }).eq("id", film.id).eq("owner_id", owner).eq("state", "draft");
      if (error) throw error;
      kick(film.id);
      return json(await present(film.id));
    }
    if (body.action === "stop") {
      if (!["preparing", "running", "assembling"].includes(film.state)) return json({ error: "This film is not running." }, 409);
      const { error } = await admin.from("character_films").update({ state: "stopped", error: "Stopped. Clips already generating may still be charged; finished clips are saved.", updated_at: new Date().toISOString() }).eq("id", film.id).eq("owner_id", owner);
      if (error) throw error;
      return json(await present(film.id));
    }
    if (body.action === "resume") {
      if (!["stopped", "attention", "billing_paused"].includes(film.state)) return json({ error: "This film does not need resuming." }, 409);
      if(film.preparation?.task)return json({error:"An interrupted preparation request needs reconciliation before resuming. No duplicate request will be sent."},409);
      // Recovery stays inside the original allowance and cannot authorize video.
      const { error } = await admin.from("character_films").update({ state: film.preparation&&film.preparation.phase!=="ready"?"preparing":"running", error: null, updated_at: new Date().toISOString() }).eq("id", film.id).eq("owner_id", owner);
      if (error) throw error;
      kick(film.id);
      return json(await present(film.id));
    }
    if (body.action === "retry_stitch") {
      if (!["attention", "assembling"].includes(film.state)) return json({ error: "No assembly needs retrying." }, 409);
      const chapters = (film.chapters ?? []).map(a => ({ ...a }));
      const target = chapters.find(a => ["failed", "save_failed"].includes(a.state) || (a.state === "checking" && !a.job_id));
      if (!target) return json({ error: "No assembly needs retrying." }, 409);
      if (target.state === "save_failed") target.state = "pending";
      else { target.state = "pending"; delete target.job_id; delete target.output_url; }
      const { error } = await admin.from("character_films").update({ chapters, state: "assembling", error: null, updated_at: new Date().toISOString() }).eq("id", film.id).eq("owner_id", owner);
      if (error) throw error;
      kick(film.id);
      return json(await present(film.id));
    }
    if (body.action === "retake") {
      const { data: shot } = await admin.from("character_film_shots").select().eq("id", body.shot_id).eq("film_id", film.id).maybeSingle();
      if (!shot) return json({ error: "Shot not found." }, 404);
      if (!["ready", "failed", "save_failed"].includes(shot.state)) return json({ error: "This shot is still working." }, 409);
      const { error } = await admin.from("character_film_shots").update({
        state: "pending", request_id: crypto.randomUUID(), animation_id: null, video_path: null, frame_path: null, frame_job_id: null, error: null,
      }).eq("id", shot.id).eq("film_id", film.id);
      if (error) throw error;
      const start = await admin.from("character_films").update({ state: "running", error: null, updated_at: new Date().toISOString() }).eq("id", film.id).eq("owner_id", owner);
      if (start.error) throw start.error;
      kick(film.id);
      return json(await present(film.id));
    }
    if (body.action === "narration") {
      if (film.state !== "draft") return json({ error: "This film has started." }, 409);
      if (!/^[0-9a-f-]{36}\/narration-[a-zA-Z0-9-]+\.(mp3|wav|m4a)$/i.test(body.path)) return json({ error: "Upload your narration first." }, 400);
      const { data: file } = await admin.storage.from("film-media").info(body.path);
      if (!file) return json({ error: "Upload your narration first." }, 400);
      const narration = (film.narration ?? []).filter(n => n.chapter !== body.chapter).concat({ chapter: body.chapter, path: body.path, seconds: body.seconds });
      const { error } = await admin.from("character_films").update({ narration, audio_mode: "uploaded", updated_at: new Date().toISOString() }).eq("id", film.id).eq("owner_id", owner);
      if (error) throw error;
      return json(await present(film.id));
    }
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check the film.";
    return json({ error: message.includes("Permission") || message.includes("row-level") ? "Could not check the film." : message.slice(0, 300) }, 500);
  }
});
