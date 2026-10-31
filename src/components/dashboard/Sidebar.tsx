import { Zap, BookOpen, Images, Clapperboard, Film, LogOut, ChevronLeft, ChevronRight, User } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
const items = [
  { path: "/dashboard/script", label: "Script", icon: BookOpen },
  { path: "/dashboard/storyboard", label: "Storyboard", icon: Images },
  { path: "/dashboard/director", label: "Director", icon: Clapperboard },
  { path: "/dashboard/sequence", label: "Sequence", icon: Film },
];
interface SidebarProps { activePage?: string; collapsed?: boolean; onToggle?: () => void }
export default function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <aside className={`relative hidden lg:flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar ${collapsed ? "w-20" : "w-60"}`}>
      <div className="flex items-center gap-3 px-5 py-6">
        <Link to="/" aria-label="Capscify AI home" className="flex min-w-0 items-center gap-3">
          <Zap className="h-7 w-7 shrink-0 text-primary" />
          {!collapsed && <span className="font-display text-lg font-semibold whitespace-nowrap">Capscify <span className="text-primary">AI</span></span>}
        </Link>
      </div>
      {onToggle && <Button variant="outline" size="icon" onClick={onToggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-24 z-20 h-6 w-6 rounded-full bg-card">
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>}
      <nav aria-label="Director sidebar" className="flex-1 space-y-2 px-3 pt-4">
        {!collapsed && <p className="px-3 pb-3 text-xs text-muted-foreground">DIRECTOR WORKSPACE</p>}
        {items.map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} title={collapsed ? label : undefined}
          aria-label={label} className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-3 text-sm ${collapsed ? "justify-center" : ""} ${isActive ? "bg-sidebar-accent text-sidebar-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}>
          <Icon className="h-4 w-4 shrink-0" />{!collapsed && label}
        </NavLink>)}
      </nav>
      <div className="space-y-3 border-t border-sidebar-border p-4">
        <div className="flex min-w-0 items-center gap-3 text-muted-foreground">
          <User className="h-4 w-4 shrink-0" />{!collapsed && <span className="truncate text-xs">{user?.email ?? "Signed in"}</span>}
        </div>
        <Button variant="ghost" title="Sign Out" className="w-full justify-start" aria-label="Sign Out"
          onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}>
          <LogOut className="h-4 w-4 shrink-0" />{!collapsed && <span className="ml-3">Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
