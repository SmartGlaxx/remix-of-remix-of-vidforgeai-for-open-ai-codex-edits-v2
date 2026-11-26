import ShotBoard from "./ShotBoard";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Download, Film, Loader2, Pause, Play, RefreshCw, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { planCharacterFilm } from "../../../supabase/functions/_shared/characterFilmPlan";
import { ESTIMATED_COST, imageError } from "../../../supabase/functions/character-animation/contract";
import { automaticBudget, checkPassed, type Preparation, type SceneRecord, type EventDirection, type FrameCheck } from "../../../supabase/functions/_shared/automaticDirection";

type Shot = { direction?:EventDirection;frame_check?:FrameCheck;board_start_path?:string;board_end_path?:string; id: string; index: number; chapter: number; duration: number; line: string; purpose: string; visual: string; action: string; transition: "cut" | "continue"; state: string; error: string | null; video_path: string | null };
type Chapter = { key: string; indices: number[]; state: string; error?: string };
type Film = { preparation?:Preparation;scenes?:SceneRecord[]; id: string; state: string; seconds: number; script: string; audio_mode: string; image_path: string; estimated_usd: number; final_video_url: string | null; error: string | null; mismatch: boolean; spoken_seconds: number; narration: { chapter: number; path: string; seconds: number }[]; chapters: Chapter[] };
type View = { film: Film; shots: Shot[]; progress: { saved: number; total: number; chapter: number; chapters: number; phase: string } };

const hosts = [
  { id: "studio", name: "Studio presenter", image: "/explainer/studio-host.webp" },
  { id: "ledger", name: "Finance storyteller", image: "/explainer/scene-0.webp" },
] as const;

const presets = [["30 seconds", 30], ["1 minute", 60], ["3 minutes", 180], ["5 minutes", 300], ["10 minutes", 600], ["15 minutes", 900], ["30 minutes", 1800]] as const;
const shotLabels: Record<string, string> = { pending: "Waiting", submitting: "Submitting", checking: "Checking", queued: "Queued", generating: "Generating", saving: "Saving", ready: "Saved", failed: "Failed", save_failed: "Save failed" };

