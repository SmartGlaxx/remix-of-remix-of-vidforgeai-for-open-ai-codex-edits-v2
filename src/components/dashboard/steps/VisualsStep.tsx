import { useState } from "react";
import {
  Image, Sparkles, Layers, Wand2, RefreshCw, ZoomIn, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const stylePresets = [
  { name: "Cinematic", preview: "🎬", selected: true },
  { name: "Comic Book", preview: "💥" },
  { name: "Anime", preview: "🌸" },
  { name: "Pixel Art", preview: "👾" },
  { name: "Oil Painting", preview: "🎨" },
  { name: "3D Render", preview: "🧊" },
];

const VisualsStep = () => {
  const [selectedStyle, setSelectedStyle] = useState(0);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <Image className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Visual Engine</h3>
            <p className="text-xs text-muted-foreground">Generate cinematic visuals for every scene</p>
          </div>
        </div>

        {/* Style presets */}
        <label className="text-xs text-muted-foreground mb-2 block font-medium">Style Preset</label>
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {stylePresets.map((style, i) => (
            <button
              key={style.name}
              onClick={() => setSelectedStyle(i)}
              className={`flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border min-w-[80px] transition-all ${
                selectedStyle === i
                  ? "border-primary/40 bg-primary/8 shadow-md shadow-primary/5"
                  : "border-border hover:border-primary/20"
              }`}
            >
              <span className="text-2xl">{style.preview}</span>
              <span className="text-[10px] font-medium text-foreground">{style.name}</span>
            </button>
          ))}
        </div>

        {/* Settings grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Aspect Ratio</label>
            <select className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option>16:9 (Landscape)</option>
              <option>9:16 (Portrait)</option>
              <option>1:1 (Square)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Quality</label>
            <select className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option>Ultra HD (90 credits)</option>
              <option>HD (40 credits)</option>
              <option>Standard (20 credits)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Scene Count</label>
            <input type="number" defaultValue={30} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Motion</label>
            <select className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option>Ken Burns + Pan</option>
              <option>Static</option>
              <option>Full Animation</option>
            </select>
          </div>
        </div>

        {/* Animate toggle */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border/50 mb-5">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Animate images with AI motion</span>
          </div>
          <div className="w-10 h-5 bg-primary/30 rounded-full relative cursor-pointer">
            <div className="absolute left-5 top-0.5 w-4 h-4 rounded-full bg-primary shadow-md" />
          </div>
        </div>

        <Button className="w-full glow-sm h-11">
          <Sparkles className="w-4 h-4 mr-2" /> Generate 30 Scenes
        </Button>
      </div>

      {/* Scene grid */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-foreground">Scene Preview</h3>
          <span className="text-xs text-muted-foreground">30 scenes • 2,700 credits</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-video bg-secondary/60 rounded-xl flex items-center justify-center border border-border group relative overflow-hidden cursor-pointer hover:border-primary/30 transition-all">
              <Image className="w-6 h-6 text-muted-foreground/20" />
              <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <ZoomIn className="w-3.5 h-3.5 text-primary" />
                </button>
                <button className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <RefreshCw className="w-3.5 h-3.5 text-primary" />
                </button>
                <button className="w-7 h-7 rounded-lg bg-destructive/20 flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
              <span className="absolute bottom-1 left-1.5 text-[9px] text-muted-foreground/60">Scene {i + 1}</span>
            </div>
          ))}
        </div>
        <button className="w-full mt-3 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all">
          + Load more scenes
        </button>
      </div>
    </div>
  );
};

export default VisualsStep;
