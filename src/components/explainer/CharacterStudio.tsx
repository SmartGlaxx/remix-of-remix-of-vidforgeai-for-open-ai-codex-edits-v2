import { useEffect, useRef, useState } from "react";
import ScriptAnimation from "./ScriptAnimation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const actions = {
  run: { name: "Run", duration: 5 },
  wave: { name: "Wave", duration: 3 },
  lift: { name: "Lift a cup", duration: 5 },
};
type Action = keyof typeof actions;
const ids = Object.keys(actions) as Action[];
const clip = (action: Action) => "/explainer/actions/" + action + ".mp4";

function read(key: string): Action[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (Array.isArray(saved) && saved.every(id => ids.includes(id))) return saved;
  } catch { /* Start with the running sample if storage is unavailable. */ }
  return ["run"];
}

export default function CharacterStudio() {
  const { user } = useAuth();
  const key = "capscify.character.sequence." + (user?.id ?? "guest");
  return <Editor key={key} storageKey={key}/>;
}

function Editor({storageKey}: {storageKey: string}) {
  const [sequence, setSequence] = useState(() => read(storageKey));
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{url: string; ext: string}>();
  const controller = useRef<AbortController>();
  const player = useRef<HTMLVideoElement>(null);
  const current = sequence[index];
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  useEffect(() => {
    if (playing && player.current) player.current.play().catch(() => setPlaying(false));
  }, [playing,index]);
  function update(next: Action[], selected: number) {
    setSequence(next); setIndex(selected); setPlaying(false); setResult(undefined); setError("");
    player.current?.pause();
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setError("Browser storage is unavailable. This sequence will last for this session."); }
  }
  function move(offset: number) {
    const next = sequence.slice();
    [next[index], next[index+offset]] = [next[index+offset], next[index]];
    update(next,index+offset);
  }
  async function download() {
    if (controller.current) return;
    const task = new AbortController();
    controller.current = task;
    setExporting(true); setError(""); setPlaying(false); player.current?.pause();
    try {
      const {exportActions} = await import("./exportActions");
      const file = await exportActions(sequence.map(clip), task.signal);
      if (!task.signal.aborted) setResult({url: URL.createObjectURL(file), ext: file.type.includes("mp4") ? "mp4" : "webm"});
    } catch (e) { if (!task.signal.aborted) setError(e instanceof Error ? e.message : "Export failed."); }
    finally { controller.current = undefined; if (!task.signal.aborted) setExporting(false); }
  }
  return <section className="space-y-4">
    <header><h2 className="text-3xl font-bold">Character Animation</h2></header>
    <ScriptAnimation storageKey={storageKey+".script"}/>
    <h3 className="text-xl font-semibold">Recorded action sequences</h3>
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="workspace-card space-y-3">
        {current ? <video key={index+current} ref={player} controls playsInline preload="auto" className="aspect-video w-full rounded-lg bg-black object-contain" src={clip(current)} aria-label={actions[current].name}
          onError={() => {setPlaying(false); setError("This action could not be loaded.");}}
          onEnded={() => {if (playing && index+1 < sequence.length) setIndex(index+1); else setPlaying(false);}}/> :
          <div className="grid aspect-video place-items-center rounded-lg bg-muted">Add an action to start.</div>}
        <Button disabled={!current || exporting} onClick={() => {
          if (playing) {player.current?.pause(); setPlaying(false);}
          else {if (player.current) player.current.currentTime = 0; setIndex(0); setPlaying(true);}
        }}>{playing ? "Stop sequence" : "Play sequence"}</Button>
      </div>
      <div className="workspace-card space-y-4">
        <h3 className="font-semibold">Action library</h3>
        <div className="flex flex-wrap gap-2">{ids.map(id => <Button key={id} variant="outline" disabled={exporting} onClick={() => update([...sequence,id],sequence.length)}>+ {actions[id].name}</Button>)}</div>
        <h3 className="font-semibold">Sequence · {sequence.reduce((sum,id) => sum+actions[id].duration,0)}s</h3>
        <ol className="space-y-1">{sequence.map((id,i) => <li key={i}><button disabled={exporting} aria-pressed={index===i} onClick={() => {player.current?.pause(); setPlaying(false); setIndex(i);}} className={'flex w-full justify-between rounded-lg border px-3 py-2 '+(index===i?'border-primary':'')}><span>{i+1}. {actions[id].name}</span><span>{actions[id].duration}s</span></button></li>)}</ol>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={exporting || index===0} onClick={() => move(-1)}>Earlier</Button><Button size="sm" variant="outline" disabled={exporting || index+1>=sequence.length} onClick={() => move(1)}>Later</Button><Button size="sm" variant="outline" disabled={exporting || !current} onClick={() => update(sequence.filter((_,i)=>i!==index),Math.max(0,index-1))}>Remove</Button></div>
        {result ? <Button asChild><a href={result.url} download={'character-animation.'+result.ext}>Download video</a></Button> : <Button disabled={!current || exporting} onClick={download}>{exporting ? "Exporting… keep this tab visible" : "Export sequence"}</Button>}
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  </section>;
}
