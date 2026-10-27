import { useEffect, useRef, useState } from "react";
import { Clapperboard, Loader2, AlertCircle, Link, Image, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";
import { firstFrameIgnored, validateFirstFrame } from "./studioClipUtils";
import StudioClipPlayer from "./StudioClipPlayer";

// Worst measured cold first clip ≈ 13 min (285s queue + 491s gen). Size for 14.
export const COLD_START_BUDGET_MS = 14 * 60 * 1000;
const POLL_MS = 5000;

type Tier = "primary" | "backup";
const CAMERA = ["static", "slow push in", "pan left", "pan right", "orbit", "dolly out", "handheld"];

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const StudioClipPanel = () => {
  const { visualScenes } = useProject();
  const storyboardFrame = visualScenes.find((scene) => scene.imageUrl)?.imageUrl;
  const [firstFrame, setFirstFrame] = useState("");
  const [clips, setClips] = useState<{ videoUrl: string; lastFrame: string | null; tier: Tier; saved: boolean }[]>([]);
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
  const lastFrame = clips.at(-1)?.lastFrame;
  const cancel = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  useEffect(() => () => { cancel.current = true; }, []);

  const elapsed = running ? now - startedAt : 0;
  const pct = Math.min(97, (elapsed / COLD_START_BUDGET_MS) * 100);

  const run = async (useTier: Tier) => {
    if (running) return;
    if (!prompt.trim()) return toast({ title: "Describe the shot first", variant: "destructive" });
    let frameUrl: string | undefined;
    try {
      frameUrl = validateFirstFrame(firstFrame);
    } catch {
      return toast({ title: "First frame must be a public HTTPS image URL", variant: "destructive" });
    }
    if (frameUrl && useTier === "backup") {
      return toast({ title: "Use the main engine for first-frame shots", variant: "destructive" });
    }
    cancel.current = false;
    setTier(useTier); setRunning(true); setError(null); setWarning(null);
    setStartedAt(Date.now()); setNow(Date.now()); setPhase("Sending to the video engine…");
    try {
      const { data, error } = await supabase.functions.invoke("studio-clip", {
        body: {
          action: "submit", tier: useTier, prompt: prompt.trim(),
          dialogue: dialogue.trim() || undefined, duration_seconds: duration,
          resolution, aspect_ratio: aspect, camera_motion: camera === "static" ? undefined : camera,
          ...(frameUrl ? { first_frame_url: frameUrl } : {}),
        },
      });
      if (error || !data?.job_id) throw new Error(error?.message || data?.error || "Could not start the clip");
      const start = Date.now();
      while (!cancel.current) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (cancel.current) return;
        const { data: s, error: se } = await supabase.functions.invoke("studio-clip", {
          body: { action: "status", tier: useTier, job_id: data.job_id },
        });
        if (cancel.current) return;
        if (se) continue;
        if (firstFrameIgnored(s)) {
          setWarning("The worker reported first_frame_url ignored. This shot may not match your first frame; flag this to Muse.");
        }
        if (s?.status === "IN_QUEUE") setPhase("Waking up the GPU (first clip can take up to ~14 min)…");
        else if (s?.status === "IN_PROGRESS") setPhase("Rendering video + sound…");
        else if (s?.status === "COMPLETED") {
          const out = s.output?.output ?? s.output;
          if (!out?.video_url) throw new Error("Finished but no video came back");
          setPhase("Saving your clip to app storage…");
          let videoUrl = out.video_url;
          let saved = false;
          try {
            const { data: hosted, error: hostingError } = await supabase.functions.invoke("rehost-video", {
              body: { url: out.video_url, label: `studio-${data.job_id}` },
            });
            if (!hostingError && hosted?.rehosted === true && typeof hosted.url === "string") {
              const hostedUrl = validateFirstFrame(hosted.url);
              if (hostedUrl) { videoUrl = hostedUrl; saved = true; }
            }
          } catch {
            // Keep the completed shot even if storage is temporarily unavailable.
          }
          if (cancel.current) return;
          setClips((previous) => [...previous, { videoUrl, lastFrame: out.last_frame_url ?? null, tier: useTier, saved }]);
          toast({ title: "Clip ready", description: `Made with ${out.model_used ?? useTier}` });
          return;
        } else if (s?.status === "FAILED" || s?.status === "CANCELLED" || s?.status === "TIMED_OUT") {
          throw new Error(s?.error || `Job ${s.status.toLowerCase()}`);
        }
        if (Date.now() - start > COLD_START_BUDGET_MS + 6 * 60 * 1000) throw new Error("Took far longer than expected");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Clapperboard className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Studio Clip (LTX-2, with sound)</h3>
          <p className="text-xs text-muted-foreground">One shot with native audio. Main engine: LTX-2.5 · Backup: LTX-2.3</p>
        </div>
      </div>

      <Textarea ref={promptRef} aria-label="Shot description" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running}
        placeholder="Describe the shot: who, where, framing, mood…" className="min-h-[90px]" />
      <Textarea value={dialogue} onChange={(e) => setDialogue(e.target.value)} disabled={running}
        placeholder="Optional spoken line (the character will say this)" className="min-h-[60px]" />

      <div className="space-y-2">
        <label htmlFor="studio-first-frame" className="text-xs text-muted-foreground">First frame (optional)</label>
        <div className="flex items-center gap-2">
          <Input id="studio-first-frame" type="url" value={firstFrame} disabled={running}
            onChange={(e) => setFirstFrame(e.target.value)} placeholder="https://…" />
          {firstFrame && <Button variant="ghost" size="icon" disabled={running} aria-label="Clear first frame" title="Clear first frame" onClick={() => setFirstFrame("")}><X className="w-4 h-4" /></Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={running || !storyboardFrame} onClick={() => setFirstFrame(storyboardFrame ?? "")}><Image className="w-4 h-4" /> Use first storyboard image</Button>
          <Button variant="outline" size="sm" disabled={running || !lastFrame} onClick={() => setFirstFrame(lastFrame ?? "")}><Link className="w-4 h-4" /> Use previous last frame</Button>
        </div>
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
        <Button onClick={() => run("primary")} disabled={running}>
          {running && tier === "primary" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Generate clip
        </Button>
        <Button variant="outline" onClick={() => run("backup")} disabled={running || !!firstFrame.trim()} title={firstFrame.trim() ? "First-frame conditioning is verified on the main engine only" : undefined}>
          {running && tier === "backup" ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Use backup engine
        </Button>
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
          <span>{error}{tier === "primary" && !firstFrame.trim() ? " — try “Use backup engine”." : ""}</span>
        </div>
      )}

      {warning && <div role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{warning}</span></div>}

      {clips.map((clip, index) => (
        <div key={`${clip.videoUrl}-${index}`} className="space-y-2 border-t border-border pt-4">
          <h4 className="text-sm font-medium">Shot {index + 1} · {clip.tier === "primary" ? "LTX-2.5" : "LTX-2.3"}</h4>
           <StudioClipPlayer videoUrl={clip.videoUrl} shot={index + 1} saved={clip.saved} />
           <div className="flex flex-wrap gap-2">
            {clip.lastFrame && (
              <Button asChild variant="ghost" size="sm">
                <a href={clip.lastFrame} target="_blank" rel="noreferrer">View last frame</a>
              </Button>
            )}
          </div>
        </div>
      ))}
      {lastFrame && <Button variant="outline" disabled={running} onClick={() => {
        setFirstFrame(lastFrame); setTier("primary"); setPrompt(""); setDialogue("");
        promptRef.current?.focus();
      }}><Link className="w-4 h-4" /> Chain next shot</Button>}
    </div>
  );
};

export default StudioClipPanel;