async function call(body: object) {
  const { data, error } = await supabase.functions.invoke("character-film", { body });
  if (error) {
    let message = error.message;
    try { message = (await error.context.json()).error ?? message; } catch { /* Keep the transport message. */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as View;
}

export default function CharacterFilm({simple=false}:{simple?:boolean}={}) {
  const { user } = useAuth();
  return user ? <Builder simple={simple} key={user.id} owner={user.id} /> : null;
}

function Builder({ owner,simple }: { owner: string; simple:boolean }) {
  const [view, setView] = useState<View>();
  const preference = `film-host-${owner}`;
  const [host, setHost] = useState(() => hosts.find(h => h.id === localStorage.getItem(preference)) ?? hosts[0]);
  const [image, setImage] = useState<string>(host.image);
  const [path, setPath] = useState("");
  const [script, setScript] = useState("");
  const [topic, setTopic] = useState("");
  const [seconds, setSeconds] = useState(30);
  const [audioMode, setAudioMode] = useState<"native" | "uploaded">("native");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const narrationInput = useRef<HTMLInputElement>(null);
  const polling = useRef<number>();

  const load = useCallback(async (id: string) => setView(await call({ action: "status", id })), []);

  // A planned film is restored from the backend, so closing or refreshing the tab never loses it.
  useEffect(() => {
    (async () => {
      setBusy("Loading");
      try {
        const filmId = new URLSearchParams(window.location.search).get("film");
        const pending = localStorage.getItem(`film-create-${owner}`);
        const first = await call(filmId ? { action: "status", id: filmId } : pending ? JSON.parse(pending) : { action: "prepare" });
        if(pending&&!filmId)localStorage.removeItem(`film-create-${owner}`);
        setView(first); setScript(first.film.script); setSeconds(first.film.seconds); setAudioMode(first.film.audio_mode as "native" | "uploaded");
        if (first.film.image_path && !first.film.image_path.includes("awaiting-illustration")) {
          setPath(first.film.image_path);
          const { data } = await supabase.storage.from("character-inputs").createSignedUrl(first.film.image_path, 3600);
          if (data?.signedUrl) setImage(data.signedUrl);
        }
      } catch (e) { setError(e instanceof Error ? e.message : "Could not open the film builder."); }
      finally { setBusy(""); }
    })();
    return () => window.clearInterval(polling.current);
  }, []);

  // The worker owns progress; the browser only reads it, so closing the tab cannot stop a render.
  useEffect(() => {
    window.clearInterval(polling.current);
    if (!view || !["preparing", "running", "assembling"].includes(view.film.state)) return;
    polling.current = window.setInterval(() => { void load(view.film.id).catch(e => setError(e instanceof Error ? e.message : "Could not check progress.")); }, 5000);
    return () => window.clearInterval(polling.current);
  }, [view, load]);

  async function upload(file?: File) {
    if (!file) return;
    const invalid = imageError(file.type, file.size);
    if (invalid) { setError(invalid); return; }
    setBusy("Uploading"); setError("");
    try {
      const next = `${owner}/${crypto.randomUUID()}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
      const { error: uploaded } = await supabase.storage.from("character-inputs").upload(next, file, { contentType: file.type });
      if (uploaded) throw uploaded;
      const { data } = await supabase.storage.from("character-inputs").createSignedUrl(next, 3600);
      setPath(next); setImage(data?.signedUrl ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not upload this illustration."); }
    finally { setBusy(""); }
  }

  async function referencePath() {
    if (path) return path;
    const response = await fetch(host.image);
    if (!response.ok) throw new Error("The selected host could not be loaded.");
    const destination = `${owner}/template-${host.id}-v1.webp`;
    const { error } = await supabase.storage.from("character-inputs").upload(destination, await response.blob(), { contentType: "image/webp", upsert: false });
    if (error && String(error.statusCode) !== "409" && error.name !== "Duplicate" && !/already exists/i.test(error.message)) throw error;
    setPath(destination);
    return destination;
  }

  async function writeScript() {
    if (!topic.trim()) return;
    setBusy("Writing"); setError("");
    try {
      const { data, error: failed } = await supabase.functions.invoke("generate-script", { body: { title: topic.trim(), duration: `${Math.round(seconds / 60) || 1} minutes`, tone: "Warm and clear", hook: "Plain opening", language: "English" } });
      if (failed || data?.error) throw new Error(data?.error ?? failed?.message ?? "The writer is unavailable.");
      const text = (data.sections ?? []).map((s: { text: string }) => s.text).join(" ");
      if (!text.trim()) throw new Error("The writer returned no script.");
      setScript(text.trim());
    } catch (e) { setError(e instanceof Error ? e.message : "Could not write a script."); }
    finally { setBusy(""); }
  }

  async function plan() {
    setBusy("Planning"); setError("");
    try {
      const next = await call({ action: "plan", request_id: crypto.randomUUID(), script: script.trim(), seconds, image_path: await referencePath(), audio_mode: audioMode });
      setView(next); setSelected(0);
      let previousBeat="";
      for(const chapter of Array.from(new Set(next.shots.map(item=>item.chapter)))){
        const group=next.shots.filter(item=>item.chapter===chapter);
        setBusy("Directing chapter "+(chapter+1));
        const result=await supabase.functions.invoke("generate-script",{body:{shotLines:group.map(item=>item.line),previousBeat}});
        if(result.error || result.data?.shots?.length!==group.length)throw new Error("Your draft is saved. Chapter "+(chapter+1)+" could not be directed.");
        for(const [index,item] of group.entries()){
          const direction=result.data.shots[index];
          const saved=await call({action:"update_shot",id:item.id,purpose:direction.purpose,visual:direction.visual,direction:direction.action,transition:item.index===0?"cut":direction.transition});
          previousBeat=direction.action;
          setView(saved);
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not plan this film."); }
    finally { setBusy(""); }
  }

  async function buildBoards(){
    if(!view)return;
    setError("");
    try{
      for(const item of view.shots){
        for(const side of ["start","end"] as const){
          if(side==="start"?item.board_start_path:item.board_end_path)continue;
          setBusy("Drawing shot "+(item.index+1)+" of "+view.shots.length);
          const {data,error}=await supabase.functions.invoke("character-film",{body:{action:"board_frame",id:item.id,side}});
          if(error||!data?.path)throw new Error(data?.error||error?.message||"Could not generate frame");
        }
      }
    }catch(e){setError(e instanceof Error?e.message:"Storyboard generation failed");}
    finally{try{await load(view.film.id);}finally{setBusy("");}}
  }

  async function generate() {
    if (!view) return;
    setBusy("Starting"); setError("");
    try { setView(await call({ action: "generate", id: view.film.id })); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not start this film."); }
    finally { setBusy(""); }
  }

  async function createVideo(prepareOnly = false) {
    if(view?.film.preparation?.phase==="ready" && view.film.script===script.trim() && view.film.image_path===path && view.film.seconds===seconds && view.film.audio_mode===audioMode && !topic.trim() && !prepareOnly){await generate();return;}
    setBusy(prepareOnly?"Preparing draft":"Creating video");setError("");
    const key=`film-create-${owner}`;
    try {
      const input={action:"create",script:script.trim(),topic:topic.trim(),seconds,image_path:await referencePath(),audio_mode:audioMode,prepare_only:prepareOnly};
      const pending=localStorage.getItem(key);
      const previous=pending?JSON.parse(pending):null;
      const body=previous&&Object.entries(input).every(([field,value])=>previous[field]===value)?previous:{...input,request_id:crypto.randomUUID()};
      localStorage.setItem(key,JSON.stringify(body));
      const next=await call(body);setView(next);setSelected(0);
      localStorage.removeItem(key);
      const url=new URL(window.location.href);url.searchParams.set("film",next.film.id);window.history.replaceState(null,"",url);
    }catch(e){setError(e instanceof Error?e.message:"Could not create this video. Your request is retained for a safe retry.");}
    finally{setBusy("");}
  }

  async function act(body: object) {
    if (!view) return;
    setBusy("Working"); setError("");
    try { setView(await call(body)); }
    catch (e) { setError(e instanceof Error ? e.message : "That action did not complete."); }
    finally { setBusy(""); }
  }

  async function uploadNarration(file?: File) {
    if (!file || !view) return;
    if (!file.type.startsWith("audio/")) { setError("Choose an audio file."); return; }
    setBusy("Uploading narration"); setError("");
    try {
      const next = `${owner}/narration-${crypto.randomUUID()}.${file.type.includes("wav") ? "wav" : file.type.includes("mp4") ? "m4a" : "mp3"}`;
      const { error: uploaded } = await supabase.storage.from("film-media").upload(next, file, { contentType: file.type });
      if (uploaded) throw uploaded;
      const seconds = await new Promise<number>(resolve => { const audio = new Audio(URL.createObjectURL(file)); audio.onloadedmetadata = () => resolve(Math.max(1, Math.round(audio.duration))); audio.onerror = () => resolve(0); });
      if (!seconds) { setError("Could not read that audio file."); return; }
      setView(await call({ action: "narration", id: view.film.id, chapter: view.shots[selected]?.chapter ?? 0, path: next, seconds }));
      setAudioMode("uploaded");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not upload narration."); }
    finally { setBusy(""); }
  }

  async function download() {
    if (!view?.film.final_video_url) return;
    setDownloading(true); setError("");
    try {
      const response = await fetch(view.film.final_video_url);
      if (!response.ok) throw new Error("Could not download the film.");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob); link.download = `film-${view.film.id}.mp4`; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed."); }
    finally { setDownloading(false); }
  }

  const plan_ = (() => { try { return planCharacterFilm(seconds); } catch { return null; } })();
  const shot = view?.shots[selected];
  const running = view ? ["preparing", "running", "assembling"].includes(view.film.state) : false;
  const draft = view?.film.state === "draft";
  const estimate = plan_ ? plan_.shotCount * ESTIMATED_COST : 0;
  const allowance=automaticBudget(seconds);
  const prepared=view?.film.preparation?.phase==="ready" && view.film.script===script.trim() && view.film.image_path===path && view.film.seconds===seconds && !topic.trim();
  const createEstimate=prepared&&view?view.shots.length*ESTIMATED_COST:allowance.max_video_clips*ESTIMATED_COST;

  if(simple) return <section className="space-y-4">
    <label className="block">Topic<Input value={topic} maxLength={300} disabled={running} onChange={e=>{setTopic(e.target.value);setScript("");}} placeholder="What should the video explain?"/></label>
    <label className="block">Length<select className="block w-full rounded border bg-background p-2" value={seconds} disabled={running} onChange={e=>setSeconds(Number(e.target.value))}>{presets.map(([label,n])=><option key={n} value={n}>{label}</option>)}</select></label>
    <details><summary>Host</summary><select aria-label="Host" disabled={running||!!busy} value={path && !path.includes("/template-")?"custom":hosts.find(h=>path.endsWith("/template-"+h.id+"-v1.webp"))?.id??host.id} onChange={e=>{
      const next=hosts.find(h=>h.id===e.target.value);if(next){setHost(next);setPath("");setImage(next.image);localStorage.setItem(preference,next.id);}
    }}>{path && <option hidden value="custom">Saved film reference</option>}{hosts.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></details>
    <Button disabled={!topic.trim()||running||!!busy} onClick={()=>createVideo()}>Generate video · up to US${createEstimate.toFixed(2)}</Button>
    <p role="status">{busy||view?.film.error||view?.progress.phase}</p>{error&&<p role="alert">{error}</p>}
    {view?.film.final_video_url&&<><video controls src={view.film.final_video_url} className="w-full"/><Button onClick={download}>Download MP4</Button></>}
  </section>;

  return <section aria-label="Create a film" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xl font-semibold">Create a film</h3>
      <span className="text-xs text-muted-foreground">30 seconds to 30 minutes · one finished MP4</span>
    </div>

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(17rem,.8fr)_minmax(0,1.65fr)]">
      <div className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
        <details open className="group"><summary className="cursor-pointer text-sm font-semibold">Film setup</summary><div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="film-topic">Topic</Label>
          <div className="flex gap-2">
            <Input id="film-topic" value={topic} maxLength={300} disabled={!!busy || running} placeholder="Why saving $5 a day changes a year" onChange={e => {setTopic(e.target.value);if(e.target.value.trim())setScript("");}} />
            <Button variant="outline" disabled={!!busy || running || !topic.trim()} onClick={writeScript}><Wand2 className="mr-2 h-4 w-4" />Write</Button>
          </div>
        </div>

        <details><summary className="cursor-pointer text-sm">Customize host</summary>        <div className="space-y-2">
          <label htmlFor="host-template">Host template</label>
          <select id="host-template" className="block w-full rounded border bg-background p-2" disabled={!!busy || running}
            value={path && !hosts.some(h => path === `${owner}/template-${h.id}-v1.webp`) ? "custom" : hosts.find(h => path.endsWith("/template-"+h.id+"-v1.webp"))?.id ?? host.id}
            onChange={event => {
              const chosen = hosts.find(h => h.id === event.target.value);
              if (!chosen) return;
              setHost(chosen); setPath(""); setImage(chosen.image); localStorage.setItem(preference, chosen.id);
            }}>
            {path && <option hidden value="custom">Film reference</option>}
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <input ref={fileInput} id="film-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => void upload(e.target.files?.[0])} />
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-muted">
            {image ? <img src={image} alt="Character illustration" className="max-h-72 w-full object-contain" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
          </div>
          <Button variant="outline" size="sm" disabled={!!busy || running} onClick={() => fileInput.current?.click()}><Upload className="mr-2 h-4 w-4" />{image ? "Replace illustration" : "Upload illustration"}</Button>
        </div>

        </details>
        <div className="space-y-2">
          <Label htmlFor="film-script">Script · {script.trim().split(/\s+/).filter(Boolean).length} words</Label>
          <Textarea id="film-script" rows={6} maxLength={20000} value={script} disabled={!!busy || running} onChange={e => {setScript(e.target.value);if(e.target.value.trim())setTopic("");}} placeholder="Paste a finished script, or write one from a topic." />
        </div>

        <div className="space-y-2">
          <Label>Length</Label>
          <div className="flex flex-wrap gap-2">{presets.map(([label, value]) => <Button key={value} size="sm" variant={seconds === value ? "default" : "outline"} disabled={!!busy || running} onClick={() => setSeconds(value)}>{label}</Button>)}</div>
          <div className="flex items-center gap-2">
            <Label htmlFor="film-custom" className="text-xs text-muted-foreground">Custom seconds</Label>
            <Input id="film-custom" type="number" min={30} max={1800} step={1} value={seconds} disabled={!!busy || running} className="h-8 w-28" onChange={e => setSeconds(Number(e.target.value))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Sound</Label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={audioMode === "native" ? "default" : "outline"} disabled={!!busy || running} onClick={() => setAudioMode("native")}>Native scene audio</Button>
            <Button size="sm" variant={audioMode === "uploaded" ? "default" : "outline"} disabled={!!busy || running} onClick={() => setAudioMode("uploaded")}>Uploaded narration</Button>
          </div>
          {audioMode === "uploaded" && <div className="space-y-2">
            <input ref={narrationInput} id="film-narration" type="file" accept="audio/mpeg,audio/wav,audio/mp4" className="sr-only" onChange={e => void uploadNarration(e.target.files?.[0])} />
            <Button variant="outline" size="sm" disabled={!!busy || running || !view} onClick={() => narrationInput.current?.click()}>Upload narration for chapter {(view?.shots[selected]?.chapter ?? 0) + 1}</Button>
            {!!view?.film.narration?.length && <ul className="space-y-1 text-xs text-muted-foreground">{view.film.narration.map(n => <li key={n.chapter}>Chapter {n.chapter + 1} · {n.seconds}s narration</li>)}</ul>}
          </div>}
        </div>

        </div></details>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Estimated US${estimate.toFixed(2)}</p>
          <p className="text-muted-foreground">{plan_ ? `${plan_.seconds}s runtime · ${plan_.shotCount} clips · ${plan_.chapters.length} chapter${plan_.chapters.length === 1 ? "" : "s"}` : "Choose a length from 30 to 1,800 seconds."}</p>
          <p className="text-xs text-muted-foreground">Automatic video allowance: up to {allowance.max_video_clips} clips · estimated US${(allowance.max_video_clips*ESTIMATED_COST).toFixed(2)}. Estimates are not a billing cap.</p>
          <p className="text-xs text-muted-foreground">Separate charges: medium-quality images (up to {allowance.max_image_calls} requests including corrections), script planning, and Lovable AI continuity checks (up to {allowance.max_check_calls}). Billed by usage; no new music or narration generation. Saved work is reused.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!!busy || running || (!script.trim()&&!topic.trim()) || !plan_ || (!!view?.film.preparation && view.film.state==="attention" && view.film.script===script.trim()) || (view?.film.state==="ready"&&view.film.script===script.trim())} onClick={()=>createVideo()}><Play className="mr-2 h-4 w-4" />Create video · {seconds}s · {prepared?"":"up to "}US${createEstimate.toFixed(2)}</Button>
          {running && view && <Button variant="outline" onClick={() => act({ action: "stop", id: view.film.id })}><Pause className="mr-2 h-4 w-4" />Stop</Button>}
          {view && ["stopped", "attention", "billing_paused"].includes(view.film.state) && <Button variant="outline" onClick={() => act({ action: "resume", id: view.film.id })}><Play className="mr-2 h-4 w-4" />Resume</Button>}
        </div>
        {busy && <p role="status" className="text-sm text-muted-foreground">{busy}…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {view?.film.mismatch && <p role="alert" className="text-sm text-destructive">This script reads as about {view.film.spoken_seconds}s, not {view.film.seconds}s. Shorten the script or change the length before generating.</p>}
      </div>

      <div className="min-w-0 space-y-4">
        <div role="status" className="flex flex-wrap items-center gap-2 text-sm">
          {view ? <><span className={view.film.state === "ready" ? "text-primary" : ""}>{view.progress.phase}</span><span className="text-muted-foreground">Chapter {view.progress.chapter} of {view.progress.chapters} · {view.progress.saved} of {view.progress.total} clips saved</span></> : <span>Opening the film builder…</span>}
        </div>

        {view?.film.final_video_url
          ? <div className="space-y-2">
            <video key={view.film.final_video_url} controls playsInline preload="metadata" src={view.film.final_video_url} className="max-h-96 w-full rounded-lg bg-muted object-contain" aria-label="Finished film" onError={() => setError("The finished film could not play. Try downloading it.")} />
            <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={downloading} onClick={download}><Download className="mr-2 h-4 w-4" />{downloading ? "Downloading…" : "Download film"}</Button><span className="text-xs text-muted-foreground">{view.film.seconds}s · US${Number(view.film.estimated_usd).toFixed(2)} video generation</span></div>
          </div>
          : <div className="grid aspect-video place-items-center overflow-hidden rounded-xl border bg-muted text-muted-foreground">{image?<img src={image} alt="Film reference preview" className="h-full w-full object-contain"/>:<span className="flex items-center gap-2 text-sm"><Film className="h-5 w-5"/>Film preview</span>}</div>}

        {view?.film.error && <p role="alert" className="text-sm text-destructive">{view.film.error}</p>}
        {view && ["attention", "billing_paused"].includes(view.film.state) && <Button variant="outline" onClick={() => act({ action: "retry_stitch", id: view.film.id })}><RefreshCw className="mr-2 h-4 w-4" />Retry assembly from saved clips</Button>}

        <details className="space-y-4"><summary className="cursor-pointer font-semibold">Director details &amp; storyboard</summary>
        <div className="flex flex-wrap gap-2 pt-3">
          <Button variant="outline" disabled={!!busy||running||(!script.trim()&&!topic.trim())||!plan_} onClick={()=>createVideo(true)}><Wand2 className="mr-2 h-4 w-4"/>Prepare draft only</Button>
          <Button variant="outline" disabled={!!busy||running||!script.trim()||!plan_} onClick={plan}><Film className="mr-2 h-4 w-4"/>Plan film manually</Button>
          {draft&&view&&<Button variant="outline" disabled={!!busy} onClick={buildBoards}>Illustrate storyboard</Button>}
          {draft&&view&&!view.film.preparation&&<Button variant="outline" disabled={!!busy||!plan_} onClick={generate}><Play className="mr-2 h-4 w-4"/>Generate film · US${estimate.toFixed(2)}</Button>}
        </div>
        {!!view?.film.scenes?.length&&<div className="space-y-2">{view.film.scenes.map(scene=><div key={scene.id} className="border-b py-2 text-sm"><p className="font-medium">{scene.id}</p><p className="text-muted-foreground">{scene.layout}</p><p>{scene.props.map(prop=>`${prop.id}: ${prop.position} · ${prop.owner}, ${prop.hand}`).join("; ")}</p></div>)}</div>}
        {!!view?.shots.length && <div className="space-y-2">
          <h4 className="font-semibold">Scene outline · {view.shots.length} shots</h4>
          <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">Chapter
              <select className="mt-1 block h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={shot?.chapter ?? 0} onChange={e => setSelected(view.shots.findIndex(s=>s.chapter===Number(e.target.value)))}>
                {Array.from(new Set(view.shots.map(s=>s.chapter))).map(c=><option key={c} value={c}>Chapter {c+1}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Shot
              <select className="mt-1 block h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={selected} onChange={e=>setSelected(Number(e.target.value))}>
                {view.shots.map((s,i)=>s.chapter===shot?.chapter && <option key={s.id} value={i}>Shot {s.index+1} · {s.duration}s · {shotLabels[s.state] ?? s.state}</option>)}
              </select>
            </label>
            <div className="flex justify-between sm:col-span-2"><Button size="sm" variant="ghost" disabled={!selected} onClick={()=>setSelected(selected-1)}>Previous shot</Button><Button size="sm" variant="ghost" disabled={selected>=view.shots.length-1} onClick={()=>setSelected(selected+1)}>Next shot</Button></div>
          </div>
        </div>}

        {shot && <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between"><h4 className="font-semibold">Shot {shot.index + 1}</h4><span className="text-xs text-muted-foreground">{shotLabels[shot.state] ?? shot.state}</span></div>
          <ShotBoard key={shot.id} id={shot.id} start={shot.board_start_path} end={shot.board_end_path} onSaved={async()=>{if(view)await load(view.film.id);}} continuation={shot.transition==="continue"} shared={shot.direction?.continuity==="shared"} enabled={!!draft && !busy}/>
          {shot.direction&&<div className="space-y-1 text-sm"><p><strong>Opening:</strong> {shot.direction.start_pose}</p><p><strong>Ending:</strong> {shot.direction.end_pose}</p><p>{shot.direction.camera}</p><p>{shot.direction.motion_prompt}</p><p className={checkPassed(shot.frame_check)?"text-primary":"text-muted-foreground"}>{checkPassed(shot.frame_check)?"Continuity checked":"Continuity review pending"}</p></div>}
          {draft ? <div className="space-y-2">
            <Label htmlFor="shot-purpose">Purpose</Label>
            <Input id="shot-purpose" value={shot.purpose} maxLength={300} disabled={!!busy} onChange={e => setView(current=>current?{ ...current, shots: current.shots.map((s, i) => i === selected ? { ...s, purpose: e.target.value } : s) }:current)} />
            <Label htmlFor="shot-visual">Visual</Label>
            <Textarea id="shot-visual" rows={2} maxLength={2200} value={shot.visual} disabled={!!busy} onChange={e => setView(current=>current?{ ...current, shots: current.shots.map((s, i) => i === selected ? { ...s, visual: e.target.value } : s) }:current)} />
            <Label htmlFor="shot-action">Physical action</Label>
            <Textarea id="shot-action" rows={2} maxLength={600} value={shot.action} disabled={!!busy} onChange={e => setView(current=>current?{ ...current, shots: current.shots.map((s, i) => i === selected ? { ...s, action: e.target.value } : s) }:current)} />
            <Label htmlFor="shot-line">Line</Label>
            <Textarea id="shot-line" rows={2} maxLength={600} value={shot.line} disabled={!!busy} onChange={e => setView(current=>current?{ ...current, shots: current.shots.map((s, i) => i === selected ? { ...s, line: e.target.value } : s) }:current)} />
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="shot-transition" className="text-xs">Transition</Label>
              <select id="shot-transition" className="h-8 rounded-md border bg-background px-2 text-sm" value={shot.transition} disabled={!!busy} onChange={e => setView(current=>current?{ ...current, shots: current.shots.map((s, i) => i === selected ? { ...s, transition: e.target.value as "cut" | "continue" } : s) }:current)}>
                <option value="cut">Cut to a new scene</option>
                <option value="continue" disabled={shot.index===0}>Continue the action</option>
              </select>
            </div>
            <Button size="sm" disabled={!!busy} onClick={() => act({ action: "update_shot", id: shot.id, line: shot.line, purpose: shot.purpose, visual: shot.visual, direction: shot.action, transition: shot.transition })}><Check className="mr-2 h-4 w-4" />Save direction</Button>
          </div> : <div className="space-y-1 text-sm">
            <p className="font-medium">{shot.purpose}</p><p className="text-muted-foreground">{shot.visual}</p><p>{shot.action}</p><p className="italic">“{shot.line}”</p>
          </div>}
          {shot.error && <p role="alert" className="text-sm text-destructive">{shot.error}</p>}
          {!draft && ["ready", "failed", "save_failed"].includes(shot.state) && <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act({ action: "retake", shot_id: shot.id })}><RefreshCw className="mr-2 h-4 w-4" />Retake this shot · US${ESTIMATED_COST.toFixed(2)}</Button>}
        </div>}
        </details>
      </div>
    </div>
  </section>;
}
