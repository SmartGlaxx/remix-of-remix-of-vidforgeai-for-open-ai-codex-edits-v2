import { useEffect, useMemo, useState } from "react";
import {
  Image, Sparkles, RefreshCw, ZoomIn, Trash2, Loader2, AlertCircle, Scissors,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject, type VisualScene } from "@/contexts/ProjectContext";

const MIN_VISUALS = 24;
const LOWER_END_MINUTES = 8;
const HIGHER_END_MINUTES = 30;

const stylePresets = [
  { name: "Cinematic", preview: "🎬" },
  { name: "Documentary", preview: "📽️" },
  { name: "Comic Book", preview: "💥" },
  { name: "Anime", preview: "🌸" },
  { name: "Oil Painting", preview: "🎨" },
  { name: "3D Render", preview: "🧊" },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getVisualRange = (minutes: number) => {
  const normalized = clamp(minutes || LOWER_END_MINUTES, LOWER_END_MINUTES, HIGHER_END_MINUTES);
  const recommended = Math.max(MIN_VISUALS, Math.round(normalized * 7.5));
  const allowance = Math.round(20 + ((normalized - LOWER_END_MINUTES) / (HIGHER_END_MINUTES - LOWER_END_MINUTES)) * 10);
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
    visualQuality, setVisualQuality,
    visualMotion, setVisualMotion,
  } = useProject();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scriptText = useMemo(
    () => scriptSections.map((s) => `${s.section}\n${s.text}`).join("\n\n").trim(),
    [scriptSections],
  );
  const estimatedMinutes = scriptMeta?.minutes || Math.max(LOWER_END_MINUTES, Math.round(getWords(scriptText).length / 140));
  const visualRange = useMemo(() => getVisualRange(estimatedMinutes), [estimatedMinutes]);
  const selectedStyleIndex = Math.max(0, stylePresets.findIndex((s) => s.name === visualStyle));

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
        prompt: trimText(`${selectedTitle ? `Video title: ${selectedTitle}. ` : ""}Create a visual for this narration beat: ${sceneText}`, 720),
        imageUrl: visualScenes[i]?.imageUrl,
        status: (visualScenes[i]?.imageUrl ? "done" : "pending") as VisualScene["status"],
        error: undefined,
      } as VisualScene;
    });
  }, [scriptText, scriptSections, selectedTitle, visualCount, visualRange.min, visualRange.max, visualRange.recommended, visualScenes]);

  const scenesToShow = visualScenes.length ? visualScenes : scenePlan;
  const completed = scenesToShow.filter((scene) => scene.status === "done" && scene.imageUrl).length;

  useEffect(() => {
    if (!visualScenes.length && visualCount !== visualRange.recommended) {
      setVisualCount(visualRange.recommended);
    }
  }, [visualRange.recommended, visualScenes.length, visualCount, setVisualCount]);

  const updateScene = (scenes: VisualScene[], index: number, patch: Partial<VisualScene>) => {
    scenes[index] = { ...scenes[index], ...patch };
    setVisualScenes([...scenes]);
  };

  const generateOne = async (scenes: VisualScene[], index: number) => {
    updateScene(scenes, index, { status: "generating", error: undefined });
    const { data, error: invokeError } = await supabase.functions.invoke("generate-visual", {
      body: {
        prompt: scenes[index].prompt,
        style: visualStyle,
        aspect_ratio: visualAspectRatio,
        quality: visualQuality,
        motion: visualMotion,
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
    updateScene(scenes, index, { status: "done", imageUrl, prompt: data?.prompt || scenes[index].prompt });
  };

  const generateVisuals = async () => {
    if (!scriptText) {
      toast({ title: "No script found", description: "Generate the script before creating visuals.", variant: "destructive" });
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
      await Promise.all(Array.from({ length: Math.min(3, scenes.length) }, worker));
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

        <label className="text-xs text-muted-foreground mb-2 block font-medium">Style Preset</label>
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {stylePresets.map((style, i) => (
            <button
              key={style.name}
              onClick={() => setVisualStyle(style.name)}
              className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border min-w-[88px] transition-all ${
                selectedStyleIndex === i
                  ? "border-primary/40 bg-primary/8 shadow-md shadow-primary/5"
                  : "border-border hover:border-primary/20"
              }`}
            >
              <span className="text-2xl">{style.preview}</span>
              <span className="text-[10px] font-medium text-foreground">{style.name}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Aspect Ratio</label>
            <select value={visualAspectRatio} onChange={(e) => setVisualAspectRatio(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option value="16:9">16:9 (Landscape)</option>
              <option value="9:16">9:16 (Portrait)</option>
              <option value="1:1">1:1 (Square)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Quality</label>
            <select value={visualQuality} onChange={(e) => setVisualQuality(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option>HD</option>
              <option>Ultra HD</option>
              <option>Standard</option>
            </select>
          </div>
          <div>
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
            <p className="text-[10px] text-muted-foreground mt-1">Recommended {visualRange.recommended}; range {visualRange.min}-{visualRange.max} ({estimatedMinutes} min script)</p>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Motion</label>
            <select value={visualMotion} onChange={(e) => setVisualMotion(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option>Static</option>
              <option>Ken Burns + Pan</option>
              <option>Full Animation</option>
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">Static is the default for image generation.</p>
          </div>
        </div>

        <Button className="w-full glow-sm h-11" onClick={generateVisuals} disabled={isGenerating || !scriptText}>
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {isGenerating ? `Generating ${completed}/${scenesToShow.length || visualCount} Visuals…` : `Generate ${visualCount} Visuals`}
        </Button>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {scenesToShow.slice(0, Math.max(visualCount, scenesToShow.length)).map((scene, i) => (
            <div key={`${scene.id}-${i}`} className="rounded-xl border border-border bg-secondary/30 overflow-hidden group">
              <div className="aspect-video bg-secondary/60 flex items-center justify-center relative overflow-hidden">
                {scene.imageUrl ? (
                  <img src={scene.imageUrl} alt={`Generated visual for scene ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                ) : scene.status === "generating" ? (
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                ) : (
                  <Image className="w-6 h-6 text-muted-foreground/40" />
                )}
                <div className="absolute inset-0 bg-background/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {scene.imageUrl && (
                    <a href={scene.imageUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center" aria-label="Open generated image">
                      <ZoomIn className="w-4 h-4 text-primary" />
                    </a>
                  )}
                  <button onClick={() => regenerateScene(i)} disabled={isGenerating} className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center disabled:opacity-50" aria-label="Regenerate scene">
                    <RefreshCw className="w-4 h-4 text-primary" />
                  </button>
                  <button onClick={() => removeScene(i)} disabled={isGenerating} className="w-8 h-8 rounded-lg bg-destructive/20 flex items-center justify-center disabled:opacity-50" aria-label="Remove scene">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
                <span className="absolute bottom-1.5 left-2 text-[9px] text-foreground bg-background/70 px-1.5 py-0.5 rounded">Scene {i + 1}</span>
              </div>
              <div className="p-3">
                <p className="text-[10px] text-primary/80 font-semibold uppercase truncate mb-1">{scene.section}</p>
                <p className="text-xs text-muted-foreground line-clamp-3">{scene.text}</p>
                {scene.status === "error" && <p className="text-[10px] text-destructive mt-2 truncate">{scene.error}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VisualsStep;
