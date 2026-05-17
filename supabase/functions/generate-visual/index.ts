import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
const MIN_VISUALS = 24;
const LOWER_END_MINUTES = 8;
const HIGHER_END_MINUTES = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    const GATEWAY_ID = Deno.env.get("RUNPOD_GATEWAY_ENDPOINT_ID");
    if (!RUNPOD_API_KEY || !GATEWAY_ID) {
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

    const finalPrompt = [
      `${style} documentary visual for a long-form YouTube video.`,
      prompt,
      `Aspect ratio ${aspectRatio}. ${quality} detail.`,
      motion === "Static" ? "Static image, no camera movement, no animation." : `Motion direction: ${motion}.`,
      "No text, no captions, no logos, no watermarks. High composition quality, realistic lighting, clear subject."
    ].join(" ");

    const r = await fetch(`${RUNPOD_BASE}/${GATEWAY_ID}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          route: "workflow/generate-image",
          params: {
            prompt: finalPrompt,
            aspect_ratio: aspectRatio,
            quality: quality.toLowerCase(),
            seed: body.seed ?? Math.floor(Date.now() / 1000) + index,
          },
        },
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.error || "RunPod image request failed", details: data }, r.status);
    if (data?.error) return json({ error: data.error, details: data }, 502);

    const output = data?.output ?? data;
    const nested = output?.output ?? output;
    const imageUrl = nested?.url || nested?.image_url || nested?.ipfs_url || nested?.image?.url || nested?.image?.ipfs_url;
    if (!imageUrl) return json({ error: "No image URL returned", details: data }, 502);

    return json({ image_url: imageUrl, prompt: finalPrompt });
  } catch (e) {
    console.error("generate-visual error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function safeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 80) || fallback;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
