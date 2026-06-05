import { useState, useMemo, useEffect, useRef } from "react";
import { Download, Wand2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";

type Stage =
  | "idle"
  | "generating"
  | "lipsync"
  | "stitching"
  | "rehosting"
  | "done"
  | "error";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "Ready",
  generating: "Generating voice, image, video & music…",
  lipsync: "Lip-syncing character…",
  stitching: "Merging audio + video…",
  rehosting: "Preparing safe download…",
  done: "Done",
  error: "Error",
};

// Approximate target % each stage should asymptote toward. The bar
// interpolates smoothly toward the target so it always moves while we wait.
const STAGE_TARGET: Record<Stage, number> = {
  idle: 0,
  generating: 55,
  lipsync: 80,
  stitching: 92,
  rehosting: 98,
  done: 100,
  error: 0,
};

async function callGateway(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("runpod-gateway", {
    body: payload,
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

async function pollGateway(endpoint_id: string, job_id: string, timeoutMs = 1_500_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await callGateway({ action: "status", endpoint_id, job_id });
    const status = data?.status;
    if (status === "COMPLETED") return data.output ?? data;
    if (status === "FAILED" || status === "CANCELLED") {
      throw new Error(data?.error || `Job ${status}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Job timed out");
}

// Submit a route to the gateway; if it returns a job_id, poll until completion
// and unwrap the gateway handler's result.
async function runRoute(payload: Record<string, unknown>) {
  const data = await callGateway(payload);
  if (data?.job_id && data?.endpoint_id) {
    return await pollGateway(data.endpoint_id, data.job_id);
  }
  return data;
}

async function pollHallo2(endpoint_id: string, job_id: string, timeoutMs = 600_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const data = await callGateway({ action: "status", endpoint_id, job_id });
    if (data?.status === "COMPLETED") return data.output ?? data;
    if (data?.status === "FAILED") throw new Error(data?.error || "Lip-sync failed");
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Lip-sync timed out");
}

const VideoStep = () => {
  const {
    selectedTitle, scriptSections,
    imagePrompt, setImagePrompt,
    musicPrompt, setMusicPrompt,
    voice, setVoice,
    videoUrl, setVideoUrl,
    visualScenes,
  } = useProject();

  const scriptFromContext = useMemo(
    () => scriptSections.map((s) => s.text).join("\n\n"),
    [scriptSections]
  );
  const [scriptOverride, setScriptOverride] = useState<string | null>(null);
  const script = scriptOverride ?? scriptFromContext ?? "";

  const [stage, setStage] = useState<Stage>(videoUrl ? "done" : "idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(videoUrl ? 100 : 0);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Smoothly ease the progress bar toward the current stage's target.
  useEffect(() => {
    if (stage === "idle" || stage === "error") return;
    if (stage === "done") {
      setProgress(100);
      return;
    }
    const target = STAGE_TARGET[stage];
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= target) return p;
        // ease toward target, slower as we approach it
        return p + Math.max(0.3, (target - p) * 0.06);
      });
    }, 400);
    return () => window.clearInterval(id);
  }, [stage]);

  const generate = async () => {
    setErrorMsg(null);
    setVideoUrl(null);
    setProgress(0);
    setStage("generating");
    setStatusMsg(STAGE_LABEL.generating);

    try {
      const seedImageUrl = visualScenes.find((s) => s.imageUrl)?.imageUrl;

      // 1) Full pipeline (TTS + image + music + video + submit lipsync)
      const full = await runRoute({
        route: "workflow/full-video",
        params: {
          text: script,
          voice,
          image_prompt: imagePrompt,
          music_prompt: musicPrompt,
          ...(seedImageUrl ? { image_url: seedImageUrl } : {}),
        },
      });

      const out = full?.output ?? full;
      const voiceUrl: string | undefined = out?.voice?.url;
      const musicUrl: string | undefined = out?.music?.url || out?.music?.audio_url;
      const videoRaw: string | undefined =
        out?.video?.url || out?.video?.video_url || out?.video?.ipfs_url;
      const lipsync = out?.lip_sync;

      if (!videoRaw) throw new Error("No video URL returned from pipeline");

      // 2) Wait for lipsync (optional — fall back to raw video if missing)
      let finalVideo = videoRaw;
      if (lipsync?.job_id) {
        setStage("lipsync");
        setStatusMsg(STAGE_LABEL.lipsync);
        try {
          const lsOut = await pollHallo2(
            // endpoint id from poll_url
            (lipsync.poll_url as string).split("/v2/")[1].split("/")[0],
            lipsync.job_id,
          );
          finalVideo = lsOut?.video_url || lsOut?.url || finalVideo;
        } catch (e) {
          console.warn("Lip-sync failed, using raw video:", e);
          toast({ title: "Lip-sync skipped", description: String((e as Error).message) });
        }
      }

      // 3) Stitch video + voice + music into a single MP4
      setStage("stitching");
      setStatusMsg(STAGE_LABEL.stitching);
      const stitched = await runRoute({
        route: "workflow/stitch",
        params: {
          video_url: finalVideo,
          voice_url: voiceUrl,
          music_url: musicUrl,
          music_volume: 0.3,
        },
      });
      const stitchedUrl = stitched?.output?.url || stitched?.url;
      if (!stitchedUrl) throw new Error("Stitch returned no URL");

      // 4) Rehost the stitched MP4 onto our storage so the browser
      // doesn't load it from a third-party CDN that antivirus tools
      // (e.g. Quick Heal) routinely block.
      setStage("rehosting");
      setStatusMsg(STAGE_LABEL.rehosting);
      let finalUrl = stitchedUrl;
      try {
        const { data: rehost, error: rehostErr } = await supabase.functions.invoke(
          "rehost-video",
          { body: { url: stitchedUrl, label: selectedTitle || "vidforge" } },
        );
        if (rehostErr) throw new Error(rehostErr.message);
        if (rehost?.url) finalUrl = rehost.url as string;
        if (rehost?.rehosted === false) {
          console.warn("rehost-video fell back to source URL");
        }
      } catch (e) {
        console.warn("rehost-video failed, using stitch URL:", e);
      }

      setVideoUrl(finalUrl);
      setStage("done");
      setProgress(100);
      setStatusMsg(STAGE_LABEL.done);
      toast({ title: "Video ready", description: "Your generated video is ready to play." });
    } catch (e) {
      console.error(e);
      setStage("error");
      setErrorMsg((e as Error).message);
      toast({
        title: "Generation failed",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  const busy =
    stage === "generating" ||
    stage === "lipsync" ||
    stage === "stitching" ||
    stage === "rehosting";

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Generate Video</h3>
          <p className="text-xs text-muted-foreground">Text → voice → image → video → music → final MP4</p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Script</label>
          <Textarea
            value={script}
            onChange={(e) => setScriptOverride(e.target.value)}
            rows={4}
            disabled={busy}
            placeholder="Enter the narration text…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Image / Scene Prompt</label>
            <Input
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Music Prompt</label>
            <Input
              value={musicPrompt}
              onChange={(e) => setMusicPrompt(e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Voice</label>
            <Input
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              disabled={busy}
              placeholder="af_heart"
            />
          </div>
        </div>

        <Button onClick={generate} disabled={busy || !script.trim()} className="glow-sm h-11 w-full">
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {statusMsg}
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate Video
            </>
          )}
        </Button>

        {(busy || stage === "done") && (
          <div className="space-y-1.5">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{STAGE_LABEL[stage]}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {videoUrl && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-display font-semibold text-foreground">Your Video</h3>
          <video
            src={videoUrl}
            controls
            className="w-full rounded-xl border border-border bg-black aspect-video"
          />
          <div className="flex gap-2">
            <Button asChild className="glow-sm h-10">
              <a href={videoUrl} download target="_blank" rel="noreferrer">
                <Download className="w-4 h-4 mr-2" /> Download MP4
              </a>
            </Button>
            <Button asChild variant="outline" className="h-10">
              <a href={videoUrl} target="_blank" rel="noreferrer">Open in new tab</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoStep;
