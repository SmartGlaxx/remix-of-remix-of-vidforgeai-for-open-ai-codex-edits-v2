import { admin } from "./filmRuntime.ts";
import { IMAGE_MODEL, IMAGE_QUALITY } from "./openai-image.ts";
import { ownsImage } from "./prunaContract.ts";

export async function drawFrame(owner:string, source:string, target:string, prompt:string) {
  if (!ownsImage(owner,source) || !ownsImage(owner,target)) throw new Error("Invalid storyboard image");
  const bucket=admin.storage.from("character-inputs");
  if ((await bucket.info(target)).data) return;
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key) throw new Error("Image generation is not configured");
  const reference=await bucket.download(source);
  if(reference.error || !reference.data) throw new Error("Reference frame is unavailable");
  const form=new FormData();
  form.set("image",reference.data,source.split("/").pop() ?? "reference.png");
  form.set("model",IMAGE_MODEL); form.set("quality",IMAGE_QUALITY); form.set("size","1536x1024");
  form.set("prompt","Preserve the reference character's exact face, clothing, palette, proportions and art style. Create exactly ONE continuous widescreen animation keyframe showing ONE moment and exactly ONE instance of the reference character. Never show before-and-after poses together, duplicate people, split screens, panels, montages, words or letters. The action describes timing context, not multiple poses to include in this image. "+prompt);
  const response=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:"Bearer "+key},body:form});
  const result=await response.json();
  if(!response.ok || !result.data?.[0]?.b64_json) throw new Error(result.error?.message || "Could not generate storyboard frame");
  const bytes=Uint8Array.from(atob(result.data[0].b64_json),c=>c.charCodeAt(0));
  const upload=await bucket.upload(target,bytes,{contentType:"image/png"});
  if(upload.error && !(await bucket.info(target)).data) throw upload.error;
}
