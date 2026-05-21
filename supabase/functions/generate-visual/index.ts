import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
// The unified gateway has been unreliable (no available workers), so we call
// the Z-Image endpoint directly. The client still polls via runpod-gateway
// status action which works against any endpoint_id.
const ZIMAGE_ENDPOINT_ID = Deno.env.get("ZIMAGE_ENDPOINT_ID") || "a6cjdpnprs4r1c";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    if (!RUNPOD_API_KEY) {
      return json({ error: "Image generation backend is not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return json({ error: "prompt is required" }, 400);
    if (prompt.length > 2500) return json({ error: "prompt is too long" }, 400);

    const style = safeText(body.style, "Cinematic");
    const aspectRatio = safeText(body.aspect_ratio, "16:9");
    const quality = safeText(body.quality, "HD");
    const motion = safeText(body.motion, "Static");
    const index = Number.isFinite(Number(body.index)) ? Number(body.index) : 0;

    // Map aspect ratio → explicit hi-res dimensions so Z-Image stops
    // returning 512×512 thumbnails. These are the user-requested defaults.
    const dims = aspectRatio === "9:16" ? { width: 768, height: 1344 }
      : aspectRatio === "1:1" ? { width: 1024, height: 1024 }
      : { width: 1344, height: 768 }; // default 16:9

    // Hard-strip ANY textual / titular content from the incoming prompt so the
    // diffusion model never tries to render letters (the #1 cause of gibberish).
    const cleanPrompt = sanitizePrompt(prompt);

    const finalPrompt = [
      "Pure visual composition, ultra-detailed, 8K, razor-sharp focus, cinematic lighting, crisp specular highlights, professional color grading. No text or writing of any kind anywhere in the frame.",
      `${style} cinematic visual.`,
      cleanPrompt,
      `Aspect ratio ${aspectRatio}.`,
      motion === "Static" ? "Static image, no camera movement, no animation." : `Motion direction: ${motion}.`,
    ].join(" ");

    const negativePrompt = [
      "text", "letters", "words", "numbers", "captions", "subtitles", "typography",
      "written language", "glyphs", "characters", "alphabet", "fonts",
      "signs", "signage", "labels", "watermarks", "logos", "brand marks",
      "channel names", "UI overlays", "subtitle bar",
      "book pages with readable text", "screens with readable text", "newspaper text",
      "blurry", "low-res", "low resolution", "jpeg artifacts", "banding",
      "compression artifacts", "soft focus", "noisy", "pixelated", "deformed",
    ].join(", ");

    // Submit directly to the Z-Image endpoint (bypassing the gateway).
    const r = await fetch(`${RUNPOD_BASE}/${ZIMAGE_ENDPOINT_ID}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          prompt: finalPrompt,
          negative_prompt: negativePrompt,
          aspect_ratio: aspectRatio,
          quality: "ultra",
          width: dims.width,
          height: dims.height,
          num_inference_steps: 40,
          guidance_scale: 6.5,
          seed: body.seed ?? Math.floor(Date.now() / 1000) + index,
        },
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.error || "RunPod image request failed", details: data }, r.status);
    if (data?.error) return json({ error: data.error, details: data }, 502);

    return json({
      job_id: data?.id,
      endpoint_id: ZIMAGE_ENDPOINT_ID,
      status: data?.status || "IN_QUEUE",
      prompt: finalPrompt,
    });
  } catch (e) {
    console.error("generate-visual error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function safeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 80) || fallback;
}

function sanitizePrompt(raw: string): string {
  let s = raw;
  // Drop "Video title: ..." / "Overlay: ..." / "Caption: ..." labels and the
  // sentence that follows up to the next period.
  s = s.replace(/\b(video\s+title|title|overlay|caption|headline|subtitle|label|text)\s*:\s*[^.]*\.?/gi, "");
  // Drop anything in quotes — diffusion models often try to render quoted text.
  s = s.replace(/["“”„‟"'‘’`][^"“”„‟"'‘’`]{1,120}["“”„‟"'‘’`]/g, "");
  // Drop ALL-CAPS runs of 2+ words (headline-style fragments).
  s = s.replace(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,})\b/g, "");
  // Strip the words text/title/caption etc. wherever they appear standalone.
  s = s.replace(/\b(text|letters?|words?|captions?|subtitles?|titles?|headlines?|typography|logos?|watermarks?)\b/gi, "");
  return s.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
