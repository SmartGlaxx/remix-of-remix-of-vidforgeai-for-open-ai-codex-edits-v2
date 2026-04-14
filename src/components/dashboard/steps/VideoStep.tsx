import {
  Check, Play, Download, Film, Share2, ExternalLink,
  Clock, Sparkles, Eye, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const VideoStep = () => (
  <div className="space-y-6">
    <div className="glass-card p-8 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-primary/20 flex items-center justify-center mx-auto mb-5 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
        <Check className="w-10 h-10 text-emerald-400" />
      </div>
      <h3 className="font-display text-2xl font-bold text-foreground mb-2">Your Video is Ready!</h3>
      <p className="text-muted-foreground mb-6 text-sm">Preview, fine-tune, and export your AI-generated masterpiece</p>

      {/* Video player */}
      <div className="aspect-video bg-secondary/60 rounded-2xl flex items-center justify-center border border-border mb-6 relative overflow-hidden group cursor-pointer">
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
        <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-2xl shadow-primary/30 group-hover:scale-110 transition-transform">
          <Play className="w-7 h-7 text-primary-foreground ml-1" />
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden backdrop-blur-sm">
            <div className="h-full w-0 bg-primary rounded-full" />
          </div>
          <span className="text-xs text-foreground/80">10:32</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { icon: Clock, label: "Duration", value: "10:32" },
          { icon: Sparkles, label: "Quality", value: "4K Ultra" },
          { icon: Eye, label: "Est. Views", value: "2.4M" },
          { icon: TrendingUp, label: "Viral Score", value: "94/100" },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/30 rounded-xl p-3 border border-border/50">
            <stat.icon className="w-4 h-4 text-primary mx-auto mb-1.5" />
            <span className="block text-xs font-display font-bold text-foreground">{stat.value}</span>
            <span className="block text-[9px] text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-center flex-wrap">
        <Button className="glow-sm h-11 px-6">
          <Download className="w-4 h-4 mr-2" /> Export Video
        </Button>
        <Button variant="outline" className="h-11 px-6 border-border hover:border-primary/30">
          <Film className="w-4 h-4 mr-2" /> Open Editor
        </Button>
        <Button variant="outline" className="h-11 px-6 border-border hover:border-primary/30">
          <Share2 className="w-4 h-4 mr-2" /> Share
        </Button>
        <Button variant="outline" className="h-11 px-6 border-border hover:border-primary/30">
          <ExternalLink className="w-4 h-4 mr-2" /> Upload to YouTube
        </Button>
      </div>
    </div>

    {/* Export formats */}
    <div className="glass-card p-6">
      <h3 className="font-display font-semibold text-foreground mb-4">Export Formats</h3>
      <div className="grid grid-cols-2 gap-2">
        {[
          { format: "MP4 (H.264)", size: "~850 MB", quality: "4K 60fps" },
          { format: "MP4 (H.265)", size: "~420 MB", quality: "4K 60fps" },
          { format: "WebM (VP9)", size: "~380 MB", quality: "4K 30fps" },
          { format: "YouTube Ready", size: "~650 MB", quality: "Optimized" },
        ].map((fmt) => (
          <button
            key={fmt.format}
            className="p-3 rounded-xl border border-border hover:border-primary/20 text-left transition-all hover:bg-secondary/30"
          >
            <span className="text-xs font-medium text-foreground block">{fmt.format}</span>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
              <span>{fmt.quality}</span>
              <span>•</span>
              <span>{fmt.size}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default VideoStep;
