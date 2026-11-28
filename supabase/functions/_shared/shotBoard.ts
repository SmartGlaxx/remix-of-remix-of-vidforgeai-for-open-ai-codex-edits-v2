import { admin } from "./filmRuntime.ts";
import { IMAGE_MODEL, IMAGE_QUALITY } from "./openai-image.ts";
import { ownsImage } from "./prunaContract.ts";
import { PNG } from "npm:pngjs@7.0.0";
import { Buffer } from "node:buffer";
import { maskedCanvas } from "./maskedCanvas.ts";
import { encode } from "npm:fast-png@8.0.0";
import type { FrameEditReceipt } from "./automaticDirection.ts";
import type { EditRegion } from "./frameMask.ts";
import { requirePng } from "./pngSignature.ts";

export async function drawFrame(owner:string, source:string, target:string, prompt:string, region?: EditRegion | null) {
  if (!ownsImage(owner,source) || !ownsImage(owner,target)) throw new Error("Invalid storyboard image");
  const bucket=admin.storage.from("character-inputs");
  if ((await bucket.info(target)).data) return;
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key) throw new Error("Image generation is not configured");
  const reference=await bucket.download(source);
  if(reference.error || !reference.data) throw new Error("Reference frame is unavailable");
  const form=new FormData();
  form.set("image",reference.data,source.split("/").pop() ?? "reference.png");
  let canvas: ReturnType<typeof maskedCanvas> | undefined;
  if (region) {
    const referenceBytes = new Uint8Array(await reference.data.arrayBuffer());
    requirePng(referenceBytes);
    // Decode indexed, grayscale and RGB PNGs to a consistent 8-bit RGBA representation.
    canvas = maskedCanvas(PNG.sync.read(Buffer.from(referenceBytes)), region);
    for (const [field, raster] of [["image", canvas.image], ["mask", canvas.mask]] as const) {
      const png = encode({ ...raster, channels: 4 });
      form.set(field, new Blob([new Uint8Array(png)], { type: "image/png" }), field + ".png");
    }
  }
  form.set("model",IMAGE_MODEL); form.set("quality",IMAGE_QUALITY); form.set("size","1536x1024");
  form.set("prompt","Preserve the reference character's exact face, clothing, palette, proportions and art style. Create exactly ONE continuous widescreen animation keyframe showing ONE moment and exactly ONE instance of the reference character. Never show before-and-after poses together, duplicate people, split screens, panels, montages, words or letters. The action describes timing context, not multiple poses to include in this image. "+prompt);
  const response=await fetch("https://api.openai.com/v1/images/edits",{method:"POST",headers:{Authorization:"Bearer "+key},body:form});
  // Return exact edit provenance for private preparation records, without credentials or signed URLs.
  const digest = await crypto.subtle.digest("SHA-256", await reference.data.arrayBuffer());
  const source_sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  const receipt: FrameEditReceipt = { source, target, source_sha256, model: IMAGE_MODEL, quality: IMAGE_QUALITY, prompt: String(form.get("prompt")), edit_region: region ?? null, provider_request_id: response.headers.get("x-request-id"), status: response.status };
  const result=await response.json();
  if(!response.ok || !result.data?.[0]?.b64_json) throw new Error(result.error?.message || "Could not generate storyboard frame");
  const bytes=Uint8Array.from(atob(result.data[0].b64_json),c=>c.charCodeAt(0));
  const output = canvas ? encode({ ...canvas.composite(PNG.sync.read(Buffer.from(bytes))), channels: 4 }) : bytes;
  const upload=await bucket.upload(target,output,{contentType:"image/png"});
  if(upload.error && !(await bucket.info(target)).data) throw upload.error;
  return receipt;
}
