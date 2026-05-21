import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { url, label } = await req.json();
    if (!url || typeof url !== "string") return json({ error: "url required" }, 400);

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;
    let resp: Response | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        resp = await fetch(url);
        if (resp.ok) break;
        console.warn(`rehost-video attempt ${attempt} status ${resp.status}`);
      } catch (err) {
        console.warn(`rehost-video attempt ${attempt} threw`, err);
      }
      if (attempt < MAX_RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
    if (!resp || !resp.ok) {
      return json({ url, source_url: url, rehosted: false });
    }

    const bytes = new Uint8Array(await resp.arrayBuffer());
    const ct = resp.headers.get("content-type") || "video/mp4";
    const ext = ct.includes("webm") ? "webm" : ct.includes("quicktime") ? "mov" : "mp4";
    const slug = String(label ?? "video")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "video";
    const key = `${slug}-${crypto.randomUUID()}.${ext}`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: upErr } = await admin.storage
      .from("videos")
      .upload(key, bytes, { contentType: ct, upsert: false });
    if (upErr) {
      console.warn("rehost-video upload failed:", upErr);
      return json({ url, source_url: url, rehosted: false });
    }
    const { data: pub } = admin.storage.from("videos").getPublicUrl(key);
    return json({
      url: pub.publicUrl,
      source_url: url,
      storage_path: key,
      bytes: bytes.byteLength,
      rehosted: true,
    });
  } catch (e) {
    console.error("rehost-video error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}