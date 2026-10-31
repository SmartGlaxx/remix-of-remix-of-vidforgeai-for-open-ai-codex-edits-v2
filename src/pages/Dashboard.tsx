import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, useLocation } from "react-router-dom";
import { BookOpen, Images, Clapperboard, Film, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/dashboard/Sidebar";
import ScriptStep from "@/components/dashboard/steps/ScriptStep";
import VisualsStep from "@/components/dashboard/steps/VisualsStep";
import SoundtrackStep from "@/components/dashboard/steps/SoundtrackStep";
import StudioClipPanel from "@/components/dashboard/StudioClipPanel";
import StudioSequencePanel from "@/components/dashboard/StudioSequencePanel";
import { ProjectProvider, useProject } from "@/contexts/ProjectContext";

export const workspacePages = [
  { id: "script", label: "Script", icon: BookOpen },
  { id: "storyboard", label: "Storyboard", icon: Images },
  { id: "director", label: "Director", icon: Clapperboard },
  { id: "sequence", label: "Sequence", icon: Film },
];

function DashboardInner() {
  const { pathname } = useLocation();
  const page = workspacePages.find((item) => pathname === `/dashboard/${item.id}`);
  const [collapsed, setCollapsed] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const scroll = useRef<HTMLDivElement>(null);
  const { topic, selectedTitle, studioClips } = useProject();
  useEffect(() => {
    if (page) setVisited((items) => items.includes(page.id) ? items : [...items, page.id]);
    scroll.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname, page]);
  if (pathname === "/dashboard" || pathname === "/dashboard/") return <Navigate to="/dashboard/script" replace />;
  if (!page) return <Navigate to="/dashboard/script" replace />;
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 md:px-8">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{topic || selectedTitle || "Untitled project"}</p>
            <h1 className="text-2xl font-semibold">{page.label}</h1>
          </div>
          <span className="text-xs text-muted-foreground">{studioClips.length} shots · Director Studio</span>
        </header>
        <nav aria-label="Workspace pages" className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:px-7">
          {workspacePages.map(({ id, label, icon: Icon }) => (
            <Button key={id} asChild variant={page.id === id ? "secondary" : "ghost"} size="sm">
              <NavLink to={`/dashboard/${id}`}><Icon className="mr-2 h-4 w-4" />{label}</NavLink>
            </Button>
          ))}
        </nav>
        <div ref={scroll} className="flex-1 overflow-y-auto px-5 py-6 md:px-8" data-workspace-scroll>
          <div className="mx-auto max-w-6xl">
            {/* Keep visited tools mounted so navigation cannot interrupt in-flight work. */}
            {visited.includes("script") && <div hidden={page.id !== "script"}><ScriptStep /></div>}
            {visited.includes("storyboard") && <div hidden={page.id !== "storyboard"}><VisualsStep /></div>}
            {visited.includes("director") && <div hidden={page.id !== "director"}><StudioClipPanel includeSequence={false} /></div>}
            {visited.includes("sequence") && <div hidden={page.id !== "sequence"}>
              <StudioSequencePanel />
              <div className="mt-8 border-t border-border pt-5">
                <Button variant="outline" onClick={() => setMusicOpen((open) => !open)} aria-expanded={musicOpen}>
                  <Music className="mr-2 h-4 w-4" />Optional background music
                </Button>
                {musicOpen && <div className="mt-5"><SoundtrackStep /></div>}
              </div>
            </div>}
          </div>
        </div>
      </main>
    </div>
  );
}
export default function Dashboard() {
  return <ProjectProvider><DashboardInner /></ProjectProvider>;
}
