import { motion } from "framer-motion";
import { Lightbulb, Layers, Sparkles, Rocket } from "lucide-react";

const steps = [
  { icon: Lightbulb, title: "Drop an idea", description: "A title, a niche, a URL — that's all. Our planner turns it into a structured brief." },
  { icon: Layers, title: "Pick your style", description: "Choose a visual reference, voice, and pacing — or clone an existing channel's DNA." },
  { icon: Sparkles, title: "AI orchestrates", description: "Script, voice, scenes, music, lip-sync — generated in parallel by a director-level agent." },
  { icon: Rocket, title: "Ship to platform", description: "Export a final cut and upload — or schedule a series across channels." },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary text-xs font-semibold tracking-[0.3em] uppercase mb-4">— The Workflow</p>
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-4 text-balance">
            Idea to upload, in <span className="gradient-text">four moves.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22,1,0.36,1] }}
              className="relative group"
            >
              <div className="relative h-full rounded-3xl border border-border/60 bg-card/40 backdrop-blur-2xl p-6 hover:border-primary/40 hover:shadow-[0_10px_60px_-15px_hsl(var(--primary)/0.35)] transition-all duration-500 overflow-hidden">
                <div className="absolute -top-12 -right-10 w-44 h-44 bg-primary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="text-[10px] font-mono text-muted-foreground mb-4">0{i + 1}</div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center mb-5">
                    <step.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
