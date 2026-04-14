import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  { initials: "A", result: "$100k revenue in 4 months", quote: "100k subscribers, just over 100 videos. The AI scripts are indistinguishable from human-written ones." },
  { initials: "B", result: "Monetized in 15 days", quote: "I went from zero to monetized faster than I ever thought possible. The thumbnail maker alone is worth the price." },
  { initials: "C", result: "$12k/mo consistently", quote: "Running 3 channels simultaneously would be impossible without VidForge. The workflow is seamless." },
  { initials: "D", result: "$641 in first 15 days", quote: "A second channel I started hit $150 in a single day. The niche finder is absolutely game-changing." },
  { initials: "E", result: "$40k in 6 months", quote: "The custom style training is incredible. My videos look completely unique despite being AI-generated." },
  { initials: "F", result: "Monetized in 3 weeks", quote: "VidForge isn't just a tool — it was a mindset shift. The crash course helped me understand the strategy." },
];

const Testimonials = () => {
  return (
    <section id="testimonials" className="py-24 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary text-sm font-semibold tracking-wider uppercase mb-3">Testimonials</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Real <span className="gradient-text">Results</span>
          </h2>
          <p className="text-muted-foreground text-lg">See what our users are achieving.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass-card-hover p-6"
            >
              <div className="flex gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-secondary-foreground mb-4 leading-relaxed">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-display font-bold text-sm">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Verified User</p>
                  <p className="text-xs text-primary">{t.result}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
