import { useMemo, useState } from "react";
import { Music, Sparkles, Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";

const genres = [
  { label: "Cinematic", emoji: "🎬", directive: "cinematic orchestral score, sweeping strings, epic brass swells, film-trailer style" },
  { label: "Electronic", emoji: "⚡", directive: "modern electronic production, synth pads, punchy drum machine, driving bassline" },
  { label: "Orchestral", emoji: "🎻", directive: "full symphonic orchestra, lush strings, woodwinds, timpani, concert-hall reverb" },
  { label: "Lo-Fi", emoji: "🎧", directive: "lo-fi hip-hop instrumental, warm vinyl crackle, mellow jazz chords, soft drums" },
  { label: "Hip Hop", emoji: "🎤", directive: "hip hop beat, heavy 808 bass, crisp trap hi-hats, atmospheric melodic loop" },
  { label: "Ambient", emoji: "🌊", directive: "ambient atmospheric soundscape, ethereal pads, slow evolving textures, dreamy reverb" },
];

const bpmOptions = [
  { label: "80-120 (Medium)", value: "around 100 BPM, medium tempo" },
  { label: "60-80 (Slow)", value: "around 70 BPM, slow contemplative tempo" },
  { label: "120-160 (Fast)", value: "around 140 BPM, fast energetic tempo" },
];

const mixOptions = [
  { label: "Background (-12dB)", value: "mixed as background underscore, subtle and supportive of voiceover" },
  { label: "Subtle (-18dB)", value: "very subtle background ambience, minimal presence" },
  { label: "Prominent (-6dB)", value: "prominent and foreground, full presence and dynamics" },
];

type Segment = { label: string; mood: string; intensity: number; duration: number };

const defaultSegments: Segment[] = [
  { label: "Intro Hook", mood: "Mysterious, building tension", intensity: 30, duration: 15 },
  { label: "Rising Action", mood: "Energetic, driving rhythm", intensity: 60, duration: 20 },
  { label: "Climax", mood: "Peak energy, dramatic", intensity: 95, duration: 20 },
  { label: "Resolution", mood: "Reflective, fading out", intensity: 40, duration: 15 },
];

async function pollJob(endpointId: string, jobId: string, timeoutMs = 600_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await supabase.functions.invoke("runpod-gateway", {
      body: { action: "status", endpoint_id: endpointId, job_id: jobId },
    });
    if (error) throw new Error(error.message);
    if (data?.status === "COMPLETED") return data;
    if (data?.status === "FAILED") throw new Error(data?.error || "Soundtrack job failed");
    await new Promise((r) => setTimeout(r, 3500));
  }
  throw new Error("Soundtrack generation timed out");
}

const extractAudioUrl = (payload: any): string | undefined => {
  const o = payload?.output ?? payload;
  const n = o?.output ?? o;
  return n?.url || n?.audio_url || n?.ipfs_url;
};

async function rehostAudio(sourceUrl: string, segmentLabel: string) {
  try {
    const { data, error } = await supabase.functions.invoke("rehost-audio", {
      body: { url: sourceUrl, segment_label: segmentLabel },
    });
    if (error || !data?.url) return { url: sourceUrl, rehosted: false };
    return {
      url: data.url as string,
      source_url: sourceUrl,
      storage_path: data.storage_path as string | undefined,
      rehosted: Boolean(data.rehosted),
    };
  } catch {
    return { url: sourceUrl, rehosted: false };
  }
}

