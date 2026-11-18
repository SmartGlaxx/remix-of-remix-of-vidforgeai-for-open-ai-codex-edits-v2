import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Wand2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const pilot = [
  ["Payment", "$100", "You pay one hundred dollars toward your credit card.", "A woman paying a bill at a desk under a golden lamp."],
  ["Interest", "$40", "Forty dollars covers interest that has already accrued.", "Close up of hands separating copper coins on a statement."],
  ["Principal", "$60", "The remaining sixty dollars reduces the amount you borrowed.", "The woman closes her ledger beside a sunlit apartment window."],
].map(([title,amount,line,prompt],i)=>({title,amount,line,prompt,image:"/explainer/scene-"+i+".webp"}));
const key = "genvast.explainer.illustrations.v1";
function readScenes() {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (Array.isArray(saved) && saved.length === 3 && saved.every(s=>s && Object.keys(pilot[0]).every(k=>typeof s[k]==="string"))) return saved as typeof pilot;
  } catch { /* First visit or unavailable storage. */ }
  return pilot;
}

const motionNames = ["Payment flows", "Interest accrues", "Principal falls"];

function SceneMotion({ index, active }: { index: number; active: boolean }) {
  return <div className={`scene-motion scene-motion-${index} ${active ? "is-playing" : "is-paused"}`} aria-hidden="true">
    {index === 0 && <svg viewBox="0 0 460 220" className="motion-art">
      <g className="motion-card"><path d="M18 30h155v132H18z"/><path d="M38 61h110M38 82h78M38 116h58"/><text x="38" y="146">PAYMENT</text></g>
      <path className="coin-route" d="M188 56 C250 20 274 123 331 107"/>
      <g className="coin coin-a"><circle cx="0" cy="0" r="22"/><text x="0" y="7">$</text></g>
      <g className="coin coin-b"><circle cx="0" cy="0" r="16"/><text x="0" y="6">$</text></g>
      <g className="coin-stack"><ellipse cx="361" cy="158" rx="49" ry="14"/><path d="M312 133v25c0 8 22 14 49 14s49-6 49-14v-25"/><ellipse cx="361" cy="133" rx="49" ry="14"/><text x="361" y="140">$</text></g>
    </svg>}
    {index === 1 && <svg viewBox="0 0 460 220" className="motion-art">
      <g className="interest-panel"><path d="M22 30h180v148H22z"/><text x="42" y="62">INTEREST</text><text className="interest-value" x="42" y="122">$40</text><path d="M42 145h132"/></g>
      <path className="interest-route" d="M211 100 C264 100 277 71 322 71"/>
      <g className="interest-coin"><circle cx="0" cy="0" r="19"/><text x="0" y="7">$</text></g>
      <g className="interest-meter"><path d="M330 57h86v112h-86z"/><path className="meter-fill" d="M338 140h70v21h-70z"/><path d="M344 87h58"/></g>
    </svg>}
    {index === 2 && <svg viewBox="0 0 460 220" className="motion-art">
      <g className="ledger"><path d="M23 33h186v145H23z"/><path d="M48 33v145M70 72h111M70 104h91M70 136h64"/><text x="70" y="58">BALANCE</text><path className="balance-line" d="M74 154h99"/></g>
      <g className="check-stamp"><circle cx="331" cy="103" r="47"/><path d="m309 103 15 15 30-34"/><text x="331" y="173">REDUCED</text></g>
      <path className="progress-arrow" d="M235 168 C257 146 267 154 285 128"/>
    </svg>}
    <span className="sr-only">{motionNames[index]}</span>
    <style>{`
      .scene-motion{position:absolute;inset:0;pointer-events:none;overflow:hidden}.motion-art{position:absolute;width:min(39%,390px);height:auto;right:3%;bottom:19%;overflow:visible;filter:drop-shadow(0 12px 22px #0008)}
      .motion-art text{font:700 13px ui-sans-serif,system-ui;letter-spacing:1px;text-anchor:middle;fill:#f4d9a0}.motion-card,.interest-panel,.ledger{fill:#102b2cdd;stroke:#f2c879;stroke-width:2}.motion-card path,.interest-panel path,.ledger path{fill:none;stroke:#f2c879;stroke-width:3;stroke-linecap:round}.motion-card text,.interest-panel text,.ledger text{fill:#f7e8c9}.coin,.coin-stack{fill:#e8aa49;stroke:#ffe4a5;stroke-width:3}.coin text,.coin-stack text,.interest-coin text{fill:#573516;font-size:24px;font-weight:900}.coin-route,.interest-route{fill:none;stroke:#ffd778;stroke-width:3;stroke-dasharray:7 9}.coin-a{transform:translate(0,0)}.coin-b{transform:translate(0,0)}.coin-stack ellipse:last-of-type{fill:#f6c65f}.interest-meter{fill:#112a2b;stroke:#f2c879;stroke-width:3}.interest-meter path{fill:none;stroke:#f2c879;stroke-width:3}.interest-meter .meter-fill{fill:#d98f3c;stroke:none}.interest-coin circle{fill:#e8aa49;stroke:#ffe4a5;stroke-width:3}.interest-coin text{font-size:20px}.ledger .balance-line{stroke:#d7864b;stroke-width:8}.check-stamp circle{fill:#143c37dd;stroke:#61d6aa;stroke-width:4}.check-stamp path{fill:none;stroke:#8cf0c2;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}.check-stamp text{fill:#b6f3d8;font-size:11px}.progress-arrow{fill:none;stroke:#61d6aa;stroke-width:4;stroke-linecap:round;stroke-dasharray:6 7}
      .is-playing .motion-card{animation:cardArrive 6s ease-in-out infinite}.is-playing .coin-a{animation:coinDrop 3.4s ease-in-out infinite}.is-playing .coin-b{animation:coinDrop 3.4s 1.3s ease-in-out infinite}.is-playing .interest-coin{animation:interestFlow 3.5s ease-in-out infinite}.is-playing .meter-fill{animation:meterRise 4s ease-in-out infinite}.is-playing .interest-value{animation:valuePulse 2.2s ease-in-out infinite}.is-playing .balance-line{animation:balanceFall 4s ease-in-out infinite;transform-origin:left center}.is-playing .check-stamp{animation:stampIn 3.8s ease-in-out infinite}.is-playing .progress-arrow{animation:arrowDraw 3.8s ease-in-out infinite}
      .is-paused *{animation-play-state:paused!important}@keyframes cardArrive{0%,100%{transform:translateX(-20px);opacity:.75}45%,70%{transform:translateX(0);opacity:1}}@keyframes coinDrop{0%{transform:translate(0,0);opacity:0}15%{opacity:1}75%{transform:translate(150px,98px)}100%{transform:translate(150px,98px);opacity:0}}@keyframes interestFlow{0%{transform:translate(213px,103px);opacity:0}15%{opacity:1}75%{transform:translate(344px,72px)}100%{transform:translate(344px,72px);opacity:0}}@keyframes meterRise{0%,100%{transform:translateY(7px);opacity:.65}50%{transform:translateY(-9px);opacity:1}}@keyframes valuePulse{0%,100%{opacity:.75}50%{opacity:1}}@keyframes balanceFall{0%,100%{transform:scaleX(1)}60%{transform:scaleX(.48)}}@keyframes stampIn{0%,20%,100%{transform:scale(.72) rotate(-8deg);opacity:.65}40%,75%{transform:scale(1) rotate(0);opacity:1}}@keyframes arrowDraw{0%,100%{stroke-dashoffset:70;opacity:.2}60%{stroke-dashoffset:0;opacity:1}}
      @media(max-width:640px){.motion-art{width:50%;right:2%;bottom:22%}}
    `}</style>
  </div>;
}
export default function Explainer() {
  const [scenes,setScenes]=useState(readScenes);
  const [index,setIndex]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [paused,setPaused]=useState(false);
  const pausedRef=useRef(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const scene=scenes[index];
  useEffect(()=>{try {localStorage.setItem(key,JSON.stringify(scenes));} catch {setMessage("Device storage is full. Edits will last for this visit.");}},[scenes]);
  useEffect(()=>{
    if (!playing) return;
    let active=true;
    let elapsed=0;
    let fallback=true;
    const finish=()=>{
      if (!active) return;
      active=false;
      if(index===scenes.length-1) setPlaying(false);
      else setIndex(index+1);
    };
    const speech=window.speechSynthesis;
    if(speech && scene.line.trim()){
      const voice=new SpeechSynthesisUtterance(scene.line);
      voice.onstart=()=>{fallback=false;};
      voice.onend=finish;
      voice.onerror=()=>{fallback=true;};
      speech.speak(voice);
    }
    const timer=window.setInterval(()=>{
      if(pausedRef.current || !fallback) return;
      elapsed+=100;
      if(elapsed>=Math.max(5000,scene.line.length*105)) finish();
    },100);
    return ()=>{active=false;clearInterval(timer);speech?.cancel();};
  },[index,playing,scene.line,scenes.length]);
  function pause(value:boolean){pausedRef.current=value;setPaused(value);if(value) window.speechSynthesis?.pause();else window.speechSynthesis?.resume();}
  function select(i:number){pause(false);setIndex(i);}
  function toggle(){
    if(playing) pause(!paused);
    else {pause(false);if(index===2)setIndex(0);setPlaying(true);}
  }
  function edit(field:"line"|"prompt",value:string){setScenes(all=>all.map((s,i)=>i===index?{...s,[field]:value}:s));}
  async function generate(){
    const target=index;
    setBusy(true);setMessage("");
    try {
      const {data,error}=await supabase.functions.invoke("generate-visual",{body:{index:target,aspect_ratio:"16:9",use_prompt_as_is:true,prompt:"Cinematic layered shadow animation, sculpted paper silhouettes, expressive anatomy, deep teal shadows and amber rim lighting. "+scene.prompt.trim()}});
      if(error){const detail=await error.context?.json?.().catch(()=>null);throw new Error(detail?.error || error.message);}
      if(typeof data?.image_url!=="string")throw new Error(data?.error || "No illustration returned.");
      setScenes(all=>all.map((s,i)=>i===target?{...s,image:data.image_url}:s));
      setMessage("Illustration saved to "+scenes[target].title+".");
    } catch(e){setMessage(e instanceof Error?e.message:"Image generation failed.");} finally{setBusy(false);}
  }
  return <main className="mx-auto max-w-7xl space-y-5">
    <header><h2 className="text-3xl font-bold tracking-tight">Explainer Studio</h2><p className="text-muted-foreground">Where your $100 payment goes</p></header>
    <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="relative aspect-video overflow-hidden bg-black text-white">
        <style>{'@keyframes explainerPush {from{transform:scale(1)}to{transform:scale(1.09)}}'}</style>
        <img key={index+scene.image} className="h-full w-full object-cover" src={scene.image} alt={scene.prompt} style={{animation:"explainerPush 12s ease-out forwards",animationPlayState:playing&&!paused?"running":"paused"}}/>
        <SceneMotion index={index} active={playing&&!paused}/>
        <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">{motionNames[index]}</div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-6 pb-5 pt-14"><strong className="text-4xl">{scene.amount}</strong><p>{scene.line}</p></div>
      </div>
      <div className="flex items-center gap-2 p-3"><Button variant="ghost" aria-label="Previous scene" disabled={!index} onClick={()=>select(index-1)}><SkipBack/></Button><Button onClick={toggle}>{playing&&!paused?<Pause/>:<Play/>}{playing&&!paused?"Pause":paused?"Resume":"Play"}</Button><Button variant="ghost" aria-label="Next scene" disabled={index===2} onClick={()=>select(index+1)}><SkipForward/></Button><span className="ml-auto flex items-center gap-2 text-sm"><Volume2 className="h-4 w-4"/>Narrated scene {index+1} / 3</span></div>
    </section>
    <section className="workspace-card space-y-3"><h3 className="text-xl font-semibold">{scene.title}</h3><label htmlFor="direction">Visual prompt</label><Textarea id="direction" maxLength={2200} value={scene.prompt} onChange={e=>edit("prompt",e.target.value)} disabled={busy}/><Button disabled={busy||!scene.prompt.trim()} onClick={generate}><Wand2/>{busy?"Illustrating…":"Generate illustration"}</Button><p role="status" className="text-sm">{message}</p><label htmlFor="narration">Narration</label><Textarea id="narration" disabled={playing&&!paused} value={scene.line} onChange={e=>{setPlaying(false);pause(false);edit("line",e.target.value);}}/></section></div>
    <div className="grid grid-cols-3 gap-3">{scenes.map((s,i)=><button key={s.title} aria-pressed={index===i} onClick={()=>select(i)} className={'overflow-hidden rounded-xl border text-left '+(i===index?'ring-2 ring-primary':'')}><img src={s.image} alt="" className="aspect-[4/1] w-full object-cover"/><span className="block p-2 font-medium">{s.title}</span></button>)}</div>
  </main>;
}
