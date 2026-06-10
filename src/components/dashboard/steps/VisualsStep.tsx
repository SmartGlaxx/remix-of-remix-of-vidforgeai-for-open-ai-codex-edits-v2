import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image, Sparkles, RefreshCw, Trash2, Loader2, AlertCircle, Scissors, Wand2,
  Settings2, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject, type VisualScene } from "@/contexts/ProjectContext";

const MIN_VISUALS = 4;
const SECONDS_PER_VISUAL = 15;

const PRESET_STYLES = [
  "Cinematic", "Documentary", "Comic Book", "Anime",
  "Oil Painting", "3D Render", "Vintage Cyber-Pop", "Editorial Fashion",
];
const AMBIANCE_OPTIONS = ["Light & Vibrant", "Neutral & Realistic", "Dark & Somber"];
const CAMERA_OPTIONS = [
  "Dynamic First-Person (Action)",
  "Cinematic Close-Up (Emotion)",
  "Low-Angle Heroic (Power)",
  "Epic Landscape (Scale)",
  "Dutch Angle (Tension)",
];
const ENGINE_OPTIONS = [
  "IMAX Hollywood Quality",
  "Analog Film Nostalgia",
  "CGI Hyper-Realism",
  "National Geographic Raw",
];
const PALETTE_OPTIONS = [
  "Cyberpunk Neon",
  "Teal & Tangerine",
  "Monochromatic Noir",
  "Earthy Pastel",
];
const ASPECT_OPTIONS = ["16:9", "9:16", "1:1"];

