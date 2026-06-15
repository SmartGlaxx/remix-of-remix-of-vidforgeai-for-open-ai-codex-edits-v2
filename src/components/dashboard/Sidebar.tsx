import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Film, Search, Palette, BarChart3, Plus,
  Clock, Crown, ChevronDown, Folder, Star, TrendingUp,
  User, LogOut, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const mainNavItems = [
  { icon: Plus, label: "New Project", badge: null, path: "/dashboard" },
  { icon: Film, label: "My Videos", badge: "12", path: "/dashboard" },
  { icon: Search, label: "Niche Finder", badge: null, path: "/dashboard/niches" },
  { icon: Palette, label: "Style Library", badge: "3 new", path: "/dashboard" },
  { icon: BarChart3, label: "Analytics", badge: null, path: "/dashboard" },
];

const recentProjects = [
  { name: "Drone Army Documentary", status: "rendering", progress: 78 },
  { name: "Top 10 AI Tools 2024", status: "complete", progress: 100 },
  { name: "Hidden Gems Revealed", status: "draft", progress: 34 },
];

interface SidebarProps {
  activePage?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}

const Sidebar = ({ activePage = "create", collapsed = false, onToggle }: SidebarProps) => {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const getActiveIndex = () => {
    if (activePage === "niches") return 2;
    return 0;
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 288 }}
      transition={{ type: "spring", stiffness: 260, damping: 32 }}
      className="hidden lg:flex flex-col bg-gradient-to-b from-[hsl(225_24%_5%)] via-[hsl(225_22%_4%)] to-[hsl(225_25%_3%)] relative"
    >
      {/* Premium right edge: hairline + soft glow */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-[-1px] w-px bg-border/60" />

      {/* Floating edge toggle — never overlaps the logo */}
      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="group absolute top-7 -right-3 z-20 w-6 h-6 rounded-full bg-card border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/40 shadow-md shadow-black/40 transition-all flex items-center justify-center"
        >
          {collapsed
            ? <ChevronRight className="w-3 h-3" />
            : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 flex items-center">
        <Link to="/" className="flex items-center gap-2.5 min-w-0 group/logo">
          <div className="relative w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-primary via-primary/90 to-accent flex items-center justify-center shadow-lg shadow-primary/30 ring-1 ring-primary/30">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/20 to-transparent opacity-70" />
            <Zap className="relative w-5 h-5 text-primary-foreground drop-shadow" />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <span className="font-display text-[17px] font-bold tracking-tight text-foreground whitespace-nowrap">
                  VidForge<span className="text-primary">AI</span>
                </span>
                <span className="block text-[9px] font-medium text-muted-foreground/80 -mt-0.5 tracking-[0.18em] uppercase">Studio · Pro</span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Main Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Workspace</div>
        )}
        {mainNavItems.map((item, i) => {
          const isActive = i === getActiveIndex();
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 ${collapsed ? "justify-center px-2" : "px-3"} py-2.5 rounded-lg text-sm transition-all group ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-sm shadow-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "group-hover:text-primary transition-colors"}`} />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  item.badge.includes("new")
                    ? "bg-accent/20 text-accent"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Recent Projects */}
        {!collapsed && <div className="pt-4">
          <button
            onClick={() => setProjectsOpen(!projectsOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${projectsOpen ? "" : "-rotate-90"}`} />
            Recent Projects
          </button>
          {projectsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-1 mt-1"
            >
              {recentProjects.map((project) => (
                <button
                  key={project.name}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all group"
                >
                  <Folder className="w-3.5 h-3.5 shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <span className="block truncate text-xs">{project.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            project.status === "complete"
                              ? "bg-emerald-500"
                              : project.status === "rendering"
                              ? "bg-primary"
                              : "bg-muted-foreground/40"
                          }`}
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground">{project.progress}%</span>
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>}

        {/* Quick Stats */}
        {!collapsed && <div className="pt-4">
          <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Quick Stats</div>
          <div className="grid grid-cols-2 gap-2 px-1">
            {[
              { label: "Videos", value: "47", icon: Film, trend: "+12%" },
              { label: "Views", value: "2.1M", icon: TrendingUp, trend: "+28%" },
              { label: "Avg RPM", value: "$18.40", icon: Star, trend: "+5%" },
              { label: "This Month", value: "8", icon: Clock, trend: "+3" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-2.5 group hover:border-primary/20 transition-all cursor-default">
                <div className="flex items-center gap-1.5 mb-1">
                  <stat.icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{stat.label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-display font-bold text-foreground">{stat.value}</span>
                  <span className="text-[9px] text-emerald-400">{stat.trend}</span>
                </div>
              </div>
            ))}
          </div>
        </div>}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 space-y-3 border-t border-border">
        {!collapsed && <div className="glass-card p-3 bg-gradient-to-br from-accent/10 to-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-accent" />
            <span className="text-xs font-display font-semibold text-foreground">Pro Plan</span>
          </div>
          <div className="flex items-center justify-between text-[10px] mb-1.5">
            <span className="text-muted-foreground">Credits Used</span>
            <span className="text-primary font-semibold">28,450 / 33,000</span>
          </div>
          <div className="h-1.5 bg-background rounded-full overflow-hidden">
            <div className="h-full w-[86%] bg-gradient-to-r from-primary via-accent to-primary rounded-full" />
          </div>
          <p className="text-[9px] text-muted-foreground mt-1.5">Resets in 12 days</p>
        </div>}

        {/* Profile */}
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center px-1" : "px-3"} py-2.5 rounded-lg hover:bg-secondary/50 transition-all cursor-pointer group`}>
          <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-display font-bold text-xs">
            <User className="w-4 h-4" />
          </div>
          {!collapsed && <div className="flex-1 min-w-0">
            <span className="block text-xs font-medium text-foreground truncate">{user?.email ?? "My Profile"}</span>
            <span className="block text-[10px] text-muted-foreground">Signed in</span>
          </div>}
        </div>

        {/* Sign Out */}
        <button onClick={handleSignOut} title={collapsed ? "Sign Out" : undefined} className={`w-full flex items-center gap-3 ${collapsed ? "justify-center px-2" : "px-3"} py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all`}>
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
