import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, useLocation } from "react-router-dom";
import { BookOpen, Images, Clapperboard, Film, ArrowRight, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/dashboard/Sidebar";
import ScriptStep from "@/components/dashboard/steps/ScriptStep";
import VisualsStep from "@/components/dashboard/steps/VisualsStep";
import StudioClipPanel from "@/components/dashboard/StudioClipPanel";
import StudioSequencePanel from "@/components/dashboard/StudioSequencePanel";
import { ProjectProvider, useProject } from "@/contexts/ProjectContext";

export const workspacePages = [
  { id: "script", label: "Script", icon: BookOpen, group: "01 · STORY" },
  { id: "storyboard", label: "Storyboard", icon: Images, group: "01 · STORY" },
  { id: "director", label: "Director", icon: Clapperboard, group: "02 · SHOOT" },
  { id: "sequence", label: "Final cut", icon: Film, group: "03 · FINISH" },
  { id: "export", label: "Export", icon: Download, group: "03 · FINISH" },
];

function DashboardInner() {
  const { pathname } = useLocation();
  const currentPath = pathname.replace(/\/$/, "").split("/").at(-1);
  const page = workspacePages.find((item) => item.id === currentPath);
  const [collapsed, setCollapsed] = useState(true);
  const [visited, setVisited] = useState<string[]>([]);
  const scroll = useRef<HTMLDivElement>(null);
  const { topic, selectedTitle, studioClips, studioSequence } = useProject();
  useEffect(() => {
    if (page) setVisited((items) => items.includes(page.id) ? items : [...items, page.id]);
    scroll.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname, page]);
  if (pathname === "/dashboard" || pathname === "/dashboard/") return <Navigate to="/dashboard/script" replace />;
  if (!page) return <Navigate to="/dashboard/script" replace />;
  const pageIndex = workspacePages.findIndex((item) => item.id === page.id);
  const nextPage = workspacePages[pageIndex + 1];
  const title = topic || selectedTitle || "Untitled project";
  return (
    <div className="director-shell flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onMouseEnter={() => setCollapsed(false)} onMouseLeave={() => setCollapsed(true)} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="director-header flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 md:px-8">
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><span className="project-status-dot" />{title}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{page.label}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:inline-flex">{studioClips.length} shots · Director Studio</span>
            {nextPage && <Button asChild size="sm" className="shadow-sm">
              <NavLink to={`/dashboard/${nextPage.id}`}>Next step <ArrowRight className="ml-2 h-4 w-4" /></NavLink>
            </Button>}
          </div>
        </header>
        <div className="stepper-wrap border-b border-border px-5 py-3 md:px-8">
          <nav aria-label="Production steps" className="stepper mx-auto flex max-w-7xl items-center gap-2 overflow-x-auto">
            {workspacePages.map(({ id, label }, index) => {
              const active = id === page.id;
              const complete = index < pageIndex;
              return <div key={id} className="flex min-w-fit flex-1 items-center gap-2">
                <NavLink aria-current={active ? "step" : undefined} to={`/dashboard/${id}`} className={`stepper-link ${active ? "is-active" : complete ? "is-complete" : ""}`}>
                  <span className="stepper-number">{complete ? <Check className="h-3.5 w-3.5" /> : String(index + 1).padStart(2, "0")}</span>
                  <span>{label}</span>
                </NavLink>
                {index < workspacePages.length - 1 && <span aria-hidden="true" className={`stepper-rule ${complete ? "is-complete" : ""}`} />}
              </div>;
            })}
          </nav>
        </div>
        <div ref={scroll} className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-7" data-workspace-scroll>
          <div className="mx-auto max-w-7xl">
            {/* Keep visited tools mounted so navigation cannot interrupt in-flight work. */}
            {visited.includes("script") && <div hidden={page.id !== "script"}><div className="workspace-card"><ScriptStep /></div></div>}
            {visited.includes("storyboard") && <div hidden={page.id !== "storyboard"}><div className="workspace-card"><VisualsStep /></div></div>}
            {visited.includes("director") && <div hidden={page.id !== "director"}><StudioClipPanel includeSequence={false} /></div>}
            {visited.includes("sequence") && <div hidden={page.id !== "sequence"}>
              <StudioSequencePanel />
            </div>}
            {visited.includes("export") && <section hidden={page.id !== "export"} className="workspace-card space-y-5">
              <div><p className="text-sm text-muted-foreground">Delivery</p><h2 className="mt-1 text-xl font-semibold">Your finished film</h2></div>
              {studioSequence ? <>
                <p className="break-all text-xs text-muted-foreground">Stitch job · {studioSequence.jobId ?? "—"}</p>
                <video controls playsInline src={studioSequence.videoUrl} className="w-full rounded-xl border border-border bg-black" />
                <Button asChild><a href={studioSequence.videoUrl} download><Download className="mr-2 h-4 w-4" />Download video</a></Button>
              </> : <p className="text-sm text-muted-foreground">Stitch your approved shots in Final cut to prepare a video for download.</p>}
            </section>}
          </div>
        </div>
      </main>
    </div>
  );
}
export default function Dashboard() {
  return <ProjectProvider><DashboardInner /></ProjectProvider>;
}
