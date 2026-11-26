import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { renderFilm, type FilmScene } from "./renderFilm";

import { artDirections, type StoryFormat } from "./sceneStyles";

const sceneSchema = z.object({
  line: z.string().trim().min(1).max(600), prompt: z.string().trim().min(1).max(2200),
  label: z.string().trim().min(1).max(100),
  diagram: z.object({kind:z.enum(["flow","comparison","sequence"]), labels:z.array(z.string().min(1).max(32)).length(3)}).optional(),
  endPrompt: z.string().optional(), transitionText: z.string().optional(), endImage:z.string().url().optional(),
  image: z.string().url().optional(),
  audio: z.string().url().optional(), job_id: z.string().optional(), endpoint_id: z.string().optional(),
});
const draftSchema = z.object({brief: z.string(), scenes: z.array(sceneSchema).length(6)});
const scenePlanSchema = z.object({
  scenes: z.array(sceneSchema.pick({line: true, prompt: true, label: true, diagram: true,endPrompt:true,transitionText:true})).length(6),
});
const plannerDeploymentError = "The deployed script function needs the Explainer update. Deploy generate-script from the latest main branch, then retry.";
type Draft = {brief: string; scenes: FilmScene[]};

function load(key: string): Draft {
  try { return draftSchema.parse(JSON.parse(localStorage.getItem(key) || "")) as Draft; }
  catch { return {brief: "", scenes: []}; }
}

async function invoke(name: string, body: Record<string, unknown>, signal: AbortSignal) {
  signal.throwIfAborted();
  const {data, error} = await supabase.functions.invoke(name, {body, signal});
  signal.throwIfAborted();
  if (error || data?.error) {
    const payload = await error?.context?.json?.().catch(() => null);
    const message = data?.error || payload?.error || error?.message || "Request failed.";
    if (name === "generate-script" && message === "Missing title") {
      throw new Error(plannerDeploymentError);
    }
    throw new Error(message);
  }
  return data;
}

type FormatChoice = StoryFormat | "auto";

function selectFormat(topic: string): StoryFormat {
  return /\b(chart|compare|comparison|compound|interest|percent|percentage|budget|formula|calculate|calculation|step.by.step|diagram|cycle)\b/i.test(topic)
    ? "whiteboard" : "illustrated";
}

export default function FilmBuilder({format="illustrated"}: {format?:FormatChoice}) {
  const { user } = useAuth();
  return user ? <Builder format={format} key={user.id+format} storageKey={"genvast.film." + user.id + (format==="illustrated"?"":"."+format)}/> : null;
}

