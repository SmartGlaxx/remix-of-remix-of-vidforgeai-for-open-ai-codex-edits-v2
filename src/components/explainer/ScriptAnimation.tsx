import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { direct, gestures, hostMarkup, type Beat, type Gesture } from "./characterScene";
import { renderCharacter } from "./localCharacterRender";

const saved = z.object({
  script: z.string(),
  beats: z.array(z.object({line:z.string(),action:z.enum(["Explain","Wave","Point","Shrug"])})),
});
type Draft = z.infer<typeof saved>;

function load(key:string):Draft {
  try {return saved.parse(JSON.parse(localStorage.getItem(key) || ""));}
  catch {return {script:"", beats:[]};}
}

export default function ScriptAnimation({storageKey}:{storageKey:string}) {
  const [draft,setDraft]=useState(()=>load(storageKey));
  const [voice,setVoice]=useState<File|null>(null);
  const [scene,setScene]=useState(0);
  const [status,setStatus]=useState("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<{url:string;ext:string}>();
  const task=useRef<AbortController>();
  const selected=draft.beats[scene];
  useEffect(()=>()=>task.current?.abort(),[]);
  useEffect(()=>()=>{if(result) URL.revokeObjectURL(result.url);},[result]);

  function save(next:Draft) {
    setDraft(next);setResult(undefined);setStatus("");
    try {localStorage.setItem(storageKey,JSON.stringify(next));}
    catch {setStatus("Browser storage is unavailable. Keep the page open to export.");}
  }
  function chooseAction(index:number, action:Gesture) {
    save({...draft,beats:draft.beats.map((beat,i)=>i===index?{...beat,action}:beat)});
    setScene(index);
  }
  async function record() {
    if(task.current || !draft.beats.length) return;
    const controller=new AbortController();
    task.current=controller;setBusy(true);setStatus("Preparing the character…");
    try {
      const file=await renderCharacter(draft.beats as Beat[],voice,controller.signal,setStatus);
      if(!controller.signal.aborted) {
        setResult({url:URL.createObjectURL(file),ext:file.type.includes("mp4")?"mp4":"webm"});
        setStatus("Your film is ready to play and download.");
      }
    } catch(e) {if(!controller.signal.aborted)setStatus(e instanceof Error?e.message:"Export failed.");}
    finally {if(!controller.signal.aborted)setBusy(false);task.current=undefined;}
  }
  return <section className="workspace-card space-y-4">
    <h3 className="text-xl font-semibold">Animate a script</h3>
    <label htmlFor="character-script" className="block">Narration script</label>
    <Textarea id="character-script" value={draft.script} disabled={busy} maxLength={12000}
      placeholder="Welcome to the lesson. Look at what happens when $100 earns interest."
      onChange={e=>{save({script:e.target.value,beats:[]});setScene(0);}}/>
    <Button disabled={busy || !draft.script.trim()} onClick={()=>{
      const beats=direct(draft.script);save({...draft,beats});setScene(0);
      if(!beats.length)setStatus("Enter a sentence to create a scene.");
    }}>Create scenes</Button>
    {!!draft.beats.length && <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        {draft.beats.map((beat,i)=><div key={i} className="flex items-center gap-2 rounded-lg border p-2">
          <button className="min-w-0 flex-1 text-left" aria-pressed={scene===i} onClick={()=>setScene(i)}>
            <strong className="block text-xs">Scene {i+1}</strong>{beat.line}</button>
          <select className="rounded border bg-background p-1.5 text-sm" aria-label={'Scene '+(i+1)+' gesture'}
            disabled={busy} value={beat.action} onChange={e=>chooseAction(i,e.target.value as Gesture)}>
            {gestures.map(g=><option key={g}>{g}</option>)}</select>
        </div>)}
      </div>
      <div className="space-y-3">
        {result ? <video className="aspect-video w-full rounded-lg bg-black" aria-label="Finished character film" controls playsInline src={result.url}/> :
          selected && <div className="flex aspect-video items-center gap-3 rounded-lg bg-[#eef3f2] p-3 text-[#263234]">
            <svg role="img" aria-label={selected.action+" pose"} className="h-full w-1/3 shrink-0" viewBox="-145 -400 290 425" dangerouslySetInnerHTML={{__html:hostMarkup(selected.action as Gesture,1)}}/>
            <p className="max-h-full overflow-auto font-semibold">{selected.line}</p>
          </div>}
        <label className="block text-sm">Narration audio (optional)
          <input className="mt-1 block w-full" type="file" accept="audio/*" disabled={busy}
            onChange={e=>{setVoice(e.target.files?.[0]??null);setResult(undefined);setStatus("");}}/></label>
        <p className="text-sm text-muted-foreground">Use a recording of your script for voiceover. Scene lengths follow word count. Keep this tab visible during export.</p>
        {result ? <Button asChild><a href={result.url} download={'character-film.'+result.ext}>Download film</a></Button> :
          <Button disabled={busy} onClick={record}>{busy?"Exporting…":"Export character film"}</Button>}
      </div>
    </div>}
    <p role="status" className="text-sm">{status}</p>
  </section>;
}
