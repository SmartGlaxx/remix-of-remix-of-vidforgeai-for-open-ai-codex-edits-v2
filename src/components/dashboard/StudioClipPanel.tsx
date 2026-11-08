import TrackWaveform from "./TrackWaveform";
import PlaybackControls from "./PlaybackControls";
import WorkspaceLink from "./WorkspaceLink";
import { useEffect, useRef, useState } from "react";
import { MousePointer2, Maximize, LockKeyhole, Eye, AudioLines, PanelTop, Save, Camera, Timer, Ratio, Monitor, Clapperboard, Loader2, AlertCircle, Link, Image, X, Check, RotateCcw, ThumbsDown, Film, Plus, Sparkles } from "lucide-react";
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
const SHOTS_PER_PAGE = 5;
const clock = (seconds: number) => new Date(Math.max(0, seconds) * 1000).toISOString().slice(11, 19);

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
  const { soundtrackTracks, sequenceSoundtrack, visualScenes, studioClips: shots, setStudioClips: setShots,
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
  const [libraryTab, setLibraryTab] = useState<"Shots" | "Assets" | "Approved">("Shots");
  const [libraryPage, setLibraryPage] = useState(0);
  const pendingShot = shots.find(shot => shot.takes.some(take => take.pendingDecision && take.status === "needs_review"));
  const pendingTake = pendingShot?.takes.find(take => take.pendingDecision && take.status === "needs_review");
  const decideTake = (discard: boolean) => {
    if (!pendingShot || !pendingTake) return;
    setShots(previous => previous.map(shot => shot.id !== pendingShot.id ? shot : {
      ...shot, takes: shot.takes.map(take => take.jobId !== pendingTake.jobId ? take : {
        ...take, pendingDecision: false,
        ...(discard ? { videoUrl: null, rejected: true, status: "failed" as const, error: "Discarded" } : {}),
      }),
    }));
  };
  const currentShot = shots[selectedShot];
  const takeIndex = currentShot ? previewTakes[currentShot.id] ?? currentShot.takes.length - 1 : -1;
  const currentTake = currentShot?.takes[takeIndex];
  const monitor = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(1);
  const [showAudio, setShowAudio] = useState(true);
  const [timelinePage, setTimelinePage] = useState(0);
  useEffect(() => {
    if (selectedShot >= 0) setTimelinePage(Math.floor(selectedShot / SHOTS_PER_PAGE));
  }, [selectedShot]);
  const firstTimelineShot = Math.min(timelinePage, Math.max(0, Math.ceil(shots.length / SHOTS_PER_PAGE) - 1)) * SHOTS_PER_PAGE;
  const pageShots = shots.slice(firstTimelineShot, firstTimelineShot + SHOTS_PER_PAGE);
  const pageStart = shots.slice(0, firstTimelineShot).reduce((sum, shot) => sum + shot.durationSeconds, 0);
  const pageSeconds = pageShots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  const totalSeconds = shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  const music = soundtrackTracks.find(track => track.id === sequenceSoundtrack);
  const goToPage = (offset: number) => selectShot(firstTimelineShot + offset * SHOTS_PER_PAGE);
  const [playTime, setPlayTime] = useState({ id: "", seconds: 0 });
  const shotStart = shots.slice(0, Math.max(0, selectedShot)).reduce((sum, shot) => sum + shot.durationSeconds, 0);
  const position = shotStart + (playTime.id === currentShot?.id ? Math.min(playTime.seconds, currentShot.durationSeconds) : 0);
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
  const canGenerate = !pendingTake && !busy && !!prompt.trim() && framesValid;
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
      append({ ...result, seed, pendingDecision: true });
      setPreviewTakes(previous => ({...previous, [shot.id]: shot.takes.length}));
      if (!isNew) setSelectedShot(shots.findIndex(item => item.id === shot.id));
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

  const retake = (index: number) => { if (!busy && !pendingTake) renderTake(shots[index], "primary", false); };

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
      <label className="frame-input-label" htmlFor={id}>{isValidFrameUrl(value) ? <img src={value} alt="" /> : <Image size={18} />}<span>{label}<span className="sr-only"> (required)</span></span></label>
      <div className="flex items-center gap-2">
        <Input id={id} type="url" value={value} disabled={running} onChange={(e) => set(e.target.value)}
          placeholder="https://…" aria-invalid={!!value && !isValidFrameUrl(value)} />
        {value && <Button variant="ghost" size="icon" disabled={running} aria-label={`Clear ${label.toLowerCase()}`} onClick={() => set("")}><X className="w-4 h-4" /></Button>}
      </div>
      {value && !isValidFrameUrl(value) && <p className="text-xs text-destructive">{label} must be a public HTTPS image URL.</p>}
    </div>
  );

  const libraryItems = [
    ...(libraryTab === "Assets" ? visualScenes.flatMap(scene => scene.imageUrl ? [{
      key: "frame-" + scene.id, title: scene.section || "Storyboard frame", image: scene.imageUrl, audio: "",
      open: () => { setSelectedShot(-1); setStartFrame(scene.imageUrl!); },
    }] : []) : []),
    ...shots.flatMap((shot, index) => shot.takes.flatMap((take, number) => {
      if (!take.videoUrl || take.rejected || take.pendingDecision || (libraryTab === "Approved" && (number !== shot.activeTakeIndex || take.status !== "passed"))) return [];
      return [{ key: shot.id + "-" + number, title: `Shot ${String(index + 1).padStart(2,"0")} · Take ${number + 1}`,
        image: shot.firstFrame, audio: "", open: () => { selectShot(index); setPreviewTakes(previous => ({...previous, [shot.id]: number})); } }];
    })),
    ...(libraryTab === "Assets" ? soundtrackTracks.flatMap(track => track.url && track.status === "done" ? [{
      key: "audio-" + track.id, title: track.segment, image: "", audio: track.url, open: () => {},
    }] : []) : []),
  ];
  const libraryStart = Math.min(libraryPage, Math.max(0, Math.ceil(libraryItems.length / SHOTS_PER_PAGE) - 1)) * SHOTS_PER_PAGE;
  return (
    <div className="director-editing-layout">
      <div className="director-workspace-grid">
      <aside className="director-library" aria-label="Shot library">
        <div className="library-tabs" aria-label="Library views">{(["Shots","Assets","Approved"] as const).map(tab => {
          const TabIcon = tab === "Shots" ? Film : tab === "Assets" ? Image : Check;
          return <button key={tab} type="button" aria-label={tab} title={tab} aria-pressed={libraryTab === tab} className={libraryTab === tab ? "is-active" : ""} onClick={() => {setLibraryTab(tab);setLibraryPage(0)}}>
            <TabIcon className="library-tab-icon" size={16} aria-hidden="true"/><span>{tab}</span>
          </button>;
        })}</div>
        {libraryTab === "Shots" ? <>
        <div className="library-heading"><h2>Shot library <span>({shots.length})</span></h2><button onClick={() => { setSelectedShot(-1); promptRef.current?.focus(); }} aria-label="New shot"><Plus size={18} /></button></div>
        <div className="library-shots">
          {pageShots.map((shot, offset) => {
            const index = firstTimelineShot + offset;
            return <button type="button" key={shot.id} aria-pressed={selectedShot === index} className="shot-still" onClick={() => selectShot(index)}>
              <img src={shot.firstFrame} alt="" /><b>Shot {String(index + 1).padStart(2, "0")}</b><time>{clock(shot.durationSeconds)}</time>
              {selectedShot === index && <Check className="still-check" size={18} />}
            </button>;
          })}
          {!shots.length && <div className="library-empty"><div className="empty-thumbnail"><Film size={32} strokeWidth={1} /></div><h3>Your first shot starts here</h3><p>Add both storyboard frames and describe the shot to generate your first take.</p><WorkspaceLink href="/dashboard/storyboard">Open Storyboard →</WorkspaceLink></div>}
        </div>
        {shots.length > SHOTS_PER_PAGE && <div className="timeline-pages"><button disabled={!firstTimelineShot} aria-label="Previous shots" onClick={() => goToPage(-1)}>‹</button><span>{firstTimelineShot + 1}–{firstTimelineShot + pageShots.length} / {shots.length}</span><button disabled={firstTimelineShot + pageShots.length >= shots.length} aria-label="Next shots" onClick={() => goToPage(1)}>›</button></div>}
        </> : <>
          <div className="library-heading"><h2>{libraryTab} <span>({libraryItems.length})</span></h2></div>
          <div className="library-shots">{libraryItems.slice(libraryStart, libraryStart + SHOTS_PER_PAGE).map(item => item.audio
            ? <div key={item.key} className="library-audio"><span>{item.title}</span><audio controls preload="none" src={item.audio}/></div>
            : <button key={item.key} className="shot-still" onClick={item.open}><img src={item.image} alt=""/><b>{item.title}</b></button>)}
            {!libraryItems.length && <p className="library-empty">{libraryTab === "Assets" ? "No saved assets yet." : "No approved takes yet."}</p>}
          </div>
          {libraryItems.length > SHOTS_PER_PAGE && <div className="timeline-pages"><button aria-label="Previous items" disabled={!libraryStart} onClick={() => setLibraryPage(libraryStart / SHOTS_PER_PAGE - 1)}>‹</button><span>{libraryStart + 1}–{Math.min(libraryStart + SHOTS_PER_PAGE, libraryItems.length)}</span><button aria-label="Next items" disabled={libraryStart + SHOTS_PER_PAGE >= libraryItems.length} onClick={() => setLibraryPage(libraryStart / SHOTS_PER_PAGE + 1)}>›</button></div>}
        </>}
      </aside>
      <section ref={monitor} className="director-monitor" aria-label="Shot preview" onTimeUpdateCapture={event => {
        const video = event.target;
        if (currentShot && video instanceof HTMLVideoElement && video.offsetWidth) setPlayTime({ id: currentShot.id, seconds: video.currentTime });
      }}>
        {(!shots.length || selectedShot === -1) && <div className="draft-preview">
          <div className="director-player">{isValidFrameUrl(startFrame) && <img className="player-glass-backdrop" src={startFrame} aria-hidden="true" alt="" />}<div className="draft-viewport">{isValidFrameUrl(startFrame) ? <img src={startFrame} alt="Start frame preview" /> : <div className="preview-placeholder"><h2>Shot preview</h2><p>Add your start and end frames in the inspector.</p></div>}</div><span className="preview-format">{resolution} · {aspect}</span><PlaybackControls summary="No takes yet">
          <div className="draft-frame-pair">{[["Start frame", startFrame], ["End frame", endFrame]].map(([label, url]) => <div key={label}>{isValidFrameUrl(url) ? <img src={url} alt={label} /> : <Image size={18} />}<span>{label}<small>{isValidFrameUrl(url) ? "Ready" : "Required"}</small></span></div>)}</div>
          <div className="empty-takes"><Film size={18} /><span>Generated takes will appear here for review.</span></div>
          </PlaybackControls></div>
        </div>}

      {shots.map((shot, index) => {
        const active = activeTake(shot);
        const shotCost = shot.takes.reduce((sum, k) => sum + takeCost(k.generationSeconds, rate), 0);
        const takeStrip = (
            <div className="director-take-strip" aria-label={`Shot ${index + 1} takes`}>
              {shot.takes.map((take, t) => <button key={t} type="button" aria-pressed={t === (previewTakes[shot.id] ?? shot.takes.length - 1)} onClick={() => setPreviewTakes((prev) => ({ ...prev, [shot.id]: t }))} className="director-take-thumb">
                <img src={shot.firstFrame} alt="" /><span>Take {t + 1}{take.status === "passed" ? " ✓" : ""}</span>
              </button>)}
            </div>
        );
        return (
          <section key={shot.id} aria-label={`Shot ${index + 1} card`} hidden={index !== selectedShot} className="director-preview-shot space-y-3">
            <div className="monitor-meta"><h4 className="text-sm font-medium">Shot {String(index + 1).padStart(2,"0")}　|　{clock(shot.durationSeconds)}</h4>
              <span>{shot.resolution}　 {shot.aspectRatio}</span><details><summary aria-label="Shot actions">•••</summary><aside><small>{shot.takes.length} takes · {usd(shotCost)}</small>
                <Button asChild variant="ghost" size="sm"><WorkspaceLink href={`/dashboard/shot-lab?shot=${encodeURIComponent(shot.id)}`}>Review it in Shot Lab <Link className="ml-1 h-4 w-4" /></WorkspaceLink></Button>
                {active && <Badge variant={active.status === "passed" ? "default" : active.status === "failed" ? "destructive" : "secondary"}
                  aria-label={`Shot ${index + 1} QC`}>{QC_LABEL[active.status]}</Badge>}
                <Button size="sm" variant="outline" disabled={busy || !!pendingTake} onClick={() => retake(index)}><RotateCcw className="w-4 h-4" /> Retake (new seed)</Button>
              </aside></details>
            </div>
            <div className="preview-take-stack">
              {shot.takes.map((take, t) => (
                <div key={`${take.jobId}-${t}`} hidden={t !== (previewTakes[shot.id] ?? shot.takes.length - 1)} className="preview-take space-y-3">
                  {take.videoUrl
                    ? <StudioClipPlayer director active={visible && selectedShot === index && t === (previewTakes[shot.id] ?? shot.takes.length - 1)} videoUrl={take.videoUrl} poster={shot.firstFrame} shot={index + 1} take={t + 1} saved={take.saved} dockContent={visible && index === selectedShot && t === takeIndex ? takeStrip : null} />
                    : <><p className="text-xs text-destructive">No video — {take.error ?? "generation failed"}</p>{takeStrip}</>}

                </div>
              ))}
            </div>

          </section>
        );
      })}

      </section>
      <section className="director-inspector" aria-label="Shot prompt">
      <div className="inspector-fields">
      <div className="direction-composer"><label className="sr-only" htmlFor="shot-direction">Shot description</label>
      <Textarea id="shot-direction" ref={promptRef} aria-label="Shot description" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running}
         placeholder="Enter prompt here" className="min-h-[90px]" /><small>{prompt.length} characters</small></div>