const SoundtrackStep = () => {
  const { selectedTitle, scriptSections, soundtrackTracks, setSoundtrackTracks } = useProject();
  const [genreIdx, setGenreIdx] = useState(0);
  const [bpmIdx, setBpmIdx] = useState(0);
  const [mixIdx, setMixIdx] = useState(0);
  const [segments, setSegments] = useState<Segment[]>(defaultSegments);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tracks = soundtrackTracks;
  const setTracks = setSoundtrackTracks;

  const scriptSummary = useMemo(() => {
    const joined = scriptSections.map((s) => `${s.section}: ${s.text}`).join(" ");
    return joined.slice(0, 400);
  }, [scriptSections]);

  const buildPrompt = (seg: Segment) => {
    const genre = genres[genreIdx];
    const bpm = bpmOptions[bpmIdx].value;
    const mix = mixOptions[mixIdx].value;
    const intensityWord = seg.intensity >= 80 ? "very high intensity" : seg.intensity >= 55 ? "high intensity" : seg.intensity >= 35 ? "medium intensity" : "low intensity";
    return [
      `${genre.label} soundtrack — ${genre.directive}.`,
      `Section "${seg.label}": ${seg.mood}. ${intensityWord}.`,
      `${bpm}.`,
      `${mix}.`,
      selectedTitle ? `Composed for a video titled "${selectedTitle}".` : "",
      scriptSummary ? `Script context: ${scriptSummary}.` : "",
      "Instrumental only, no vocals, no lyrics, no spoken word. High-fidelity studio production.",
    ].filter(Boolean).join(" ");
  };

  const updateSegment = (i: number, patch: Partial<Segment>) => {
    setSegments((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const generateOne = async (seg: Segment, idx: number, list: typeof tracks) => {
    list[idx] = { id: `t-${Date.now()}-${idx}`, segment: seg.label, status: "generating" };
    setTracks([...list]);
    const prompt = buildPrompt(seg);
    const { data, error: invokeError } = await supabase.functions.invoke("generate-soundtrack", {
      body: { prompt, duration: Math.min(47, Math.max(5, seg.duration)) },
    });
    if (invokeError) throw new Error(invokeError.message);
    if (data?.error) throw new Error(data.error);
    let url = data?.url;
    if (!url && data?.job_id && data?.endpoint_id) {
      const completed = await pollJob(data.endpoint_id, data.job_id);
      url = extractAudioUrl(completed);
    }
    if (!url) throw new Error("No audio URL returned");
    const rehost = await rehostAudio(url, seg.label);
    list[idx] = {
      ...list[idx],
      status: "done",
      url: rehost.url,
      source_url: rehost.source_url ?? url,
      storage_path: rehost.storage_path,
      rehosted: rehost.rehosted,
      created_at: Date.now(),
    };
    setTracks([...list]);
  };

  const generateAll = async () => {
    if (segments.length === 0) {
      toast({ title: "Add at least one segment", variant: "destructive" });
      return;
    }
    setError(null);
    setIsGenerating(true);
    const list: import("@/contexts/ProjectContext").SoundtrackTrack[] =
      segments.map((s, i) => ({ id: `pending-${i}`, segment: s.label, status: "generating" }));
    setTracks(list);
    let failures = 0;
    for (let i = 0; i < segments.length; i++) {
      try {
        await generateOne(segments[i], i, list);
      } catch (e) {
        failures++;
        list[i] = { ...list[i], status: "error", error: (e as Error).message };
        setTracks([...list]);
      }
    }
    setIsGenerating(false);
    if (failures) {
      const msg = `${failures} of ${segments.length} segment${segments.length === 1 ? "" : "s"} failed.`;
      setError(msg);
      toast({ title: "Finished with errors", description: msg, variant: "destructive" });
    } else {
      toast({ title: "Soundtrack ready", description: `${segments.length} segment${segments.length === 1 ? "" : "s"} generated.` });
    }
  };

  const removeTrack = (id: string) => {
    setTracks(tracks.filter((t) => t.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-foreground">Music Composer</h3>
        </div>

        <label className="text-xs text-muted-foreground mb-2 block font-medium">Genre</label>
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {genres.map((g, i) => (
            <button
              key={g.label}
              onClick={() => setGenreIdx(i)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all ${
                genreIdx === i ? "border-primary/40 bg-primary/8" : "border-border hover:border-primary/20"
              }`}
            >
              <span>{g.emoji}</span>
              <span className="text-xs font-medium text-foreground">{g.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">BPM Range</label>
            <select
              value={bpmIdx}
              onChange={(e) => setBpmIdx(Number(e.target.value))}
              className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
            >
              {bpmOptions.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Mix Level</label>
            <select
              value={mixIdx}
              onChange={(e) => setMixIdx(Number(e.target.value))}
              className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
            >
              {mixOptions.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground font-medium">Mood Timeline</label>
          <button
            onClick={() => setSegments((s) => [...s, { label: `Segment ${s.length + 1}`, mood: "Describe mood…", intensity: 50, duration: 15 }])}
            className="text-[10px] text-primary inline-flex items-center gap-1 hover:underline"
          >
            <Plus className="w-3 h-3" /> Add segment
          </button>
        </div>
        <div className="space-y-2 mb-5">
          {segments.map((seg, i) => (
            <div key={i} className="bg-secondary/30 rounded-xl p-3.5 border border-border/50 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={seg.label}
                  onChange={(e) => updateSegment(i, { label: e.target.value })}
                  className="flex-1 bg-background/60 border border-border rounded-lg px-2 py-1.5 text-xs font-medium text-foreground"
                />
                <input
                  type="number"
                  min={5}
                  max={47}
                  value={seg.duration}
                  onChange={(e) => updateSegment(i, { duration: Number(e.target.value) })}
                  className="w-20 bg-background/60 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground text-center"
                  title="Duration in seconds (max 47)"
                />
                <span className="text-[10px] text-muted-foreground">sec</span>
                <button
                  onClick={() => setSegments((s) => s.filter((_, idx) => idx !== i))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive"
                  aria-label="Remove segment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                value={seg.mood}
                onChange={(e) => updateSegment(i, { mood: e.target.value })}
                className="w-full bg-background/60 border border-border rounded-lg px-2 py-1.5 text-[11px] text-foreground"
                placeholder="Mood description"
              />
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={seg.intensity}
                  onChange={(e) => updateSegment(i, { intensity: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="text-[10px] text-muted-foreground w-10 text-right">{seg.intensity}%</span>
              </div>
            </div>
          ))}
        </div>

        <Button onClick={generateAll} disabled={isGenerating} className="w-full glow-sm h-11">
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {isGenerating ? "Generating soundtrack…" : "Generate Soundtrack"}
        </Button>

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {tracks.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Generated Tracks</h3>
          <div className="space-y-3">
            {tracks.map((t) => (
              <div key={t.id} className="bg-secondary/30 rounded-xl p-3.5 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{t.segment}</span>
                    {t.rehosted && (
                      <span className="text-[9px] uppercase tracking-wide text-primary/80 bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">Saved</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.status === "generating" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {t.status === "error" && (
                      <span className="text-[10px] text-destructive line-clamp-1">{t.error}</span>
                    )}
                    {t.status === "done" && (
                      <button
                        onClick={() => removeTrack(t.id)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Remove track"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {t.status === "done" && t.url && (
                  <audio controls src={t.url} className="w-full h-10" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SoundtrackStep;