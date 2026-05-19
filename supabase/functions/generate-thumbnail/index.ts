import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
// Route through the unified gateway using this app's `workflow/*` namespace.
const GATEWAY_ID = Deno.env.get("RUNPOD_GATEWAY_ENDPOINT_ID");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    if (!RUNPOD_API_KEY || !GATEWAY_ID) return json({ error: "Image generation backend is not configured" }, 500);

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

    const finalPrompt = [
      `YouTube thumbnail, 16:9, ultra-high click-through rate.`,
      `Style: ${styleName}.`,
      styleDirective || "Bold composition, strong focal subject, vibrant contrast, dramatic lighting.",
      title ? `Video title: ${title}.` : "",
      `Scene: ${description}.`,
      textOverlay
        ? `Render the short text overlay "${textOverlay}" in massive, bold, legible sans-serif typography with a heavy outline and high contrast against the background.`
        : "No visible text or captions on the image.",
      referenceUrl ? `Visual reference inspiration: ${referenceUrl}.` : "",
      "No logos, no watermarks, no channel branding. Hyper-detailed, photoreal where appropriate, sharp focus, eye-catching at small sizes.",
    ].filter(Boolean).join(" ");

    const r = await fetch(`${RUNPOD_BASE}/${GATEWAY_ID}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          route: "workflow/generate-image",
          params: {
            prompt: finalPrompt,
            aspect_ratio: "16:9",
            quality: "hd",
            seed: body.seed ?? Math.floor(Date.now() / 1000) + index,
          },
        },
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.error || "RunPod request failed", details: data }, r.status);
    if (data?.error) return json({ error: data.error, details: data }, 502);

    return json({
      job_id: data?.id,
      endpoint_id: GATEWAY_ID,
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