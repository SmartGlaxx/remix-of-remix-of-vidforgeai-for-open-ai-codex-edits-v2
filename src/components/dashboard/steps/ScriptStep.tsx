import { useState } from "react";
import {
  Wand2, BookOpen, Clock, Hash, Sparkles, RotateCw,
  Copy, Download, AlertCircle, Lightbulb, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject, useDraftField } from "@/contexts/ProjectContext";

const tones = [
  { label: "Engaging & Dramatic", emoji: "🎭", desc: "Dramatic" },
  { label: "Educational", emoji: "📚", desc: "Informative" },
  { label: "Comedy", emoji: "😂", desc: "Lighthearted" },
  { label: "Documentary", emoji: "🎬", desc: "Long-form" },
  { label: "Storytelling", emoji: "📖", desc: "Narrative arc" },
  { label: "Controversial", emoji: "🔥", desc: "Provocative" },
];

const ScriptStep = () => {
  const { topic, setTopic, selectedTitle, setSelectedTitle, scriptSections, setScriptSections, scriptMeta, setScriptMeta,
    scriptDraft, setScriptDraft } = useProject();
  const [selectedTone, setSelectedTone] = useDraftField(scriptDraft, setScriptDraft, "selectedTone");
  const [duration, setDuration] = useDraftField(scriptDraft, setScriptDraft, "duration");
  const [hook, setHook] = useDraftField(scriptDraft, setScriptDraft, "hook");
  const [language, setLanguage] = useDraftField(scriptDraft, setScriptDraft, "language");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = topic.trim() || selectedTitle || "";

  const generate = async () => {
    if (!title) {
      toast({ title: "Title or topic required", description: "Enter a title or topic above.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: { title, tone: tones[selectedTone].label, duration, hook, language },
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
      {/* Script draft */}
      {(loading || scriptSections.length > 0) && (
      <section className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-foreground">Script draft</h3>
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
        <div className="space-y-4 script-document">
          {loading && scriptSections.length === 0
            ? [0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl border border-border bg-secondary/30 animate-pulse" />
              ))
            : scriptSections.map((block, index) => (
            <div key={block.section} className="group">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-primary/60" />
                <span className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider">{block.section}</span>
              </div>
              <Textarea aria-label={`Script section ${index + 1}`} value={block.text}
                onChange={(e) => setScriptSections(scriptSections.map((item, i) => i === index ? { ...item, text: e.target.value } : item))}
                className="script-scene-text min-h-32 text-sm leading-relaxed" />
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
      </section>
      )}
      <Button variant="outline" onClick={() => setScriptSections([...scriptSections, { section: `Scene ${scriptSections.length + 1}`, text: "" }])}>+ Add scene</Button>
      {/* Script config */}
      <details className="space-y-4" open={!scriptSections.length}><summary className="cursor-pointer text-sm font-bold">Writing assistant</summary>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Script Engine</h3>
            <p className="text-xs text-muted-foreground">Story and scene direction</p>
          </div>
        </div>

        <label htmlFor="project-topic" className="text-xs text-muted-foreground block mb-2">Title / topic</label>
        <Input id="project-topic" value={topic || selectedTitle || ""} onChange={(e) => { setTopic(e.target.value); setSelectedTitle(e.target.value || null); }} placeholder="Your film title or story idea" className="mb-5" />

        {/* Tone selector */}
        <label className="text-xs text-muted-foreground mb-2 block font-medium">Writing Tone</label>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {tones.map((tone, i) => (
            <Button variant="outline"
              key={tone.label}
              onClick={() => setSelectedTone(i)}
              className={`h-auto whitespace-normal p-3 rounded-md border text-left block transition-all ${
                selectedTone === i
                  ? "border-primary/40 bg-primary/8 shadow-md shadow-primary/5"
                  : "border-border hover:border-primary/20 hover:bg-secondary/30"
              }`}
            >
              <span className="text-lg mb-1 block">{tone.emoji}</span>
              <span className="text-xs font-medium text-foreground block">{tone.label}</span>
              <span className="text-[10px] text-muted-foreground">{tone.desc}</span>
            </Button>
          ))}
        </div>

        {/* Parameters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
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

        <Button className="w-full glow-sm h-11" onClick={generate} disabled={loading || !title}>
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          {loading ? "Generating…" : scriptSections.length ? "Regenerate Script" : "Generate Script"}
        </Button>
        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </details>




    </div>
  );
};

export default ScriptStep;
