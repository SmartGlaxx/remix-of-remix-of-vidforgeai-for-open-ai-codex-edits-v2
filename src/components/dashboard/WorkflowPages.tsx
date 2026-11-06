import { useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Film, FolderPlus, Check, X, RotateCcw, Clapperboard, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { workspaceAccents, useWorkspaceAppearance } from "@/contexts/WorkspaceAppearance";
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
  const runtime = studioClips.reduce((total, shot) => total + shot.durationSeconds, 0);
  const cover = studioClips[0]?.firstFrame || visualScenes.find((scene) => scene.imageUrl)?.imageUrl;
  return <div className="space-y-6">
    <div className="workspace-page-head"><div><h2>Projects</h2><p>Where every film starts. Open your film to pick it up where you left off, or name a new project to begin its story.</p></div><div className="flex gap-2"><Input aria-label="New film title" placeholder="Name your new film" value={draft} onChange={(e) => setDraft(e.target.value)} /><Button className="workspace-export" onClick={create} disabled={!draft.trim()}><FolderPlus size={16} />New project</Button></div></div>
    <div className="workspace-stats"><Stat title="Current project" value="1" /><Stat title="Total shots" value={String(studioClips.length)} /><Stat title="Combined runtime" value={`${runtime}s`} /><Stat title="Storyboard frames" value={String(visualScenes.filter((s) => s.imageUrl).length)} /></div>
    <div className="project-grid"><NavLink to="/dashboard/script" className="project-tile">{cover ? <img src={cover} alt={title} /> : <div className="project-cover"><Film size={48} strokeWidth={1} /></div>}<div className="project-tile-copy"><h3>{title}</h3><p>{studioClips.length} shots · {runtime}s · Saved on this device</p><div className="project-progress"><i style={{ width: studioClips.length ? "60%" : visualScenes.length ? "40%" : "20%" }} /></div><p>{studioClips.length ? "Shoot — takes being generated" : visualScenes.length ? "Plan — shots being boarded" : "Story — script in draft"}</p></div></NavLink></div>
  </div>;
}

export function StoryCanvasPage() {
  const { scriptSections, studioClips, visualScenes, setStudioDraft } = useProject();
  const navigate = useNavigate();
  const openBeat = (index: number) => {
    const shot = studioClips[index];
    setStudioDraft((draft) => ({ ...draft, prompt: shot?.prompt || scriptSections[index]?.text || "", startFrame: shot?.firstFrame || visualScenes[index]?.imageUrl || "", endFrame: shot?.lastFrame || visualScenes[index + 1]?.imageUrl || "" }));
    navigate(`/dashboard/director${shot ? `?shot=${encodeURIComponent(shot.id)}` : ""}`);
  };
  return <div className="space-y-5"><div className="workspace-page-head"><div><h2>Story Canvas</h2><p>The shape of the story before a frame is generated — the story moments in the order the audience will feel them. Open a beat to direct its matching shot.</p></div><Button asChild variant="outline"><NavLink to="/dashboard/storyboard">Board these beats →</NavLink></Button></div>
    {scriptSections.length ? <div className="story-grid">{scriptSections.map((scene, index) => <button className="story-beat" key={index} onClick={() => openBeat(index)}><span>{String(index + 1).padStart(2, "0")} · Story beat</span>{(studioClips[index]?.firstFrame || visualScenes[index]?.imageUrl) && <img src={studioClips[index]?.firstFrame || visualScenes[index]?.imageUrl} alt="" />}<strong>{scene.section || `Beat ${index + 1}`}</strong><p className="line-clamp-4">{scene.text}</p><span className="block mt-5">Open in Director →</span></button>)}</div> : <div className="workspace-card cut-empty"><Film className="text-primary mb-4" size={32} /><h3 className="font-bold">Your story starts with a script</h3><p className="text-sm text-muted-foreground mt-2 mb-5">Write your scenes to begin laying out the story beats.</p><Button asChild><NavLink to="/dashboard/script">Open Script →</NavLink></Button></div>}
  </div>;
}

