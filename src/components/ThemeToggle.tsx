import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

interface Props { className?: string }

export const ThemeToggle = ({ className = "" }: Props) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const current = (theme === "system" ? resolvedTheme : theme) ?? "dark";
  const isDark = current === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={
        "relative inline-flex h-9 w-16 items-center rounded-full border border-border bg-secondary/60 backdrop-blur-md transition-colors hover:border-primary/40 " +
        className
      }
    >
      <span
        className={`absolute top-1 h-7 w-7 rounded-full bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30 transition-transform duration-300 ${
          mounted && isDark ? "translate-x-1" : "translate-x-8"
        }`}
      />
      <Sun className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-primary-foreground/90" />
      <Moon className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-foreground/70" />
    </button>
  );
};

export default ThemeToggle;