import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
// Phase 1: LTX-2.5 primary, LTX-2.3 backup (manual fallback only).
const ENDPOINTS = {
  primary: { id: "brzqdegz3rq3gg", model: "ltx-2.5" },
  backup: { id: "7kiw6ag212y7mh", model: "ltx-2.3" },
} as const;

const Submit = z.object({
  action: z.literal("submit"),
  tier: z.enum(["primary", "backup"]).default("primary"),
  prompt: z.string().min(1).max(4000),
  dialogue: z.string().max(1000).optional(),
  duration_seconds: z.number().min(2).max(30).default(10),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  aspect_ratio: z.enum(["16:9", "9:16"]).default("16:9"),
  camera_motion: z.string().max(100).optional(),
  seed: z.number().int().optional(),
  first_frame_url: z.string().url().optional(),
});
const Status = z.object({
  action: z.literal("status"),
  tier: z.enum(["primary", "backup"]),
  job_id: z.string().min(1).max(200),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("RUNPOD_API_KEY");
    if (!key) return json({ error: "Video service not configured" }, 500);
    const body = await req.json().catch(() => ({}));

    if (body.action === "status") {
      const p = Status.safeParse(body);
      if (!p.success) return json({ error: p.error.flatten().fieldErrors }, 400);
      const ep = ENDPOINTS[p.data.tier];
      const r = await fetch(`${RUNPOD_BASE}/${ep.id}/status/${encodeURIComponent(p.data.job_id)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      return json(await r.json(), r.status);
    }

    const p = Submit.safeParse(body);
    if (!p.success) return json({ error: p.error.flatten().fieldErrors }, 400);
    const { action: _a, tier, ...input } = p.data;
    const ep = ENDPOINTS[tier];
    const r = await fetch(`${RUNPOD_BASE}/${ep.id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ input: { ...input, model_id: ep.model, audio_enabled: true } }),
    });
    const data = await r.json().catch(() => ({}));
    // Engine unavailable (e.g. paused, 409 ENDPOINT_PAUSED): reply 200 with an error so the
    // client fails over to backup cleanly instead of surfacing a runtime error.
    if (!r.ok) {
      return json({
        error: data?.detail || data?.error || `Video engine unavailable (${r.status})`,
        code: data?.code ?? "ENGINE_UNAVAILABLE", upstream_status: r.status, tier,
      });
    }
    return json({ job_id: data.id, status: data.status ?? "IN_QUEUE", tier, model: ep.model });
  } catch (e) {
    console.error("studio-clip error:", e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
