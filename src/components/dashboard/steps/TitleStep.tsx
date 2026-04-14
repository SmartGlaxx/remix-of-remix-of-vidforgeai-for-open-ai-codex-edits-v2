import { useState } from "react";
import { motion } from "framer-motion";
import {
  Play, Sparkles, ChevronRight, TrendingUp, Eye, ThumbsUp,
  Globe, Flame, Target, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const suggestedTitles = [
  { title: "The Secret Drone Army Hunting Cartel Bosses", score: 94, views: "2.4M", ctr: "14.2%" },
  { title: "The Biggest Prison Break You Never Heard Of", score: 88, views: "1.8M", ctr: "11.7%" },
  { title: "Inside the World's Most Dangerous Smuggling Route", score: 91, views: "3.1M", ctr: "12.9%" },
  { title: "Why Nobody Can Stop This $50B Underground Empire", score: 86, views: "1.2M", ctr: "10.4%" },
];

const TitleStep = () => {
  const [selectedTitle, setSelectedTitle] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* Channel Analyzer */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center border border-destructive/20">
            <Play className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Channel Analyzer</h3>
            <p className="text-xs text-muted-foreground">Reverse-engineer any channel's winning formula</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">AI Ready</span>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-background/80 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 transition-all"
            placeholder="https://www.youtube.com/@channel"
          />
          <Button className="glow-sm px-5">
            <Sparkles className="w-4 h-4 mr-2" /> Analyze
          </Button>
        </div>
        {/* Quick channel tags */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {["@MrBeast", "@veritasium", "@JohnnyHarris", "@kurzgesagt"].map((ch) => (
            <button key={ch} className="px-3 py-1 rounded-full text-[11px] bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border hover:border-primary/20 transition-all">
              {ch}
            </button>
          ))}
        </div>
      </div>

      {/* Manual title */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Custom Title</h3>
        </div>
        <div className="flex gap-3">
          <input
            className="flex-1 bg-background/80 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 transition-all"
            placeholder="Enter a video title idea..."
          />
          <Button variant="outline" className="border-border hover:border-primary/30">Use Title</Button>
        </div>
      </div>

      {/* AI Generated Titles */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-accent" />
            <h3 className="font-display font-semibold text-foreground">AI Generated Titles</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Sorted by</span>
            <select className="bg-secondary/60 border border-border rounded-lg px-2 py-1 text-[11px] text-foreground">
              <option>Viral Score</option>
              <option>CTR Potential</option>
              <option>View Estimate</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          {suggestedTitles.map((item, i) => (
            <motion.button
              key={i}
              onClick={() => setSelectedTitle(i)}
              whileHover={{ scale: 1.005 }}
              whileTap={{ scale: 0.995 }}
              className={`w-full text-left p-4 rounded-xl border transition-all group ${
                selectedTitle === i
                  ? "border-primary/50 bg-primary/8 shadow-lg shadow-primary/5"
                  : "border-border hover:border-primary/25 hover:bg-primary/3"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground font-medium block mb-2">{item.title}</span>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Eye className="w-3 h-3" /> {item.views} est.
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <ThumbsUp className="w-3 h-3" /> {item.ctr} CTR
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Globe className="w-3 h-3" /> English
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-display font-bold ${
                    item.score >= 90
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                      : item.score >= 85
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}>
                    {item.score}
                  </div>
                  <span className="text-[9px] text-muted-foreground">Score</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* SEO Insights */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground text-sm">SEO Insights</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Competition", value: "Medium", color: "text-yellow-400" },
            { label: "Search Vol.", value: "18.2K/mo", color: "text-primary" },
            { label: "Trending", value: "↑ Rising", color: "text-emerald-400" },
          ].map((ins) => (
            <div key={ins.label} className="bg-secondary/40 rounded-lg p-3 text-center">
              <span className="block text-[10px] text-muted-foreground mb-1">{ins.label}</span>
              <span className={`text-sm font-display font-semibold ${ins.color}`}>{ins.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TitleStep;