<div className="shot-settings-rows">
        <label className="space-y-1"><span className="text-xs text-muted-foreground"><Timer size={15}/> Duration</span>
          <select className="w-full rounded-md border border-border bg-background p-2" value={duration}
            disabled={running} onChange={(e) => setDuration(Number(e.target.value))}>
            {[5, 8, 10, 15, 20].map((d) => <option key={d} value={d}>{d}s</option>)}
          </select></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground"><Monitor size={15}/> Quality</span>
          <select className="w-full rounded-md border border-border bg-background p-2" value={resolution}
            disabled={running} onChange={(e) => setResolution(e.target.value as "720p" | "1080p")}>
            <option value="720p">720p</option><option value="1080p">1080p</option>
          </select></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground"><Ratio size={15}/> Aspect ratio</span>
          <select className="w-full rounded-md border border-border bg-background p-2" value={aspect}
            disabled={running} onChange={(e) => setAspect(e.target.value as "16:9" | "9:16")}>
            <option value="16:9">16:9 wide</option><option value="9:16">9:16 vertical</option>
          </select></label>
        <label className="space-y-1"><span className="text-xs text-muted-foreground"><Camera size={15}/> Camera</span>
          <select className="w-full rounded-md border border-border bg-background p-2" value={camera}
            disabled={running} onChange={(e) => setCamera(e.target.value)}>
            {CAMERA.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></label>
      </div>
      <div className="frame-section"><div className="frame-heading"><strong>Frame pair</strong><span>{Number(isValidFrameUrl(startFrame)) + Number(isValidFrameUrl(endFrame))} / 2 ready</span></div><div className="inspector-frame-pair">
        {frameField("studio-start-frame", "Start frame", startFrame, setStartFrame)}
        {frameField("studio-end-frame", "End frame", endFrame, setEndFrame)}
      </div>
      <details className="direction-disclosure frame-sources"><summary>Use existing frames</summary><div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={running || !storyboardImages[0]} onClick={() => setStartFrame(storyboardImages[0] ?? "")}><Image className="w-4 h-4" /> Start: first storyboard image</Button>
        <Button variant="outline" size="sm" disabled={running || !storyboardImages[1]} onClick={() => setEndFrame(storyboardImages[1] ?? "")}><Image className="w-4 h-4" /> End: next storyboard image</Button>
        <Button variant="outline" size="sm" disabled={running || !previousEnd} onClick={() => setStartFrame(previousEnd ?? "")}><Link className="w-4 h-4" /> Start: previous shot's end</Button>
      </div>

      </details></div>
      <details className="direction-disclosure"><summary>Dialogue <small>Optional</small></summary><Textarea aria-label="Dialogue" value={dialogue} onChange={(e) => setDialogue(e.target.value)} disabled={running}
        placeholder="Optional spoken line (the character will say this)" className="min-h-[60px]" /></details>

      <details className="direction-disclosure"><summary>Production controls</summary>        <Button variant="outline" onClick={() => generate("backup")} disabled={!canGenerate}>
          {running && tier === "backup" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Use backup engine
        </Button>
        <Button variant="outline" disabled={running || !isValidFrameUrl(endFrame)} onClick={chainNext}>
          <Link className="w-4 h-4" /> Chain next shot
        </Button>
      {currentShot && currentTake && <section className="take-inspector-details space-y-2" aria-label="Selected take">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">Take {takeIndex + 1}{takeIndex === currentShot.activeTakeIndex && currentTake.status === "passed" ? " · selected for cut" : ""}</span>
          <Badge variant="outline">{currentTake.tier === "primary" ? "LTX-2.5" : "LTX-2.3"}{currentTake.failover ? " · auto-backup" : ""}</Badge>
          <Badge variant={currentTake.status === "passed" ? "default" : currentTake.status === "failed" ? "destructive" : "secondary"}>{currentTake.rejected ? "rejected" : QC_LABEL[currentTake.status]}</Badge>
        </div>
        {currentTake.failover && <p className="text-xs text-muted-foreground">Main engine failed (job {currentTake.failover.primaryJobId ?? "not started"}: {currentTake.failover.primaryError}). Rendered on backup, job {currentTake.failover.backupJobId}.</p>}
        <p className="text-xs text-muted-foreground">
          Job {currentTake.jobId ?? "—"} · seed {currentTake.seed} · {currentTake.generationSeconds != null ? `${currentTake.generationSeconds.toFixed(1)}s GPU` : "GPU time n/a"} · {usd(takeCost(currentTake.generationSeconds, rate))}
        </p>
        {currentTake.videoUrl && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy || currentTake.status === "passed"} onClick={() => setShots((s) => approveTake(s, selectedShot, takeIndex))}><Check className="w-4 h-4" /> Approve take {takeIndex + 1}</Button>
            <Button size="sm" variant="outline" disabled={busy || currentTake.status !== "needs_review"} onClick={() => setShots((s) => rejectTake(s, selectedShot, takeIndex))}><ThumbsDown className="w-4 h-4" /> Reject take {takeIndex + 1}</Button>
            {currentTake.lastFrame && <Button asChild variant="ghost" size="sm"><a href={currentTake.lastFrame} target="_blank" rel="noreferrer">View last frame</a></Button>}
          </div>
        )}
      </section>}</details>
      </div>
      <div className="inspector-actions">
        {pendingTake ? <>
          <Button onClick={() => decideTake(false)}><Save size={15}/> Save take</Button>
          <Button variant="outline" onClick={() => decideTake(true)}><X size={15}/> Discard</Button>
        </> : <Button className="generate-take" onClick={() => generate("primary")} disabled={!canGenerate}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate take
        </Button>}
      </div>

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

      <section aria-label="Director shot timeline" className="cut-console">
        <header><strong><Clapperboard size={17}/> Timeline</strong>
          <div className="cut-tools"><MousePointer2 className="cut-pointer" size={27}/><button title="Fit timeline" onClick={() => setZoom(1)}><Maximize size={16}/></button><button title="New shot" disabled={busy} onClick={() => {setSelectedShot(-1);promptRef.current?.focus()}}><Plus size={17}/></button></div>
          <time>{clock(position)} / {clock(totalSeconds)}</time>
          <label className="cut-zoom">− <input aria-label="Timeline zoom" type="range" min="1" max="3" step=".1" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/> +</label>
          <button aria-label="Show audio lane" aria-pressed={showAudio} onClick={()=>setShowAudio(!showAudio)}><AudioLines size={17}/></button>
          <WorkspaceLink href="/dashboard/final-cut"><PanelTop aria-hidden size={17}/><span className="sr-only">Open Final cut</span></WorkspaceLink></header>
        <div className="cut-scroll"><div className="cut-lanes" style={{width:zoom*100+"%"}}>
          <span/><div className="cut-ruler">{Array.from({length: 6}, (_, i) => <time key={i}>{clock(pageStart + pageSeconds * i / 5)}</time>)}</div>
          <strong><Eye size={13}/><LockKeyhole size={12}/><Film size={15}/> Video</strong><div className="cut-clips">{pageSeconds > 0 && <i className="cut-playhead" style={{left: Math.max(0, Math.min(100, 100 * (position - pageStart) / pageSeconds)) + "%"}}/>}{pageShots.map((shot, offset) => <button key={shot.id} className="shot-still" style={{flex: shot.durationSeconds}} aria-pressed={selectedShot === firstTimelineShot + offset} onClick={() => selectShot(firstTimelineShot + offset)}>
            <img src={shot.firstFrame} alt=""/><b>Shot {String(firstTimelineShot + offset + 1).padStart(2, "0")}</b><time>{clock(shot.durationSeconds)}</time>
          </button>)}{!shots.length && <small>No shots yet</small>}</div>
          {showAudio && <><strong><Eye size={13}/><LockKeyhole size={12}/><AudioLines size={15}/> Audio</strong><div className="cut-audio"><TrackWaveform url={music?.url || undefined}/><span>{music?.segment || (shots.length ? "Original clip audio" : "No clips")}</span></div></>}
        </div></div>
      </section>
      {includeSequence && <StudioSequencePanel />}
    </div>
  );
};

export default StudioClipPanel;
