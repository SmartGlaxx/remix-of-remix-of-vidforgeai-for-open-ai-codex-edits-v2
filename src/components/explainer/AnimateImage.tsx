import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Film, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { imageError, VIDEO_MODELS, type VideoModel } from "../../../supabase/functions/character-animation/contract";
export type AnimationJob = {id:string; request_id:string; prompt:string; image_path:string; image_url:string; video_url:string|null; state:string; error:string|null; prediction_id:string|null; created_at:string};
const labels: Record<string,string> = {submitting:"Submitting",checking:"Checking submission",queued:"Queued",generating:"Generating",saving:"Saving video",save_failed:"Saving failed",ready:"Ready",failed:"Failed"};
export function restoreDraft(jobs: AnimationJob[]) { return jobs[0] ? {prompt:jobs[0].prompt,path:jobs[0].image_path,image:jobs[0].image_url} : undefined; }
async function call(body: object) {
  const {data,error} = await supabase.functions.invoke("character-animation",{body});
  if (error) {
    let message = error.message;
    try { message = (await error.context.json()).error ?? message; } catch { /* Keep transport message. */ }
    throw new Error(message);
  }
  return data;
}
export default function AnimateImage() {
  const {user} = useAuth();
  const key = "capscify.animate-image."+(user?.id ?? "guest");
  const [prompt,setPrompt] = useState(""); const [image,setImage] = useState(""); const [path,setPath] = useState("");
  const [jobs,setJobs] = useState<AnimationJob[]>([]); const [selected,setSelected] = useState<string>();
  const [busy,setBusy] = useState(false); const [loading,setLoading] = useState(true); const [error,setError] = useState("");
  const [request,setRequest] = useState<string>(); const [model,setModel] = useState<VideoModel>("pruna"); const [downloading,setDownloading] = useState(false);
  const input = useRef<HTMLInputElement>(null); const locked = useRef(false); const draftLoaded = useRef(false);
  useEffect(()=>{ draftLoaded.current=false; setJobs([]); setSelected(undefined); setError("");
    try {const d=JSON.parse(localStorage.getItem(key) ?? "null"); if(d){setPrompt(d.prompt ?? "");setPath(d.path ?? "");setImage(d.image ?? "");setRequest(d.request);draftLoaded.current=true;}} catch { /* Stored jobs remain authoritative. */ }
    setLoading(true);
    call({action:"list"}).then(async data=>{setJobs(data.jobs);const d=restoreDraft(data.jobs);if(d&&!draftLoaded.current){setPrompt(d.prompt);setPath(d.path);setImage(d.image);} else {
      let stored;try{stored=JSON.parse(localStorage.getItem(key) ?? "null");}catch{/* No draft. */}
      if(stored?.path){const {data:read}=await supabase.storage.from("character-inputs").createSignedUrl(stored.path,3600);if(read)setImage(read.signedUrl);}
    } }).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[key]);
  useEffect(()=>{if(!loading)try{localStorage.setItem(key,JSON.stringify({prompt,path,image,request}));}catch{/* Saved jobs restore through the backend. */}},[prompt,path,image,request,key,loading]);
  const merge = useCallback((job:AnimationJob)=>setJobs(list=>[job,...list.filter(j=>j.id!==job.id)].sort((a,b)=>b.created_at.localeCompare(a.created_at))),[]);
  useEffect(()=>{
    const active=jobs.filter(j=>!["ready","failed","save_failed"].includes(j.state)); if(!active.length)return;
    let stopped=false;
    const timer=setInterval(()=>{Promise.all(active.map(j=>call({action:"status",id:j.id}))).then(results=>{if(!stopped)results.forEach(r=>merge(r.job));}).catch(e=>{if(!stopped)setError(e.message);});},5000);
    return ()=>{stopped=true;clearInterval(timer);};
  },[jobs,merge]);
  async function upload(file?:File) {
    if(!file||!user)return;
    const invalid=imageError(file.type,file.size); if(invalid){setError(invalid);return;}
    setBusy(true);setError("");
    try {
      const bitmap=await createImageBitmap(file); bitmap.close();
      const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
      const next=`${user.id}/${crypto.randomUUID()}.${ext}`;
      const {error:up}=await supabase.storage.from("character-inputs").upload(next,file,{contentType:file.type});if(up)throw up;
      const {data,error:read}=await supabase.storage.from("character-inputs").createSignedUrl(next,3600);if(read||!data)throw read ?? new Error("Could not preview image.");
      setPath(next);setImage(data.signedUrl);setRequest(undefined);
    } catch(e){setError(e instanceof Error?e.message:"Could not upload this illustration.");}finally{setBusy(false);}
  }
  async function generate() {
    if(locked.current||!path||!prompt.trim())return;
    locked.current=true;setBusy(true);setError("");
    const id=request ?? crypto.randomUUID();setRequest(id);
    // Persist before the network call: refresh/retry uses this same paid attempt.
    try{localStorage.setItem(key,JSON.stringify({prompt,path,image,request:id}));}catch{/* The unique server record still protects this attempt. */}
    try{const data=await call({action:"submit",request_id:id,image_path:path,prompt,model});merge(data.job);setSelected(data.job.id);setRequest(undefined);}
    catch(e){setError(e instanceof Error?e.message:"Submission interrupted. Check this attempt again.");}
    finally{setBusy(false);locked.current=false;}
  }
  const job=jobs.find(j=>j.id===selected) ?? jobs[0];
  const active=jobs.some(j=>!["ready","failed","save_failed"].includes(j.state));
  async function download() {
    if(!job?.video_url)return;setDownloading(true);setError("");
    try{const response=await fetch(job.video_url);if(!response.ok)throw new Error("Could not download clip.");const blob=await response.blob();const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`character-${job.id}.mp4`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);}catch(e){setError(e instanceof Error?e.message:"Download failed.");}finally{setDownloading(false);}
  }
  return <section aria-label="Animate an image" className="space-y-5 border-b border-border pb-8">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xl font-semibold">Animate an image</h3><span className="text-xs text-muted-foreground">10 seconds · 720p · 24 fps · Draft · Generated audio</span></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <Label htmlFor="character-image">Character illustration</Label>
        <input ref={input} id="character-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e=>void upload(e.target.files?.[0])}/>
        <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-muted">
          {image?<img src={image} alt="Input character illustration" className="max-h-80 w-full object-contain"/>:<Upload className="h-10 w-10 text-muted-foreground"/>}
        </div>
        <Button variant="outline" disabled={busy||active||loading} onClick={()=>input.current?.click()}><Upload className="mr-2 h-4 w-4"/>{image?"Replace image":"Upload illustration"}</Button>
        {!path&&<p className="text-xs text-muted-foreground">Choose a JPG, PNG, or WebP image · up to 10 MB</p>}
        <div className="space-y-2"><Label htmlFor="motion-direction">What should happen?</Label><Textarea id="motion-direction" rows={4} maxLength={4000} value={prompt} disabled={active||busy} onChange={e=>{setPrompt(e.target.value);setRequest(undefined);}} placeholder="She looks down, picks up the mug, takes a sip, and sets it back on the table."/>{!prompt.trim()&&<p className="text-xs text-muted-foreground">Enter a motion direction.</p>}</div>
        <div className="space-y-2"><Label htmlFor="video-model">Video model</Label><Select value={model} disabled={active||busy} onValueChange={v=>{setModel(v as VideoModel);setRequest(undefined);}}><SelectTrigger id="video-model" className="w-full sm:w-72"><SelectValue/></SelectTrigger><SelectContent>{(Object.keys(VIDEO_MODELS) as VideoModel[]).map(m=><SelectItem key={m} value={m}>{VIDEO_MODELS[m].label} · ~US${VIDEO_MODELS[m].estimate.toFixed(2)}</SelectItem>)}</SelectContent></Select>{model==="ltx"&&<p className="text-xs text-muted-foreground">LTX-2.5 runs on your own engine and accepts any character. The first take may take a few minutes while it warms up.</p>}</div>
        <div className="flex flex-wrap items-center gap-3"><Button onClick={generate} disabled={!user||!path||!prompt.trim()||busy||active||loading}>{busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Film className="mr-2 h-4 w-4"/>}{request?"Check this attempt":jobs.length?"Generate another take":"Generate 10-second clip"}</Button><span className="text-xs text-muted-foreground">Estimated US${VIDEO_MODELS[model].estimate.toFixed(2)} / take</span></div>
        {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="min-w-0 space-y-4">
        <div role="status" className="flex items-center gap-2 text-sm">{loading?<><Loader2 className="h-4 w-4 animate-spin"/>Loading saved takes</>:job?<><span className={job.state==="ready"?"text-primary":""}>{labels[job.state] ?? job.state}</span> · {new Date(job.created_at).toLocaleString()}</>:"No takes yet"}</div>
        {job?.video_url?<video key={job.video_url} controls playsInline preload="metadata" src={job.video_url} className="max-h-96 w-full rounded-lg bg-muted object-contain" aria-label="Generated character clip" onError={()=>setError("The saved clip could not play. Try downloading it.")}/>:<div className="grid aspect-video place-items-center rounded-lg bg-muted text-muted-foreground"><Film className="h-12 w-12"/></div>}
        {job?.error&&<p role="alert" className="text-sm text-destructive">{job.error}</p>}
        {job?.state==="save_failed"&&<Button variant="outline" onClick={()=>call({action:"status",id:job.id}).then(r=>merge(r.job)).catch(e=>setError(e.message))}><RefreshCw className="mr-2 h-4 w-4"/>Retry saving video</Button>}
        {job?.video_url&&<Button variant="outline" disabled={downloading} onClick={download}><Download className="mr-2 h-4 w-4"/>{downloading?"Downloading…":"Download clip"}</Button>}
        {!!jobs.length&&<div className="space-y-2"><h4 className="font-semibold">Previous takes</h4><ul className="space-y-2">{jobs.map((j,i)=><li key={j.id}><Button variant="outline" aria-pressed={job?.id===j.id} className="h-auto w-full justify-between gap-3 whitespace-normal py-3 text-left" onClick={()=>{setSelected(j.id);if(!active){setPrompt(j.prompt);setPath(j.image_path);setImage(j.image_url);setRequest(undefined);}}}><span className="min-w-0 break-words">Take {jobs.length-i} · {j.prompt.slice(0,90)}</span><span className="shrink-0 text-xs">{labels[j.state]}</span></Button></li>)}</ul></div>}
      </div>
    </div>
  </section>;
}
