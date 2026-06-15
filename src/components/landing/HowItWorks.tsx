import { motion } from "framer-motion";
import { UserPlus, Palette, DollarSign } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    title: "Sign Up",
    description: "Create your account and choose a plan that fits your goals.",
    color: "primary" as const,
  },
  {
    icon: Palette,
    title: "Choose Your Style",
    description: "Replicate any successful channel or create a unique custom style.",
    color: "accent" as const,
  },
  {
    icon: DollarSign,
    title: "Start Earning",
    description: "Generate complete videos and upload them to monetize your channels.",
    color: "primary" as const,
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary text-sm font-semibold tracking-wider uppercase mb-3">How It Works</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            From Idea to Upload in{" "}
            <span className="gradient-text">3 Steps</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="text-center relative"
            >
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-border to-transparent" />
              )}
              <div className="w-24 h-24 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-6 relative">
                <step.icon className={`w-10 h-10 ${step.color === 'accent' ? 'text-accent' : 'text-primary'}`} />
                <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <h3 className="font-display text-xl font-semibold mb-2 text-foreground">{step.title}</h3>
              <p className="text-muted-foreground text-sm">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
