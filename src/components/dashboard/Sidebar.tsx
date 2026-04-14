import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap, Film, Search, Palette, BarChart3, Plus,
  Clock, Crown, ChevronDown, Folder, Star, TrendingUp,
  User, LogOut,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

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
}

const Sidebar = ({ activePage = "create" }: SidebarProps) => {
  const [projectsOpen, setProjectsOpen] = useState(true);
  const navigate = useNavigate();

  const getActiveIndex = () => {
    if (activePage === "niches") return 2;
    return 0;
  };

  return (
    <aside className="hidden lg:flex w-72 flex-col border-r border-border bg-card/30 backdrop-blur-sm">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <span className="font-display text-lg font-bold text-foreground">
              VidForge<span className="text-primary">AI</span>
            </span>
            <span className="block text-[10px] text-muted-foreground -mt-0.5 tracking-wider uppercase">Studio Pro</span>
          </div>
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Workspace</div>
        {mainNavItems.map((item, i) => {
          const isActive = i === getActiveIndex();
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-sm shadow-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? "text-primary" : "group-hover:text-primary transition-colors"}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
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
        <div className="pt-4">
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
        </div>

        {/* Quick Stats */}
        <div className="pt-4">
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
        </div>
      </nav>

      {/* Bottom Section */}
      <div className="p-3 space-y-3 border-t border-border">
        {/* Pro Plan Badge */}
        <div className="glass-card p-3 bg-gradient-to-br from-accent/10 to-primary/5">
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
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/50 transition-all cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-display font-bold text-xs">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-xs font-medium text-foreground truncate">My Profile</span>
            <span className="block text-[10px] text-muted-foreground">Manage account</span>
          </div>
        </div>

        {/* Sign Out */}
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
