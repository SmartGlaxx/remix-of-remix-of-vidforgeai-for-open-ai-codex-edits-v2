import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RUNPOD_BASE = "https://api.runpod.ai/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    const GATEWAY_ID = Deno.env.get("RUNPOD_GATEWAY_ENDPOINT_ID");
    if (!RUNPOD_API_KEY || !GATEWAY_ID) {
      return json({ error: "RunPod gateway not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const { action = "gateway", route, params = {}, endpoint_id, job_id } = body;

    // Direct job status polling (any endpoint)
    if (action === "status") {
      if (!endpoint_id || !job_id) return json({ error: "endpoint_id and job_id required" }, 400);
      const r = await fetch(`${RUNPOD_BASE}/${endpoint_id}/status/${job_id}`, {
        headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
      });
      return json(await r.json(), r.status);
    }

    if (!route || typeof route !== "string") {
      return json({ error: "route is required" }, 400);
    }

    // Submit async job to gateway (/run) so long workflows don't hit the 90s runsync limit.
    const r = await fetch(`${RUNPOD_BASE}/${GATEWAY_ID}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({ input: { route, params } }),
    });
    const data = await r.json();
    if (!r.ok) return json(data, r.status);
    return json({
      status: data.status ?? "IN_QUEUE",
      job_id: data.id,
      endpoint_id: GATEWAY_ID,
      raw: data,
    }, 200);
  } catch (e) {
    console.error("runpod-gateway error:", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}