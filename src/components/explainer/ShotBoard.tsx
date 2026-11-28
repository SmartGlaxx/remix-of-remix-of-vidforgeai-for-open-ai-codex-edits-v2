import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
import {supabase} from "@/integrations/supabase/client";

export default function ShotBoard({id,start,end,continuation,shared,independent=false,enabled,onSaved}: {id:string;start?:string;end?:string;continuation:boolean;shared?:boolean;independent?:boolean;enabled:boolean;onSaved:()=>Promise<void>}){
  const [urls,setUrls]=useState<string[]>([]);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    setUrls([]);setError("");
    Promise.all([start,end].map(async path=>path?(await supabase.storage.from("character-inputs").createSignedUrl(path,3600)).data?.signedUrl??"":""))
      .then(results=>{if(active)setUrls(results);}).catch(()=>{if(active)setError("Could not open storyboard images.");});
    return ()=>{active=false;};
  },[id,start,end]);
  async function generate(){
    setWorking(true);setError("");
    try{
      for(const side of independent?["start"]:["start","end"]){
        const {data,error}=await supabase.functions.invoke("character-film",{body:{action:"board_frame",id,side}});
        if(error || !data?.url)throw new Error(data?.error||error?.message||"Frame generation failed");
      }
      await onSaved();
    }catch(e){setError(e instanceof Error?e.message:"Frames unavailable");}finally{setWorking(false);}
  }
  return <section className="space-y-2"><div className={independent?"grid grid-cols-1 gap-2":"grid grid-cols-2 gap-2"}>{(independent?["Start frame"]:["Start frame","End frame"]).map((label,i)=><figure key={label} className="overflow-hidden rounded-lg border bg-muted/30">
    {urls[i] && <img src={urls[i]} alt={label} className="aspect-video w-full object-cover"/>}<figcaption className="px-2 py-1.5 text-xs">{label}</figcaption></figure>)}</div>
    {continuation && <p className="text-xs text-muted-foreground">{shared?"Shared boundary image · preceding end = this start":"Playback continues from the preceding clip’s actual final frame."}</p>}
    {enabled && <Button type="button" size="sm" variant="outline" disabled={working} onClick={generate}>{working?"Illustrating…":"Generate storyboard frames"}</Button>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
