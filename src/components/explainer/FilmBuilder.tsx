import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { renderFilm, type FilmScene } from "./renderFilm";

const sceneSchema = z.object({
  line: z.string().trim().min(1).max(600), prompt: z.string().trim().min(1).max(2200),
  label: z.string().trim().min(1).max(100),
  diagram: z.object({kind:z.enum(["flow","comparison","sequence"]), labels:z.array(z.string().min(1).max(32)).length(3)}).optional(),
  image: z.string().url().optional(),
  audio: z.string().url().optional(), job_id: z.string().optional(), endpoint_id: z.string().optional(),
});
const draftSchema = z.object({brief: z.string(), scenes: z.array(sceneSchema).length(6)});
type Draft = {brief: string; scenes: FilmScene[]};

function load(key: string): Draft {
  try { return draftSchema.parse(JSON.parse(localStorage.getItem(key) || "")) as Draft; }
  catch { return {brief: "", scenes: []}; }
}

async function invoke(name: string, body: Record<string, unknown>, signal: AbortSignal) {
  signal.throwIfAborted();
  const {data, error} = await supabase.functions.invoke(name, {body, signal});
  signal.throwIfAborted();
  if (error || data?.error) throw new Error(data?.error || error.message);
  return data;
}

export default function FilmBuilder() {
  const { user } = useAuth();
  return user ? <Builder key={user.id} storageKey={"genvast.film." + user.id}/> : null;
}

function Builder({storageKey}: {storageKey: string}) {
  const [draft, setDraft] = useState(() => load(storageKey));
  const [brief, setBrief] = useState(draft.brief);
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
      if (render) {
        setStatus("Rendering. Keep this tab visible for one minute.");
        const blob = await renderFilm(draft.scenes, sec => setStatus("Rendering " + sec + " / 60 seconds. Keep this tab visible."), signal);
        setResult({url: URL.createObjectURL(blob), ext: blob.type.includes("mp4") ? "mp4" : "webm"});
        setStatus("Your film is ready.");
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
        const plan = await invoke("generate-script", {title: brief.slice(0, 300), explainerBrief: brief.trim()}, signal);
        film.scenes = z.array(sceneSchema.pick({line:true, prompt:true, label:true, diagram:true})).length(6).parse(plan.scenes) as FilmScene[];
        film.brief = brief.trim();
        setResult(undefined);
        save();
      }
      for (const [i, scene] of film.scenes.entries()) {
        if (!scene.image) {
          setStatus("Illustrating scene " + (i+1) + " of 6…");
          const image = await invoke("generate-visual", {index:i, use_prompt_as_is:true, prompt:"Layered paper-cutout illustration. " + scene.prompt}, signal);
          scene.image = z.string().url().parse(image.image_url);
          save();
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
      setStatus("All six scenes are ready to render.");
    } catch (error) {
      if (!signal.aborted) setStatus(error instanceof Error ? error.message : "Generation failed. Try again.");
    } finally { task.current = undefined; setBusy(false); }
  }

  const ready = draft.brief === brief.trim() && draft.scenes.length === 6 && draft.scenes.every(s => s.image && s.audio);
  return <section className="workspace-card space-y-4">
    <h2 className="text-2xl font-semibold">Create a one-minute explainer</h2>
    <label htmlFor="film-brief">Video brief</label>
    <Textarea id="film-brief" placeholder="Explain how rental income becomes monthly cash flow…" value={brief} disabled={busy} maxLength={5000} onChange={e => setBrief(e.target.value)}/>
    <Button disabled={busy || !brief.trim()} onClick={() => run(ready)}>{ready ? "Render video" : draft.brief === brief.trim() && draft.scenes.length ? "Resume generation" : "Generate film"}</Button>
    <p role="status">{status}</p>
    {result && <><video src={result.url} controls playsInline className="w-full rounded-xl"/><a className="underline" href={result.url} download={"explainer."+result.ext}>Download video</a></>}
  </section>;
}
