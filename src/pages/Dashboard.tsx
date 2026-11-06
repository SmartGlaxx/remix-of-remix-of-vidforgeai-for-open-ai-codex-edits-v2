import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FolderKanban, BookOpen, GitBranch, Images, Clapperboard, Check, Beaker, Film, Download, Boxes, Activity, Settings, MoreHorizontal, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/dashboard/Sidebar";
import ScriptStep from "@/components/dashboard/steps/ScriptStep";
import VisualsStep from "@/components/dashboard/steps/VisualsStep";
import StudioClipPanel from "@/components/dashboard/StudioClipPanel";
import StudioSequencePanel from "@/components/dashboard/StudioSequencePanel";
import { ProjectProvider, useProject } from "@/contexts/ProjectContext";
import { ProjectsPage, StoryCanvasPage, ShotLabPage, AssetsPage, ProductionPage, SettingsPage } from "@/components/dashboard/WorkflowPages";

export const workspacePages = [
  { id: "projects", label: "Projects", icon: FolderKanban, group: "01 · STORY" },
  { id: "script", label: "Script", icon: BookOpen, group: "01 · STORY" },
  { id: "story-canvas", label: "Story Canvas", icon: GitBranch, group: "01 · STORY" },
  { id: "storyboard", label: "Storyboard", icon: Images, group: "01 · STORY" },
  { id: "director", label: "Director", icon: Clapperboard, group: "02 · SHOOT" },
  { id: "shot-lab", label: "Shot Lab", icon: Beaker, group: "02 · SHOOT" },
  { id: "final-cut", label: "Final cut", icon: Film, group: "03 · FINISH" },
  { id: "export", label: "Export", icon: Download, group: "03 · FINISH" },
];
export const supportingPages = [
  { id: "assets", label: "Assets", icon: Boxes },
  { id: "production", label: "Production", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

function DashboardInner() {
  const { pathname } = useLocation();
  const currentPath = pathname.replace(/\/$/, "").split("/").at(-1);
  const page = [...workspacePages, ...supportingPages].find((item) => item.id === currentPath);
  const [collapsed, setCollapsed] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [visited, setVisited] = useState<string[]>([]);
  const scroll = useRef<HTMLDivElement>(null);
  const { topic, selectedTitle, studioClips, studioSequence, scriptSections, visualScenes, setStudioDraft } = useProject();
  const navigate = useNavigate();
  useEffect(() => {
    if (page) setVisited((items) => items.includes(page.id) ? items : [...items, page.id]);
    scroll.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname, page]);
  if (pathname === "/dashboard" || pathname === "/dashboard/" || currentPath === "sequence") return <Navigate to={currentPath === "sequence" ? "/dashboard/final-cut" : "/dashboard/projects"} replace />;
  if (!page) return <Navigate to="/dashboard/script" replace />;
  const pageIndex = workspacePages.findIndex((item) => item.id === page.id);
  const nextPage = workspacePages[pageIndex + 1];
  const isFlowPage = pageIndex >= 0;
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
          {!isFlowPage && <p className="mx-auto mt-2 max-w-7xl text-[11px] text-muted-foreground">Supporting workspace · <NavLink className="text-primary hover:underline" to="/dashboard/projects">Return to Projects</NavLink></p>}
        </div>
        <div ref={scroll} className="flex-1 overflow-y-auto px-4 py-5 pb-24 md:px-8 md:py-7 lg:pb-7" data-workspace-scroll>
          <div className="mx-auto max-w-7xl">
            {/* Keep visited tools mounted so navigation cannot interrupt in-flight work. */}
            {visited.includes("script") && <div hidden={page.id !== "script"}><div className="workspace-card space-y-5"><ScriptStep />
              {scriptSections.length > 0 && <div className="border-t border-border pt-4"><h3 className="mb-3 text-sm font-semibold">Scenes · open on Storyboard</h3><div className="grid gap-2 sm:grid-cols-2">{scriptSections.map((scene, index) => <NavLink key={`${scene.section}-${index}`} to={`/dashboard/storyboard?scene=${index}`} className="rounded-lg border border-border bg-background/35 p-3 text-sm transition hover:border-primary/40"><span className="block font-medium">{scene.section || `Scene ${index + 1}`}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{scene.text}</span></NavLink>)}</div></div>}
            </div></div>}
            {page.id === "projects" && <ProjectsPage />}
            {page.id === "story-canvas" && <StoryCanvasPage />}
            {visited.includes("storyboard") && <div hidden={page.id !== "storyboard"}>
              <section className="workspace-card mb-5 space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Shot pairs</p><h2 className="mt-1 text-lg font-semibold">Every shot has a start and end frame</h2><p className="mt-1 text-xs text-muted-foreground">Adjacent storyboard frames form the visual anchor pair for each shot.</p></div>
                {visualScenes.length > 1 ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visualScenes.slice(0, -1).map((scene, index) => { const end = visualScenes[index + 1]; return <article key={scene.id} className="rounded-xl border border-border bg-background/40 p-3"><div className="grid grid-cols-2 gap-2"><div><span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Start frame</span><div className="aspect-video overflow-hidden rounded-lg bg-muted">{scene.imageUrl && <img src={scene.imageUrl} alt={`Shot ${index + 1} start frame`} className="h-full w-full object-cover" />}</div></div><div><span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">End frame</span><div className="aspect-video overflow-hidden rounded-lg bg-muted">{end.imageUrl && <img src={end.imageUrl} alt={`Shot ${index + 1} end frame`} className="h-full w-full object-cover" />}</div></div></div><p className="my-2 truncate text-xs font-medium">Shot {String(index + 1).padStart(2, "0")} · {scene.section}</p><Button size="sm" variant="outline" className="w-full" onClick={() => { setStudioDraft((draft) => ({ ...draft, startFrame: scene.imageUrl || "", endFrame: end.imageUrl || "", prompt: scene.prompt || scene.text })); navigate("/dashboard/director"); }}>Direct this shot</Button></article>; })}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Generate at least two storyboard frames to create a start/end pair for a shot.</p>}
              </section><div className="workspace-card"><VisualsStep /></div>
            </div>}
            {visited.includes("director") && <div hidden={page.id !== "director"}><StudioClipPanel includeSequence={false} /></div>}
            {page.id === "shot-lab" && <ShotLabPage />}
            {visited.includes("final-cut") && <div hidden={page.id !== "final-cut"}>
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
            {page.id === "assets" && <AssetsPage />}
            {page.id === "production" && <ProductionPage />}
            {page.id === "settings" && <SettingsPage />}
          </div>
        </div>
      </main>
      <nav aria-label="Mobile navigation" className="mobile-bottom-nav lg:hidden">
        {workspacePages.slice(0, 1).map(({ id, label, icon: Icon }) => <NavLink key={id} to={`/dashboard/${id}`} className={({ isActive }) => `mobile-nav-item ${isActive ? "is-active" : ""}`}><Icon /><span>{label}</span></NavLink>)}
        {workspacePages.slice(1, 2).map(({ id, label, icon: Icon }) => <NavLink key={id} to={`/dashboard/${id}`} className={({ isActive }) => `mobile-nav-item ${isActive ? "is-active" : ""}`}><Icon /><span>{label}</span></NavLink>)}
        {workspacePages.slice(3, 4).map(({ id, label, icon: Icon }) => <NavLink key={id} to={`/dashboard/${id}`} className={({ isActive }) => `mobile-nav-item ${isActive ? "is-active" : ""}`}><Icon /><span>{label}</span></NavLink>)}
        {workspacePages.slice(4, 5).map(({ id, label, icon: Icon }) => <NavLink key={id} to={`/dashboard/${id}`} className={({ isActive }) => `mobile-nav-item ${isActive ? "is-active" : ""}`}><Icon /><span>{label}</span></NavLink>)}
        <button type="button" onClick={() => setMoreOpen((open) => !open)} className={`mobile-nav-item ${moreOpen ? "is-active" : ""}`} aria-expanded={moreOpen}><MoreHorizontal /><span>More</span></button>
        {moreOpen && <div className="mobile-more-menu"><div className="flex items-center justify-between px-2 pb-2"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">More pages</span><button onClick={() => setMoreOpen(false)} aria-label="Close menu"><X className="h-4 w-4" /></button></div>{[...workspacePages.slice(2, 3), ...workspacePages.slice(5), ...supportingPages].map(({ id, label, icon: Icon }) => <NavLink key={id} to={`/dashboard/${id}`} onClick={() => setMoreOpen(false)} className="mobile-more-link"><Icon className="h-4 w-4" />{label}</NavLink>)}</div>}
      </nav>
    </div>
  );
}
export default function Dashboard() {
  return <ProjectProvider><DashboardInner /></ProjectProvider>;
}
