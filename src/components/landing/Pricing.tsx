import { motion } from "framer-motion";
import { Check, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    credits: "33K",
    price: "$149",
    description: "Perfect for getting started with AI content.",
    features: [
      "AI titles, scripts, voiceovers & images",
      "AI Thumbnails",
      "Niche Finder Access",
      "Scripts up to 8,000 words",
      "2 Saved Styles",
      "2 concurrent projects",
    ],
    popular: false,
  },
  {
    name: "Pro",
    credits: "140K",
    price: "$499",
    description: "Best for growing channels and agencies.",
    features: [
      "Everything in Starter +",
      "10 Saved Styles",
      "3 Voice Clones",
      "AI Image Animation",
      "2 team seats",
      "3 concurrent projects",
    ],
    popular: true,
  },
  {
    name: "Premium",
    credits: "420K",
    price: "$1,199",
    description: "For large channels and agencies.",
    features: [
      "Everything in Pro +",
      "20 Saved Styles",
      "10 Voice Clones",
      "3 team seats",
      "Early access to features",
      "5 concurrent projects",
    ],
    popular: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 relative">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-accent/5 rounded-full blur-[150px]" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary text-xs font-semibold tracking-[0.3em] uppercase mb-4">— Pricing</p>
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-4 text-balance">
            One studio. <span className="gradient-text">Three tiers.</span>
          </h2>
          <p className="text-muted-foreground text-lg">No hidden fees. Cancel anytime.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col p-8 rounded-3xl border bg-card/40 backdrop-blur-2xl transition-all duration-500 hover:-translate-y-1 ${
                plan.popular
                  ? "border-primary/50 shadow-[0_20px_80px_-20px_hsl(var(--primary)/0.55)]"
                  : "border-border/60 hover:border-primary/30"
              }`}
            >
              {plan.popular && (
                <div className="absolute inset-0 rounded-3xl pointer-events-none bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
              )}
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Most Popular
                </div>
              )}

              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">{plan.credits} Credits</p>
                <h3 className="font-display text-2xl font-bold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </div>

              <div className="mb-8">
                <span className="font-display text-4xl font-bold text-foreground">{plan.price}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-secondary-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.popular ? "default" : "outline"}
                className={`w-full ${plan.popular ? "glow-sm" : ""}`}
                asChild
              >
                <Link to="/dashboard">Get Started</Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
