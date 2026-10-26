import { useEffect, useRef, useState } from "react";
import { Clapperboard, Loader2, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
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
    if (!prompt.trim()) return toast({ title: "Describe the shot first", variant: "destructive" });
    cancel.current = false;
    setTier(useTier); setRunning(true); setError(null); setVideoUrl(null); setLastFrame(null);
    setStartedAt(Date.now()); setNow(Date.now()); setPhase("Sending to the video engine…");
    try {
      const { data, error } = await supabase.functions.invoke("studio-clip", {
        body: {
          action: "submit", tier: useTier, prompt: prompt.trim(),
          dialogue: dialogue.trim() || undefined, duration_seconds: duration,
          resolution, aspect_ratio: aspect, camera_motion: camera === "static" ? undefined : camera,
        },
      });
      if (error || !data?.job_id) throw new Error(error?.message || data?.error || "Could not start the clip");
      const start = Date.now();
      while (!cancel.current) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const { data: s, error: se } = await supabase.functions.invoke("studio-clip", {
          body: { action: "status", tier: useTier, job_id: data.job_id },
        });
        if (se) continue;
        if (s?.status === "IN_QUEUE") setPhase("Waking up the GPU (first clip can take up to ~14 min)…");
        else if (s?.status === "IN_PROGRESS") setPhase("Rendering video + sound…");
        else if (s?.status === "COMPLETED") {
          const out = s.output?.output ?? s.output;
          if (!out?.video_url) throw new Error("Finished but no video came back");
          setVideoUrl(out.video_url); setLastFrame(out.last_frame_url ?? null);
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

      <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={running}
        placeholder="Describe the shot: who, where, framing, mood…" className="min-h-[90px]" />
      <Textarea value={dialogue} onChange={(e) => setDialogue(e.target.value)} disabled={running}
        placeholder="Optional spoken line (the character will say this)" className="min-h-[60px]" />

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
        <Button variant="outline" onClick={() => run("backup")} disabled={running}>
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
          <span>{error}{tier === "primary" ? " — try “Use backup engine”." : ""}</span>
        </div>
      )}

      {videoUrl && (
        <div className="space-y-2">
          <video src={videoUrl} controls className="w-full rounded-lg bg-muted" />
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={videoUrl} target="_blank" rel="noreferrer"><Download className="w-4 h-4" /> Download</a>
            </Button>
            {lastFrame && (
              <Button asChild variant="ghost" size="sm">
                <a href={lastFrame} target="_blank" rel="noreferrer">View last frame</a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudioClipPanel;
