import { motion } from "framer-motion";
import {
  Sparkles, Mic, Image as ImageIcon, Music, Search, PenTool, Film, Palette, Wand2,
} from "lucide-react";

const Features = () => {
  return (
    <section id="features" className="py-32 relative">
      <div className="absolute inset-0 aurora-bg opacity-40 pointer-events-none" />
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 max-w-3xl mx-auto"
        >
          <p className="text-primary text-xs font-semibold tracking-[0.3em] uppercase mb-4">— Capabilities</p>
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-4 text-balance">
            One pipeline. <span className="gradient-text">Every craft.</span>
          </h2>
          <p className="text-muted-foreground text-lg text-balance">
            From the first idea to the final cut — every layer of production, intelligently orchestrated.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-12 auto-rows-[180px] gap-4 max-w-7xl mx-auto">
          {/* Big feature — script writer */}
          <BentoCard className="col-span-12 md:col-span-7 row-span-2" delay={0}>
            <div className="absolute -top-24 -right-20 w-72 h-72 bg-primary/20 blur-3xl rounded-full" />
            <div className="relative h-full flex flex-col justify-between">
              <div className="flex items-center gap-2 text-primary"><PenTool className="w-5 h-5" /><span className="text-xs uppercase tracking-widest font-semibold">AI Script Writer</span></div>
              <div>
                <h3 className="font-display text-3xl md:text-4xl font-bold mb-3 leading-tight">Scripts that hold attention to the last second.</h3>
                <p className="text-muted-foreground max-w-md">Retention-optimized writing up to 10,000 words — match any channel's voice, hook, and rhythm.</p>
              </div>
              <ScriptPreview />
            </div>
          </BentoCard>

          <BentoCard className="col-span-12 md:col-span-5 row-span-2" delay={0.05}>
            <div className="absolute -bottom-16 -left-10 w-56 h-56 bg-accent/25 blur-3xl rounded-full" />
            <div className="relative h-full flex flex-col justify-between">
              <div className="flex items-center gap-2 text-accent"><Mic className="w-5 h-5" /><span className="text-xs uppercase tracking-widest font-semibold">Pro Voiceovers</span></div>
              <div>
                <h3 className="font-display text-2xl md:text-3xl font-bold mb-2 leading-tight">Studio-quality voices in 30+ languages.</h3>
                <p className="text-muted-foreground text-sm">Custom voice cloning that's indistinguishable from human narration.</p>
              </div>
              <Waveform />
            </div>
          </BentoCard>

          <BentoCard className="col-span-12 md:col-span-4" delay={0.1}>
            <div className="flex flex-col h-full justify-between">
              <ImageIcon className="w-6 h-6 text-primary" />
              <div>
                <h4 className="font-display font-semibold text-lg mb-1">Scene Builder</h4>
                <p className="text-sm text-muted-foreground">Cinematic visuals timed to your audio.</p>
              </div>
            </div>
          </BentoCard>

          <BentoCard className="col-span-12 md:col-span-4" delay={0.15}>
            <div className="flex flex-col h-full justify-between">
              <Music className="w-6 h-6 text-accent" />
              <div>
                <h4 className="font-display font-semibold text-lg mb-1">Soundtrack AI</h4>
                <p className="text-sm text-muted-foreground">Score that matches the mood, beat-perfect.</p>
              </div>
            </div>
          </BentoCard>

          <BentoCard className="col-span-12 md:col-span-4" delay={0.2}>
            <div className="flex flex-col h-full justify-between">
              <Palette className="w-6 h-6 text-primary" />
              <div>
                <h4 className="font-display font-semibold text-lg mb-1">Thumbnail Maker</h4>
                <p className="text-sm text-muted-foreground">High-CTR thumbnails, trained on real wins.</p>
              </div>
            </div>
          </BentoCard>

          <BentoCard className="col-span-12 md:col-span-5" delay={0.25}>
            <div className="flex items-center justify-between h-full">
              <div>
                <Search className="w-6 h-6 text-primary mb-3" />
                <h4 className="font-display font-semibold text-xl mb-1">Niche Finder</h4>
                <p className="text-sm text-muted-foreground max-w-xs">Profitable niches with live RPM analytics from our channel database.</p>
              </div>
              <div className="hidden md:flex flex-col gap-1.5">
                {[80, 62, 91, 47, 73].map((w, i) => (
                  <div key={i} className="h-2 rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${w * 1.2}px` }} />
                ))}
              </div>
            </div>
          </BentoCard>

          <BentoCard className="col-span-12 md:col-span-7" delay={0.3}>
            <div className="flex items-center justify-between h-full gap-6">
              <div>
                <Film className="w-6 h-6 text-accent mb-3" />
                <h4 className="font-display font-semibold text-xl mb-1">Final Cut Renderer</h4>
                <p className="text-sm text-muted-foreground max-w-md">Export up to 30 minutes at 1080p — stitched, scored, and ready to upload.</p>
              </div>
              <RenderBars />
            </div>
          </BentoCard>

          <BentoCard className="col-span-6 md:col-span-3" delay={0.35}>
            <Wand2 className="w-5 h-5 text-primary mb-2" />
            <h4 className="font-display font-semibold mb-1">Custom Styles</h4>
            <p className="text-xs text-muted-foreground">Train AI on your aesthetic.</p>
          </BentoCard>

          <BentoCard className="col-span-6 md:col-span-3" delay={0.4}>
            <Sparkles className="w-5 h-5 text-accent mb-2" />
            <h4 className="font-display font-semibold mb-1">AI Avatars</h4>
            <p className="text-xs text-muted-foreground">Consistent on-screen talent.</p>
          </BentoCard>

          <BentoCard className="col-span-12 md:col-span-6" delay={0.45}>
            <div className="flex items-center justify-between h-full">
              <div>
                <h4 className="font-display font-semibold text-lg mb-1">Director-grade prompts</h4>
                <p className="text-sm text-muted-foreground">Cinematography terms baked in — lens, mood, lighting, era.</p>
              </div>
              <div className="flex -space-x-2">
                {["35mm", "Noir", "Dusk", "Macro"].map((t, i) => (
                  <span key={t} className="rounded-full border border-primary/30 bg-primary/10 backdrop-blur px-3 py-1 text-[11px] text-primary font-medium" style={{ transform: `translateY(${i * 2}px)` }}>{t}</span>
                ))}
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
};

const BentoCard = ({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    className={`relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 backdrop-blur-2xl p-6 hover:border-primary/40 hover:shadow-[0_10px_60px_-15px_hsl(var(--primary)/0.35)] transition-all duration-500 group ${className}`}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-transparent pointer-events-none" />
    <div className="relative h-full">{children}</div>
  </motion.div>
);

const Waveform = () => (
  <div className="flex items-end gap-1 h-12">
    {Array.from({ length: 36 }).map((_, i) => (
      <motion.div
        key={i}
        animate={{ scaleY: [0.3, Math.random() * 0.8 + 0.4, 0.3] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.04, ease: "easeInOut" }}
        className="flex-1 rounded-sm bg-gradient-to-t from-accent/40 to-primary origin-bottom"
      />
    ))}
  </div>
);

const ScriptPreview = () => (
  <div className="rounded-xl border border-border/60 bg-background/40 backdrop-blur p-4 font-mono text-[11px] text-muted-foreground space-y-1.5 max-w-md">
    <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span>generating · scene 04</span></div>
    <div><span className="text-primary">[hook]</span> What if everything you knew about the deep ocean…</div>
    <div><span className="text-accent">[reveal]</span> was hiding something extraordinary?</div>
  </div>
);

const RenderBars = () => (
  <div className="grid grid-cols-4 gap-1.5">
    {Array.from({ length: 16 }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0.2 }}
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.06 }}
        className="w-3 h-8 rounded-sm bg-gradient-to-b from-primary to-accent"
      />
    ))}
  </div>
);

export default Features;