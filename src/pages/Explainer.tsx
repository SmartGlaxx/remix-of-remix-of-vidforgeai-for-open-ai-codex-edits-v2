import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const pilot = [
  ["Payment", "$100", "You pay one hundred dollars toward your credit card."],
  ["Interest", "$40", "Forty dollars covers interest that has already accrued."],
  ["Principal", "$60", "The remaining sixty dollars reduces the amount you borrowed."],
];

export default function Explainer() {
  const [scenes, setScenes] = useState(pilot);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shadow, setShadow] = useState(false);
  const [title, amount, line] = scenes[index];
  useEffect(() => {
    if (!playing) return;
    let active = true;
    const next = () => {
      if (!active) return;
      if (index === scenes.length - 1) setPlaying(false);
      else setIndex(index + 1);
    };
    const started = performance.now();
    const timer = window.setInterval(() => setProgress(Math.min(1,(performance.now()-started)/2400)), 40);
    const timeout = window.setTimeout(next, Math.max(6000,line.length * 140));
    if ("speechSynthesis" in window) {
      const speech = new SpeechSynthesisUtterance(line);
      speech.onend = next;
      window.speechSynthesis.speak(speech);
    }
    return () => { active = false; clearInterval(timer); clearTimeout(timeout); window.speechSynthesis?.cancel(); };
  }, [playing, index, line, scenes.length]);
  function select(i: number) { setPlaying(false); setProgress(0); setIndex(i); }
  return <div className="mx-auto max-w-5xl space-y-5">
    <header><h2 className="text-3xl font-bold">Explainer Studio</h2><p className="text-muted-foreground">Where your $100 payment goes</p></header>
    <section className="workspace-card space-y-3">
      <svg viewBox="0 0 640 280" className="w-full rounded-xl" role="img" aria-label={title + " " + amount}>
        <rect width="640" height="280" fill="#f2eddb"/><path d="M48 227H592" stroke="#bbb49f"/>
        <g stroke="#193b38" strokeWidth={shadow ? 18 : 7} fill="#193b38" strokeLinecap="round">
          <circle cx="141" cy="92" r="17"/><path fill="none" d={`M141 115v55l-27 52m27-52 27 52m-27-96-28 32m28-32 27 14 22 ${-8-progress*18}`}/>
        </g>
        <g transform={`translate(${250+progress*35},50)`}><rect width="238" height="155" rx="16" fill={["#215751","#89552d","#265871"][index]}/>
        <text x="22" y="42" fill="white" fontSize="21">{title}</text><text x="20" y="116" fill="white" fontSize="62" fontWeight="bold">{amount}</text></g>
      </svg>
      <p className="text-center">{line}</p>
      <div className="flex flex-wrap gap-3"><Button onClick={() => { if (!playing) { setIndex(0); setProgress(0); } setPlaying(!playing); }}>{playing ? "Stop" : "Play narrated episode"}</Button>
      <Button variant="outline" onClick={() => setShadow(!shadow)}>Style · {shadow ? "Silhouette" : "Stick figure"}</Button></div>
    </section>
    <section className="workspace-card space-y-3"><div className="flex flex-wrap gap-2">{scenes.map(([name],i) => <Button key={name} variant={index===i?"default":"outline"} onClick={() => select(i)}>{name}</Button>)}</div>
    <label className="block" htmlFor="scene-line">Scene narration</label><Textarea id="scene-line" value={line} disabled={playing} onChange={e => setScenes(scenes.map((s,i)=>i===index?[s[0],s[1],e.target.value]:s))}/></section>
  </div>;
}
