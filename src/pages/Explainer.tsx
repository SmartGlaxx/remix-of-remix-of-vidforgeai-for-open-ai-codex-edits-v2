import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Wand2 } from "lucide-react";
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
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-6 pb-5 pt-14"><strong className="text-4xl">{scene.amount}</strong><p>{scene.line}</p></div>
      </div>
      <div className="flex items-center gap-2 p-3"><Button variant="ghost" aria-label="Previous scene" disabled={!index} onClick={()=>select(index-1)}><SkipBack/></Button><Button onClick={toggle}>{playing&&!paused?<Pause/>:<Play/>}{playing&&!paused?"Pause":paused?"Resume":"Play"}</Button><Button variant="ghost" aria-label="Next scene" disabled={index===2} onClick={()=>select(index+1)}><SkipForward/></Button><span className="ml-auto text-sm">Scene {index+1} / 3</span></div>
    </section>
    <section className="workspace-card space-y-3"><h3 className="text-xl font-semibold">{scene.title}</h3><label htmlFor="direction">Visual prompt</label><Textarea id="direction" maxLength={2200} value={scene.prompt} onChange={e=>edit("prompt",e.target.value)} disabled={busy}/><Button disabled={busy||!scene.prompt.trim()} onClick={generate}><Wand2/>{busy?"Illustrating…":"Generate illustration"}</Button><p role="status" className="text-sm">{message}</p><label htmlFor="narration">Narration</label><Textarea id="narration" disabled={playing&&!paused} value={scene.line} onChange={e=>{setPlaying(false);pause(false);edit("line",e.target.value);}}/></section></div>
    <div className="grid grid-cols-3 gap-3">{scenes.map((s,i)=><button key={s.title} aria-pressed={index===i} onClick={()=>select(i)} className={'overflow-hidden rounded-xl border text-left '+(i===index?'ring-2 ring-primary':'')}><img src={s.image} alt="" className="aspect-[4/1] w-full object-cover"/><span className="block p-2 font-medium">{s.title}</span></button>)}</div>
  </main>;
}
