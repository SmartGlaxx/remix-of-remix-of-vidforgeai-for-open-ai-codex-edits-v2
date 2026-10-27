import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { STITCH_ENDPOINT, stitchEnvelope } from "./contract.ts";

const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Public HTTPS URL required");
const Request = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit"),
    video_clips: z.array(z.object({ url: httpsUrl, shot_index: z.number().int().nonnegative() })).min(2).max(200),
    soundtrack_url: httpsUrl.optional(),
    resolution: z.enum(["1280x720", "720x1280", "1920x1080", "1080x1920"]).optional(),
  }),
  z.object({ action: z.literal("status"), job_id: z.string().min(1).max(200) }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const key = Deno.env.get("RUNPOD_API_KEY");
    if (!key) return json({ error: "Stitch service not configured" }, 500);
    const parsed = Request.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid stitch request", details: parsed.error.flatten() }, 400);
    const input = parsed.data;
    const base = `https://api.runpod.ai/v2/${STITCH_ENDPOINT}`;
    const status = input.action === "status";
    const response = await fetch(input.action === "status" ? `${base}/status/${encodeURIComponent(input.job_id)}` : `${base}/run`, {
      method: status ? "GET" : "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      ...(input.action === "submit" ? { body: JSON.stringify(stitchEnvelope({
        video_clips: input.video_clips, soundtrack_url: input.soundtrack_url, resolution: input.resolution,
      })) } : {}),
    });
    const data = await response.json();
    if (!response.ok || status) return json(data, response.status);
    return json({ job_id: data.id, status: data.status ?? "IN_QUEUE" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Stitch request failed" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}