import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ArrowRight, Film, FolderPlus, Settings2, Check, X, RotateCcw, Clapperboard, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { useProject } from "@/contexts/ProjectContext";
import { activeTake, approveTake, rejectTake, sequenceSummary, takeCost } from "./studioClipUtils";
import StudioClipPlayer from "./StudioClipPlayer";

export function ProjectsPage() {
  const { topic, selectedTitle, setTopic, setSelectedTitle, resetProject, studioClips, visualScenes } = useProject();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const title = topic || selectedTitle || "Untitled film";
  const create = () => { if (!draft.trim()) return; resetProject(); setTopic(draft.trim()); setSelectedTitle(draft.trim()); setDraft(""); navigate("/dashboard/script"); };
  return <div className="space-y-6">
    <section className="workspace-card flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-primary">Your workspace</p><h2 className="mt-2 text-2xl font-semibold">Projects</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Choose a film to continue or start a new project.</p></div>
      <div className="flex w-full max-w-lg gap-2 sm:w-auto"><Input aria-label="New film title" placeholder="Name your new film" value={draft} onChange={(e) => setDraft(e.target.value)} /><Button onClick={create} disabled={!draft.trim()}><FolderPlus className="mr-2 h-4 w-4" />Create film</Button></div>
    </section>
    <NavLink to="/dashboard/script" className="workspace-card flex items-center gap-4 transition hover:border-primary/40">
      <span className="brand-mark"><Film className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{title}</span><span className="mt-1 block text-xs text-muted-foreground">{studioClips.length} shots · {visualScenes.length} storyboard frames</span></span><ArrowRight className="h-4 w-4 text-primary" />
    </NavLink>
  </div>;
}

