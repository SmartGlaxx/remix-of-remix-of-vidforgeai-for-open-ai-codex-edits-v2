import { motion } from "framer-motion";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const pipelineSteps = ["Title", "Script", "Voiceover", "Visuals", "Thumbnail", "Soundtrack", "Video"];

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm mb-8"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Video Creation Platform</span>
          </motion.div>

          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
            Create{" "}
            <span className="gradient-text">Viral Videos</span>
            <br />
            <span className="text-foreground/80">In Minutes</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Everything you need to dominate social media — AI scripts, voiceovers, visuals, thumbnails, and full video editing. All in one platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button size="lg" className="glow-md text-base px-8 py-6" asChild>
              <Link to="/dashboard">
                Start Creating <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-base px-8 py-6 border-border hover:bg-secondary" asChild>
              <a href="#demo">
                <Play className="w-5 h-5 mr-2" /> Watch Demo
              </a>
            </Button>
          </div>
        </motion.div>

        {/* Pipeline Steps */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="max-w-3xl mx-auto"
        >
          <div className="glass-card p-6">
            <div className="flex items-center justify-between gap-1 mb-6 overflow-x-auto pb-2">
              {pipelineSteps.map((step, i) => (
                <button
                  key={step}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    i === 0
                      ? "bg-primary text-primary-foreground glow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {step}
                </button>
              ))}
            </div>

            <div className="bg-secondary/50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center flex-shrink-0">
                  <Play className="w-5 h-5 text-destructive" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-display font-semibold text-foreground mb-1">
                    Generate from YouTube Channel
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Analyze any channel and generate viral titles in their style
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="https://www.youtube.com/@channel"
                      className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                      readOnly
                      defaultValue="https://www.youtube.com/@fern-tv"
                    />
                    <Button className="glow-sm">
                      <Sparkles className="w-4 h-4 mr-2" /> Generate
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
