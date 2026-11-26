import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import CharacterFilm from "./CharacterFilm";

const formats = { illustrated: "Illustrated Stories", whiteboard: "Whiteboard / Hand Reveal", character: "Character Animation", comic: "Motion Comics" };
type Format = keyof typeof formats;
type Job = { id:string; topic:string; state:string; progress:string; output_path:string|null; error:string|null };
const field = "w-full rounded-md border bg-background px-3 py-2";
export default function FormatStudio() {
  const [params,setParams] = useSearchParams();
  const selected = params.get("format");
  const format:Format = selected && Object.prototype.hasOwnProperty.call(formats,selected) ? selected as Format : "illustrated";
  const {user} = useAuth();
  return <section className="mx-auto max-w-3xl space-y-5">
    <h2 className="text-3xl font-bold">Explainer Studio</h2>
    <label className="block">Video type<select className={field} value={format} onChange={e=>setParams({format:e.target.value})}>
      {Object.entries(formats).map(([id,name])=><option key={id} value={id}>{name}</option>)}
    </select></label>
    {format==="character" ? <CharacterFilm simple/> : user && <ExportForm key={user.id+format} owner={user.id} format={format}/>}
  </section>;
}
function ExportForm({owner,format}:{owner:string;format:Exclude<Format,"character">}) {
  const [topic,setTopic]=useState("");
  const [seconds,setSeconds]=useState(60);
  const [host,setHost]=useState("auto");
  const [jobs,setJobs]=useState<Job[]>([]);
  const [error,setError]=useState("");
  const [sending,setSending]=useState(false);
  const [file,setFile]=useState("");
  const pending=useRef({signature:"",id:""});
  const table=supabase.from("explainer_exports" as never);
  useEffect(()=>{
    let active=true;
    async function refresh(){
      const response=await supabase.from("explainer_exports" as never).select("id,topic,state,progress,output_path,error").eq("owner_id",owner).eq("format",format).order("created_at",{ascending:false}).limit(25);
      if(active && response.data)setJobs(response.data as Job[]);
      if(active && response.error)setError(response.error.message);
    }
    void refresh(); const timer=setInterval(refresh,5000);
    return ()=>{active=false;clearInterval(timer);};
  },[owner,format]);
  async function create(){
    if(sending||!topic.trim())return;
    setSending(true);setError("");
    try{
      const chosen=host==="auto" ? format==="whiteboard"?"none":/money|financ|budget|interest|debt/i.test(topic)?"finance":"studio" :host;
      const input={format,topic:topic.trim(),seconds,host:chosen};
      const signature=JSON.stringify(input);
      if(signature!==pending.current.signature)pending.current={signature,id:crypto.randomUUID()};
      const id=pending.current.id;
      const {error}=await table.insert({...input,id} as never);
      if(error && error.code!=="23505")throw error;
      pending.current={signature:"",id:""};setTopic("");
      setJobs(old=>[{id,topic:input.topic,state:"queued",progress:"Queued",output_path:null,error:null},...old.filter(j=>j.id!==id)]);
    }catch(e){setError((e as Error).message);}finally{setSending(false);}
  }
  async function open(path:string,download:boolean){
    const {data,error}=await supabase.storage.from("film-media").createSignedUrl(path,3600,download?{download:"explainer.mp4"}:undefined);
    if(error){setError(error.message);return;}
    if(download)location.assign(data.signedUrl);else setFile(data.signedUrl);
  }
  return <div className="space-y-4">
    <label className="block">Topic<Input value={topic} maxLength={300} onChange={e=>setTopic(e.target.value)} placeholder="What should the video explain?"/></label>
    <label className="block">Length<select className={field} value={seconds} onChange={e=>setSeconds(Number(e.target.value))}>{[30,60,180,300,600,900,1800].map(s=><option key={s} value={s}>{s<60?"30 seconds":s/60+" min"}</option>)}</select></label>
    {format!=="whiteboard" && <details><summary>Host preference</summary><select aria-label="Host" className={field} value={host} onChange={e=>setHost(e.target.value)}><option value="auto">Recommend a host</option><option value="studio">Studio presenter</option><option value="finance">Finance storyteller</option><option value="none">No host</option></select></details>}
    <Button disabled={sending||!topic.trim()} onClick={create}>{sending?"Submitting…":"Generate video"}</Button>
    {error&&<p role="alert">{error}</p>}
    {jobs.length>0 && <section className="space-y-2"><h3>Your videos</h3>{jobs.map(job=><article key={job.id} className="rounded border p-3"><strong>{job.topic}</strong><p>{job.error||job.progress}</p>{job.output_path && <><Button variant="outline" onClick={()=>open(job.output_path!,false)}>Play</Button> <Button onClick={()=>open(job.output_path!,true)}>Download MP4</Button></>}</article>)}</section>}
    {file && <video src={file} controls className="w-full"/>}
  </div>;
}
