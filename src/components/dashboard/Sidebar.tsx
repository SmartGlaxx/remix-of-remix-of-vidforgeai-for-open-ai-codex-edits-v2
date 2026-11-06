import { Play, FolderKanban, BookOpen, GitBranch, Images, Clapperboard, Beaker, Film, Download, Boxes, Activity, Settings, LogOut, User } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const items = [
  { path: "/dashboard/projects", label: "Projects", icon: FolderKanban, section: "STORY · 01" },
  { path: "/dashboard/script", label: "Script", icon: BookOpen, section: "STORY · 01" },
  { path: "/dashboard/story-canvas", label: "Story Canvas", icon: GitBranch, section: "STORY · 01" },
  { path: "/dashboard/storyboard", label: "Storyboard", icon: Images, section: "PLAN · 02" },
  { path: "/dashboard/director", label: "Director", icon: Clapperboard, section: "SHOOT · 03" },
  { path: "/dashboard/shot-lab", label: "Shot Lab", icon: Beaker, section: "SHOOT · 03" },
  { path: "/dashboard/final-cut", label: "Final cut", icon: Film, section: "FINISH · 04" },
  { path: "/dashboard/export", label: "Export", icon: Download, section: "DELIVER · 05" },
  { path: "/dashboard/assets", label: "Assets", icon: Boxes, section: "WORKSPACE" },
  { path: "/dashboard/production", label: "Production", icon: Activity, section: "WORKSPACE" },
  { path: "/dashboard/settings", label: "Settings", icon: Settings, section: "WORKSPACE" },
];
interface SidebarProps {
  activePage?: string;
  collapsed?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}
export default function Sidebar({ collapsed = false, onMouseEnter, onMouseLeave }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const sections = [...new Set(items.map((item) => item.section))];
  return (
    <aside onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      className={`director-sidebar relative hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex ${collapsed ? "is-collapsed w-[76px]" : "w-60"}`}>
      <div className={`flex h-[76px] items-center border-b border-sidebar-border ${collapsed ? "justify-center px-2" : "px-5"}`}>
        <Link to="/dashboard/script" aria-label="Genvast Director home" title={collapsed ? "Genvast Director" : undefined} className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-3"}`}>
          <span className="brand-mark"><Play className="h-4 w-4" /></span>
          {!collapsed && <span className="font-display text-base font-semibold tracking-tight whitespace-nowrap">GENVAST <span className="text-primary">Director</span></span>}
        </Link>
      </div>
      <nav aria-label="Director sidebar" className={`flex-1 overflow-y-auto py-5 ${collapsed ? "px-2" : "px-3"}`}>
        {sections.map((section) => <div key={section} className="mb-5">
          <p className={`pb-2 text-[10px] font-semibold uppercase tracking-[.14em] ${collapsed ? "text-center text-primary" : "px-3 text-muted-foreground"}`}>{collapsed ? section.split(" · ")[1] || "—" : section}</p>
          <div className="space-y-1">{items.filter((item) => item.section === section).map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} title={collapsed ? label : undefined}
            aria-label={label} className={({ isActive }) => `sidebar-link ${collapsed ? "justify-center px-0" : "px-3"} ${isActive ? "is-active" : ""}`}>
            <Icon className="h-[18px] w-[18px] shrink-0" />{!collapsed && <span className="truncate">{label}</span>}
          </NavLink>)}</div>
        </div>)}
      </nav>
      <div className={`space-y-3 border-t border-sidebar-border py-4 ${collapsed ? "px-2" : "px-4"}`}>
        <div title={collapsed ? (user?.email ?? "Signed in") : undefined} className={`flex min-w-0 items-center text-muted-foreground ${collapsed ? "justify-center" : "gap-3 px-1"}`}>
          <User className="h-[18px] w-[18px] shrink-0" />{!collapsed && <span className="truncate text-xs">{user?.email ?? "Signed in"}</span>}
        </div>
        <Button variant="ghost" title="Sign out" className={`w-full text-muted-foreground hover:text-foreground ${collapsed ? "justify-center px-0" : "justify-start"}`} aria-label="Sign out"
          onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}>
          <LogOut className="h-[18px] w-[18px] shrink-0" />{!collapsed && <span className="ml-3">Sign out</span>}
        </Button>
      </div>
    </aside>
  );
}
