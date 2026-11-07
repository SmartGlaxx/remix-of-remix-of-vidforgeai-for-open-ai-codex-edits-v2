import PlaybackControls from "./PlaybackControls";
import WorkspaceLink from "./WorkspaceLink";
import { useEffect, useRef, useState } from "react";
import { Clapperboard, Loader2, AlertCircle, Link, Image, X, Check, RotateCcw, ThumbsDown, Film, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject, useDraftField, type StudioShot, type StudioTake, type QCStatus } from "@/contexts/ProjectContext";
import {
  activeTake, approveTake, firstFrameIgnored, isValidFrameUrl,
  rejectTake, takeCost, validateFrameUrl,
} from "./studioClipUtils";
import StudioClipPlayer from "./StudioClipPlayer";
import StudioSequencePanel from "./StudioSequencePanel";

type ShotFailure = Error & { jobId?: string; generationSeconds?: number };

// Worst measured cold first clip ≈ 13 min (285s queue + 491s gen). Size for 14.
export const COLD_START_BUDGET_MS = 14 * 60 * 1000;
const POLL_MS = 5000;

type Tier = "primary" | "backup";
const CAMERA = ["static", "slow push in", "pan left", "pan right", "orbit", "dolly out", "handheld"];
const QC_LABEL: Record<QCStatus, string> = { passed: "passed", needs_review: "needs review", failed: "failed" };

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const usd = (n: number) => `$${n.toFixed(4)}`;
const newSeed = () => Math.floor(Math.random() * 2_147_483_647);

/** The exact 9-field payload sent to the engine — identical on failover. */
const payloadFor = (shot: StudioShot, seed: number) => ({
  prompt: shot.prompt, dialogue: shot.dialogue, first_frame_url: shot.firstFrame, last_frame_url: shot.lastFrame,
  seed, resolution: shot.resolution, aspect_ratio: shot.aspectRatio, camera_motion: shot.cameraMotion,
  duration_seconds: shot.durationSeconds,
});

