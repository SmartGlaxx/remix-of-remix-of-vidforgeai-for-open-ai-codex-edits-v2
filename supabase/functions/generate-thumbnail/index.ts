import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
// Call Z-Image directly (gateway has been queueing without workers).
const ZIMAGE_ENDPOINT_ID = Deno.env.get("ZIMAGE_ENDPOINT_ID") || "a6cjdpnprs4r1c";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    if (!RUNPOD_API_KEY) return json({ error: "Image generation backend is not configured" }, 500);

    const body = await req.json().catch(() => ({}));
    const description = String(body.description ?? "").trim();
    if (!description) return json({ error: "description is required" }, 400);
    if (description.length > 2000) return json({ error: "description is too long" }, 400);

    const styleName = String(body.style ?? "High-Impact").trim().slice(0, 80) || "High-Impact";
    const styleDirective = String(body.style_directive ?? "").trim().slice(0, 400);
    const textOverlay = String(body.text_overlay ?? "").trim().slice(0, 60);
    const referenceUrl = String(body.reference_url ?? "").trim().slice(0, 400);
    const title = String(body.title ?? "").trim().slice(0, 200);
    const index = Number.isFinite(Number(body.index)) ? Number(body.index) : 0;
    const aspectRatio = String(body.aspect_ratio ?? "16:9").trim() || "16:9";
    const videoStyle = String(body.video_style ?? "").trim().slice(0, 80);
    // Optional caller-supplied unique scene direction (from AI diversifier).
    const sceneOverride = String(body.scene_direction ?? "").trim().slice(0, 600);

    const dims = aspectRatio === "9:16" ? { width: 768, height: 1344 }
      : aspectRatio === "1:1" ? { width: 1024, height: 1024 }
      : { width: 1344, height: 768 };

    // Per-variant uniqueness directives — guarantee no two thumbnails look the same.
    const variationHints = [
      "Hero close-up framing, subject fills the frame, low-angle dramatic perspective, golden-hour rim light.",
      "Wide cinematic establishing shot, subject off-center using rule-of-thirds, deep background layers, blue-hour color grade.",
      "Dutch-angle dynamic composition, motion-blurred background, neon accent lighting, high-contrast teal-and-orange palette.",
      "Over-the-shoulder POV framing, shallow depth of field with strong bokeh, warm tungsten key light, moody shadows.",
      "Top-down overhead composition, symmetrical layout, hard directional sunlight, saturated complementary color palette.",
      "Side-profile silhouette against a glowing backdrop, lens flare, magenta-and-cyan gradient lighting.",
      "Macro detail shot of the most iconic element, hyper-real textures, studio softbox lighting, crisp specular highlights.",
      "Split-composition diptych feel, contrasting light/dark halves, volumetric god rays, cinematic anamorphic flares.",
    ];
    const variationHint = variationHints[index % variationHints.length];
    const sceneDirection = sceneOverride || variationHint;
    const randomNonce = crypto.getRandomValues(new Uint32Array(1))[0];
    const seed = Number.isFinite(Number(body.seed))
      ? Number(body.seed)
      : (randomNonce ^ ((Date.now() & 0xffffffff) >>> 0) ^ (index * 2654435761)) >>> 0;

    // IMPORTANT: We never ask the model to render letters/titles. Title and
    // overlay text are composited client-side as a clean vector overlay so
    // they're always legible (no gibberish glyphs).
    const cleanDescription = sanitizePrompt(description);
    const cleanDirection = sanitizePrompt(sceneDirection);
    const cleanStyleDirective = sanitizePrompt(styleDirective);

    const finalPrompt = [
      "YouTube thumbnail background plate (clean image only, NO text will be rendered by the model — text is added separately).",
      "Pure visual composition, ultra-detailed, 8K, razor-sharp focus, cinematic lighting, crisp specular highlights, professional color grading.",
      `Style: ${styleName}.`,
      cleanStyleDirective || "Bold composition, strong focal subject, vibrant contrast, dramatic lighting.",
      videoStyle ? `Visual style continuity from the video: ${videoStyle}.` : "",
      `Scene: ${cleanDescription}.`,
      `Variant ${index + 1}: ${cleanDirection}`,
      referenceUrl ? `Visual reference inspiration: ${referenceUrl}.` : "",
      "Masterpiece composition, eye-catching at small sizes, leave clean negative space in the upper third for a separate text overlay.",
    ].filter(Boolean).join(" ");

    const negativePrompt = [
      "text", "letters", "words", "numbers", "captions", "subtitles", "typography",
      "written language", "glyphs", "characters", "alphabet", "fonts",
      "signs", "signage", "labels", "watermarks", "logos", "brand marks",
      "channel names", "UI overlays", "subtitle bar",
      "book pages with readable text", "screens with readable text", "newspaper text",
      "blurry", "low-res", "low resolution", "jpeg artifacts", "banding",
      "compression artifacts", "soft focus", "noisy", "pixelated", "deformed",
    ].join(", ");

    const r = await fetch(`${RUNPOD_BASE}/${ZIMAGE_ENDPOINT_ID}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNPOD_API_KEY}` },
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
          seed,
        },
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.error || "RunPod request failed", details: data }, r.status);
    if (data?.error) return json({ error: data.error, details: data }, 502);

    return json({
      job_id: data?.id,
      endpoint_id: ZIMAGE_ENDPOINT_ID,
      status: data?.status || "IN_QUEUE",
      prompt: finalPrompt,
      text_overlay: textOverlay,
      title,
    });
  } catch (e) {
    console.error("generate-thumbnail error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function sanitizePrompt(raw: string): string {
  let s = raw || "";
  s = s.replace(/\b(video\s+title|title|overlay|caption|headline|subtitle|label|text)\s*:\s*[^.]*\.?/gi, "");
  s = s.replace(/["“”„‟"'‘’`][^"“”„‟"'‘’`]{1,120}["“”„‟"'‘’`]/g, "");
  s = s.replace(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,})\b/g, "");
  s = s.replace(/\b(text|letters?|words?|captions?|subtitles?|titles?|headlines?|typography|logos?|watermarks?)\b/gi, "");
  return s.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}