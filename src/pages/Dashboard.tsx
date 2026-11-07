import StudioClipPlayer from "@/components/dashboard/StudioClipPlayer";
import "@/components/dashboard/workspace.css";
import { ThemeProvider, useTheme } from "next-themes";
import { WorkspaceAppearanceProvider, useWorkspaceAppearance, WorkspaceThemeDots } from "@/contexts/WorkspaceAppearance";
import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FolderKanban, BookOpen, GitBranch, Images, Clapperboard, Check, Beaker, Film, Download, Boxes, Activity, Settings, MoreHorizontal, X, ArrowRight, Sun, Moon } from "lucide-react";
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
  const { accent } = useWorkspaceAppearance();
  const { resolvedTheme, setTheme } = useTheme();
  const { pathname, search } = useLocation();
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
  if (pathname === "/dashboard" || pathname === "/dashboard/" || ["sequence", "timeline"].includes(currentPath)) return <Navigate to={["sequence", "timeline"].includes(currentPath) ? "/dashboard/final-cut" : "/dashboard/projects"} replace />;
  if (!page) return <Navigate to="/dashboard/script" replace />;
  const title = topic || selectedTitle || "Untitled project";
  return (
    <div data-accent={accent} className="director-shell flex h-screen overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onMouseEnter={() => setCollapsed(false)} onMouseLeave={() => setCollapsed(true)} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="director-header flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 md:px-8">
          <div className="min-w-0 flex items-center gap-5">
            <NavLink to="/dashboard/projects" className="text-sm text-muted-foreground hidden sm:block">Projects <span className="ml-3">›</span></NavLink>
            <h1 className="text-lg font-extrabold tracking-tight truncate">{title}</h1>
            <span className="header-project-status flex items-center gap-2 border-l border-border pl-5 text-xs text-muted-foreground"><Check className="text-primary h-5 w-5" /> Saved on this device</span>
          </div>
          <div className="flex items-center gap-3">
            <WorkspaceThemeDots />
            <Button variant="outline" size="icon" aria-label="Toggle light and dark mode" onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}>{resolvedTheme === "light" ? <Moon size={18} /> : <Sun size={18} />}</Button>

          </div>
        </header>
        <div ref={scroll} className="workspace-scroll flex-1 overflow-y-auto px-4 py-5 pb-24 md:px-5 md:py-5 lg:pb-7" data-workspace-scroll data-page={page.id}>
          <div className="mx-auto w-full">
            {/* Keep visited tools mounted so navigation cannot interrupt in-flight work. */}
            {visited.includes("script") && <div hidden={page.id !== "script"}>
              <div className="workspace-page-head"><div><h2>Script</h2><p>Where the story starts — the words every shot is built from. Each scene becomes a run of shots on the Storyboard.</p></div><Button asChild className="workspace-export"><NavLink to="/dashboard/storyboard">Send to Storyboard →</NavLink></Button></div>
              <div className="script-workspace"><div className="workspace-card"><ScriptStep /></div>
              <aside className="script-outline space-y-4"><section className="workspace-card"><h3 className="font-bold">Sections</h3><p className="text-xs text-muted-foreground mt-2">Open a scene on the Storyboard to see the shots it becomes.</p>{scriptSections.map((scene, index) => <NavLink key={index} to={`/dashboard/storyboard?scene=${index}`} className="script-scene-link">{scene.section || `Scene ${index + 1}`}<span>{scene.text.trim().split(/\s+/).filter(Boolean).length} words · Board it →</span></NavLink>)}{!scriptSections.length && <p className="text-sm text-muted-foreground mt-5">Your scenes appear here when you write your script.</p>}</section>
              <section className="workspace-card"><h3 className="font-bold">Script details</h3><p className="text-sm text-muted-foreground mt-3">{scriptSections.length} scenes · {scriptSections.reduce((sum, scene) => sum + scene.text.trim().split(/\s+/).filter(Boolean).length, 0)} words</p></section></aside></div>
            </div>}
            {page.id === "projects" && <ProjectsPage />}
            {page.id === "story-canvas" && <StoryCanvasPage />}
            {visited.includes("storyboard") && <div hidden={page.id !== "storyboard"}>
              <div className="workspace-page-head"><div><h2>Storyboard</h2><p>The shooting plan: every shot in story order. Each shot begins on its start frame and arrives at its end frame. Both are mandatory before directing.</p></div><Button asChild className="workspace-export"><NavLink to="/dashboard/director">Open Director →</NavLink></Button></div><section className="mb-5 space-y-4">
                {visualScenes.length > 1 ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visualScenes.slice(0, -1).map((scene, index) => { const end = visualScenes[index + 1]; return <article key={scene.id} className="rounded-xl border border-border bg-background/40 p-3"><div className="grid grid-cols-2 gap-2"><div><span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">Start frame</span><div className="aspect-video overflow-hidden rounded-lg bg-muted">{scene.imageUrl && <img src={scene.imageUrl} alt={`Shot ${index + 1} start frame`} className="h-full w-full object-cover" />}</div></div><div><span className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">End frame</span><div className="aspect-video overflow-hidden rounded-lg bg-muted">{end.imageUrl && <img src={end.imageUrl} alt={`Shot ${index + 1} end frame`} className="h-full w-full object-cover" />}</div></div></div><p className="my-2 truncate text-xs font-medium">Shot {String(index + 1).padStart(2, "0")} · {scene.section}</p><Button size="sm" variant="outline" className="w-full" onClick={() => { setStudioDraft((draft) => ({ ...draft, startFrame: scene.imageUrl || "", endFrame: end.imageUrl || "", prompt: scene.prompt || scene.text })); navigate("/dashboard/director"); }}>Direct this shot</Button></article>; })}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Generate at least two storyboard frames to create a start/end pair for a shot.</p>}
              </section><details className="workspace-card" open={visualScenes.length < 2}><summary className="cursor-pointer font-bold">Create and manage storyboard frames</summary><div className="mt-5"><VisualsStep /></div></details>
            </div>}
            {visited.includes("director") && <div className="director-page" hidden={page.id !== "director"}><StudioClipPanel visible={page.id === "director"} includeSequence={false} requestedShotId={new URLSearchParams(search).get("shot")} /></div>}
            {page.id === "shot-lab" && <ShotLabPage />}
            {visited.includes("final-cut") && <div hidden={page.id !== "final-cut"}>
              <StudioSequencePanel />
            </div>}
            {visited.includes("export") && <div hidden={page.id !== "export"} className="space-y-5">
              <div className="workspace-page-head"><div><h2>Export</h2><p>The end of the road: the stitched sequence, ready for delivery. Your export is exactly the Final cut — the same takes, order, and stitch job.</p></div></div>
              <div className="grid gap-5 lg:grid-cols-2"><section className="workspace-card space-y-5"><h3 className="font-bold">Finished film</h3>{studioSequence ? <StudioClipPlayer label="Export preview" videoUrl={studioSequence.videoUrl} saved={studioSequence.saved} /> : <div className="draft-viewport"><div className="preview-placeholder"><Film className="mx-auto mb-4" size={32} /><h3>Your finished film will appear here</h3><p>Stitch your approved shots in Final cut to prepare your download.</p></div></div>}</section>
              <section className="workspace-card space-y-5"><h3 className="font-bold">Delivery</h3><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">Original stitched video · no conversion</p><div className="rounded-xl border border-border p-4"><span className="text-xs text-muted-foreground">Stitch job ID</span><p className="font-mono text-xs mt-2 break-all">{studioSequence?.jobId || "Not stitched yet"}</p></div>{studioSequence ? <Button asChild className="workspace-export w-full"><a href={studioSequence.videoUrl} download><Download className="h-4 w-4" />Download finished film</a></Button> : <Button asChild className="workspace-export w-full"><NavLink to="/dashboard/final-cut">Open Final cut →</NavLink></Button>}</section></div>
            </div>}
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
  return <ThemeProvider attribute="class" defaultTheme="dark"><WorkspaceAppearanceProvider><ProjectProvider><DashboardInner /></ProjectProvider></WorkspaceAppearanceProvider></ThemeProvider>;
}
