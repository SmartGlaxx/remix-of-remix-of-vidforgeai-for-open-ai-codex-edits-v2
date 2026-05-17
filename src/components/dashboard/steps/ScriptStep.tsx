import { useState } from "react";
import {
  Wand2, BookOpen, Clock, Hash, Sparkles, RotateCw,
  Copy, Download, AlertCircle, Lightbulb, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";

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
  const [duration, setDuration] = useState("8-10 min");
  const [hook, setHook] = useState("Shocking Fact");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedTitle, scriptSections, setScriptSections, scriptMeta, setScriptMeta } = useProject();

  const generate = async () => {
    if (!selectedTitle) {
      toast({ title: "No title selected", description: "Pick a title in the previous step first.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: { title: selectedTitle, tone: tones[selectedTone].label, duration, hook, language },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setScriptSections(Array.isArray(data?.sections) ? data.sections : []);
      setScriptMeta(data?.meta ?? null);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast({ title: "Script generation failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyAll = () => {
    const text = scriptSections.map((s) => `${s.section}\n${s.text}`).join("\n\n");
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const downloadTxt = () => {
    const text = scriptSections.map((s) => `${s.section}\n${s.text}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "script.txt"; a.click();
    URL.revokeObjectURL(url);
  };

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
          <div className="text-sm text-foreground font-medium">
            {selectedTitle ?? <span className="text-muted-foreground italic">No title selected — pick one in the Title step.</span>}
          </div>
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
            <select value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/40">
              <option>8-10 min</option>
              <option>10-15 min</option>
              <option>15-20 min</option>
              <option>20-30 min</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Hook Style</label>
            <select value={hook} onChange={(e) => setHook(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/40">
              <option>Question</option>
              <option>Shocking Fact</option>
              <option>Story Opener</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block font-medium">Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-background/80 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/40">
              <option>English</option>
              <option>Spanish</option>
              <option>Portuguese</option>
            </select>
          </div>
        </div>

        <Button className="w-full glow-sm h-11" onClick={generate} disabled={loading || !selectedTitle}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          {loading ? "Generating…" : scriptSections.length ? "Regenerate Script" : "Generate Script"}
        </Button>
        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Generated Script */}
      {(loading || scriptSections.length > 0) && (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-foreground">Generated Script</h3>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={generate} disabled={loading}>
              <RotateCw className="w-3 h-3 mr-1" /> Regenerate
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={copyAll}>
              <Copy className="w-3 h-3 mr-1" /> Copy
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={downloadTxt}>
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
          </div>
        </div>

        {/* Script sections */}
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {loading && scriptSections.length === 0
            ? [0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl border border-border bg-secondary/30 animate-pulse" />
              ))
            : scriptSections.map((block) => (
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
        {scriptMeta && (
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Hash className="w-3 h-3" /> {scriptMeta.words?.toLocaleString()} words</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="w-3 h-3" /> ~{scriptMeta.minutes} min read</div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="w-3 h-3" /> {scriptMeta.retention}% retention score</div>
          </div>
        )}
      </div>
      )}

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
