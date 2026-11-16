import { createClient } from "npm:@supabase/supabase-js@2";

// Images are generated with FLUX.2-dev on Together AI (billed to the TOGETHER_API_KEY account).
export const IMAGE_MODEL = "black-forest-labs/FLUX.2-dev";

export function openaiSize(aspectRatio: string) {
  return aspectRatio === "9:16" ? { width: 768, height: 1344 } : aspectRatio === "1:1" ? { width: 1024, height: 1024 } : { width: 1344, height: 768 };
}

export type GenResult = { ok: true; url: string } | { ok: false; status: number; error: string };

export async function generateAndStore(prompt: string, aspectRatio: string, bucket: string, prefix: string): Promise<GenResult> {
  const key = Deno.env.get("TOGETHER_API_KEY");
  if (!key) return { ok: false, status: 500, error: "Image generation is not configured" };

  let res: Response | null = null;
  let body: any = {};
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch("https://api.together.xyz/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, ...openaiSize(aspectRatio), n: 1, response_format: "b64_json" }),
    });
    body = await res.json().catch(() => ({}));
    if (res.ok) break;
    if (res.status !== 429 && res.status < 500) break;
    if (attempt === 3) break;
    const ra = Number(res.headers.get("retry-after")) || 0;
    await new Promise((r) => setTimeout(r, Math.max(ra * 1000, 1500 * 2 ** attempt) + Math.random() * 500));
  }
  if (!res || !res.ok) {
    const msg = body?.error?.message || body?.message || body?.error || `HTTP ${res?.status}`;
    return { ok: false, status: res?.status ?? 502, error: String(msg) };
  }

  const b64 = body?.data?.[0]?.b64_json;
  const remote = body?.data?.[0]?.url;
  let bytes: Uint8Array;
  if (b64) bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  else if (remote) bytes = new Uint8Array(await (await fetch(remote)).arrayBuffer());
  else return { ok: false, status: 502, error: "No image returned" };

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const path = `${prefix}/${Date.now()}-${crypto.randomUUID()}.png`;
  const { error } = await admin.storage.from(bucket).upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) return { ok: false, status: 500, error: `Saving image failed: ${error.message}` };
  return { ok: true, url: admin.storage.from(bucket).getPublicUrl(path).data.publicUrl };
}
