import { useState } from "react";
import {
  Music, Play, Pause, Volume2, Sliders, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const genres = [
  { label: "Cinematic", emoji: "🎬" },
  { label: "Electronic", emoji: "⚡" },
  { label: "Orchestral", emoji: "🎻" },
  { label: "Lo-Fi", emoji: "🎧" },
  { label: "Hip Hop", emoji: "🎤" },
  { label: "Ambient", emoji: "🌊" },
];

const segments = [
  { label: "Intro Hook", time: "0:00 — 0:30", mood: "Mysterious, building tension", intensity: 30 },
  { label: "Rising Action", time: "0:30 — 2:00", mood: "Energetic, driving rhythm", intensity: 60 },
  { label: "Main Body", time: "2:00 — 7:00", mood: "Sustained intensity, cinematic swells", intensity: 75 },
  { label: "Climax", time: "7:00 — 9:00", mood: "Peak energy, dramatic orchestral", intensity: 95 },
  { label: "Resolution", time: "9:00 — 10:30", mood: "Reflective, fading out", intensity: 40 },
];

const SoundtrackStep = () => {
  const [selectedGenre, setSelectedGenre] = useState(0);

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <Music className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Music Composer</h3>
            <p className="text-xs text-muted-foreground">AI-generated soundtrack synced to your script</p>
          </div>
        </div>

        {/* Genre */}
        <label className="text-xs text-muted-foreground mb-2 block font-medium">Genre</label>
        <div className="flex gap-2 mb-5 overflow-x-auto pb-2">
          {genres.map((g, i) => (
            <button
              key={g.label}
              onClick={() => setSelectedGenre(i)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all ${
                selectedGenre === i
                  ? "border-primary/40 bg-primary/8"
                  : "border-border hover:border-primary/20"
              }`}
            >
              <span>{g.emoji}</span>
              <span className="text-xs font-medium text-foreground">{g.label}</span>
            </button>
          ))}
        </div>

        {/* Volume / BPM */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">BPM Range</label>
            <select className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option>80-120 (Medium)</option>
              <option>60-80 (Slow)</option>
              <option>120-160 (Fast)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Mix Level</label>
            <select className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground">
              <option>Background (-12dB)</option>
              <option>Subtle (-18dB)</option>
              <option>Prominent (-6dB)</option>
            </select>
          </div>
        </div>

        {/* Segments */}
        <label className="text-xs text-muted-foreground mb-2 block font-medium">Mood Timeline</label>
        <div className="space-y-2 mb-5">
          {segments.map((seg) => (
            <div key={seg.label} className="bg-secondary/30 rounded-xl p-3.5 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-foreground">{seg.label}</span>
                <span className="text-[10px] text-muted-foreground">{seg.time}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2">{seg.mood}</p>
              <div className="h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary/60 to-accent/60 rounded-full transition-all"
                  style={{ width: `${seg.intensity}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full glow-sm h-11">
          <Sparkles className="w-4 h-4 mr-2" /> Generate Soundtrack
        </Button>
      </div>
    </div>
  );
};

export default SoundtrackStep;
