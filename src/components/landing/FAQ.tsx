import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  { q: "Can I cancel my plan?", a: "Yes, cancel anytime from your account settings. Access continues until the end of your billing period." },
  { q: "What are credits?", a: "Credits are used for generating content. Each action (titles, scripts, voiceovers, images) consumes credits. They reset monthly based on your plan." },
  { q: "Can I monetize videos created with VidForge?", a: "Absolutely. All content you create is yours for any commercial purpose — monetize it, use it in marketing, or include it in other projects." },
  { q: "Can I generate content in other languages?", a: "Yes, we support 30+ languages for script generation and voiceovers through our advanced AI voice engine." },
  { q: "Do unused credits roll over?", a: "Yes, unused credits roll over for one additional billing cycle." },
  { q: "Can I change my plan?", a: "Yes, upgrade or downgrade anytime. Changes reflect in your next billing cycle." },
];

const FAQ = () => {
  return (
    <section id="faq" className="py-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-primary text-sm font-semibold tracking-wider uppercase mb-3">FAQ</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold">
            Got <span className="gradient-text">Questions?</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="glass-card px-6 border border-border rounded-xl data-[state=open]:border-primary/30"
              >
                <AccordionTrigger className="text-foreground font-display font-medium hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
