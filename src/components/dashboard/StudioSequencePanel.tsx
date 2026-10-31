import { useEffect, useRef, useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject, type StudioTake } from "@/contexts/ProjectContext";
import { activeTake, sequenceSummary, validateFrameUrl } from "./studioClipUtils";
import { sequenceVideoUrl } from "./studioSequenceUtils";
import StudioClipPlayer from "./StudioClipPlayer";
const POLL_MS = 5000;
const usd = (n: number) => `$${n.toFixed(4)}`;

export default function StudioSequencePanel() {
  const { soundtrackTracks, studioClips: shots, studioSequence, setStudioSequence,
    sequenceSoundtrack: soundtrack, setSequenceSoundtrack: setSoundtrack,
    poolRate: rate, setPoolRate: setRate, studioBusy, setSequenceBusy } = useProject();
  const musicTracks = soundtrackTracks.filter((track) => track.status === "done" && track.url);
  const [stitching, setStitching] = useState(false);
  const [stitchPhase, setStitchPhase] = useState("");
  const [stitchError, setStitchError] = useState<string | null>(null);
  const cancel = useRef(false);
  useEffect(() => () => { cancel.current = true; }, []);
  useEffect(() => { setSequenceBusy(stitching); return () => setSequenceBusy(false); }, [stitching, setSequenceBusy]);
  const busy = studioBusy || stitching;
  const summary = sequenceSummary(shots, rate);
  const stitchable = shots.map(activeTake).filter((t): t is StudioTake => !!t?.videoUrl);
  const stitch = async () => {
    if (busy || stitchable.length < 2) return;
    cancel.current = false;
    setStitching(true); setStitchError(null); setStitchPhase("Sending sequence…");
    try {
      const selectedMusic = musicTracks.find((track) => track.id === soundtrack)?.url;
      const { data, error } = await supabase.functions.invoke("studio-stitch", { body: {
        action: "submit",
        video_clips: stitchable.map((take, index) => ({ url: take.videoUrl ?? "", shot_index: index })),
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
          setStudioSequence({ videoUrl, saved, jobId: data.job_id });
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

  return (
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
          {studioSequence.jobId && <p className="text-xs text-muted-foreground break-all">Job {studioSequence.jobId}</p>}
          <StudioClipPlayer key={studioSequence.videoUrl} label="Final sequence" videoUrl={studioSequence.videoUrl} saved={studioSequence.saved} />
        </div>}
      </div>
  );
}
