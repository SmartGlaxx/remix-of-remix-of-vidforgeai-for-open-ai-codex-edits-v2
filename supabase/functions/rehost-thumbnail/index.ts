import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") return json({ error: "url required" }, 400);

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;
    let resp: Response | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        resp = await fetch(url);
        if (resp.ok) break;
      } catch (err) {
        console.warn(`rehost-thumbnail attempt ${attempt}:`, err);
      }
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
    if (!resp || !resp.ok) return json({ image_url: url, source_url: url, rehosted: false });

    const bytes = new Uint8Array(await resp.arrayBuffer());
    const ct = resp.headers.get("content-type") || "image/png";
    const ext = ct.includes("jpeg") || ct.includes("jpg") ? "jpg"
      : ct.includes("webp") ? "webp" : "png";
    const key = `${crypto.randomUUID()}.${ext}`;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: upErr } = await admin.storage.from("thumbnails")
      .upload(key, bytes, { contentType: ct, upsert: false });
    if (upErr) {
      console.warn("thumbnail upload failed:", upErr);
      return json({ image_url: url, source_url: url, rehosted: false });
    }
    const { data: pub } = admin.storage.from("thumbnails").getPublicUrl(key);
    return json({ image_url: pub.publicUrl, source_url: url, storage_path: key, rehosted: true });
  } catch (e) {
    console.error("rehost-thumbnail error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}