function Builder({storageKey,format: choice}: {storageKey: string;format:FormatChoice}) {
  const [selected,setSelected]=useState(0);
  const [draft, setDraft] = useState(() => load(storageKey));
  const [brief, setBrief] = useState(draft.brief);
  const automatic = choice === "auto";
  const format = automatic ? selectFormat(brief) : choice;
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{url: string; ext: string}>();
  const task = useRef<AbortController>();
  useEffect(() => () => task.current?.abort(), []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  async function run(render: boolean) {
    if (task.current) return;
    const controller = new AbortController();
    task.current = controller;
    const signal = controller.signal;
    setBusy(true);
    try {
      async function finish(scenes: FilmScene[]) {
        setStatus("Rendering. Keep this tab visible for one minute.");
        const blob = await renderFilm(scenes, sec => setStatus("Rendering " + sec + " / 60 seconds. Keep this tab visible."), signal, format);
        signal.throwIfAborted();
        setResult({url: URL.createObjectURL(blob), ext: blob.type.includes("mp4") ? "mp4" : "webm"});
        setStatus("Your film is ready.");
      }
      if (render) {
        await finish(draft.scenes);
        return;
      }
      const film = structuredClone(draft);
      function save() {
        signal.throwIfAborted();
        setDraft(structuredClone(film));
        localStorage.setItem(storageKey, JSON.stringify(film));
      }
      if (film.brief !== brief.trim() || !film.scenes.length) {
        setStatus("Planning six scenes…");
        const response = await invoke("generate-script", {explainerBrief: brief.trim(), ...(format==="illustrated"?{}:{format})}, signal);
        if (Array.isArray(response?.sections) && !response?.scenes) {
          throw new Error(plannerDeploymentError);
        }
        const plan = scenePlanSchema.safeParse(response);
        if (!plan.success) throw new Error("The planner returned an incomplete scene list. Click Generate film to try again.");
        film.scenes = plan.data.scenes as FilmScene[];
        film.brief = brief.trim();
        setResult(undefined);
        save();
      }
      for (const [i, scene] of film.scenes.entries()) {
        if (!scene.image) {
          setStatus("Illustrating scene " + (i+1) + " of 6…");
          const image = await invoke("generate-visual", {index:i, use_prompt_as_is:true, aspect_ratio:"16:9", prompt:artDirections[format]+" "+scene.prompt}, signal);
          scene.image = z.string().url().parse(image.image_url);
          save();
        }
        if(format!=="whiteboard" && scene.endPrompt && !scene.endImage){
          setStatus("Illustrating the ending of scene " + (i+1) + "…");
          const end=await invoke("generate-visual",{index:i,use_prompt_as_is:true,aspect_ratio:"16:9",prompt:(artDirections[format]+" Same scene and cast. Opening: "+scene.prompt+" Ending: "+scene.endPrompt).slice(0,2500)},signal);
          scene.endImage=z.string().url().parse(end.image_url); save();
        }
        for (let poll = 0; !scene.audio; poll++) {
          if (poll >= 12) throw new Error("Voice generation is still queued. Resume to check again.");
          setStatus("Narrating scene " + (i+1) + " of 6…");
          const speech = await invoke("generate-speech", {text:scene.line, voice:"af_heart", job_id:scene.job_id, endpoint_id:scene.endpoint_id}, signal);
          if (speech.status === "processing" && speech.job_id) {
            scene.job_id = speech.job_id;
            scene.endpoint_id = speech.endpoint_id;
          } else {
            scene.audio = z.string().url().parse(speech.audio_url);
            delete scene.job_id;
          }
          save();
        }
      }
      if (automatic) await finish(film.scenes);
      else setStatus("All six scenes are ready to render.");
    } catch (error) {
      if (!signal.aborted) setStatus(error instanceof Error ? error.message : "Generation failed. Try again.");
    } finally { task.current = undefined; setBusy(false); }
  }

  const ready = draft.brief === brief.trim() && draft.scenes.length === 6 && draft.scenes.every(s => s.image && s.audio && (format==="whiteboard" || !s.endPrompt || s.endImage));
  return <section className="workspace-card space-y-4">
    <h2 className="text-2xl font-semibold">Create a one-minute explainer</h2>
    <label htmlFor="film-brief">{automatic ? "What should your video explain?" : "Video brief"}</label>
    <Textarea id="film-brief" placeholder="Explain how rental income becomes monthly cash flow…" value={brief} disabled={busy} maxLength={5000} onChange={e => setBrief(e.target.value)}/>
    {automatic && <p className="text-sm text-muted-foreground">{brief.trim() ? (format === "whiteboard" ? "Whiteboard / Hand Reveal" : "Illustrated Stories") + " · " : ""}1 minute · 6 narrated scenes. Generation uses your connected services. Keep this tab open through export.</p>}
    <Button disabled={busy || !brief.trim()} onClick={() => run(ready)}>{automatic ? (busy ? "Creating explainer…" : ready ? "Export again" : draft.brief === brief.trim() && draft.scenes.length ? "Resume explainer" : "Create explainer") : ready ? "Render video" : draft.brief === brief.trim() && draft.scenes.length ? "Resume generation" : "Generate film"}</Button>
    <p role="status">{status}</p>
    {!!draft.scenes.length && <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
      <div className="space-y-2"><label className="text-sm">Storyboard scene <select className="rounded border bg-background px-2 py-1" value={selected} onChange={e=>setSelected(Number(e.target.value))}>{draft.scenes.map((s,i)=><option key={i} value={i}>{i+1} · {s.label}</option>)}</select></label>
      <p className="text-sm">{draft.scenes[selected].line}</p><p className="text-xs text-muted-foreground">{draft.scenes[selected].transitionText}</p></div>
      <div className="flex gap-2">{[draft.scenes[selected].image,draft.scenes[selected].endImage].map((url,i)=>url && <figure key={i} className="min-w-0 flex-1"><img className="aspect-video w-full rounded-md object-cover" src={url} alt={i?"Ending illustration":"Scene illustration"}/><figcaption className="text-xs text-muted-foreground">{i?"End frame":format==="whiteboard"?"Drawing":"Start frame"}</figcaption></figure>)}</div>
    </section>}
    {result && <><video src={result.url} controls playsInline className="w-full rounded-xl"/><a className="underline" href={result.url} download={"explainer."+result.ext}>Download video</a></>}
  </section>;
}
