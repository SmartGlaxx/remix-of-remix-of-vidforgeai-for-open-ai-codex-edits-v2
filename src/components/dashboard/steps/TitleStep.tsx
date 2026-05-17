import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, Eye, ThumbsUp, Globe, Flame, Target, BarChart3, Loader2, AlertCircle, RefreshCw, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useProject } from "@/contexts/ProjectContext";

const trendingColor = (t: string) =>
  t?.startsWith("↑") ? "text-emerald-400" : t?.startsWith("↓") ? "text-destructive" : "text-primary";

const competitionColor = (c: string) =>
  c === "Low" ? "text-emerald-400" : c === "High" ? "text-destructive" : "text-yellow-400";

const TitleStep = () => {
  const {
    selectedTitle, setSelectedTitle,
    topic, setTopic, customTitle, setCustomTitle,
    titles, setTitles, seo, setSeo,
  } = useProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const loadSuggestions = async () => {
    setSuggestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-topics", { body: {} });
      if (error) throw new Error(error.message);
      if (Array.isArray(data?.topics)) setSuggestions(data.topics.slice(0, 3));
    } catch (e) {
      // silent fail; chips just won't render
      console.warn("suggest-topics failed", e);
    } finally {
      setSuggestLoading(false);
    }
  };

  useEffect(() => { if (suggestions.length === 0) loadSuggestions(); }, []);

  const analyze = async (seed?: string) => {
    const value = (seed ?? topic).trim();
    if (value.length < 3) {
      toast({ title: "Topic too short", description: "Enter at least 3 characters." });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-title", {
        body: { topic: value },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const list = Array.isArray(data?.titles) ? data.titles : [];
      setTitles(list);
      setSeo(data?.seo ?? null);
      // Auto-select highest-scored title so it persists into Script step
      if (list.length > 0) {
        const top = [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
        setSelectedTitle(top.title);
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast({ title: "Analysis failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sortedTitles = [...titles].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="space-y-6">
      {/* Topic seed */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/20">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">Title Generator</h3>
            <p className="text-xs text-muted-foreground">Enter a topic or rough idea — AI crafts viral title candidates</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">AI Ready</span>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && analyze()}
            disabled={loading}
            className="flex-1 bg-background/80 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 transition-all"
            placeholder="e.g. how the DEA uses drones to hunt cartels"
          />
          <Button className="glow-sm px-5" onClick={() => analyze()} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? "Analyzing…" : "Analyze"}
          </Button>
        </div>
        {/* Quick topic tags */}
        <div className="flex gap-2 mt-3 items-center">
          <div className="flex gap-2 flex-1 min-w-0 overflow-hidden">
            {suggestLoading && suggestions.length === 0
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="h-6 flex-1 min-w-0 max-w-[33%] rounded-full bg-secondary/40 animate-pulse" />
                ))
              : suggestions.map((ch) => (
                  <button
                    key={ch}
                    onClick={() => { setTopic(ch); analyze(ch); }}
                    disabled={loading}
                    title={ch}
                    className="px-3 py-1 rounded-full text-[11px] bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary border border-border hover:border-primary/20 transition-all disabled:opacity-50 truncate flex-1 min-w-0 max-w-[33%]"
                  >
                    {ch}
                  </button>
                ))}
          </div>
          <button
            onClick={loadSuggestions}
            disabled={suggestLoading}
            title="Refresh suggestions"
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${suggestLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Manual title */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground">Custom Title</h3>
        </div>
        <div className="flex gap-3">
          <input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="flex-1 bg-background/80 border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/30 transition-all"
            placeholder="Enter a video title idea..."
          />
          <Button
            variant="outline"
            className="border-border hover:border-primary/30"
            onClick={() => customTitle.trim() && analyze(customTitle)}
            disabled={loading || !customTitle.trim()}
          >
            Analyze
          </Button>
        </div>
      </div>

      {/* AI Generated Titles */}
      {(loading || sortedTitles.length > 0) && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-accent" />
              <h3 className="font-display font-semibold text-foreground">AI Generated Titles</h3>
            </div>
            {sortedTitles.length > 0 && (
              <span className="text-[10px] text-muted-foreground">Sorted by Viral Score</span>
            )}
          </div>
          {loading && sortedTitles.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl border border-border bg-secondary/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedTitles.map((item, i) => (
                <motion.button
                  key={`${item.title}-${i}`}
                  onClick={() => setSelectedTitle(item.title)}
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  className={`w-full text-left p-4 rounded-xl border transition-all group ${
                    selectedTitle === item.title
                      ? "border-primary/50 bg-primary/8 shadow-lg shadow-primary/5"
                      : "border-border hover:border-primary/25 hover:bg-primary/3"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-foreground font-medium block mb-2 flex items-center gap-2">
                        {selectedTitle === item.title && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        {item.title}
                      </span>
                      <div className="flex items-center gap-4 text-[11px] flex-wrap">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Eye className="w-3 h-3" /> {item.views} est.
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <ThumbsUp className="w-3 h-3" /> {item.ctr} CTR
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Globe className="w-3 h-3" /> {item.language || "English"}
                        </span>
                      </div>
                      {item.reason && (
                        <p className="text-[11px] text-muted-foreground/80 mt-2 italic">{item.reason}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-display font-bold ${
                        item.score >= 90
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                          : item.score >= 80
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
          )}
        </div>
      )}

      {/* SEO Insights */}
      {seo && (
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold text-foreground text-sm">SEO Insights</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-secondary/40 rounded-lg p-3 text-center">
              <span className="block text-[10px] text-muted-foreground mb-1">Competition</span>
              <span className={`text-sm font-display font-semibold ${competitionColor(seo.competition)}`}>{seo.competition}</span>
            </div>
            <div className="bg-secondary/40 rounded-lg p-3 text-center">
              <span className="block text-[10px] text-muted-foreground mb-1">Search Vol.</span>
              <span className="text-sm font-display font-semibold text-primary">{seo.search_volume}</span>
            </div>
            <div className="bg-secondary/40 rounded-lg p-3 text-center">
              <span className="block text-[10px] text-muted-foreground mb-1">Trending</span>
              <span className={`text-sm font-display font-semibold ${trendingColor(seo.trending)}`}>{seo.trending}</span>
            </div>
          </div>
          {(seo.primary_keyword || seo.notes) && (
            <div className="mt-4 pt-4 border-t border-border space-y-2 text-xs text-muted-foreground">
              {seo.primary_keyword && (
                <p><span className="text-foreground font-medium">Primary keyword:</span> {seo.primary_keyword}</p>
              )}
              {seo.notes && <p>{seo.notes}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TitleStep;
