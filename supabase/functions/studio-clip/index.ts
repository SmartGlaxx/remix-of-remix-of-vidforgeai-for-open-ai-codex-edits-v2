import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { buildSchemas } from "./contract.ts";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
// LTX-2.5 primary, LTX-2.3 backup (auto-failover only). Both frames are mandatory.
const ENDPOINTS = {
  primary: { id: "brzqdegz3rq3gg", model: "ltx-2.5" },
  backup: { id: "7kiw6ag212y7mh", model: "ltx-2.3" },
} as const;

const { Submit, Status } = buildSchemas(z);

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
