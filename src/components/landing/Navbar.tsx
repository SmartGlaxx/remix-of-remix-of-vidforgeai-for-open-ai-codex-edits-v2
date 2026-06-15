import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Testimonials", href: "#testimonials" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(96%,1180px)]"
    >
      <div className="premium-border bg-background/60 backdrop-blur-2xl shadow-[0_10px_40px_-15px_hsl(var(--primary)/0.25)]">
        <div className="flex items-center justify-between h-14 px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-primary via-primary to-accent shadow-lg shadow-primary/30 flex items-center justify-center ring-1 ring-white/10">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/20 to-transparent" />
            </div>
            <span className="font-display text-[17px] font-bold tracking-tight text-foreground">
              VidForge<span className="gradient-text">AI</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 rounded-full bg-secondary/40 border border-border/60 px-1 py-1">
            {navLinks.map((link) => (
              <a key={link.label} href={link.href} className="px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground rounded-full hover:bg-background/60 transition-colors">{link.label}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild><Link to="/dashboard">Sign in</Link></Button>
            <Button size="sm" className="glow-sm rounded-full px-4 bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-95" asChild>
              <Link to="/dashboard">Launch Studio</Link>
            </Button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button className="text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="md:hidden border-t border-border">
            <div className="flex flex-col p-4 gap-2">
              {navLinks.map((link) => (
                <a key={link.label} href={link.href} className="text-sm text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileOpen(false)}>{link.label}</a>
              ))}
              <Button size="sm" className="mt-2 rounded-full bg-gradient-to-r from-primary to-accent" asChild><Link to="/dashboard">Launch Studio</Link></Button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
};

export default Navbar;
