import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

type Mode = "signin" | "signup";

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "Confirm your address to finish signing up." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast({ title: "Authentication failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
      if (result.error) throw result.error;
      // either redirected or session set
    } catch (err) {
      toast({ title: "Google sign-in failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md glass-card p-8">
        <Link to="/" className="inline-flex items-center gap-2 mb-6 text-sm text-muted-foreground hover:text-foreground">
          <Sparkles className="w-4 h-4 text-primary" /> VidForge AI
        </Link>
        <h1 className="font-display text-2xl font-semibold text-foreground mb-1">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "signin" ? "Sign in to continue building videos." : "Start generating in minutes."}
        </p>

        <Button type="button" variant="outline" className="w-full mb-4" onClick={onGoogle} disabled={busy}>
          Continue with Google
        </Button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-background px-2 text-muted-foreground">or</span></div>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full glow-sm" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="block w-full mt-4 text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
};

export default Auth;