import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Footer = () => {
  return (
    <footer className="relative pt-24 pb-12 overflow-hidden">
      <div className="absolute inset-0 aurora-bg opacity-50" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="container mx-auto px-4 relative z-10">
        {/* Mega CTA */}
        <div className="relative max-w-4xl mx-auto mb-20 rounded-3xl border border-primary/30 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-2xl p-10 md:p-14 text-center overflow-hidden shadow-[0_20px_80px_-20px_hsl(var(--primary)/0.45)]">
          <div className="absolute -top-32 -left-20 w-96 h-96 bg-primary/30 blur-[140px] rounded-full" />
          <div className="absolute -bottom-32 -right-20 w-96 h-96 bg-accent/30 blur-[140px] rounded-full" />
          <div className="relative">
            <h2 className="font-display text-3xl md:text-5xl font-bold mb-4 text-balance">
              The studio of the future <span className="gradient-text">is one click away.</span>
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-balance">
              Join thousands of creators replacing entire production teams with one intelligent pipeline.
            </p>
            <Button size="lg" className="rounded-full px-8 py-6 bg-gradient-to-r from-primary to-accent text-primary-foreground glow-md hover:opacity-95" asChild>
              <Link to="/dashboard">Launch the Studio</Link>
            </Button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center ring-1 ring-white/10">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">
              VidForge<span className="gradient-text">AI</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground tracking-wide">
            © {new Date().getFullYear()} VidForge AI · Crafted for storytellers.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
