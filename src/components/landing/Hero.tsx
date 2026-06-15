import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles, Wand2, Mic2, Image as ImageIcon, Film } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28 pb-24">
      {/* Aurora + grid background */}
      <div className="absolute inset-0 aurora-bg" />
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute inset-0 noise opacity-[0.04] mix-blend-overlay pointer-events-none" />

      {/* Animated aurora orbs */}
      <div className="absolute top-[8%] left-[6%] w-[40rem] h-[40rem] bg-primary/25 rounded-full blur-[160px] animate-aurora" />
      <div className="absolute bottom-[2%] right-[4%] w-[42rem] h-[42rem] bg-accent/25 rounded-full blur-[160px] animate-aurora" style={{ animationDelay: "3s" }} />
      <div className="absolute top-[40%] left-[55%] w-[28rem] h-[28rem] bg-primary-glow/20 rounded-full blur-[140px] animate-aurora" style={{ animationDelay: "6s" }} />

      {/* 3D perspective grid floor */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55vh] opacity-[0.22]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)/0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)/0.6) 1px, transparent 1px)",
          backgroundSize: "70px 70px",
          transform: "perspective(900px) rotateX(62deg)",
          transformOrigin: "center top",
          maskImage: "radial-gradient(ellipse at top, black 40%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at top, black 40%, transparent 75%)",
        }}
      />

      <div className="relative z-10 container mx-auto px-4 text-center" style={{ perspective: "1400px" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-md text-sm mb-8 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.5)] overflow-hidden animate-beam"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-medium tracking-wide bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-transparent">The AI Video Studio · Trusted by 12,000+ creators</span>
          </motion.div>

          <h1 className="font-display text-5xl md:text-7xl lg:text-[5.75rem] font-bold tracking-tight mb-6 leading-[1.02] text-balance">
            Cinema-grade <span className="gradient-text">AI videos</span>,
            <br />
            <span className="text-foreground/90">directed by you.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-balance">
            Script, voice, visuals, soundtrack and final cut — one intelligent pipeline,
            engineered for the next generation of storytellers.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Button size="lg" className="glow-md text-base px-8 py-6 rounded-full bg-gradient-to-r from-primary via-primary to-accent text-primary-foreground hover:opacity-95 group" asChild>
              <Link to="/dashboard">Start Creating <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" /></Link>
            </Button>
            <Button variant="outline" size="lg" className="text-base px-8 py-6 rounded-full border-border/80 bg-card/40 backdrop-blur-md hover:bg-secondary/80" asChild>
              <a href="#demo"><Play className="w-5 h-5 mr-2" /> Watch Demo</a>
            </Button>
          </div>
        </motion.div>

        {/* 3D layered showcase */}
        <motion.div
          initial={{ opacity: 0, y: 60, rotateX: 18 }}
          animate={{ opacity: 1, y: 0, rotateX: 12 }}
          transition={{ delay: 0.5, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative max-w-5xl mx-auto"
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Reflective glow under the stack */}
          <div className="absolute -inset-x-20 -bottom-16 h-40 bg-gradient-to-t from-primary/30 via-primary/10 to-transparent blur-3xl" />

          {/* Back card */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 w-[78%] h-44 rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl shadow-2xl shadow-black/40"
            style={{ transform: "translateZ(-120px) translateX(-50%)" }}
          />

          {/* Mid card */}
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            className="absolute -top-5 left-1/2 -translate-x-1/2 w-[88%] h-48 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-xl shadow-2xl shadow-black/50"
            style={{ transform: "translateZ(-60px) translateX(-50%)" }}
          />

          {/* Foreground hero card */}
          <div
            className="relative rounded-3xl border border-white/10 bg-gradient-to-br from-card/90 via-card/80 to-card/60 backdrop-blur-2xl p-6 md:p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_60px_-10px_hsl(var(--primary)/0.25)] ring-1 ring-inset ring-white/5"
          >
            {/* Inner sheen */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/[0.06] via-transparent to-transparent" />

            {/* Window chrome */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-primary/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
              </div>
              <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">vidforge · studio</div>
              <div className="w-12" />
            </div>

            {/* Pipeline tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[
                { icon: Wand2, label: "Script", value: "Generated", tone: "from-primary/25 to-primary/5" },
                { icon: Mic2, label: "Voice", value: "af_heart · 00:42", tone: "from-accent/25 to-accent/5" },
                { icon: ImageIcon, label: "Visuals", value: "8 scenes", tone: "from-primary/25 to-accent/10" },
                { icon: Film, label: "Final cut", value: "1080p · MP4", tone: "from-accent/25 to-primary/10" },
              ].map((tile, i) => (
                <motion.div
                  key={tile.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.08 }}
                  className={`group relative rounded-2xl border border-white/10 bg-gradient-to-br ${tile.tone} p-4 text-left overflow-hidden`}
                >
                  <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-primary/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <tile.icon className="w-4 h-4 text-primary mb-3" />
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{tile.label}</div>
                  <div className="text-sm font-display font-semibold text-foreground">{tile.value}</div>
                </motion.div>
              ))}
            </div>

            {/* Timeline bar */}
            <div className="mt-6 rounded-xl border border-white/5 bg-background/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 text-primary fill-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-foreground">Hidden Wonders of the Deep</div>
                    <div className="text-[10px] text-muted-foreground">Rendering · 00:38 / 02:14</div>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                </div>
              </div>
              <div className="flex gap-1 h-9">
                {Array.from({ length: 28 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scaleY: 0.3 }}
                    animate={{ scaleY: [0.3, Math.random() * 0.9 + 0.2, 0.3] }}
                    transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.05 }}
                    className="flex-1 rounded-sm bg-gradient-to-t from-primary/40 to-accent/70 origin-bottom"
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
