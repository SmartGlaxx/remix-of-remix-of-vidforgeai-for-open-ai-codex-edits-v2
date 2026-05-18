import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") return json({ error: "url required" }, 400);

    const resp = await fetch(url);
    if (!resp.ok) return json({ error: `fetch failed: ${resp.status}`, source_url: url }, 502);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const ct = resp.headers.get("content-type") || "image/png";
    const ext = ct.includes("jpeg") || ct.includes("jpg") ? "jpg"
      : ct.includes("webp") ? "webp"
      : ct.includes("gif") ? "gif"
      : "png";
    const key = `${crypto.randomUUID()}.${ext}`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: upErr } = await admin.storage
      .from("visuals")
      .upload(key, bytes, { contentType: ct, upsert: false });
    if (upErr) {
      console.warn("upload failed:", upErr);
      return json({ image_url: url, source_url: url, rehosted: false });
    }
    const { data: pub } = admin.storage.from("visuals").getPublicUrl(key);
    return json({ image_url: pub.publicUrl, source_url: url, rehosted: true });
  } catch (e) {
    console.error("rehost-image error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}