export function ShotLabPage() {
  const { studioClips, setStudioClips, poolRate, studioBusy, sequenceBusy } = useProject();
  const [params] = useSearchParams();
  const [shotIndex, setShotIndex] = useState(() => Math.max(0, studioClips.findIndex((shot) => shot.id === params.get("shot"))));
  const [candidates, setCandidates] = useState<Record<string, number>>({});
  const shot = studioClips[shotIndex];
  const candidateIndex = shot ? candidates[shot.id] ?? shot.takes.length - 1 : 0;
  const candidate = shot?.takes[candidateIndex];
  const approved = shot && activeTake(shot)?.status === "passed" ? activeTake(shot) : undefined;
  const busy = studioBusy || sequenceBusy;
  return <div className="space-y-5"><div className="workspace-page-head"><div><h2>Shot Lab</h2><p>The take in the cut sits on the left; the candidate on the right. Approving swaps the candidate into Final cut. Rejected takes still count toward the film’s cost.</p></div>{shot && <select aria-label="Review shot" className="border border-border p-3" value={shotIndex} onChange={(e) => setShotIndex(Number(e.target.value))}>{studioClips.map((s, i) => <option key={s.id} value={i}>Shot {String(i + 1).padStart(2, "0")} · {s.takes.length} takes</option>)}</select>}</div>
    <div className="grid gap-5 lg:grid-cols-2"><section className="workspace-card space-y-4"><div className="flex justify-between"><h3 className="font-bold">Active cut{approved ? ` — Take ${shot.activeTakeIndex + 1}` : ""}</h3><span className="text-xs text-primary">{approved ? "In cut" : "Awaiting approval"}</span></div>{approved?.videoUrl ? <StudioClipPlayer videoUrl={approved.videoUrl} poster={shot.firstFrame} label="Approved take" saved={approved.saved} /> : <div className="draft-viewport"><div className="preview-placeholder"><Check className="mx-auto mb-3" size={30} /><h3>No approved take yet</h3><p>Approve a candidate to add this shot to Final cut.</p></div></div>}{approved && <p className="text-xs text-muted-foreground">{approved.tier === "primary" ? "LTX-2.5" : "LTX-2.3"} · Seed {approved.seed} · {shot.durationSeconds}s · {shot.resolution}</p>}</section>
    <section className="workspace-card space-y-4"><div className="flex justify-between"><h3 className="font-bold">Candidate{candidate ? ` — Take ${candidateIndex + 1}` : ""}</h3><span className="text-xs text-muted-foreground">{candidate?.rejected ? "Rejected" : candidate?.status.replace(/_/g, " ") || "No takes"}</span></div>{candidate?.videoUrl ? <StudioClipPlayer videoUrl={candidate.videoUrl} poster={shot.firstFrame} label="Candidate take" saved={candidate.saved} /> : <div className="draft-viewport"><div className="preview-placeholder"><Clapperboard className="mx-auto mb-3" size={30} /><h3>{candidate ? "This take failed" : "No candidate yet"}</h3><p>{candidate?.error || "Generate a take in Director to review it here."}</p></div></div>}
      {candidate && <p className="text-xs text-muted-foreground break-all">Job {candidate.jobId ?? "—"} · Seed {candidate.seed} · {candidate.generationSeconds?.toFixed(1) ?? "—"}s GPU · ${takeCost(candidate.generationSeconds, poolRate).toFixed(4)}</p>}
      {shot && <div className="flex flex-wrap gap-2">{shot.takes.map((take, i) => <Button key={i} size="sm" variant={i === candidateIndex ? "default" : "outline"} onClick={() => setCandidates((current) => ({ ...current, [shot.id]: i }))}>Take {i + 1}{take.status === "passed" ? " ✓" : ""}</Button>)}</div>}
      <div className="flex flex-wrap gap-2"><Button className="workspace-export" disabled={busy || !candidate?.videoUrl || candidate.status === "passed"} onClick={() => setStudioClips((current) => approveTake(current, shotIndex, candidateIndex))}><Check size={16} />Approve candidate</Button><Button variant="outline" disabled={busy || !candidate?.videoUrl || candidate.status !== "needs_review"} onClick={() => setStudioClips((current) => rejectTake(current, shotIndex, candidateIndex))}><X size={16} />Reject</Button><Button asChild variant="outline"><NavLink to={`/dashboard/director${shot ? `?shot=${encodeURIComponent(shot.id)}` : ""}`}><RotateCcw size={16} />{shot ? "Retake in Director" : "Open Director"}</NavLink></Button></div>
    </section></div>
  </div>;
}