const StudioClipPanel = ({ includeSequence = true, requestedShotId, visible = true }: { includeSequence?: boolean; requestedShotId?: string | null; visible?: boolean }) => {
  const { visualScenes, studioClips: shots, setStudioClips: setShots,
    studioDraft, setStudioDraft, poolRate: rate, setStudioBusy, sequenceBusy } = useProject();
  const storyboardImages = visualScenes.map((s) => s.imageUrl).filter((u): u is string => !!u);
  const [startFrame, setStartFrame] = useDraftField(studioDraft, setStudioDraft, "startFrame");
  const [endFrame, setEndFrame] = useDraftField(studioDraft, setStudioDraft, "endFrame");
  const [warning, setWarning] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useDraftField(studioDraft, setStudioDraft, "prompt");
  const [dialogue, setDialogue] = useDraftField(studioDraft, setStudioDraft, "dialogue");
  const [duration, setDuration] = useDraftField(studioDraft, setStudioDraft, "duration");
  const [resolution, setResolution] = useDraftField(studioDraft, setStudioDraft, "resolution");
  const [aspect, setAspect] = useDraftField(studioDraft, setStudioDraft, "aspect");
  const [camera, setCamera] = useDraftField(studioDraft, setStudioDraft, "camera");
  const [tier, setTier] = useState<Tier>("primary");

  const [selectedShot, setSelectedShot] = useState(0);
  useEffect(() => { if (requestedShotId) { const index = shots.findIndex((shot) => shot.id === requestedShotId); if (index >= 0) setSelectedShot(index); } }, [requestedShotId, shots.length]);
  const [previewTakes, setPreviewTakes] = useState<Record<string, number>>({});
  const previousShotCount = useRef(shots.length);
  useEffect(() => {
    if (shots.length > previousShotCount.current) setSelectedShot(shots.length - 1);
    previousShotCount.current = shots.length;
  }, [shots.length]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef(false);
  const busy = running || sequenceBusy;
  useEffect(() => { setStudioBusy(running); return () => setStudioBusy(false); }, [running, setStudioBusy]);
  const framesValid = isValidFrameUrl(startFrame) && isValidFrameUrl(endFrame);
  const canGenerate = !busy && !!prompt.trim() && framesValid;
  const previousEnd = shots.at(-1)?.lastFrame;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => () => { cancel.current = true; }, []);

  const elapsed = running ? now - startedAt : 0;
  const pct = Math.min(97, (elapsed / COLD_START_BUDGET_MS) * 100);

  /** Render one take of a shot (primary with auto-failover, or manual backup) and append it. */
  const renderTake = async (shot: StudioShot, useTier: Tier, isNew: boolean) => {
    cancel.current = false;
    setTier(useTier); setRunning(true); setError(null); setWarning(null);
    setStartedAt(Date.now()); setNow(Date.now()); setPhase("Sending to the video engine…");
    const seed = newSeed();
    const payload = payloadFor(shot, seed);
    const append = (take: StudioTake) => setShots((prev) => {
      const list = isNew ? [...prev, { ...shot, takes: [] }] : [...prev];
      const index = list.findIndex((s) => s.id === shot.id);
      const target = list[index];
      const takes = [...target.takes, take];
      const keepApproved = activeTake(target)?.status === "passed";
      list[index] = { ...target, takes, activeTakeIndex: keepApproved ? target.activeTakeIndex : takes.length - 1 };
      return list;
    });
    let failedPrimary: ShotFailure | undefined;
    try {
      let result: StudioTake;
      try {
        result = await renderOn(useTier, payload);
      } catch (e) {
        // Auto-failover fires only when the primary fails or is unavailable.
        if (useTier !== "primary" || cancel.current) throw e;
        failedPrimary = e as ShotFailure;
        setTier("backup");
        setPhase("Main engine unavailable — retrying this shot on the backup engine…");
        toast({ title: "Switching to backup engine", description: failedPrimary.message });
        result = await renderOn("backup", payload);
        result.failover = { primaryJobId: failedPrimary.jobId, primaryError: failedPrimary.message, backupJobId: result.jobId ?? "not started", at: Date.now() };
        result.generationSeconds = (result.generationSeconds ?? 0) + (failedPrimary.generationSeconds ?? 0);
      }
      if (cancel.current) return;
      append({ ...result, seed });
      toast({ title: "Take ready — review it", description: `Made with ${result.tier === "primary" ? "LTX-2.5" : "LTX-2.3"}` });
    } catch (e) {
      if (cancel.current) return;
      const f = e as ShotFailure;
      setError(f.message);
      // A job that started is billed: record it as a failed take so its cost and job ID stay visible.
      if (f.jobId || failedPrimary?.jobId) {
        append({
          videoUrl: null, lastFrame: null, tier: failedPrimary ? "backup" : useTier, saved: false,
          jobId: f.jobId ?? failedPrimary?.jobId, status: "failed", error: f.message, seed, createdAt: Date.now(),
          generationSeconds: (f.generationSeconds ?? 0) + (failedPrimary?.generationSeconds ?? 0),
          ...(failedPrimary ? { failover: { primaryJobId: failedPrimary.jobId, primaryError: failedPrimary.message, backupJobId: f.jobId ?? "not started", at: Date.now() } } : {}),
        });
      }
    } finally {
      setRunning(false);
    }
  };

  const generate = (useTier: Tier) => {
    if (!canGenerate) return;
    let first: string | undefined, last: string | undefined;
    try {
      first = validateFrameUrl(startFrame, "Start frame");
      last = validateFrameUrl(endFrame, "End frame");
    } catch (e) {
      return toast({ title: (e as Error).message, variant: "destructive" });
    }
    if (!first || !last) return;
    const shot: StudioShot = {
      id: crypto.randomUUID(), prompt: prompt.trim(), dialogue: dialogue.trim() || undefined,
      firstFrame: first, lastFrame: last, durationSeconds: duration, resolution, aspectRatio: aspect,
      cameraMotion: camera === "static" ? undefined : camera, activeTakeIndex: 0, takes: [],
    };
    return renderTake(shot, useTier, true);
  };

  const retake = (index: number) => { if (!busy) renderTake(shots[index], "primary", false); };

  const renderOn = async (useTier: Tier, payload: Record<string, unknown>): Promise<StudioTake> => {
    let jobId: string | undefined;
    let generationSeconds: number | undefined;
    const fail = (message: string): never => { throw Object.assign(new Error(message), { jobId, generationSeconds }); };
    let data: { job_id?: string; error?: string } | null = null;
    try {
      const res = await supabase.functions.invoke("studio-clip", { body: { action: "submit", tier: useTier, ...payload } });
      if (res.error || !res.data?.job_id) fail(res.error?.message || res.data?.error || "Could not start the clip");
      data = res.data;
    } catch (e) { fail((e as Error).message || "Video engine unavailable"); }
    jobId = data?.job_id;
    if (!jobId) fail("Could not start the clip");
    const start = Date.now();
    while (!cancel.current) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (cancel.current) break;
      const { data: s, error: se } = await supabase.functions.invoke("studio-clip", {
        body: { action: "status", tier: useTier, job_id: jobId },
      });
      if (cancel.current) break;
      if (se) continue;
      // Worker execution time only (queue time excluded) drives cost.
      if (typeof s?.executionTime === "number") generationSeconds = s.executionTime / 1000;
      if (firstFrameIgnored(s)) {
        setWarning("The worker reported first_frame_url ignored. This shot may not match your start frame; flag this to Muse.");
      }
      if (s?.status === "IN_QUEUE") setPhase(useTier === "backup" ? "Waiting for the backup engine (one shot at a time)…" : "Waking up the GPU (first clip can take up to ~14 min)…");
      else if (s?.status === "IN_PROGRESS") setPhase("Rendering video + sound…");
      else if (s?.status === "COMPLETED") {
        const out = s.output?.output ?? s.output;
        if (!out?.video_url) fail("Finished but no video came back");
        setPhase("Saving your clip to app storage…");
        let videoUrl = out.video_url;
        let saved = false;
        try {
          const { data: hosted, error: hostingError } = await supabase.functions.invoke("rehost-video", {
            body: { url: out.video_url, label: `studio-${jobId}` },
          });
          if (!hostingError && hosted?.rehosted === true && typeof hosted.url === "string") {
            const hostedUrl = validateFrameUrl(hosted.url, "Saved video");
            if (hostedUrl) { videoUrl = hostedUrl; saved = true; }
          }
        } catch {
          // Keep the completed shot even if storage is temporarily unavailable.
        }
        return {
          videoUrl, lastFrame: out.last_frame_url ?? (payload.last_frame_url as string), tier: useTier, saved, jobId,
          status: "needs_review", generationSeconds, seed: payload.seed as number, createdAt: Date.now(),
        };
      } else if (s?.status === "FAILED" || s?.status === "CANCELLED" || s?.status === "TIMED_OUT") {
        fail(typeof s?.error === "string" ? s.error : `Job ${s.status.toLowerCase()}`);
      }
      if (Date.now() - start > COLD_START_BUDGET_MS + 6 * 60 * 1000) fail("Took far longer than expected");
    }
    return null as never;
  };

  const selectShot = (index: number) => {
    setSelectedShot(index);
    const shot = shots[index];
    if (shot && !running) setStudioDraft((draft) => ({ ...draft, prompt: shot.prompt, dialogue: shot.dialogue || "", startFrame: shot.firstFrame, endFrame: shot.lastFrame, duration: shot.durationSeconds, resolution: shot.resolution, aspect: shot.aspectRatio, camera: shot.cameraMotion || "static" }));
  };

  const chainNext = () => {
    // Next shot's start IS this shot's end — same asset, no render wait. Keep the scene prompt, new line only.
    setStartFrame(endFrame); setEndFrame(""); setDialogue(""); setTier("primary");
    promptRef.current?.focus();
  };


  const frameField = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">{label} (required)</label>
      <div className="flex items-center gap-2">
        <Input id={id} type="url" value={value} disabled={running} onChange={(e) => set(e.target.value)}
          placeholder="https://…" aria-invalid={!!value && !isValidFrameUrl(value)} />
        {value && <Button variant="ghost" size="icon" disabled={running} aria-label={`Clear ${label.toLowerCase()}`} onClick={() => set("")}><X className="w-4 h-4" /></Button>}
      </div>
      {value && !isValidFrameUrl(value) && <p className="text-xs text-destructive">{label} must be a public HTTPS image URL.</p>}
    </div>
  );

  return (
    <div className="director-editing-layout">
      <div className="director-workspace-grid">
      <aside className="director-library" aria-label="Shot library">
        <div className="library-tabs"><span className="is-active">Shots</span><WorkspaceLink href="/dashboard/assets">Assets</WorkspaceLink><WorkspaceLink href="/dashboard/shot-lab">Approved</WorkspaceLink></div>
        <div className="library-heading"><h2>Shot library <span>({shots.length})</span></h2><button onClick={() => { setSelectedShot(-1); promptRef.current?.focus(); }} aria-label="New shot"><Plus size={18} /></button></div>
        <div className="library-shots">
          {shots.map((shot, index) => <button type="button" key={shot.id} className={`library-shot ${selectedShot === index ? "is-selected" : ""}`} onClick={() => selectShot(index)}>
            <div className="library-shot-image"><img src={shot.firstFrame} alt={`Shot ${index + 1}`} /><span>{shot.durationSeconds}.0 s</span>{activeTake(shot)?.status === "passed" && <Check className="shot-check" size={22} />}</div>
            <div className="library-shot-copy"><strong>Shot {String(index + 1).padStart(2, "0")}</strong><span>{shot.takes.length} takes</span><p>{shot.cameraMotion || "Static"} · {shot.resolution}</p></div>
          </button>)}
          {!shots.length && <div className="library-empty"><div className="empty-thumbnail"><Film size={32} strokeWidth={1} /></div><h3>Your first shot starts here</h3><p>Add both storyboard frames and describe the shot to generate your first take.</p><WorkspaceLink href="/dashboard/storyboard">Open Storyboard →</WorkspaceLink></div>}
        </div>
      </aside>
      <section className="director-monitor" aria-label="Shot preview">
        {(!shots.length || selectedShot === -1) && <div className="draft-preview">
          <div className="preview-title"><span>New shot</span><span>{resolution} · {aspect}</span></div>
          <div className="director-player"><div className="draft-viewport">{isValidFrameUrl(startFrame) ? <img src={startFrame} alt="Start frame preview" /> : <div className="preview-placeholder"><h2>Your story, in motion</h2><p>Choose a start and end frame to bring your next shot to life.</p></div>}</div><PlaybackControls /></div>
          <div className="draft-frame-pair">{[["Start frame", startFrame], ["End frame", endFrame]].map(([label, url]) => <div key={label}>{isValidFrameUrl(url) ? <img src={url} alt={label} /> : <Image size={18} />}<span>{label}<small>{isValidFrameUrl(url) ? "Ready" : "Required"}</small></span></div>)}</div>
          <div className="empty-takes"><Film size={18} /><span>Generated takes will appear here for review.</span></div>
        </div>}

      {shots.map((shot, index) => {
        const active = activeTake(shot);
        const shotCost = shot.takes.reduce((sum, k) => sum + takeCost(k.generationSeconds, rate), 0);
        return (
          <section key={shot.id} aria-label={`Shot ${index + 1} card`} hidden={index !== selectedShot} className="director-preview-shot space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium">Shot {index + 1} · {shot.takes.length} take{shot.takes.length === 1 ? "" : "s"} · {usd(shotCost)}</h4>
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm"><WorkspaceLink href={`/dashboard/shot-lab?shot=${encodeURIComponent(shot.id)}`}>Review it in Shot Lab <Link className="ml-1 h-4 w-4" /></WorkspaceLink></Button>
                {active && <Badge variant={active.status === "passed" ? "default" : active.status === "failed" ? "destructive" : "secondary"}
                  aria-label={`Shot ${index + 1} QC`}>{QC_LABEL[active.status]}</Badge>}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => retake(index)}><RotateCcw className="w-4 h-4" /> Retake (new seed)</Button>
              </div>
            </div>
            <div className="preview-take-stack">
              {shot.takes.map((take, t) => (
                <div key={`${take.jobId}-${t}`} hidden={t !== (previewTakes[shot.id] ?? shot.takes.length - 1)} className="preview-take space-y-3">
                  {take.videoUrl
                    ? <StudioClipPlayer director active={visible && selectedShot === index && t === (previewTakes[shot.id] ?? shot.takes.length - 1)} videoUrl={take.videoUrl} poster={shot.firstFrame} shot={index + 1} take={t + 1} saved={take.saved} />
                    : <p className="text-xs text-destructive">No video — {take.error ?? "generation failed"}</p>}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">Take {t + 1}{t === shot.activeTakeIndex && take.status === "passed" ? " · selected for cut" : ""}</span>
                    <Badge variant="outline">{take.tier === "primary" ? "LTX-2.5" : "LTX-2.3"}{take.failover ? " · auto-backup" : ""}</Badge>
                    <Badge variant={take.status === "passed" ? "default" : take.status === "failed" ? "destructive" : "secondary"}>{take.rejected ? "rejected" : QC_LABEL[take.status]}</Badge>
                  </div>
                  {take.failover && <p className="text-xs text-muted-foreground">Main engine failed (job {take.failover.primaryJobId ?? "not started"}: {take.failover.primaryError}). Rendered on backup, job {take.failover.backupJobId}.</p>}
                  <p className="text-xs text-muted-foreground">
                    Job {take.jobId ?? "—"} · seed {take.seed} · {take.generationSeconds != null ? `${take.generationSeconds.toFixed(1)}s GPU` : "GPU time n/a"} · {usd(takeCost(take.generationSeconds, rate))}
                  </p>
                  {take.videoUrl && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={busy || take.status === "passed"} onClick={() => setShots((s) => approveTake(s, index, t))}><Check className="w-4 h-4" /> Approve take {t + 1}</Button>
                      <Button size="sm" variant="outline" disabled={busy || take.status !== "needs_review"} onClick={() => setShots((s) => rejectTake(s, index, t))}><ThumbsDown className="w-4 h-4" /> Reject take {t + 1}</Button>
                      {take.lastFrame && <Button asChild variant="ghost" size="sm"><a href={take.lastFrame} target="_blank" rel="noreferrer">View last frame</a></Button>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="director-take-strip" aria-label={`Shot ${index + 1} takes`}>
              {shot.takes.map((take, t) => <button key={t} type="button" aria-pressed={t === (previewTakes[shot.id] ?? shot.takes.length - 1)} onClick={() => setPreviewTakes((prev) => ({ ...prev, [shot.id]: t }))} className="director-take-thumb">
                <img src={shot.firstFrame} alt="" /><span>Take {t + 1}{take.status === "passed" ? " ✓" : ""}</span>
              </button>)}
            </div>
          </section>
        );
      })}

      </section>
      <section className="director-inspector" aria-label="Shot prompt">
      <div className="inspector-heading flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Prompt</h3>
          <p className="text-xs text-muted-foreground">LTX-2.5 · Automatic backup with LTX-2.3</p>
        </div>
      </div>

      <div className="inspector-fields">
      <Textarea ref={promptRef} aria-label="Shot description" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running}
         placeholder="Describe the shot: who, where, framing, mood…" className="min-h-[90px]" />
      <Textarea aria-label="Dialogue" value={dialogue} onChange={(e) => setDialogue(e.target.value)} disabled={running}
        placeholder="Optional spoken line (the character will say this)" className="min-h-[60px]" />

      <div className="grid gap-3">
        {frameField("studio-start-frame", "Start frame", startFrame, setStartFrame)}
        {frameField("studio-end-frame", "End frame", endFrame, setEndFrame)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={running || !storyboardImages[0]} onClick={() => setStartFrame(storyboardImages[0] ?? "")}><Image className="w-4 h-4" /> Start: first storyboard image</Button>
        <Button variant="outline" size="sm" disabled={running || !storyboardImages[1]} onClick={() => setEndFrame(storyboardImages[1] ?? "")}><Image className="w-4 h-4" /> End: next storyboard image</Button>
        <Button variant="outline" size="sm" disabled={running || !previousEnd} onClick={() => setStartFrame(previousEnd ?? "")}><Link className="w-4 h-4" /> Start: previous shot's end</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Length</span>
          <select className="w-full rounded-md border border-border bg-background p-2" value={duration}
            disabled={running} onChange={(e) => setDuration(Number(e.target.value))}>
            {[5, 8, 10, 15, 20].map((d) => <option key={d} value={d}>{d}s</option>)}
          </select></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Quality</span>
          <select className="w-full rounded-md border border-border bg-background p-2" value={resolution}
            disabled={running} onChange={(e) => setResolution(e.target.value as "720p" | "1080p")}>
            <option value="720p">720p</option><option value="1080p">1080p</option>
          </select></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Shape</span>
          <select className="w-full rounded-md border border-border bg-background p-2" value={aspect}
            disabled={running} onChange={(e) => setAspect(e.target.value as "16:9" | "9:16")}>
            <option value="16:9">16:9 wide</option><option value="9:16">9:16 vertical</option>
          </select></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground">Camera</span>
          <select className="w-full rounded-md border border-border bg-background p-2" value={camera}
            disabled={running} onChange={(e) => setCamera(e.target.value)}>
            {CAMERA.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
      </div>

      </div>
      <div className="inspector-actions">
        <Button className="generate-take" onClick={() => generate("primary")} disabled={!canGenerate}>
          {running && tier === "primary" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} <Sparkles className="h-4 w-4" /> Generate take
        </Button>
        <Button variant="outline" onClick={() => generate("backup")} disabled={!canGenerate}>
          {running && tier === "backup" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Use backup engine
        </Button>
        <Button variant="outline" disabled={running || !isValidFrameUrl(endFrame)} onClick={chainNext}>
          <Link className="w-4 h-4" /> Chain next shot
        </Button>
      </div>
      <WorkspaceLink className="review-link" href={shots[selectedShot] ? `/dashboard/shot-lab?shot=${encodeURIComponent(shots[selectedShot].id)}` : "/dashboard/shot-lab"}>Review it in Shot Lab →</WorkspaceLink>
      {!framesValid && <p className="text-xs text-muted-foreground">Set both a start and an end image (public HTTPS links) to generate.</p>}

      {running && (
        <div className="space-y-2">
          <Progress value={pct} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{phase}</span><span>{fmt(elapsed)} / up to ~14:00</span>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <span>{error} — your earlier shots are kept; try again.</span>
        </div>
      )}

      {warning && <div role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{warning}</span></div>}
      </section>

      </div>

      {<section aria-label="Director shot timeline" className="workspace-card director-overview space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex items-center gap-2"><Film className="h-4 w-4 text-primary" /><div>
            <h3 className="font-semibold">Shot timeline</h3>
            <p className="text-xs text-muted-foreground">Overview of generated shots in story order</p>
          </div></div>
          <WorkspaceLink href="/dashboard/final-cut" className="overview-link">Open Final cut →</WorkspaceLink>
          <span className="text-xs tabular-nums text-muted-foreground">{shots.length} shots · {shots.reduce((sum, shot) => sum + shot.durationSeconds, 0)} sec</span>
        </div>
        {!shots.length && <div className="timeline-empty"><Film className="h-5 w-5" /><span>Your shots appear here in story order as you generate them.</span></div>}
        <div className="director-filmstrip" role="list" aria-label="Shots in chronological order">
          {shots.map((shot, index) => {
            const take = activeTake(shot);
            return <article key={shot.id} role="listitem" className="director-filmstrip-shot"><button className="w-full text-left" onClick={() => selectShot(index)} aria-label={`Preview shot ${index + 1}`}>
              <div className="director-filmstrip-image">{shot.firstFrame && <img src={shot.firstFrame} alt={`Shot ${index + 1} start frame`} loading="lazy" />}
                <span className="director-filmstrip-duration">{shot.durationSeconds}s</span></div>
              <div className="flex items-center justify-between gap-2 px-3 py-2.5"><span className="truncate text-xs font-semibold">Shot {String(index + 1).padStart(2, "0")}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${take?.status === "passed" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>{take?.status === "passed" ? `Take ${shot.activeTakeIndex + 1} approved` : take?.status === "failed" ? "Needs retake" : "In review"}</span></div>
            </button></article>;
          })}
        </div>
      </section>}


      {includeSequence && <StudioSequencePanel />}
    </div>
  );
};

export default StudioClipPanel;
