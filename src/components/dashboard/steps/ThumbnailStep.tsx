import { useEffect, useState } from "react";
import { Palette, Sparkles, Eye, Loader2, RefreshCw, ZoomIn, AlertCircle, Wand2, Library, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";
import ThumbnailOverlayEditor from "@/components/dashboard/ThumbnailOverlayEditor";

type ThumbStyle = { name: string; desc: string; directive: string };

const thumbnailStyles: ThumbStyle[] = [
  {
    name: "High-Impact Creator",
    desc: "Bold text, expressive face, saturated colors",
    directive: "Massive bold sans-serif text, an expressive human face with exaggerated emotion (shock, awe), saturated primary colors, dramatic rim lighting, heavy contrast, shallow depth of field.",
  },
  {
    name: "Documentary",
    desc: "Cinematic still, minimal text, moody",
    directive: "Cinematic photographic still, moody color grade, natural lighting, subtle film grain, minimal or no text, single strong focal subject, editorial framing.",
  },
  {
    name: "Clickbait Pro",
    desc: "Red arrows, circles, bold CTAs",
    directive: "Bright red arrows and circles highlighting the subject, bold yellow outlined text, split-screen before/after composition, high saturation, comic-style emphasis marks.",
  },
  {
    name: "Minimalist",
    desc: "Single subject, dark background",
    directive: "Single isolated subject centered on a dark gradient background, ample negative space, soft studio lighting, elegant thin typography, premium minimalist aesthetic.",
  },
  {
    name: "Mystery / Thriller",
    desc: "Dark, ominous, redacted clues",
    directive: "Dark ominous mood, deep shadows, red accent lighting, partially obscured subject, redacted black bars, conspiracy-board aesthetic, suspenseful tension.",
  },
  {
    name: "Educational Explainer",
    desc: "Diagram-style, arrows, callouts",
    directive: "Diagram-style composition with labeled callouts, clean arrows connecting elements, infographic feel, friendly approachable color palette, clear hierarchy.",
  },
  {
    name: "Luxury / Cinematic",
    desc: "Gold tones, premium feel",
    directive: "Premium cinematic look, gold and deep teal palette, anamorphic lens flares, polished textures, elegant serif accent typography, magazine cover composition.",
  },
  {
    name: "News / Breaking",
    desc: "Bold banner, urgent headline",
    directive: "Breaking-news lower-third banner, urgent red and white palette, photojournalism style background, bold condensed headline typography, broadcast graphic overlays.",
  },
];

const extractImageUrl = (payload: any): string | undefined => {
  const output = payload?.output ?? payload;
  const nested = output?.output ?? output;
  return nested?.url || nested?.image_url || nested?.ipfs_url || nested?.image?.url || nested?.image?.ipfs_url;
};

async function pollJob(endpointId: string, jobId: string, timeoutMs = 600_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await supabase.functions.invoke("runpod-gateway", {
      body: { action: "status", endpoint_id: endpointId, job_id: jobId },
    });
    if (error) throw new Error(error.message);
    if (data?.status === "COMPLETED") return data;
    if (data?.status === "FAILED") throw new Error(data?.error || "Thumbnail job failed");
    await new Promise((r) => setTimeout(r, 3500));
  }
  throw new Error("Thumbnail generation timed out");
}

type Variant = { id: string; status: "pending" | "generating" | "done" | "error"; imageUrl?: string; error?: string };