export function StoryCanvasPage() {
  const { scriptSections, studioClips, setStudioDraft } = useProject();
  const navigate = useNavigate();
  const openBeat = (index: number) => {
    const shot = studioClips[index];
    if (shot) setStudioDraft((draft) => ({ ...draft, prompt: shot.prompt, startFrame: shot.firstFrame, endFrame: shot.lastFrame }));
    navigate("/dashboard/director");
  };
  if (!scriptSections.length) return <section className="workspace-card"><h2 className="text-xl font-semibold">Build the story beats</h2><p className="mt-2 text-sm text-muted-foreground">Write the script first; its scenes become the starting point for your story canvas.</p><Button asChild className="mt-5"><NavLink to="/dashboard/script">Go to Script <ArrowRight className="ml-2 h-4 w-4" /></NavLink></Button></section>;
  return <div className="workspace-card space-y-5"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Story structure</p><h2 className="mt-1 text-xl font-semibold">Beats in story order</h2><p className="mt-1 text-sm text-muted-foreground">A beat is a story moment. Open a beat to direct its matching shot.</p></div>
    <ol className="space-y-3">{scriptSections.map((scene, i) => <li key={`${scene.section}-${i}`}><button onClick={() => openBeat(i)} className="cut-shot-row w-full text-left"><span className="cut-shot-index">{String(i + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block font-semibold">{scene.section || `Beat ${i + 1}`}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{scene.text}</span></span><span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">{studioClips[i] ? "Shot linked" : "Ready to direct"}</span><ArrowRight className="h-4 w-4" /></button></li>)}</ol>
  </div>;
}

export function ShotLabPage() {
  const { studioClips, setStudioClips } = useProject();
  return <div className="space-y-5"><section className="workspace-card"><p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Take review</p><h2 className="mt-1 text-xl font-semibold">Shot Lab</h2><p className="mt-1 text-sm text-muted-foreground">Compare takes for each shot, then approve the take that belongs in the final cut.</p></section>
    {studioClips.length ? studioClips.map((shot, shotIndex) => <section key={shot.id} className="workspace-card space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Shot {String(shotIndex + 1).padStart(2, "0")}</h3><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{shot.prompt}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">{activeTake(shot)?.status === "passed" ? `Take ${shot.activeTakeIndex + 1} approved` : `${shot.takes.length} takes · choose one`}</span></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{shot.takes.map((take, takeIndex) => <article key={`${shot.id}-${take.jobId}-${takeIndex}`} className="space-y-3 rounded-xl border border-border bg-background/40 p-3"><div className="flex items-center justify-between"><span className="text-sm font-semibold">Take {takeIndex + 1}</span><span className="text-[10px] uppercase tracking-wide text-muted-foreground">{take.status === "passed" ? "Approved" : take.status === "failed" ? "Rejected" : "Review"}</span></div>{take.videoUrl ? <StudioClipPlayer videoUrl={take.videoUrl} shot={shotIndex + 1} take={takeIndex + 1} saved={take.saved} /> : <p className="rounded-md bg-destructive/10 p-3 text-xs text-destructive">{take.error || "No video returned"}</p>}<p className="text-[11px] text-muted-foreground">Job {take.jobId ?? "—"} · {take.generationSeconds?.toFixed(1) ?? "—"} GPU sec · ${takeCost(take.generationSeconds, 2.5).toFixed(4)}</p><div className="flex flex-wrap gap-2"><Button size="sm" disabled={!take.videoUrl || take.status === "passed"} onClick={() => setStudioClips((current) => approveTake(current, shotIndex, takeIndex))}><Check className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" disabled={!take.videoUrl || take.status !== "needs_review"} onClick={() => setStudioClips((current) => rejectTake(current, shotIndex, takeIndex))}><X className="mr-1 h-4 w-4" />Reject</Button></div></article>)}</div>
      <Button asChild variant="outline" size="sm"><NavLink to="/dashboard/director"><RotateCcw className="mr-2 h-4 w-4" />Generate a retake in Director</NavLink></Button>
    </section>) : <section className="workspace-card text-center"><Clapperboard className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">No takes to review yet</p><Button asChild className="mt-4"><NavLink to="/dashboard/director">Open Director</NavLink></Button></section>}
  </div>;
}

export function AssetsPage() {
  const { visualScenes, studioClips, setStudioDraft } = useProject();
  const navigate = useNavigate();
  const openShot = (shotIndex: number, image?: string, prompt?: string) => {
    const shot = studioClips[shotIndex];
    setStudioDraft((draft) => ({ ...draft, startFrame: shot?.firstFrame || image || draft.startFrame, endFrame: shot?.lastFrame || draft.endFrame, prompt: shot?.prompt || prompt || draft.prompt }));
    navigate("/dashboard/director");
  };
  const assets = [...visualScenes.filter((scene) => scene.imageUrl).map((scene, index) => ({ id: scene.id, title: scene.section || `Frame ${index + 1}`, url: scene.imageUrl!, kind: "Frame", prompt: scene.prompt, shot: index })), ...studioClips.flatMap((shot, shotIndex) => shot.takes.filter((take) => take.videoUrl).map((take, takeIndex) => ({ id: `${shot.id}-${takeIndex}`, title: `Shot ${shotIndex + 1} · Take ${takeIndex + 1}`, url: take.videoUrl!, kind: "Clip", prompt: shot.prompt, shot: shotIndex })))];
  return <div className="space-y-5"><section className="workspace-card"><p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Library</p><h2 className="mt-1 text-xl font-semibold">Assets</h2><p className="mt-1 text-sm text-muted-foreground">Saved storyboard frames and generated clips. Select an asset to open its shot in Director.</p></section>{assets.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{assets.map((asset) => <button key={asset.id} onClick={() => openShot(asset.shot, asset.kind === "Frame" ? asset.url : undefined, asset.prompt)} className="workspace-card group p-3 text-left transition hover:border-primary/40"><div className="asset-preview">{asset.kind === "Frame" ? <img src={asset.url} alt={asset.title} loading="lazy" /> : <video src={asset.url} muted preload="metadata" />}</div><div className="mt-3 flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{asset.title}</span><span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{asset.kind}</span></div><span className="mt-1 block text-xs text-primary">Open shot <ArrowRight className="ml-1 inline h-3 w-3" /></span></button>)}</div> : <div className="workspace-card text-center"><ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">Your assets will appear here</p><p className="mt-1 text-sm text-muted-foreground">Create storyboard frames or generate shots to start your library.</p></div>}</div>;
}

export function ProductionPage() {
  const { studioClips, studioSequence, poolRate, setPoolRate } = useProject();
  const summary = sequenceSummary(studioClips, poolRate);
  const jobs = studioClips.flatMap((shot, shotIndex) => shot.takes.map((take, takeIndex) => ({ key: `${shot.id}-${takeIndex}`, name: `Shot ${shotIndex + 1} · Take ${takeIndex + 1}`, id: take.jobId, state: take.status, seconds: take.generationSeconds ?? 0, cost: takeCost(take.generationSeconds, poolRate) })));
  if (studioSequence?.jobId) jobs.push({ key: studioSequence.jobId, name: "Final cut stitch", id: studioSequence.jobId, state: "passed", seconds: 0, cost: 0 });
  return <div className="space-y-5"><section className="workspace-card"><p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Operations</p><h2 className="mt-1 text-xl font-semibold">Production</h2><p className="mt-1 text-sm text-muted-foreground">Job history, worker time, and estimated compute spend.</p></section>
    <section className="workspace-card grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><label className="space-y-1"><span className="text-xs text-muted-foreground">GPU pool rate ($/hour)</span><Input aria-label="GPU pool rate" type="number" min={0} step={0.01} value={poolRate} onChange={(e) => setPoolRate(Math.max(0, Number(e.target.value) || 0))} /></label><Metric title="Jobs" value={String(jobs.length)} /><Metric title="GPU seconds" value={jobs.reduce((s, j) => s + j.seconds, 0).toFixed(1)} /><Metric title="Estimated cost" value={`$${summary.total.toFixed(4)}`} /></section>
    <section className="workspace-card overflow-x-auto"><h3 className="mb-4 font-semibold">Job history</h3>{jobs.length ? <table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-3">Job</th><th className="pb-3">Job ID</th><th className="pb-3">Status</th><th className="pb-3 text-right">GPU sec</th><th className="pb-3 text-right">Cost</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.key} className="border-b border-border/60"><td className="py-3">{job.name}</td><td className="max-w-48 truncate py-3 font-mono text-xs text-muted-foreground">{job.id || "—"}</td><td className="py-3"><span className="rounded-full bg-secondary px-2 py-1 text-xs">{job.state}</span></td><td className="py-3 text-right tabular-nums">{job.seconds.toFixed(1)}</td><td className="py-3 text-right tabular-nums">${job.cost.toFixed(4)}</td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">Submitted render and stitch jobs will appear here.</p>}</section>
  </div>;
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  return <div className="workspace-card space-y-6"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Workspace</p><h2 className="mt-1 text-xl font-semibold">Settings</h2><p className="mt-1 text-sm text-muted-foreground">Choose the appearance that feels comfortable for your editing session.</p></div><label className="block max-w-sm space-y-2 text-sm"><span className="font-medium">Appearance</span><select className="w-full rounded-lg border border-border bg-background p-3" value={theme || "dark"} onChange={(e) => setTheme(e.target.value)}><option value="dark">Dark</option><option value="light">Light</option><option value="system">Use device setting</option></select></label><p className="flex items-center gap-2 text-xs text-muted-foreground"><Settings2 className="h-4 w-4" />Your theme preference is applied across the workspace.</p></div>;
}

function Metric({ title, value }: { title: string; value: string }) { return <div className="rounded-lg border border-border bg-background/40 p-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>; }
