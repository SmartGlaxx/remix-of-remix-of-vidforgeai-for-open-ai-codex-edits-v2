import { motion } from "framer-motion";
import {
  Sparkles, Mic, Image, Palette, Film, Music, Search, Users, PenTool, MonitorPlay,
} from "lucide-react";

const features = [
  {
    icon: Search,
    title: "Niche Finder",
    description: "Discover profitable niches with our massive channel database and RPM analytics.",
  },
  {
    icon: PenTool,
    title: "AI Script Writer",
    description: "Generate retention-optimized scripts up to 10,000 words from any idea or channel style.",
  },
  {
    icon: Mic,
    title: "Pro Voiceovers",
    description: "Studio-quality AI narration in 30+ languages with custom voice cloning.",
  },
  {
    icon: Music,
    title: "Soundtrack Generator",
    description: "Auto-generate background music that perfectly matches your video's tone.",
  },
  {
    icon: Image,
    title: "Scene Builder",
    description: "Mass-generate cinematic visuals timed to your audio with AI animation.",
  },
  {
    icon: Palette,
    title: "Thumbnail Maker",
    description: "Create high-CTR thumbnails trained on millions of real YouTube results.",
  },
  {
    icon: Users,
    title: "AI Avatars",
    description: "Create consistent characters and talking-head avatars for your brand.",
  },
  {
    icon: Sparkles,
    title: "Custom Styles",
    description: "Upload references to train AI on your unique visual style.",
  },
  {
    icon: MonitorPlay,
    title: "Video Editor",
    description: "Edit and export videos up to 30 minutes directly on the platform.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const Features = () => {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary text-sm font-semibold tracking-wider uppercase mb-3">Features</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Everything You Need to{" "}
            <span className="gradient-text">Go Viral</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            AI-powered tools to generate scripts, voiceovers, visuals, soundtracks, and complete videos.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={item}
              className="glass-card-hover p-6 group"
            >
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
