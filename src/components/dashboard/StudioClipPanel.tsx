import { useEffect, useRef, useState } from "react";
import { Clapperboard, Loader2, AlertCircle, Link, Image, X, Check, RotateCcw, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject, type StudioShot, type StudioTake, type QCStatus } from "@/contexts/ProjectContext";
import {
  activeTake, approveTake, DEFAULT_POOL_RATE_PER_HOUR, firstFrameIgnored, isValidFrameUrl,
  rejectTake, sequenceSummary, takeCost, validateFrameUrl,
} from "./studioClipUtils";
import StudioClipPlayer from "./StudioClipPlayer";
import { sequenceVideoUrl } from "./studioSequenceUtils";

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

const StudioClipPanel = () => {
  const { visualScenes, soundtrackTracks, studioClips: shots, setStudioClips: setShots,
    studioSequence, setStudioSequence } = useProject();
  const storyboardImages = visualScenes.map((s) => s.imageUrl).filter((u): u is string => !!u);
  const [startFrame, setStartFrame] = useState("");
  const [endFrame, setEndFrame] = useState("");
  const [stitching, setStitching] = useState(false);
  const [stitchPhase, setStitchPhase] = useState("");
  const [stitchError, setStitchError] = useState<string | null>(null);
  const [soundtrack, setSoundtrack] = useState("");
  const [rate, setRate] = useState(DEFAULT_POOL_RATE_PER_HOUR);
  const musicTracks = soundtrackTracks.filter((track) => track.status === "done" && track.url);
  const [warning, setWarning] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const [dialogue, setDialogue] = useState("");
  const [duration, setDuration] = useState(10);
  const [resolution, setResolution] = useState<"720p" | "1080p">("720p");
  const [aspect, setAspect] = useState<"16:9" | "9:16">("16:9");
  const [camera, setCamera] = useState("static");
  const [tier, setTier] = useState<Tier>("primary");

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const cancel = useRef(false);
  const busy = running || stitching;
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
        result.failover = { primaryJobId: failedPrimary.jobId, primaryError: failedPrimary.message, backupJobId: result.jobId!, at: Date.now() };
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
    jobId = data!.job_id;
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

  const stitchable = shots.map(activeTake).filter((t): t is StudioTake => !!t?.videoUrl);
  const stitch = async () => {
    if (busy || stitchable.length < 2) return;
    cancel.current = false;
    setStitching(true); setStitchError(null); setStitchPhase("Sending sequence…");
    try {
      const selectedMusic = musicTracks.find((track) => track.id === soundtrack)?.url;
      const { data, error } = await supabase.functions.invoke("studio-stitch", { body: {
        action: "submit",
        video_clips: stitchable.map((take, index) => ({ url: take.videoUrl!, shot_index: index })),
        ...(selectedMusic ? { soundtrack_url: selectedMusic } : {}),
      } });
      if (error || !data?.job_id) throw new Error(error?.message || data?.error || "Could not start stitching");
      const start = Date.now();
      while (!cancel.current) {
        if (Date.now() - start > 20 * 60 * 1000) throw new Error("Stitching took longer than expected. Your shots are still available; try again.");
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        if (cancel.current) return;
        const { data: result, error: statusError } = await supabase.functions.invoke("studio-stitch", {
          body: { action: "status", job_id: data.job_id },
        });
        if (cancel.current) return;
        if (statusError) { setStitchPhase("Reconnecting to stitch service…"); continue; }
        if (result?.status === "COMPLETED") {
          const source = sequenceVideoUrl(result.output);
          setStitchPhase("Saving final sequence…");
          let videoUrl = source;
          let saved = false;
          try {
            const { data: hosted, error: hostingError } = await supabase.functions.invoke("rehost-video", {
              body: { url: source, label: `studio-sequence-${data.job_id}` },
            });
            if (!hostingError && hosted?.rehosted === true && typeof hosted.url === "string") {
              const url = validateFrameUrl(hosted.url, "Saved video");
              if (url) { videoUrl = url; saved = true; }
            }
          } catch { /* Retain the completed sequence when storage is unavailable. */ }
          if (cancel.current) return;
          setStudioSequence({ videoUrl, saved });
          toast({ title: "Sequence ready" });
          return;
        }
        if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(result?.status)) {
          throw new Error(result.error || `Stitch ${result.status.toLowerCase()}`);
        }
        setStitchPhase(result?.status === "IN_QUEUE" ? "Waiting for stitch worker…" : "Stitching video and sound…");
      }
    } catch (error) {
      setStitchError(error instanceof Error ? error.message : "Stitch failed");
    } finally { setStitching(false); }
  };

  const chainNext = () => {
    // Next shot's start IS this shot's end — same asset, no render wait. Keep the scene prompt, new line only.
    setStartFrame(endFrame); setEndFrame(""); setDialogue(""); setTier("primary");
    promptRef.current?.focus();
  };

  const summary = sequenceSummary(shots, rate);

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
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Clapperboard className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Studio Clip (LTX-2, with sound)</h3>
          <p className="text-xs text-muted-foreground">Each shot renders between a start and an end image. Main engine: LTX-2.5 · Backup: LTX-2.3</p>
        </div>
      </div>

      <Textarea ref={promptRef} aria-label="Shot description" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running}
         placeholder="Describe the shot: who, where, framing, mood…" className="min-h-[90px]" />
      <Textarea aria-label="Dialogue" value={dialogue} onChange={(e) => setDialogue(e.target.value)} disabled={running}
        placeholder="Optional spoken line (the character will say this)" className="min-h-[60px]" />

      <div className="grid md:grid-cols-2 gap-3">
        {frameField("studio-start-frame", "Start frame", startFrame, setStartFrame)}
        {frameField("studio-end-frame", "End frame", endFrame, setEndFrame)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={running || !storyboardImages[0]} onClick={() => setStartFrame(storyboardImages[0] ?? "")}><Image className="w-4 h-4" /> Start: first storyboard image</Button>
        <Button variant="outline" size="sm" disabled={running || !storyboardImages[1]} onClick={() => setEndFrame(storyboardImages[1] ?? "")}><Image className="w-4 h-4" /> End: next storyboard image</Button>
        <Button variant="outline" size="sm" disabled={running || !previousEnd} onClick={() => setStartFrame(previousEnd ?? "")}><Link className="w-4 h-4" /> Start: previous shot's end</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => generate("primary")} disabled={!canGenerate}>
          {running && tier === "primary" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Generate clip
        </Button>
        <Button variant="outline" onClick={() => generate("backup")} disabled={!canGenerate}>
          {running && tier === "backup" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Use backup engine
        </Button>
        <Button variant="outline" disabled={running || !isValidFrameUrl(endFrame)} onClick={chainNext}>
          <Link className="w-4 h-4" /> Chain next shot
        </Button>
      </div>
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

      {shots.map((shot, index) => {
        const active = activeTake(shot);
        const shotCost = shot.takes.reduce((sum, k) => sum + takeCost(k.generationSeconds, rate), 0);
        return (
          <section key={shot.id} aria-label={`Shot ${index + 1} card`} className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-medium">Shot {index + 1} · {shot.takes.length} take{shot.takes.length === 1 ? "" : "s"} · {usd(shotCost)}</h4>
              <div className="flex items-center gap-2">
                {active && <Badge variant={active.status === "passed" ? "default" : active.status === "failed" ? "destructive" : "secondary"}
                  aria-label={`Shot ${index + 1} QC`}>{QC_LABEL[active.status]}</Badge>}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => retake(index)}><RotateCcw className="w-4 h-4" /> Retake (new seed)</Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {shot.takes.map((take, t) => (
                <div key={`${take.jobId}-${t}`} className={`space-y-2 rounded-md border p-2 ${t === shot.activeTakeIndex ? "border-primary" : "border-border"}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-medium">Take {t + 1}{t === shot.activeTakeIndex ? " · in sequence" : ""}</span>
                    <Badge variant="outline">{take.tier === "primary" ? "LTX-2.5" : "LTX-2.3"}{take.failover ? " · auto-backup" : ""}</Badge>
                    <Badge variant={take.status === "passed" ? "default" : take.status === "failed" ? "destructive" : "secondary"}>{take.rejected ? "rejected" : QC_LABEL[take.status]}</Badge>
                  </div>
                  {take.failover && <p className="text-xs text-muted-foreground">Main engine failed (job {take.failover.primaryJobId ?? "not started"}: {take.failover.primaryError}). Rendered on backup, job {take.failover.backupJobId}.</p>}
                  {take.videoUrl
                    ? <StudioClipPlayer videoUrl={take.videoUrl} shot={index + 1} take={t + 1} saved={take.saved} />
                    : <p className="text-xs text-destructive">No video — {take.error ?? "generation failed"}</p>}
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
          </section>
        );
      })}

      <div className="space-y-3 border-t border-border pt-4">
        <h4 className="text-sm font-medium">Sequence · {shots.length} shots</h4>
        <div className="grid gap-2 text-xs md:grid-cols-4" aria-label="Cost summary">
          <label className="space-y-1"><span className="text-muted-foreground">GPU pool rate ($/hr, estimated invoice baseline)</span>
            <Input aria-label="GPU pool rate" type="number" min={0} step={0.01} value={rate} onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))} /></label>
          <div><p className="text-muted-foreground">Total spend (incl. rejected/failed)</p><p className="text-sm font-medium" data-testid="cost-total">{usd(summary.total)}</p></div>
          <div><p className="text-muted-foreground">Per approved shot ({summary.approvedShots})</p><p className="text-sm font-medium" data-testid="cost-per-shot">{usd(summary.perApprovedShot)}</p></div>
          <div><p className="text-muted-foreground">Per finished minute</p><p className="text-sm font-medium" data-testid="cost-per-minute">{usd(summary.perFinishedMinute)}</p></div>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-xs text-muted-foreground">Soundtrack</span>
          <select aria-label="Sequence soundtrack" value={soundtrack} disabled={busy}
            onChange={(event) => setSoundtrack(event.target.value)}
            className="w-full rounded-md border border-border bg-background p-2">
            <option value="">No added music</option>
            {musicTracks.map((track) => <option key={track.id} value={track.id}>{track.segment}</option>)}
          </select>
        </label>
        <Button onClick={stitch} disabled={busy || stitchable.length < 2}>
          {stitching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />} Stitch Sequence
        </Button>
        {stitching && <p role="status" className="text-sm text-muted-foreground">{stitchPhase}</p>}
        {stitchError && <p role="alert" className="text-sm text-destructive">{stitchError}</p>}
        {studioSequence && <div className="space-y-2">
          <h4 className="text-sm font-medium">Final sequence</h4>
          <StudioClipPlayer key={studioSequence.videoUrl} label="Final sequence" videoUrl={studioSequence.videoUrl} saved={studioSequence.saved} />
        </div>}
      </div>
    </div>
  );
};

export default StudioClipPanel;
