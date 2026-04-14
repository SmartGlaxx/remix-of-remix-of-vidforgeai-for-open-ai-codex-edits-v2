import {
  Palette, Sparkles, Layout, Type, Layers, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const thumbnailStyles = [
  { name: "MrBeast Style", desc: "Bold text, shocked face, bright colors" },
  { name: "Documentary", desc: "Cinematic stills, minimal text" },
  { name: "Clickbait Pro", desc: "Red arrows, circles, bold CTAs" },
  { name: "Minimalist", desc: "Clean, single subject, dark bg" },
];

const ThumbnailStep = () => (
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
            className={`p-3 rounded-xl border text-left transition-all ${
              i === 0
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
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Reference URL (optional)</label>
          <input className="w-full bg-background/80 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60" placeholder="YouTube video URL for style reference..." />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Description</label>
          <textarea
            rows={3}
            className="w-full bg-background/80 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground resize-none placeholder:text-muted-foreground/60"
            defaultValue="A shadowy desert landscape with a cartel boss highlighted in blue. A military drone flies overhead with glowing red sensors."
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Text Overlay</label>
            <input className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" placeholder="DRONE ARMY" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Variations</label>
            <select className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option>4 variations</option>
              <option>8 variations</option>
            </select>
          </div>
        </div>
      </div>

      <Button className="w-full glow-sm h-11 bg-accent hover:bg-accent/90">
        <Sparkles className="w-4 h-4 mr-2" /> Generate Thumbnails
      </Button>
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
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-video bg-secondary/60 rounded-xl flex items-center justify-center border cursor-pointer transition-all hover:shadow-lg ${
              i === 0 ? "border-accent/40 shadow-md shadow-accent/10" : "border-border hover:border-accent/20"
            }`}
          >
            <div className="text-center">
              <Palette className="w-8 h-8 text-muted-foreground/20 mx-auto mb-1" />
              <span className="text-[10px] text-muted-foreground">Variant {i + 1}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default ThumbnailStep;
