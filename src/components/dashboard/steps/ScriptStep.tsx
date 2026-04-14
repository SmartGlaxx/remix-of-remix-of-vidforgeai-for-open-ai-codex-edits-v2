import { useState } from "react";
import { motion } from "framer-motion";
import {
  Wand2, BookOpen, Clock, Hash, Sparkles, RotateCw,
  Copy, Download, AlertCircle, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const tones = [
  { label: "Engaging & Dramatic", emoji: "🎭", desc: "High retention" },
  { label: "Educational", emoji: "📚", desc: "Authority building" },
  { label: "Comedy", emoji: "😂", desc: "Shareable" },
  { label: "Documentary", emoji: "🎬", desc: "Long-form" },
  { label: "Storytelling", emoji: "📖", desc: "Narrative arc" },
  { label: "Controversial", emoji: "🔥", desc: "High engagement" },
];

const ScriptStep = () => {
  const [selectedTone, setSelectedTone] = useState(0);

  return (
    <div className="space-y-6">
      {/* Script config */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Script Engine</h3>
            <p className="text-xs text-muted-foreground">AI-powered scriptwriting with retention optimization</p>
          </div>
        </div>

        {/* Selected title */}
        <div className="bg-secondary/40 rounded-xl p-4 mb-5 border border-border">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block font-semibold">Selected Title</label>
          <div className="text-sm text-foreground font-medium">The Secret Drone Army Hunting Cartel Bosses</div>
        </div>

        {/* Tone selector */}
        <label className="text-xs text-muted-foreground mb-2 block font-medium">Writing Tone</label>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {tones.map((tone, i) => (
            <button
              key={tone.label}
              onClick={() => setSelectedTone(i)}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedTone === i
                  ? "border-primary/40 bg-primary/8 shadow-md shadow-primary/5"
                  : "border-border hover:border-primary/20 hover:bg-secondary/30"
              }`}
            >
              <span className="text-lg mb-1 block">{tone.emoji}</span>
              <span className="text-xs font-medium text-foreground block">{tone.label}</span>
              <span className="text-[10px] text-muted-foreground">{tone.desc}</span>
            </button>
          ))}
        </div>

        {/* Parameters */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Duration</label>
            <select className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/40">
              <option>8-10 min</option>
              <option>10-15 min</option>
              <option>15-20 min</option>
              <option>20-30 min</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Hook Style</label>
            <select className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/40">
              <option>Question</option>
              <option>Shocking Fact</option>
              <option>Story Opener</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Language</label>
            <select className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/40">
              <option>English</option>
              <option>Spanish</option>
              <option>Portuguese</option>
            </select>
          </div>
        </div>

        <Button className="w-full glow-sm h-11">
          <Wand2 className="w-4 h-4 mr-2" /> Generate Script
        </Button>
      </div>

      {/* Generated Script */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-foreground">Generated Script</h3>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
              <RotateCw className="w-3 h-3 mr-1" /> Regenerate
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
          </div>
        </div>

        {/* Script sections */}
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {[
            { section: "HOOK (0:00 - 0:30)", text: "Somewhere high above the Mexican desert, invisible to the naked eye, America's secret drone army is on the hunt. These aren't your typical military drones..." },
            { section: "CONTEXT (0:30 - 2:00)", text: "For decades, the cartels operated with impunity. Their networks stretched across borders, their money laundered through legitimate businesses, their violence unchecked by local authorities..." },
            { section: "RISING ACTION (2:00 - 5:00)", text: "But in 2024, everything changed when the DEA deployed its most advanced surveillance program ever. Code-named 'Project Skywatch,' this initiative combined AI facial recognition with a fleet of micro-drones..." },
            { section: "CLIMAX (5:00 - 8:00)", text: "The operation's first major success came on a Tuesday morning. Three drones had been tracking a convoy for 72 hours straight, their AI systems analyzing every stop, every passenger, every phone call..." },
            { section: "RESOLUTION (8:00 - 10:00)", text: "Today, Project Skywatch has fundamentally changed the war on drugs. But the cartels aren't sitting idle. They've begun developing their own counter-drone technology..." },
          ].map((block) => (
            <div key={block.section} className="group">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary/60" />
                <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider">{block.section}</span>
              </div>
              <div className="bg-background/60 rounded-xl p-4 text-sm text-secondary-foreground leading-relaxed border border-border/50 group-hover:border-primary/10 transition-colors">
                {block.text}
              </div>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
          {[
            { icon: Hash, label: "2,847 words" },
            { icon: Clock, label: "~12 min read" },
            { icon: Sparkles, label: "92% retention score" },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <stat.icon className="w-3 h-3" />
              {stat.label}
            </div>
          ))}
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="glass-card p-4 border-accent/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h4 className="text-xs font-display font-semibold text-foreground mb-1">AI Suggestion</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Consider adding a personal anecdote in the hook section. Scripts with personal stories in the first 30 seconds show 23% higher retention on average.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptStep;