const ThumbnailStep = () => {
  const { selectedTitle, visualStyle, visualAspectRatio } = useProject();
  const [styleIdx, setStyleIdx] = useState(0);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [description, setDescription] = useState(
    "A shadowy desert landscape with a cartel boss highlighted in blue. A military drone flies overhead with glowing red sensors.",
  );
  const [textOverlay, setTextOverlay] = useState("DRONE ARMY");
  const [variationCount, setVariationCount] = useState(4);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // AI-suggested descriptions / overlay
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestedOverlay, setSuggestedOverlay] = useState<string>("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [pickedSuggestion, setPickedSuggestion] = useState<number | null>(null);
  // Saved thumbnail library
  const [library, setLibrary] = useState<{ name: string; url: string; created_at?: string }[]>([]);

  const loadLibrary = async () => {
    const { data, error } = await supabase.storage.from("thumbnails").list("", {
      limit: 60, sortBy: { column: "created_at", order: "desc" },
    });
    if (error || !data) return;
    const items = data
      .filter((f) => f.name && !f.name.endsWith("/"))
      .map((f) => {
        const { data: pub } = supabase.storage.from("thumbnails").getPublicUrl(f.name);
        return { name: f.name, url: pub.publicUrl, created_at: (f as any).created_at };
      });
    setLibrary(items);
  };

  useEffect(() => { loadLibrary(); }, []);

  const suggestIdeas = async () => {
    if (!selectedTitle) {
      toast({ title: "Pick a title first", description: "Select a title in Step 1 to get AI suggestions.", variant: "destructive" });
      return;
    }
    setIsSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-thumbnail-ideas", {
        body: { title: selectedTitle, style: thumbnailStyles[styleIdx].name, video_style: visualStyle },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setSuggestions(data?.descriptions ?? []);
      setSuggestedOverlay(data?.text_overlay ?? "");
      setPickedSuggestion(null);
      toast({ title: "AI suggestions ready" });
    } catch (e) {
      toast({ title: "Suggestion failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsSuggesting(false);
    }
  };

  const generateOne = async (list: Variant[], index: number, sceneDirection?: string) => {
    list[index] = { ...list[index], status: "generating", error: undefined };
    setVariants([...list]);
    const style = thumbnailStyles[styleIdx];
    const { data, error: invokeError } = await supabase.functions.invoke("generate-thumbnail", {
      body: {
        description,
        style: style.name,
        style_directive: style.directive,
        text_overlay: textOverlay,
        reference_url: referenceUrl,
        title: selectedTitle || "",
        aspect_ratio: visualAspectRatio || "16:9",
        video_style: visualStyle || "",
        scene_direction: sceneDirection,
        index,
      },
    });
    if (invokeError) throw new Error(invokeError.message);
    if (data?.error) throw new Error(data.error);
    let imageUrl = data?.image_url || data?.url;
    if (!imageUrl && data?.job_id && data?.endpoint_id) {
      const completed = await pollJob(data.endpoint_id, data.job_id);
      imageUrl = extractImageUrl(completed);
    }
    if (!imageUrl) throw new Error("No image URL returned");
    try {
      const { data: rehosted } = await supabase.functions.invoke("rehost-thumbnail", { body: { url: imageUrl } });
      if (rehosted?.image_url) imageUrl = rehosted.image_url;
    } catch (e) {
      console.warn("rehost-thumbnail failed:", e);
    }
    list[index] = { ...list[index], status: "done", imageUrl };
    setVariants([...list]);
  };

  const generateAll = async () => {
    if (!description.trim()) {
      toast({ title: "Description required", description: "Describe what the thumbnail should show.", variant: "destructive" });
      return;
    }
    const list: Variant[] = Array.from({ length: variationCount }, (_, i) => ({ id: `var-${Date.now()}-${i}`, status: "pending" }));
    setVariants(list);
    setIsGenerating(true);
    setError(null);

    // Ask AI to produce N maximally-different scene directions that consider
    // description, overlay text, video title (and inherit video style).
    let directions: string[] = [];
    try {
      const { data: div } = await supabase.functions.invoke("diversify-thumbnail-prompts", {
        body: {
          title: selectedTitle || "",
          description,
          text_overlay: textOverlay,
          style: thumbnailStyles[styleIdx].name,
          video_style: visualStyle,
          count: variationCount,
        },
      });
      directions = Array.isArray(div?.directions) ? div.directions : [];
    } catch (e) {
      console.warn("diversify-thumbnail-prompts failed, using built-in variations:", e);
    }

    let cursor = 0;
    let failures = 0;
    const worker = async () => {
      while (cursor < list.length) {
        const idx = cursor++;
        try { await generateOne(list, idx, directions[idx]); }
        catch (e) {
          failures++;
          list[idx] = { ...list[idx], status: "error", error: (e as Error).message };
          setVariants([...list]);
        }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(1, list.length) }, worker));
      if (failures) {
        const msg = `${failures} thumbnail${failures === 1 ? "" : "s"} failed. You can regenerate individual variants.`;
        setError(msg);
        toast({ title: "Finished with errors", description: msg, variant: "destructive" });
      } else {
        toast({ title: "Thumbnails ready", description: `${list.length} variations generated.` });
      }
      loadLibrary();
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateOne = async (index: number) => {
    const list = [...variants];
    setIsGenerating(true);
    try {
      await generateOne(list, index);
      toast({ title: "Variant regenerated" });
      loadLibrary();
    } catch (e) {
      list[index] = { ...list[index], status: "error", error: (e as Error).message };
      setVariants([...list]);
      toast({ title: "Variant failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const completed = variants.filter((v) => v.status === "done").length;

  return (
    <div className="space-y-6">
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center border border-accent/20">
          <Palette className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground">Thumbnail Studio</h3>
          <p className="text-xs text-muted-foreground">Create click-worthy thumbnails with AI</p>
        </div>
      </div>

      {/* Style presets */}
      <label className="text-xs text-muted-foreground mb-2 block font-medium">Thumbnail Style</label>
      <div className="grid grid-cols-2 gap-2 mb-5">
        {thumbnailStyles.map((style, i) => (
          <button
            key={style.name}
            onClick={() => setStyleIdx(i)}
            className={`p-3 rounded-xl border text-left transition-all ${
              styleIdx === i
                ? "border-accent/40 bg-accent/8 shadow-md shadow-accent/5"
                : "border-border hover:border-accent/20"
            }`}
          >
            <span className="text-xs font-medium text-foreground block">{style.name}</span>
            <span className="text-[10px] text-muted-foreground">{style.desc}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3 mb-5">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[11px] font-medium text-foreground flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-primary" />
              AI suggestions for "{selectedTitle || "—"}"
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={suggestIdeas} disabled={isSuggesting || !selectedTitle}>
              {isSuggesting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
              {suggestions.length ? "Refresh" : "Suggest"}
            </Button>
          </div>
          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setDescription(s); setPickedSuggestion(i); if (suggestedOverlay) setTextOverlay(suggestedOverlay); }}
                  className={`w-full text-left text-[11px] leading-relaxed rounded-lg p-2.5 border transition-all ${
                    pickedSuggestion === i
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border bg-background/50 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {pickedSuggestion === i ? <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /> : <span className="text-[10px] text-primary/70 font-semibold mt-0.5">{i + 1}.</span>}
                    <span>{s}</span>
                  </div>
                </button>
              ))}
              {suggestedOverlay && (
                <p className="text-[10px] text-muted-foreground pt-1">Suggested overlay: <span className="text-foreground font-semibold">{suggestedOverlay}</span></p>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Reference URL (optional)</label>
          <input
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            className="w-full bg-background/80 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60"
            placeholder="YouTube video URL for style reference..."
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-background/80 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground resize-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Text Overlay</label>
            <input
              value={textOverlay}
              onChange={(e) => setTextOverlay(e.target.value)}
              className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
              placeholder="DRONE ARMY"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Variations</label>
            <select
              value={variationCount}
              onChange={(e) => setVariationCount(Number(e.target.value))}
              className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
            >
              <option value={2}>2 variations</option>
              <option value={4}>4 variations</option>
              <option value={6}>6 variations</option>
              <option value={8}>8 variations</option>
            </select>
          </div>
        </div>
      </div>

      <Button onClick={generateAll} disabled={isGenerating} className="w-full glow-sm h-11 bg-accent hover:bg-accent/90">
        {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
        {isGenerating ? `Generating ${completed}/${variants.length}…` : `Generate ${variationCount} Thumbnails`}
      </Button>

      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>

    {/* Preview */}
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground">Generated Thumbnails</h3>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Eye className="w-3 h-3" /> A/B test ready
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(variants.length ? variants : Array.from({ length: variationCount }, (_, i) => ({ id: `placeholder-${i}`, status: "pending" as const }))).map((v, i) => (
          <div
            key={v.id}
            className="aspect-video bg-secondary/60 rounded-xl flex items-center justify-center border border-border overflow-hidden relative group"
          >
            {v.status === "done" && v.imageUrl ? (
              <>
                <img src={v.imageUrl} alt={`Thumbnail variant ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-background/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <a href={v.imageUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center" aria-label="Open thumbnail">
                    <ZoomIn className="w-4 h-4 text-accent" />
                  </a>
                  <button onClick={() => regenerateOne(i)} disabled={isGenerating} className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center disabled:opacity-50" aria-label="Regenerate">
                    <RefreshCw className="w-4 h-4 text-accent" />
                  </button>
                </div>
              </>
            ) : v.status === "generating" ? (
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
            ) : v.status === "error" ? (
              <div className="text-center px-2">
                <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-1" />
                <span className="text-[10px] text-destructive line-clamp-2">{v.error}</span>
                <button onClick={() => regenerateOne(i)} className="text-[10px] text-accent underline mt-1">Retry</button>
              </div>
            ) : (
              <div className="text-center">
                <Palette className="w-8 h-8 text-muted-foreground/20 mx-auto mb-1" />
                <span className="text-[10px] text-muted-foreground">Variant {i + 1}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Text overlay editors — rendered below the grid so each completed variant gets a crisp client-side composer */}
      {variants.some((v) => v.status === "done" && v.imageUrl) && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {variants.map((v, i) =>
            v.status === "done" && v.imageUrl ? (
              <div key={`overlay-${v.id}`} className="rounded-xl border border-border overflow-hidden">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-foreground bg-secondary/40">Variant {i + 1} — text overlay</div>
                <ThumbnailOverlayEditor
                  imageUrl={v.imageUrl}
                  defaultTitle={selectedTitle}
                  defaultOverlay={textOverlay}
                  index={i}
                />
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>

    {library.length > 0 && (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground">Saved Thumbnails Library</h3>
          </div>
          <button onClick={loadLibrary} className="text-[10px] text-primary inline-flex items-center gap-1 hover:underline">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">Reuse any previously generated thumbnail — click to open in a new tab.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {library.map((item) => (
            <a key={item.name} href={item.url} target="_blank" rel="noreferrer" className="aspect-video bg-secondary/60 rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-colors">
              <img src={item.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      </div>
    )}
  </div>
  );
};

export default ThumbnailStep;
