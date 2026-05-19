import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
const GATEWAY_ID = Deno.env.get("RUNPOD_GATEWAY_ENDPOINT_ID");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    if (!RUNPOD_API_KEY || !GATEWAY_ID) {
      return json({ error: "Soundtrack backend is not configured" }, 200);
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return json({ error: "prompt is required" }, 200);
    if (prompt.length > 2000) return json({ error: "prompt is too long" }, 200);

    const duration = clamp(Number(body.duration ?? 30), 5, 47);
    const steps = clamp(Number(body.num_inference_steps ?? 120), 30, 200);
    const guidance = clamp(Number(body.guidance_scale ?? 7), 1, 15);
    const seed = Number.isFinite(Number(body.seed))
      ? Number(body.seed)
      : crypto.getRandomValues(new Uint32Array(1))[0];

    const r = await fetch(`${RUNPOD_BASE}/${GATEWAY_ID}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RUNPOD_API_KEY}` },
      body: JSON.stringify({
        input: {
          route: "workflow/generate-audio",
          params: {
            prompt,
            negative_prompt: body.negative_prompt || "Low quality, distorted, muddy, clipping, noisy, lo-fi artifacts.",
            duration,
            num_inference_steps: steps,
            guidance_scale: guidance,
            seed,
            output_format: "wav",
          },
        },
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.error || "Soundtrack request failed" }, 200);
    if (data?.error) return json({ error: data.error }, 200);

    return json({
      job_id: data?.id,
      endpoint_id: GATEWAY_ID,
      status: data?.status || "IN_QUEUE",
      prompt,
    });
  } catch (e) {
    console.error("generate-soundtrack error:", e);
    return json({ error: String((e as Error).message ?? e) }, 200);
  }
});

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}