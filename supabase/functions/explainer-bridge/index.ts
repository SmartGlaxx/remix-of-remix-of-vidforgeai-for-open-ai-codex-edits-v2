// Authenticated bridge for the external explainer worker. The worker holds only
// EXPLAINER_WORKER_TOKEN; the service-role key never leaves Lovable Cloud.
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const id = z.string().uuid();
const path = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/(scene-\d{1,4}|final)\.mp4$/);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("claim"), token: id }),
  z.object({ action: z.literal("save"), id, token: id, patch: z.object({
    scenes: z.array(z.any()).max(400).optional(), progress: z.string().max(200).optional(),
    operation: z.string().max(200).nullable().optional(), state: z.enum(["running", "done", "attention"]).optional(),
    error: z.string().max(500).optional(), output_path: path.optional(),
  }).strict() }),
  z.object({ action: z.literal("invoke"), id, token: id, name: z.enum(["generate-script", "generate-visual", "generate-speech"]), body: z.record(z.any()) }),
  z.object({ action: z.enum(["upload_url", "download_url"]), id, token: id, path }),
]);

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("EXPLAINER_WORKER_TOKEN");
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || secret.length < 32 || !safeEqual(given, secret)) return json({ error: "Unauthorized" }, 401);
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
  const b = parsed.data;

  if (b.action === "claim") {
    const { data, error } = await db.rpc("claim_explainer_export", { token: b.token });
    return error ? json({ error: error.message }, 500) : json({ job: data?.[0] ?? null });
  }
  // Every other action requires the caller to hold the job's live lease.
  const { data: job } = await db.from("explainer_exports").select("id,owner_id,lease,lease_until").eq("id", b.id).maybeSingle();
  if (!job || job.lease !== b.token || new Date(job.lease_until) < new Date()) return json({ error: "Lost export lease" }, 409);

  if (b.action === "save") {
    const { data, error } = await db.from("explainer_exports")
      .update({ ...b.patch, lease_until: new Date(Date.now() + 300000).toISOString() })
      .eq("id", b.id).eq("lease", b.token).select("id").maybeSingle();
    return error || !data ? json({ error: "Lost export lease" }, 409) : json({ ok: true });
  }
  if (b.action === "invoke") {
    const { data, error } = await db.functions.invoke(b.name, { body: b.body });
    return error || data?.error ? json({ error: data?.error || error?.message }, 502) : json(data);
  }
  if (!b.path.startsWith(`${job.owner_id}/${job.id}/`)) return json({ error: "Path outside job" }, 403);
  const bucket = db.storage.from("film-media");
  const r = b.action === "upload_url" ? await bucket.createSignedUploadUrl(b.path, { upsert: true }) : await bucket.createSignedUrl(b.path, 600);
  if (r.error) return json({ error: r.error.message }, 500);
  return json({ url: (r.data as { signedUrl: string }).signedUrl });
});