const SelectMini = ({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) => (
  <label className="block">
    <span className="text-[9px] uppercase font-semibold text-muted-foreground">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-background/70 border border-border rounded-md px-1.5 py-1 text-[10px] text-foreground mt-0.5"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </label>
);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getVisualRange = (durationSeconds: number) => {
  const safeSeconds = Math.max(SECONDS_PER_VISUAL, durationSeconds || 0);
  const recommended = Math.max(MIN_VISUALS, Math.ceil(safeSeconds / SECONDS_PER_VISUAL));
  const allowance = Math.max(2, Math.round(recommended * 0.25));
  return {
    recommended,
    min: Math.max(MIN_VISUALS, recommended - allowance),
    max: recommended + allowance,
    allowance,
  };
};

const getWords = (text: string) => text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

const trimText = (text: string, max = 620) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}…` : clean;
};

const extractImageUrl = (payload: any): string | undefined => {
  const output = payload?.output ?? payload;
  const nested = output?.output ?? output;
  return nested?.url || nested?.image_url || nested?.ipfs_url || nested?.image?.url || nested?.image?.ipfs_url;
};

async function pollVisualJob(endpointId: string, jobId: string, timeoutMs = 600_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await supabase.functions.invoke("runpod-gateway", {
      body: { action: "status", endpoint_id: endpointId, job_id: jobId },
    });
    if (error) throw new Error(error.message);
    if (data?.status === "COMPLETED") return data;
    if (data?.status === "FAILED") throw new Error(data?.error || "Visual job failed");
    await new Promise((resolve) => setTimeout(resolve, 3500));
  }
  throw new Error("Visual generation timed out");
}

const VisualsStep = () => {
  const {
    selectedTitle, scriptSections, scriptMeta,
    visualScenes, setVisualScenes,
    visualCount, setVisualCount,
    visualStyle, setVisualStyle,
    visualAspectRatio, setVisualAspectRatio,
    visualAmbiance, setVisualAmbiance,
    visualCamera, setVisualCamera,
    visualEngine, setVisualEngine,
    visualPalette, setVisualPalette,
    audioDuration,
  } = useProject();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [blinkSettings, setBlinkSettings] = useState(false);
  const [approvedGenerate, setApprovedGenerate] = useState(false);
  const autoPlannedRef = useRef(false);

  const scriptText = useMemo(
    () => scriptSections.map((s) => `${s.section}\n${s.text}`).join("\n\n").trim(),
    [scriptSections],
  );
  const estimatedSeconds = useMemo(() => {
    if (audioDuration && audioDuration > 0) return audioDuration;
    const words = getWords(scriptText).length;
    // Fallback: 150 words per minute
    return (words / 150) * 60;
  }, [audioDuration, scriptText]);
  const visualRange = useMemo(() => getVisualRange(estimatedSeconds), [estimatedSeconds]);
  // (selected style displayed in select element)

  // Auto-sync visualCount to recommended whenever audio duration changes,
  // or when the persisted count is outside the valid range (e.g. stale value
  // from a previous word-count-based formula).
  const lastSyncedDuration = useRef<number | null>(null);
  useEffect(() => {
    const durationKey = audioDuration > 0 ? audioDuration : null;
    const outOfRange = visualCount < visualRange.min || visualCount > visualRange.max;
    if (durationKey !== lastSyncedDuration.current || outOfRange) {
      lastSyncedDuration.current = durationKey;
      if (visualCount !== visualRange.recommended) {
        setVisualCount(visualRange.recommended);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioDuration, visualRange.recommended, visualRange.min, visualRange.max]);

  const scenePlan = useMemo(() => {
    const words = getWords(scriptText);
    if (!words.length) return [] as VisualScene[];
    const count = clamp(Math.round(visualCount || visualRange.recommended), visualRange.min, visualRange.max);
    const sectionWordEnds = scriptSections.reduce<{ section: string; end: number }[]>((acc, section) => {
      const last = acc[acc.length - 1]?.end ?? 0;
      acc.push({ section: section.section, end: last + getWords(section.text).length });
      return acc;
    }, []);

    return Array.from({ length: count }, (_, i) => {
      const start = Math.floor((i * words.length) / count);
      const end = Math.max(start + 12, Math.floor(((i + 1) * words.length) / count));
      const text = words.slice(start, Math.min(end, words.length)).join(" ");
      const midpoint = start + Math.floor((end - start) / 2);
      const section = sectionWordEnds.find((s) => midpoint <= s.end)?.section || `Scene ${i + 1}`;
      const sceneText = trimText(text || scriptText, 520);
      return {
        id: `scene-${i + 1}`,
        section,
        text: sceneText,
        // Do NOT inject the video title or any titular wording — the model
        // will try to render those letters into the image (gibberish text).
        // Describe the scene visually only.
        prompt: trimText(`A purely visual scene depicting: ${sceneText}`, 720),
        imageUrl: visualScenes[i]?.imageUrl,
        status: (visualScenes[i]?.imageUrl ? "done" : "pending") as VisualScene["status"],
        error: undefined,
      } as VisualScene;
    });
  }, [scriptText, scriptSections, selectedTitle, visualCount, visualRange.min, visualRange.max, visualRange.recommended, visualScenes]);

  const scenesToShow = visualScenes.length ? visualScenes : scenePlan;
  const completed = scenesToShow.filter((scene) => scene.status === "done" && scene.imageUrl).length;

  const updateScene = (scenes: VisualScene[], index: number, patch: Partial<VisualScene>) => {
    scenes[index] = { ...scenes[index], ...patch };
    setVisualScenes([...scenes]);
  };

  const generateOne = async (scenes: VisualScene[], index: number) => {
    updateScene(scenes, index, { status: "generating", error: undefined });
    const sc = scenes[index];
    const promptToSend = (sc.conceptualPrompt && sc.conceptualPrompt.trim()) || sc.prompt;
    const { data, error: invokeError } = await supabase.functions.invoke("generate-visual", {
      body: {
        prompt: promptToSend,
        style: sc.styleOverride || visualStyle,
        aspect_ratio: sc.aspectOverride || visualAspectRatio,
        ambiance: sc.ambianceOverride || visualAmbiance,
        camera: sc.cameraAngle || visualCamera,
        engine: sc.engineOverride || visualEngine,
        palette: sc.paletteOverride || visualPalette,
        index,
      },
    });
    if (invokeError) throw new Error(invokeError.message);
    if (data?.error) throw new Error(data.error);
    let imageUrl = data?.image_url || data?.url;
    if (!imageUrl && data?.job_id && data?.endpoint_id) {
      const completed = await pollVisualJob(data.endpoint_id, data.job_id);
      imageUrl = extractImageUrl(completed);
    }
    if (!imageUrl) throw new Error("No image URL returned");

    // Re-host on Lovable Cloud Storage so the image is served from a trusted
    // *.supabase.co domain (avoids AV blocks on ipfs.filebase.io). The original
    // URL still works for downstream RunPod video compilation if needed.
    try {
      const { data: rehosted } = await supabase.functions.invoke("rehost-image", {
        body: { url: imageUrl },
      });
      if (rehosted?.image_url) imageUrl = rehosted.image_url;
    } catch (e) {
      console.warn("rehost-image failed, using original URL:", e);
    }

    updateScene(scenes, index, { status: "done", imageUrl, prompt: data?.prompt || scenes[index].prompt });
  };

  const generateVisuals = async () => {
    if (!scriptText) {
      toast({ title: "No script found", description: "Generate the script before creating visuals.", variant: "destructive" });
      return;
    }

    if (!approvedGenerate) {
      setApprovedGenerate(true);
      setBlinkSettings(true);
      window.setTimeout(() => setBlinkSettings(false), 1800);
      toast({
        title: "Review settings on each frame",
        description: "Click any blinking ⚙ button to confirm a frame's prompt & look, then press Generate All again.",
      });
      return;
    }

    const count = clamp(Math.round(visualCount), visualRange.min, visualRange.max);
    if (count !== visualCount) setVisualCount(count);

    const scenes: VisualScene[] = scenePlan.slice(0, count).map((scene) => ({
      ...scene,
      status: scene.imageUrl ? "done" : "pending",
    }));
    setVisualScenes(scenes);
    setIsGenerating(true);
    setError(null);

    let cursor = 0;
    let failures = 0;
    const worker = async () => {
      while (cursor < scenes.length) {
        const index = cursor;
        cursor += 1;
        try {
          await generateOne(scenes, index);
        } catch (e) {
          failures += 1;
          updateScene(scenes, index, { status: "error", error: (e as Error).message });
        }
      }
    };

    try {
      // Serial generation — Together AI Flux.2 rate-limits aggressive parallel calls.
      await Promise.all(Array.from({ length: Math.min(1, scenes.length) }, worker));
      if (failures) {
        const msg = `${failures} visual${failures === 1 ? "" : "s"} failed. You can retry individual scenes.`;
        setError(msg);
        toast({ title: "Visual generation finished with errors", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Visuals generated", description: `${scenes.length} script-based visuals are ready.` });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateScene = async (index: number) => {
    const scenes = (visualScenes.length ? visualScenes : scenePlan).map((scene) => ({ ...scene }));
    setVisualScenes(scenes);
    setIsGenerating(true);
    try {
      await generateOne(scenes, index);
      toast({ title: "Scene regenerated" });
    } catch (e) {
      updateScene(scenes, index, { status: "error", error: (e as Error).message });
      toast({ title: "Scene failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const removeScene = (index: number) => {
    setVisualScenes(scenesToShow.filter((_, i) => i !== index));
    setVisualCount(Math.max(visualRange.min, visualCount - 1));
  };

  const planStoryboard = async () => {
    if (!scriptText) {
      toast({ title: "No script", description: "Generate the script first.", variant: "destructive" });
      return;
    }
    const count = clamp(Math.round(visualCount), visualRange.min, visualRange.max);
    setIsPlanning(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("plan-storyboard", {
        body: { scriptText, count },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data?.error) throw new Error(data.error);
      const frames: { sourceText: string; conceptualPrompt: string; cameraAngle: string }[] = data?.frames || [];
      const sectionWordEnds = scriptSections.reduce<{ section: string; end: number }[]>((acc, section) => {
        const last = acc[acc.length - 1]?.end ?? 0;
        acc.push({ section: section.section, end: last + getWords(section.text).length });
        return acc;
      }, []);
      const totalWords = getWords(scriptText).length;
      const scenes: VisualScene[] = frames.map((f, i) => {
        const midpoint = Math.floor(((i + 0.5) / frames.length) * totalWords);
        const section = sectionWordEnds.find((s) => midpoint <= s.end)?.section || `Scene ${i + 1}`;
        return {
          id: `scene-${i + 1}`,
          section,
          text: trimText(f.sourceText, 520),
          prompt: trimText(f.conceptualPrompt, 720),
          conceptualPrompt: f.conceptualPrompt,
          cameraAngle: f.cameraAngle,
          status: "pending",
        };
      });
      setVisualScenes(scenes);
      toast({ title: "Storyboard ready", description: `${scenes.length} frames planned. Review and tweak before generating.` });
    } catch (e) {
      toast({ title: "Storyboard failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsPlanning(false);
    }
  };

  const patchScene = (index: number, patch: Partial<VisualScene>) => {
    const base = (visualScenes.length ? visualScenes : scenePlan).map((s) => ({ ...s }));
    base[index] = { ...base[index], ...patch };
    setVisualScenes(base);
  };

  // Auto-populate Conceptual Metaphors when the visuals page is opened and
  // no scene yet has one. Runs once per mount when the script is ready.
  useEffect(() => {
    if (autoPlannedRef.current) return;
    if (!scriptText || isPlanning) return;
    const hasAny = (visualScenes.length ? visualScenes : []).some(
      (s) => s.conceptualPrompt && s.conceptualPrompt.trim().length > 0,
    );
    if (hasAny) {
      autoPlannedRef.current = true;
      return;
    }
    autoPlannedRef.current = true;
    void planStoryboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptText]);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <Image className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Visual Engine</h3>
            <p className="text-xs text-muted-foreground">Script-aware scene segmentation and image generation</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-secondary/30 p-4 mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Scissors className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Generated script source</span>
          </div>
          <Textarea
            value={scriptText || ""}
            readOnly
            rows={4}
            placeholder="Generate a script first. Visual scenes will be segmented from that generated text."
            className="resize-none bg-background/60 text-xs leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">1. Preset Image Type</label>
            <select value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              {PRESET_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">2. Ambiance & Lighting</label>
            <select value={visualAmbiance} onChange={(e) => setVisualAmbiance(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              {AMBIANCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">3. Camera Angle & Framing</label>
            <select value={visualCamera} onChange={(e) => setVisualCamera(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              {CAMERA_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">4. Technical Engine & Lens</label>
            <select value={visualEngine} onChange={(e) => setVisualEngine(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              {ENGINE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">5. Color Grading & Palette</label>
            <select value={visualPalette} onChange={(e) => setVisualPalette(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              {PALETTE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Aspect Ratio</label>
            <select value={visualAspectRatio} onChange={(e) => setVisualAspectRatio(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option value="16:9">16:9 (Landscape)</option>
              <option value="9:16">9:16 (Portrait)</option>
              <option value="1:1">1:1 (Square)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Visual Count</label>
            <input
              type="number"
              min={visualRange.min}
              max={visualRange.max}
              value={visualCount}
              onChange={(e) => setVisualCount(Number(e.target.value))}
              onBlur={() => setVisualCount(clamp(Math.round(visualCount || visualRange.recommended), visualRange.min, visualRange.max))}
              className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Recommended {visualRange.recommended}; range {visualRange.min}-{visualRange.max}
              {" "}({Math.round(estimatedSeconds)}s {audioDuration > 0 ? "audio" : "estimated"}, 15s per clip)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="outline" className="h-11" onClick={planStoryboard} disabled={isPlanning || isGenerating || !scriptText}>
            {isPlanning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
            {isPlanning ? "Planning Storyboard…" : "1. Plan Storyboard (AI)"}
          </Button>
          <Button className="glow-sm h-11" onClick={generateVisuals} disabled={isGenerating || !scriptText}>
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {isGenerating ? `Generating ${completed}/${scenesToShow.length || visualCount}…` : `2. Generate All (${visualCount})`}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Step 1 chunks the script and proposes a concept + camera angle per frame. Step 2 renders every card with its (optionally edited) settings.
        </p>

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display font-semibold text-foreground">Scene Visuals</h3>
            <p className="text-xs text-muted-foreground">{scenesToShow.length ? `${completed}/${scenesToShow.length} generated` : "No script-based scenes yet"}</p>
          </div>
          {visualScenes.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setVisualScenes(scenePlan)} disabled={isGenerating}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-segment
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {scenesToShow.slice(0, Math.max(visualCount, scenesToShow.length)).map((scene, i) => {
            const hasConcept = !!(scene.conceptualPrompt && scene.conceptualPrompt.trim());
            const isLoadingConcept = !hasConcept && isPlanning;
            return (
              <div
                key={`${scene.id}-${i}`}
                className="group relative rounded-xl border border-border bg-secondary/30 overflow-hidden cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
                onClick={() => setModalIndex(i)}
              >
                <div className="aspect-video bg-secondary/60 flex items-center justify-center relative overflow-hidden">
                  {scene.imageUrl ? (
                    <img src={scene.imageUrl} alt={`Visual ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  ) : scene.status === "generating" ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      <span className="text-[9px] text-muted-foreground">Rendering…</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-muted-foreground/50">
                      <Image className="w-8 h-8" />
                      <span className="text-[9px]">No image yet</span>
                    </div>
                  )}

                  {/* Hover overlay: settings + delete + helper text */}
                  <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); setModalIndex(i); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/25 hover:bg-primary/40 border border-primary/40 text-primary text-[11px] font-semibold ${blinkSettings ? "blink-green" : ""}`}
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      Set up visual
                    </button>
                    {scene.imageUrl && (
                      <button
                        onClick={(e) => { e.stopPropagation(); regenerateScene(i); }}
                        disabled={isGenerating}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-background/70 hover:bg-background text-[10px] disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" /> Regenerate
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeScene(i); }}
                      disabled={isGenerating}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-destructive/30 hover:bg-destructive/60 flex items-center justify-center disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3 text-destructive-foreground" />
                    </button>
                    <span className="absolute bottom-1 left-0 right-0 text-[9px] text-muted-foreground/90">
                      Click to set up & preview
                    </span>
                  </div>

                  <span className="absolute top-1.5 left-1.5 text-[9px] text-foreground bg-background/70 px-1.5 py-0.5 rounded">
                    {i + 1}
                  </span>
                  {isLoadingConcept && (
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] text-primary bg-background/80 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> AI describing…
                    </span>
                  )}
                  {scene.status === "error" && (
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] text-destructive bg-background/80 px-1.5 py-0.5 rounded">
                      Failed — click to fix
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Frame setup modal (carousel) */}
      <Dialog open={modalIndex !== null} onOpenChange={(o) => { if (!o) setModalIndex(null); }}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-card">
          {modalIndex !== null && scenesToShow[modalIndex] && (() => {
            const i = modalIndex;
            const scene = scenesToShow[i];
            const styleVal = scene.styleOverride || visualStyle;
            const ambianceVal = scene.ambianceOverride || visualAmbiance;
            const engineVal = scene.engineOverride || visualEngine;
            const paletteVal = scene.paletteOverride || visualPalette;
            const aspectVal = scene.aspectOverride || visualAspectRatio;
            const cameraVal = scene.cameraAngle || visualCamera;
            const canPrev = i > 0;
            const canNext = i < scenesToShow.length - 1;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-h-[85vh]">
                {/* Left: image + carousel arrows */}
                <div className="relative bg-secondary/60 flex items-center justify-center min-h-[300px]">
                  {scene.imageUrl ? (
                    <img src={scene.imageUrl} alt={`Visual ${i + 1}`} className="w-full h-full object-contain max-h-[85vh]" />
                  ) : scene.status === "generating" ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">Rendering this frame…</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
                      <Image className="w-12 h-12" />
                      <span className="text-xs">No image yet — adjust settings & press Generate</span>
                    </div>
                  )}
                  <button
                    onClick={() => canPrev && setModalIndex(i - 1)}
                    disabled={!canPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 hover:bg-background flex items-center justify-center disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => canNext && setModalIndex(i + 1)}
                    disabled={!canNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 hover:bg-background flex items-center justify-center disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="absolute top-2 left-2 text-[11px] bg-background/80 px-2 py-1 rounded">
                    Frame {i + 1} / {scenesToShow.length} · {scene.section}
                  </span>
                </div>

                {/* Right: settings panel */}
                <div className="p-5 overflow-y-auto space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-display font-semibold text-foreground">Frame Setup</h4>
                    <button onClick={() => setModalIndex(null)} className="w-7 h-7 rounded-md hover:bg-secondary flex items-center justify-center">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-semibold text-muted-foreground">Source Text</label>
                    <p className="text-xs text-muted-foreground/90 mt-1 max-h-24 overflow-y-auto">{scene.text}</p>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-semibold text-muted-foreground">Conceptual Metaphor (AI image description)</label>
                    {!scene.conceptualPrompt && isPlanning ? (
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground bg-background/60 border border-border rounded-md p-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        Crafting a visual description from the script…
                      </div>
                    ) : (
                      <Textarea
                        value={scene.conceptualPrompt ?? scene.prompt ?? ""}
                        onChange={(e) => patchScene(i, { conceptualPrompt: e.target.value, prompt: e.target.value })}
                        rows={3}
                        placeholder="e.g. A picture of the sun, blazing and hot, scorching cracked desert earth…"
                        className="text-xs mt-1 resize-none bg-background/60"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <SelectMini label="Style" value={styleVal} options={PRESET_STYLES} onChange={(v) => patchScene(i, { styleOverride: v })} />
                    <SelectMini label="Ambiance" value={ambianceVal} options={AMBIANCE_OPTIONS} onChange={(v) => patchScene(i, { ambianceOverride: v })} />
                    <SelectMini label="Camera" value={cameraVal} options={CAMERA_OPTIONS} onChange={(v) => patchScene(i, { cameraAngle: v })} />
                    <SelectMini label="Engine" value={engineVal} options={ENGINE_OPTIONS} onChange={(v) => patchScene(i, { engineOverride: v })} />
                    <SelectMini label="Palette" value={paletteVal} options={PALETTE_OPTIONS} onChange={(v) => patchScene(i, { paletteOverride: v })} />
                    <SelectMini label="Aspect" value={aspectVal} options={ASPECT_OPTIONS} onChange={(v) => patchScene(i, { aspectOverride: v })} />
                  </div>
                  <Button className="w-full" onClick={() => regenerateScene(i)} disabled={isGenerating}>
                    {scene.status === "generating" ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> {scene.imageUrl ? "Regenerate this frame" : "Generate this frame"}</>
                    )}
                  </Button>
                  {scene.status === "error" && (
                    <p className="text-[11px] text-destructive">{scene.error}</p>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border">
                    <button onClick={() => canPrev && setModalIndex(i - 1)} disabled={!canPrev} className="flex items-center gap-1 hover:text-foreground disabled:opacity-40">
                      <ChevronLeft className="w-3 h-3" /> Previous frame
                    </button>
                    <button onClick={() => canNext && setModalIndex(i + 1)} disabled={!canNext} className="flex items-center gap-1 hover:text-foreground disabled:opacity-40">
                      Next frame <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VisualsStep;