export function AssetsPage() {
  const { visualScenes, studioClips, soundtrackTracks, setStudioDraft } = useProject();
  const [filter, setFilter] = useState("All");
  const navigate = useNavigate();
  const openShot = (shotIndex: number, image?: string, prompt?: string) => {
    const shot = studioClips[shotIndex];
    setStudioDraft((draft) => ({ ...draft, startFrame: shot?.firstFrame || image || draft.startFrame, endFrame: shot?.lastFrame || draft.endFrame, prompt: shot?.prompt || prompt || draft.prompt }));
    navigate(`/dashboard/director${shot ? `?shot=${encodeURIComponent(shot.id)}` : ""}`);
  };
  const assets = [...visualScenes.map((scene, index) => ({ id: scene.id, title: scene.section || `Frame ${index + 1}`, url: scene.imageUrl!, kind: "Frame", prompt: scene.prompt, shot: index })).filter((asset) => asset.url), ...studioClips.flatMap((shot, shotIndex) => shot.takes.filter((take) => take.videoUrl).map((take, takeIndex) => ({ id: `${shot.id}-${takeIndex}`, title: `Shot ${shotIndex + 1} · Take ${takeIndex + 1}`, url: take.videoUrl!, kind: "Clip", prompt: shot.prompt, shot: shotIndex })))];
  return <div className="space-y-5"><div className="workspace-page-head"><div><h2>Assets</h2><p>The references this film is built from — saved frames and generated clips. Open an asset to land on its shot in Director.</p></div><div className="flex gap-2">{["All", "Frame", "Clip", "Audio"].map((kind) => <Button key={kind} variant={filter === kind ? "default" : "outline"} onClick={() => setFilter(kind)}>{kind === "All" || kind === "Audio" ? kind : `${kind}s`}</Button>)}</div></div>{assets.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{assets.filter((asset) => filter === "All" || asset.kind === filter).map((asset) => <button key={asset.id} onClick={() => openShot(asset.shot, asset.kind === "Frame" ? asset.url : undefined, asset.prompt)} className="workspace-card group p-3 text-left transition hover:border-primary/40"><div className="asset-preview">{asset.kind === "Frame" ? <img src={asset.url} alt={asset.title} loading="lazy" /> : <video src={asset.url} muted preload="metadata" />}</div><div className="mt-3 flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{asset.title}</span><span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">{asset.kind}</span></div><span className="mt-1 block text-xs text-primary">Open shot <ArrowRight className="ml-1 inline h-3 w-3" /></span></button>)}</div> : <div className="workspace-card text-center"><ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-medium">Your assets will appear here</p><p className="mt-1 text-sm text-muted-foreground">Create storyboard frames or generate shots to start your library.</p></div>}{(filter === "All" || filter === "Audio") && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{soundtrackTracks.filter((track) => track.status === "done" && track.url).map((track) => <article key={track.id} className="workspace-card space-y-4"><h3 className="font-bold">{track.segment}</h3><span className="text-xs text-muted-foreground">Saved audio</span><audio controls src={track.url} className="w-full" /><NavLink to="/dashboard/final-cut" className="text-sm text-primary">Use in Final cut →</NavLink></article>)}</div>}</div>;
}

export function ProductionPage() {
  const { studioClips, studioSequence, poolRate, setPoolRate } = useProject();
  const summary = sequenceSummary(studioClips, poolRate);
  const jobs = studioClips.flatMap((shot, shotIndex) => shot.takes.map((take, takeIndex) => ({ key: `${shot.id}-${takeIndex}`, name: `Shot ${shotIndex + 1} · Take ${takeIndex + 1}`, id: take.jobId, state: take.status, engine: take.tier === "primary" ? "LTX-2.5" : "LTX-2.3", seconds: take.generationSeconds ?? 0, cost: takeCost(take.generationSeconds, poolRate) })));
  if (studioSequence?.jobId) jobs.push({ key: studioSequence.jobId, name: "Final cut stitch", id: studioSequence.jobId, state: "passed", engine: "Stitch", seconds: 0, cost: 0 });
  return <div className="space-y-5"><div className="workspace-page-head"><div><h2>Production</h2><p>Every generation run behind the story and what it cost. Execution seconds × pool rate, including rejected and failed takes. Primary LTX-2.5, automatic failover to LTX-2.3.</p></div></div>
    <section className="workspace-card grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><label className="space-y-1"><span className="text-xs text-muted-foreground">GPU pool rate ($/hour)</span><Input aria-label="GPU pool rate" type="number" min={0} step={0.01} value={poolRate} onChange={(e) => setPoolRate(Math.max(0, Number(e.target.value) || 0))} /></label><Metric title="Jobs" value={String(jobs.length)} /><Metric title="GPU seconds" value={jobs.reduce((s, j) => s + j.seconds, 0).toFixed(1)} /><Metric title="Estimated cost" value={`$${summary.total.toFixed(4)}`} /></section>
    <section className="workspace-card"><h3 className="font-bold">GPU seconds by shot</h3><p className="text-xs text-muted-foreground mt-2">Where the render time went — all takes included.</p>{studioClips.map((shot, index) => { const seconds = shot.takes.reduce((sum, take) => sum + (take.generationSeconds ?? 0), 0); const max = Math.max(1, ...studioClips.map((s) => s.takes.reduce((sum, take) => sum + (take.generationSeconds ?? 0), 0))); return <div className="gpu-bar" key={shot.id}><span>Shot {String(index + 1).padStart(2, "0")}</span><div><i style={{ width: `${seconds / max * 100}%` }} /></div><span>{seconds.toFixed(1)}s</span></div>; })}{!studioClips.length && <p className="text-sm text-muted-foreground mt-6">Render a shot to see GPU usage here.</p>}</section>
    <section className="workspace-card overflow-x-auto"><h3 className="mb-4 font-semibold">Job history</h3>{jobs.length ? <table className="w-full min-w-[560px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-3">Job</th><th className="pb-3">Job ID</th><th className="pb-3">Engine</th><th className="pb-3">Status</th><th className="pb-3 text-right">GPU sec</th><th className="pb-3 text-right">Cost</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.key} className="border-b border-border/60"><td className="py-3">{job.name}</td><td className="max-w-48 truncate py-3 font-mono text-xs text-muted-foreground">{job.id || "—"}</td><td className="py-3 text-xs">{job.engine}</td><td className="py-3"><span className="rounded-full bg-secondary px-2 py-1 text-xs">{job.state}</span></td><td className="py-3 text-right tabular-nums">{job.seconds.toFixed(1)}</td><td className="py-3 text-right tabular-nums">${job.cost.toFixed(4)}</td></tr>)}</tbody></table> : <p className="text-sm text-muted-foreground">Submitted render and stitch jobs will appear here.</p>}</section>
  </div>;
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { accent, setAccent } = useWorkspaceAppearance();
  const { poolRate, setPoolRate } = useProject();
  return <div className="space-y-5"><div className="workspace-page-head"><div><h2>Settings</h2><p>Appearance and workspace preferences. Pick one theme colour for the app — it applies everywhere, in both modes.</p></div></div>
    <section className="workspace-card space-y-5"><div><h3 className="font-bold">Theme colour — choose one for the app</h3><p className="text-sm text-muted-foreground mt-2">Five options. Generate and Export keep their action colour.</p></div><div className="workspace-swatches">{workspaceAccents.map((item) => <button key={item.id} className="workspace-swatch" aria-pressed={accent === item.id} onClick={() => setAccent(item.id)}><i style={{ background: item.color }} /><b>{item.name}</b><span>{item.description}</span></button>)}</div>
    <h3 className="font-bold">Appearance</h3><div className="flex gap-2">{["dark", "light", "system"].map((mode) => <Button key={mode} variant={theme === mode ? "default" : "outline"} onClick={() => setTheme(mode)}>{mode === "system" ? "Use device setting" : mode === "dark" ? "Dark" : "Light"}</Button>)}</div></section>
    <section className="workspace-card space-y-5"><h3 className="font-bold">Generation</h3><div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Primary engine</p><p className="mt-2 font-bold">LTX-2.5</p></div><div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Automatic failover</p><p className="mt-2 font-bold">LTX-2.3</p></div><label className="rounded-xl border border-border p-4"><span className="text-xs text-muted-foreground">Pool rate ($/hour)</span><Input aria-label="Pool rate" className="mt-2" type="number" min={0} step={0.01} value={poolRate} onChange={(e) => setPoolRate(Math.max(0, Number(e.target.value) || 0))} /></label></div><p className="text-xs text-muted-foreground">Preferences are saved automatically on this device.</p></section>
  </div>;
}
function Stat({ title, value }: { title: string; value: string }) { return <div className="workspace-stat"><strong>{value}</strong><span>{title}</span></div>; }

function Metric({ title, value }: { title: string; value: string }) { return <div className="rounded-lg border border-border bg-background/40 p-4"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-2 text-xl font-semibold tabular-nums">{value}</p></div>; }
