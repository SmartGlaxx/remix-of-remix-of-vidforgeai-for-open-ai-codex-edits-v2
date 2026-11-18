import {createClient} from "npm:@supabase/supabase-js@2";
import {animation} from "./animation.ts";
import {chartCues,narrateScene,scenes} from "./narration.ts";

const voice = "gOupLcAkjEnguROwi4oS";
const stage = "https://api.shotstack.io/edit/stage/render";
const reply = (body: unknown,status=200) => Response.json(body,{status});
const stamp=(seconds:number)=>new Date(Math.round(seconds*1000)).toISOString().slice(11,23).replace(".",",");

// ElevenLabs mp3_44100_128 is MPEG-1 Layer III. Count samples including trailing silence.
function duration(bytes:Uint8Array){
  let p=0, samples=0;
  if (String.fromCharCode(...bytes.slice(0,3))==="ID3") {
    p=10+bytes.slice(6,10).reduce((n,b)=>n*128+b,0);
  }
  const bitrate=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];
  while(p+4<=bytes.length && bytes[p]===255 && (bytes[p+1]&254)===250){
    const rate=bitrate[bytes[p+2]>>4];
    if(!rate || (bytes[p+2]&12)!==0)break;
    const size=Math.floor(144000*rate/44100)+((bytes[p+2]>>1)&1);
    if(p+size>bytes.length)break;
    samples+=1152;p+=size;
  }
  if (!samples) throw new Error("Unsupported narration audio format.");
  return samples/44100;
}

Deno.serve(async req=>{
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!service || req.headers.get("authorization")!=="Bearer "+service) return reply({error:"Backend invocation required"},403);
  if(req.method!=="POST")return reply({error:"POST required"},405);
  try{
    const sandbox=Deno.env.get("SHOTSTACK_SANDBOX_API_KEY"), speech=Deno.env.get("ELEVENLABS_API_KEY");
    if(!sandbox || !speech || !Deno.env.get("SHOTSTACK_API_KEY"))throw new Error("Required provider secret missing.");
    const store=createClient(Deno.env.get("SUPABASE_URL")!,service).storage.from("videos");
    const url=(key:string)=>store.getPublicUrl(key).data.publicUrl;
    const root="proofs/compound-interest-v1/"+voice;
    const {action,scene,id}=await req.json();
    if(action==="narrate" && Number.isInteger(scene) && scene>=0 && scene<3){
      const key=root+"/"+scene;
      const saved=await store.download(key+".json");
      if(saved.data)return reply({scene,cached:true});
      const {audio,words}=await narrateScene(scene,voice,speech);
      const seconds=duration(audio);
      const captions=words.map((w,i)=>`${i+1}\n${stamp(w.start)} --> ${stamp(w.end)}\n${w.word}\n`).join("\n");
      for(const [suffix,data,type] of [
        [".mp3",audio,"audio/mpeg"],[".srt",captions,"application/x-subrip"],
        [".json",JSON.stringify({seconds,cues:scene===1?chartCues(words):[]}),"application/json"]
      ] as const){
        const res=await store.upload(key+suffix,data,{contentType:type,upsert:true});
        if(res.error)throw new Error("Proof asset upload failed: "+res.error.message);
      }
      return reply({scene,seconds});
    }
    const headers={"x-api-key":sandbox,"Content-Type":"application/json"};
    if(action==="submit"){
      const captions=[],visuals=[],audio=[];
      let start=0, cues=[];
      for(let i=0;i<scenes.length;i++){
        const key=root+"/"+i,res=await store.download(key+".json");
        if(!res.data)return reply({error:"Generate narration for scene "+(i+1)},409);
        const meta=JSON.parse(await res.data.text()), length=meta.seconds;
        if(i===1)cues=meta.cues;
        visuals.push({asset:animation(i,length,cues),width:1280,height:720,scale:1.5,start,length});
        captions.push({asset:{type:"rich-caption",src:url(key+".srt")},position:"bottom",offset:{x:0,y:0.06},start,length});
        audio.push({asset:{type:"audio",src:url(key+".mp3")},start,length});
        start+=length;
      }
      const sent=await fetch(stage,{method:"POST",headers,body:JSON.stringify({timeline:{tracks:[{clips:captions},{clips:visuals},{clips:audio}]},output:{format:"mp4",resolution:"1080",fps:30}})});
      return reply(await sent.json(),sent.status);
    }
    if(action==="status" && typeof id==="string" && /^[a-zA-Z0-9-]{8,80}$/.test(id)){
      const response=await fetch(stage+"/"+id,{headers}),data=await response.json();
      const job=data.response;
      if(job?.status==="done" && job.url){
        const key=root+"/"+id+".mp4";
        const existing=await store.list(root,{search:id+".mp4"});
        if(!existing.data?.some(f=>f.name===id+".mp4")){
          const media=await fetch(job.url);
          if(!media.ok)throw new Error("Could not download finished proof.");
          const saved=await store.upload(key,await media.blob(),{contentType:"video/mp4",upsert:true});
          if(saved.error)throw new Error(saved.error.message);
        }
        return reply({id,status:"done",url:url(key),created:job.created,updated:job.updated,renderTime:job.renderTime,shotstackSandboxCostUSD:0});
      }
      return reply(data,response.status);
    }
    return reply({error:"Expected narrate, submit or status."},400);
  }catch(error){return reply({error:error instanceof Error?error.message:"Proof request failed"},502)}
});
