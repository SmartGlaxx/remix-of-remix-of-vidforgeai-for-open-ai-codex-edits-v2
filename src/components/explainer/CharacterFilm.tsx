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

type Shot = { id: string; index: number; chapter: number; duration: number; line: string; purpose: string; visual: string; action: string; transition: "cut" | "continue"; state: string; error: string | null; video_path: string | null };
type Chapter = { key: string; indices: number[]; state: string; error?: string };
type Film = { id: string; state: string; seconds: number; script: string; audio_mode: string; image_path: string; estimated_usd: number; final_video_url: string | null; error: string | null; mismatch: boolean; spoken_seconds: number; narration: { chapter: number; path: string; seconds: number }[]; chapters: Chapter[] };
type View = { film: Film; shots: Shot[]; progress: { saved: number; total: number; chapter: number; chapters: number; phase: string } };

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

export default function CharacterFilm() {
  const { user } = useAuth();
  return user ? <Builder key={user.id} owner={user.id} /> : null;
}

function Builder({ owner }: { owner: string }) {
  const [view, setView] = useState<View>();
  const [image, setImage] = useState("");
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
        const first = await call({ action: "prepare" });
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
    if (!view || !["running", "assembling"].includes(view.film.state)) return;
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
      const next = await call({ action: "plan", request_id: crypto.randomUUID(), script: script.trim(), seconds, image_path: path, audio_mode: audioMode });
      setView(next); setSelected(0);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not plan this film."); }
    finally { setBusy(""); }
  }

  async function generate() {
    if (!view) return;
    setBusy("Starting"); setError("");
    try { setView(await call({ action: "generate", id: view.film.id })); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not start this film."); }
    finally { setBusy(""); }
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
  const running = view ? ["running", "assembling"].includes(view.film.state) : false;
  const draft = view?.film.state === "draft";
  const estimate = plan_ ? plan_.shotCount * ESTIMATED_COST : 0;

  return <section aria-label="Create a film" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xl font-semibold">Create a film</h3>
      <span className="text-xs text-muted-foreground">30 seconds to 30 minutes · one finished MP4</span>
    </div>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="film-image">Character illustration</Label>
          <input ref={fileInput} id="film-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => void upload(e.target.files?.[0])} />
          <div className="flex min-h-48 items-center justify-center rounded-lg border border-border bg-muted">
            {image ? <img src={image} alt="Character illustration" className="max-h-72 w-full object-contain" /> : <Upload className="h-8 w-8 text-muted-foreground" />}
          </div>
          <Button variant="outline" size="sm" disabled={!!busy || running} onClick={() => fileInput.current?.click()}><Upload className="mr-2 h-4 w-4" />{image ? "Replace illustration" : "Upload illustration"}</Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="film-topic">Topic</Label>
          <div className="flex gap-2">
            <Input id="film-topic" value={topic} disabled={!!busy || running} placeholder="Why saving $5 a day changes a year" onChange={e => setTopic(e.target.value)} />
            <Button variant="outline" disabled={!!busy || running || !topic.trim()} onClick={writeScript}><Wand2 className="mr-2 h-4 w-4" />Write</Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="film-script">Script · {script.trim().split(/\s+/).filter(Boolean).length} words</Label>
          <Textarea id="film-script" rows={6} maxLength={20000} value={script} disabled={!!busy || running} onChange={e => setScript(e.target.value)} placeholder="Paste a finished script, or write one from a topic." />
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

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Estimated US${estimate.toFixed(2)}</p>
          <p className="text-muted-foreground">{plan_ ? `${plan_.seconds}s runtime · ${plan_.shotCount} clips · ${plan_.chapters.length} chapter${plan_.chapters.length === 1 ? "" : "s"}` : "Choose a length from 30 to 1,800 seconds."}</p>
          <p className="text-xs text-muted-foreground">Video generation only. Stitching and saving are included; a retake costs US${ESTIMATED_COST.toFixed(2)} and is always your choice.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!!busy || running || !script.trim() || !path || !plan_} onClick={plan}>{busy === "Planning" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />}Plan film</Button>
          <Button disabled={!!busy || running || !view || !draft || !plan_} onClick={generate}><Play className="mr-2 h-4 w-4" />Generate film · US${estimate.toFixed(2)}</Button>
          {running && <Button variant="outline" onClick={() => act({ action: "stop", id: view!.film.id })}><Pause className="mr-2 h-4 w-4" />Stop</Button>}
          {["stopped", "attention", "billing_paused"].includes(view?.film.state ?? "") && <Button variant="outline" onClick={() => act({ action: "resume", id: view!.film.id })}><Play className="mr-2 h-4 w-4" />Resume</Button>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {view?.film.mismatch && <p role="alert" className="text-sm text-destructive">This script reads as about {view.film.spoken_seconds}s, not {view.film.seconds}s. Shorten the script or change the length before generating.</p>}
      </div>

      <div className="min-w-0 space-y-4">
        <div role="status" className="flex flex-wrap items-center gap-2 text-sm">
          {view ? <><span className={view.film.state === "ready" ? "text-primary" : ""}>{view.progress.phase}</span><span className="text-muted-foreground">Chapter {view.progress.chapter} of {view.progress.chapters} · {view.progress.saved} of {view.progress.total} clips saved</span></> : <span>Opening the film builder…</span>}
        </div>

        {view?.film.final_video_url
          ? <div className="space-y-2">
            <video key={view.film.final_video_url} controls playsInline preload="metadata" src={view.film.final_video_url} className="max-h-96 w-full rounded-lg bg-black object-contain" aria-label="Finished film" onError={() => setError("The finished film could not play. Try downloading it.")} />
            <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={downloading} onClick={download}><Download className="mr-2 h-4 w-4" />{downloading ? "Downloading…" : "Download film"}</Button><span className="text-xs text-muted-foreground">{view.film.seconds}s · US${Number(view.film.estimated_usd).toFixed(2)} video generation</span></div>
          </div>
          : <div className="grid aspect-video place-items-center rounded-lg bg-muted text-muted-foreground"><Film className="h-12 w-12" /></div>}

        {view?.film.error && <p role="alert" className="text-sm text-destructive">{view.film.error}</p>}
        {view && ["attention", "billing_paused"].includes(view.film.state) && <Button variant="outline" onClick={() => act({ action: "retry_stitch", id: view.film.id })}><RefreshCw className="mr-2 h-4 w-4" />Retry assembly from saved clips</Button>}

        {!!view?.shots.length && <div className="space-y-2">
          <h4 className="font-semibold">Scene outline · {view.shots.length} shots</h4>
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {view.shots.map((s, i) => <li key={s.id}>
              <button aria-pressed={selected === i} onClick={() => setSelected(i)} className={"w-full rounded-lg border px-3 py-2 text-left text-sm " + (selected === i ? "border-primary" : "")}>
                <span className="flex justify-between gap-2"><span className="font-medium">Shot {s.index + 1} · Chapter {s.chapter + 1} · {s.duration}s</span><span className="shrink-0 text-xs text-muted-foreground">{shotLabels[s.state] ?? s.state}</span></span>
                <span className="mt-1 block text-xs text-muted-foreground">{s.purpose} · {s.transition === "continue" ? "continues the action" : "new scene"}</span>
              </button>
            </li>)}
          </ul>
        </div>}

        {shot && <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between"><h4 className="font-semibold">Shot {shot.index + 1}</h4><span className="text-xs text-muted-foreground">{shotLabels[shot.state] ?? shot.state}</span></div>
          {draft ? <div className="space-y-2">
            <Label htmlFor="shot-purpose">Purpose</Label>
            <Input id="shot-purpose" value={shot.purpose} maxLength={300} disabled={!!busy} onChange={e => setView({ ...view!, shots: view!.shots.map((s, i) => i === selected ? { ...s, purpose: e.target.value } : s) })} />
            <Label htmlFor="shot-visual">Visual</Label>
            <Textarea id="shot-visual" rows={2} maxLength={2200} value={shot.visual} disabled={!!busy} onChange={e => setView({ ...view!, shots: view!.shots.map((s, i) => i === selected ? { ...s, visual: e.target.value } : s) })} />
            <Label htmlFor="shot-action">Physical action</Label>
            <Textarea id="shot-action" rows={2} maxLength={600} value={shot.action} disabled={!!busy} onChange={e => setView({ ...view!, shots: view!.shots.map((s, i) => i === selected ? { ...s, action: e.target.value } : s) })} />
            <Label htmlFor="shot-line">Line</Label>
            <Textarea id="shot-line" rows={2} maxLength={600} value={shot.line} disabled={!!busy} onChange={e => setView({ ...view!, shots: view!.shots.map((s, i) => i === selected ? { ...s, line: e.target.value } : s) })} />
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="shot-transition" className="text-xs">Transition</Label>
              <select id="shot-transition" className="h-8 rounded-md border bg-background px-2 text-sm" value={shot.transition} disabled={!!busy} onChange={e => setView({ ...view!, shots: view!.shots.map((s, i) => i === selected ? { ...s, transition: e.target.value as "cut" | "continue" } : s) })}>
                <option value="cut">Cut to a new scene</option>
                <option value="continue">Continue the action</option>
              </select>
            </div>
            <Button size="sm" disabled={!!busy} onClick={() => act({ action: "update_shot", id: shot.id, line: shot.line, purpose: shot.purpose, visual: shot.visual, direction: shot.action, transition: shot.transition })}><Check className="mr-2 h-4 w-4" />Save direction</Button>
          </div> : <div className="space-y-1 text-sm">
            <p className="font-medium">{shot.purpose}</p><p className="text-muted-foreground">{shot.visual}</p><p>{shot.action}</p><p className="italic">“{shot.line}”</p>
          </div>}
          {shot.error && <p role="alert" className="text-sm text-destructive">{shot.error}</p>}
          {!draft && ["ready", "failed", "save_failed"].includes(shot.state) && <Button variant="outline" size="sm" disabled={!!busy} onClick={() => act({ action: "retake", shot_id: shot.id })}><RefreshCw className="mr-2 h-4 w-4" />Retake this shot · US${ESTIMATED_COST.toFixed(2)}</Button>}
        </div>}
      </div>
    </div>
  </section>;
}
