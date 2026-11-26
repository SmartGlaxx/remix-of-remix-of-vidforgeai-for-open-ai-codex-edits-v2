import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
async function invoke(name,body){
  const {data,error}=await db.functions.invoke(name,{body});
  if(error||data?.error)throw new Error(data?.error||error.message);
  return data;
}
const art={illustrated:"Editorial narrative illustration",whiteboard:"Sparse black marker drawing on white paper",comic:"Expressive full-color inked comic panel without lettering"};
const hosts={studio:"A slim friendly young man with wavy brown hair, tan skin, teal sweater, navy trousers",finance:"A woman with dark wavy hair reviewing a ledger, amber and teal palette",none:"Use props and scenes without a recurring host"};

async function work(job,token){
  const bucket=db.storage.from("film-media");
  const dir=await mkdtemp(join(tmpdir(),"explainer-"));
  const scenes=job.scenes;
  async function save(patch){
    const {data,error}=await db.from("explainer_exports").update({...patch,lease_until:new Date(Date.now()+300000).toISOString()}).eq("id",job.id).eq("lease",token).select("id").single();
    if(error||!data)throw new Error("Lost export lease");
  }
  async function operation(label,fn){
    // Persist intent before a billable call. A crashed submission needs reconciliation.
    await save({progress:label,operation:label});
    const result=await fn();
    return result;
  }
  let browser;
  try{
    if(job.operation)throw new Error("Interrupted during "+job.operation+". Check provider history before retrying.");
    const count=Math.ceil(job.seconds/10);
    while(scenes.length<count){
      const brief=job.topic+". Part "+(Math.floor(scenes.length/6)+1)+" of "+Math.ceil(count/6)+". Prior takeaways: "+scenes.map(s=>s.label).join(", ").slice(-2800);
      const plan=await operation("Planning scenes",()=>invoke("generate-script",{explainerBrief:brief,format:job.format}));
      if(!Array.isArray(plan.scenes)||plan.scenes.length!==6||plan.scenes.some(s=>!s.line||!s.prompt||!s.label))throw new Error("Incomplete scene plan");
      scenes.push(...plan.scenes.slice(0,count-scenes.length));
      await save({scenes,operation:null});
    }
    browser=await chromium.launch({args:["--autoplay-policy=no-user-gesture-required"]});
    for(const [i,s] of scenes.entries()){
      const clipPath=job.owner_id+"/"+job.id+"/scene-"+i+".mp4";
      const local=join(dir,i+".mp4");
      if(s.saved){
        const {data,error}=await bucket.download(clipPath);if(error)throw error;
        await writeFile(local,Buffer.from(await data.arrayBuffer()));continue;
      }
      if(!s.image){
        const img=await operation("Drawing scene "+(i+1),()=>invoke("generate-visual",{use_prompt_as_is:true,prompt:(art[job.format]+". "+hosts[job.host]+". "+s.prompt).slice(0,2500)}));
        if(!img.image_url)throw new Error("Missing illustration");
        s.image=img.image_url;await save({scenes,operation:null});
      }
      if(job.format==="comic" && !s.endImage){
        const image=await operation("Drawing second panel "+(i+1),()=>invoke("generate-visual",{use_prompt_as_is:true,prompt:(art.comic+". "+hosts[job.host]+". "+(s.endPrompt||s.prompt)).slice(0,2500)}));
        if(!image.image_url)throw new Error("Missing second comic panel");
        s.endImage=image.image_url;await save({scenes,operation:null});
      }
      while(!s.audio){
        const body={text:s.line,voice:"af_heart",job_id:s.job_id,endpoint_id:s.endpoint_id};
        const speech=s.job_id?await invoke("generate-speech",body):await operation("Narrating scene "+(i+1),()=>invoke("generate-speech",body));
        if(speech.audio_url)s.audio=speech.audio_url;
        else if(speech.job_id){s.job_id=speech.job_id;s.endpoint_id=speech.endpoint_id;}
        else throw new Error("Missing narration");
        await save({scenes,operation:null});
        if(!s.audio)await wait(3000);
      }
      await save({progress:"Rendering scene "+(i+1)+" of "+count});
      const page=await browser.newPage();
      try{
        await page.addScriptTag({path:"bundle.js"});
        const bytes=await page.evaluate(async ({scene,format,length})=>{
          const blob=await Studio.renderFilm([scene],()=>{},new AbortController().signal,format,length);
          return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(",")[1]);reader.readAsDataURL(blob);});
        },{scene:s,format:job.format,length:job.seconds/count});
        const recording=join(dir,"recording");await writeFile(recording,Buffer.from(bytes,"base64"));
        execFileSync("ffmpeg",["-loglevel","error","-y","-i",recording,"-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-ar","48000","-r","30",local]);
      }finally{await page.close();}
      const {error}=await bucket.upload(clipPath,await readFile(local),{contentType:"video/mp4",upsert:true});if(error)throw error;
      s.saved=true;await save({scenes});
    }
    await save({progress:"Saving final MP4"});
    await writeFile(join(dir,"clips"),scenes.map((_,i)=> "file '"+i+".mp4'").join("\n"));
    const out=join(dir,"final.mp4");
    execFileSync("ffmpeg",["-loglevel","error","-y","-f","concat","-safe","1","-i",join(dir,"clips"),"-c","copy","-movflags","+faststart",out]);
    const path=job.owner_id+"/"+job.id+"/final.mp4";
    const {error}=await bucket.upload(path,await readFile(out),{contentType:"video/mp4",upsert:true});if(error)throw error;
    await save({state:"done",progress:"Ready",output_path:path});
  }catch(e){await save({state:"attention",error:String(e.message).slice(0,450)});}
  finally{await browser?.close();await rm(dir,{recursive:true,force:true});}
}
while(true){
  try{
    const token=crypto.randomUUID();
    const {data,error}=await db.rpc("claim_explainer_export",{token});
    if(error)throw error;
    if(data?.length){await work(data[0],token);continue;}
  }catch(e){console.error("Worker:",e.message);}
  await wait(5000);
}
