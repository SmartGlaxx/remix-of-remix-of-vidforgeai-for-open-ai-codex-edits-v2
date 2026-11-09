import { useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Loader2, ArrowUp, ArrowDown, X, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject, type StudioShot, type StudioTake } from "@/contexts/ProjectContext";
import { activeTake, sequenceSummary, validateFrameUrl } from "./studioClipUtils";
import { sequenceVideoUrl } from "./studioSequenceUtils";
import StudioClipPlayer from "./StudioClipPlayer";
const POLL_MS = 5000;
const usd = (n: number) => `$${n.toFixed(4)}`;
type CutShot = { shot: StudioShot; take: StudioTake };

export default function StudioSequencePanel() {
  const { voiceoverTracks, sequenceVoiceover, setSequenceVoiceover, soundtrackTracks, studioClips: shots, studioSequence, setStudioSequence,
    sequenceSoundtrack: soundtrack, setSequenceSoundtrack: setSoundtrack,
    poolRate: rate, setPoolRate: setRate, studioBusy, setSequenceBusy } = useProject();
  const voiceTracks = voiceoverTracks.filter(track => track.status === "done" && track.url);
  const musicTracks = soundtrackTracks.filter((track) => track.status === "done" && track.url);
  const [stitching, setStitching] = useState(false);
  const [stitchPhase, setStitchPhase] = useState("");
  const [stitchError, setStitchError] = useState<string | null>(null);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const cancel = useRef(false);
  useEffect(() => () => { cancel.current = true; }, []);
  useEffect(() => { setSequenceBusy(stitching); return () => setSequenceBusy(false); }, [stitching, setSequenceBusy]);
  const busy = studioBusy || stitching;
  const approvedShots = useMemo(() => shots.flatMap((shot) => {
    const take = activeTake(shot);
    return take?.status === "passed" && take.videoUrl ? [{ shot, take }] : [];
  }), [shots]);
  // Newly approved shots enter automatically after existing user reordering.
  useEffect(() => {
    const approvedIds = approvedShots.map(({ shot }) => shot.id);
    setOrderIds((previous) => [...previous.filter((id) => approvedIds.includes(id)), ...approvedIds.filter((id) => !previous.includes(id))]);
    setRemovedIds((previous) => previous.filter((id) => approvedIds.includes(id)));
  }, [approvedShots]);
  const orderedApproved = useMemo(() => {
    const byId = new Map(approvedShots.map((item) => [item.shot.id, item]));
    return [...orderIds.map((id) => byId.get(id)).filter((item): item is CutShot => !!item), ...approvedShots.filter(({ shot }) => !orderIds.includes(shot.id))];
  }, [approvedShots, orderIds]);
  const cut = orderedApproved.filter(({ shot }) => !removedIds.includes(shot.id));
  const removed = orderedApproved.filter(({ shot }) => removedIds.includes(shot.id));
  const summary = sequenceSummary(shots, rate);
  const move = (index: number, direction: -1 | 1) => {
    const visibleIds = cut.map(({ shot }) => shot.id);
    const target = index + direction;
    if (target < 0 || target >= visibleIds.length) return;
    [visibleIds[index], visibleIds[target]] = [visibleIds[target], visibleIds[index]];
    const hiddenIds = orderedApproved.map(({ shot }) => shot.id).filter((id) => removedIds.includes(id));
    setOrderIds([...visibleIds, ...hiddenIds]);
  };
  const stitch = async () => {
    if (busy || cut.length < 2) return;
    cancel.current = false;
    setStitching(true); setStitchError(null); setStitchPhase("Sending approved shots in order…");
    try {
      const selectedVoiceover = voiceTracks.find(track => track.id === sequenceVoiceover)?.url;
      const selectedMusic = musicTracks.find((track) => track.id === soundtrack)?.url;
      const { data, error } = await supabase.functions.invoke("studio-stitch", { body: {
        action: "submit",
        video_clips: cut.map(({ take }, index) => ({ url: take.videoUrl ?? "", shot_index: index })),
        ...(selectedMusic ? { soundtrack_url: selectedMusic } : {}),
        ...(selectedVoiceover ? { voiceover_url: selectedVoiceover } : {}),
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
          setStitchPhase("Saving finished video…");
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
          } catch { /* Retain the completed video when storage is unavailable. */ }
          if (cancel.current) return;
          setStudioSequence({ videoUrl, saved, jobId: data.job_id });
          toast({ title: "Final cut ready" });
          return;
        }
        if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(result?.status)) {
          throw new Error(result.error || `Stitch ${result.status.toLowerCase()}`);
        }
        setStitchPhase(result?.status === "IN_QUEUE" ? "Waiting for stitch worker…" : "Joining the approved shots…");
      }
    } catch (error) {
      setStitchError(error instanceof Error ? error.message : "Stitch failed");
    } finally { setStitching(false); }
  };

  return (
    <div className="space-y-6"><div className="workspace-page-head"><div><h2>Final cut</h2><p>Approved takes appear automatically in shot order. Change the order or remove a shot only when you choose to.</p></div></div>
      <section className="workspace-card space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="mt-1 text-xl font-semibold">Shot order</h2>
            <p className="mt-1 text-sm text-muted-foreground">Approved takes are placed here automatically. Adjust the order only if you choose.</p></div>
          <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">{cut.length} in cut</span>
        </div>
        {cut.length ? <ol className="space-y-3" aria-label="Final cut shot order">
          {cut.map(({ shot, take }, index) => {
            const originalIndex = shots.findIndex((item) => item.id === shot.id);
            const takeIndex = shot.activeTakeIndex + 1;
            return <li key={shot.id} className="cut-shot-row">
              <span className="cut-shot-index">{String(index + 1).padStart(2, "0")}</span>
              <div className="cut-shot-preview">{take.videoUrl && <video src={take.videoUrl} muted playsInline preload="metadata" aria-label={`Shot ${originalIndex + 1} preview`} />}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Shot {originalIndex + 1}</p>
                <p className="mt-1 text-xs text-muted-foreground">Take {takeIndex} · approved · {shot.durationSeconds}s</p></div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" aria-label={`Move shot ${originalIndex + 1} earlier`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={`Move shot ${originalIndex + 1} later`} disabled={busy || index === cut.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label={`Remove shot ${originalIndex + 1} from cut`} disabled={busy} onClick={() => setRemovedIds((previous) => [...previous, shot.id])}><X className="h-4 w-4" /></Button>
              </div>
            </li>;
          })}
        </ol> : <div className="cut-empty"><Film className="h-7 w-7 text-muted-foreground" /><p className="mt-3 font-medium">Your cut will build itself</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Approve a take for each shot in Director. Approved takes will appear here in shot order.</p></div>}
        {removed.length > 0 && <div className="space-y-2 border-t border-border pt-4"><p className="text-xs font-medium text-muted-foreground">Removed from this cut</p>
          {removed.map(({ shot }, index) => <div key={shot.id} className="flex items-center justify-between text-sm"><span>Shot {shots.findIndex((item) => item.id === shot.id) + 1}</span><Button variant="ghost" size="sm" disabled={busy} onClick={() => setRemovedIds((previous) => previous.filter((id) => id !== shot.id))}>Add back</Button></div>)}
        </div>}
      </section>

      <section className="workspace-card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Stitch final cut</h3><p className="mt-1 text-sm text-muted-foreground">Join this ordered list into one finished video.</p></div>
          <Button onClick={stitch} disabled={busy || cut.length < 2} size="lg" className="min-w-44 workspace-export">
            {stitching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}{stitching ? "Stitching…" : "Stitch final cut"}
          </Button>
        </div>
        {stitching && <p role="status" className="text-sm text-muted-foreground">{stitchPhase}</p>}
        {stitchError && <p role="alert" className="text-sm text-destructive">{stitchError}</p>}
        {studioSequence && <div className="space-y-3 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">Finished video</h4>
            {studioSequence.jobId && <p className="max-w-full break-all rounded-md bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">Stitch job · {studioSequence.jobId}</p>}</div>
          <StudioClipPlayer key={studioSequence.videoUrl} label="Finished video" videoUrl={studioSequence.videoUrl} saved={studioSequence.saved} />
        </div>}
      </section>

      <section className="workspace-card space-y-2">
        <div><p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Optional</p><h3 className="mt-1 font-semibold">Background music</h3></div>
        <label className="block max-w-xl space-y-1 text-sm"><span className="text-xs text-muted-foreground">Choose an existing saved track</span>
          <select aria-label="Sequence soundtrack" value={soundtrack} disabled={busy} onChange={(event) => setSoundtrack(event.target.value)} className="w-full rounded-lg border border-border bg-background p-3">
            <option value="">No added music</option>{musicTracks.map((track) => <option key={track.id} value={track.id}>{track.segment}</option>)}
          </select>
        </label>
        <label className="block max-w-xl space-y-1 text-sm"><span className="text-xs text-muted-foreground">Voiceover</span>
          <select aria-label="Sequence voiceover" value={sequenceVoiceover} disabled={busy} onChange={event => setSequenceVoiceover(event.target.value)} className="w-full rounded-lg border border-border bg-background p-3">
            <option value="">No voiceover</option>{voiceTracks.map(track => <option key={track.id} value={track.id}>{track.segment}</option>)}
          </select>
        </label>
      </section>      <details className="rounded-xl border border-border bg-card/40 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">Production cost summary</summary>
        <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4" aria-label="Cost summary">
          <label className="space-y-1"><span className="text-muted-foreground">GPU pool rate ($/hr)</span>
            <Input aria-label="GPU pool rate" type="number" min={0} step={0.01} value={rate} onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))} /></label>
          <div><p className="text-muted-foreground">Total spend (incl. rejected/failed)</p><p className="mt-1 text-sm font-semibold" data-testid="cost-total">{usd(summary.total)}</p></div>
          <div><p className="text-muted-foreground">Per approved shot ({summary.approvedShots})</p><p className="mt-1 text-sm font-semibold" data-testid="cost-per-shot">{usd(summary.perApprovedShot)}</p></div>
          <div><p className="text-muted-foreground">Per finished minute</p><p className="mt-1 text-sm font-semibold" data-testid="cost-per-minute">{usd(summary.perFinishedMinute)}</p></div>
        </div>
      </details>


    </div>
  );
}
