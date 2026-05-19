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
    const randomNonce = crypto.getRandomValues(new Uint32Array(1))[0];
    const seed = Number.isFinite(Number(body.seed))
      ? Number(body.seed)
      : (randomNonce ^ ((Date.now() & 0xffffffff) >>> 0) ^ (index * 2654435761)) >>> 0;

    const finalPrompt = [
      `YouTube thumbnail, 16:9, ultra-high click-through rate.`,
      `Style: ${styleName}.`,
      styleDirective || "Bold composition, strong focal subject, vibrant contrast, dramatic lighting.",
      title ? `Video title: ${title}.` : "",
      `Scene: ${description}.`,
      `Variant ${index + 1} direction: ${variationHint}`,
      textOverlay
        ? `Render the short text overlay "${textOverlay}" in massive, bold, legible sans-serif typography with a heavy outline and high contrast against the background.`
        : "No visible text or captions on the image.",
      referenceUrl ? `Visual reference inspiration: ${referenceUrl}.` : "",
      "No logos, no watermarks, no channel branding. Ultra-detailed 8K quality, photoreal where appropriate, razor-sharp focus, professional color grading, masterpiece composition, eye-catching at small sizes.",
    ].filter(Boolean).join(" ");

    const r = await fetch(`${RUNPOD_BASE}/${ZIMAGE_ENDPOINT_ID}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          prompt: finalPrompt,
          aspect_ratio: "16:9",
          quality: "ultra",
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
    });
  } catch (e) {
    console.error("generate-thumbnail error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}