import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const RUNPOD_BASE = "https://api.runpod.ai/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    const GATEWAY_ID = Deno.env.get("RUNPOD_GATEWAY_ENDPOINT_ID");
    if (!RUNPOD_API_KEY || !GATEWAY_ID) {
      return json({ error: "RunPod gateway not configured" }, 500);
    }

    const { text, voice = "af_bella", speed = 1.0, response_format = "mp3" } =
      await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return json({ error: "Text is required" }, 400);
    }
    if (text.length > 10000) {
      return json({ error: "Text too long (max 10,000 characters)" }, 400);
    }

    const r = await fetch(`${RUNPOD_BASE}/${GATEWAY_ID}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          route: "workflow/generate-tts",
          params: { text, voice, speed, response_format },
        },
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("Gateway HTTP error:", r.status, data);
      return json({ error: "TTS service error", details: data }, 502);
    }

    // RunPod runsync wraps response in { output: ... } OR returns inline
    const inner = data?.output ?? data;
    if (inner?.error) {
      console.error("Gateway returned error:", inner.error);
      return json({ error: inner.error }, 502);
    }
    const audioUrl = inner?.output?.url ?? inner?.url;
    if (!audioUrl) {
      console.error("No audio_url in response:", JSON.stringify(data).slice(0, 500));
      return json({ error: "No audio URL returned from TTS service" }, 502);
    }

    // Re-host the audio in Lovable Cloud Storage so the URL comes from a
    // trusted *.supabase.co domain (avoids AV blocks on ipfs.filebase.io
    // while keeping fast streaming + seek support, unlike base64).
    let finalUrl = audioUrl;
    try {
      const audioResp = await fetch(audioUrl);
      if (!audioResp.ok) throw new Error(`fetch ${audioResp.status}`);
      const bytes = new Uint8Array(await audioResp.arrayBuffer());
      const ext = response_format === "wav" ? "wav" : response_format === "flac" ? "flac" : "mp3";
      const mime = ext === "wav" ? "audio/wav" : ext === "flac" ? "audio/flac" : "audio/mpeg";
      const key = `${crypto.randomUUID()}.${ext}`;

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { error: upErr } = await admin.storage
        .from("tts-audio")
        .upload(key, bytes, { contentType: mime, upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = admin.storage.from("tts-audio").getPublicUrl(key);
      if (pub?.publicUrl) finalUrl = pub.publicUrl;
    } catch (e) {
      console.warn("Re-host failed, returning original URL:", e);
    }

    return json({ audio_url: finalUrl, source_url: audioUrl, characters: text.length, voice, format: response_format });
  } catch (err) {
    console.error("generate-speech error:", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
