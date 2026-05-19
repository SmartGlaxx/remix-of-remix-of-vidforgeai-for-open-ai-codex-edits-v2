import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
const KOKORO_ENDPOINT_ID = Deno.env.get("KOKORO_ENDPOINT_ID") || "erpnk7ibq46vsv";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    if (!RUNPOD_API_KEY) {
      return errJson("Voice service isn't configured yet. Please contact support.");
    }

    const { text, voice = "af_bella", speed = 1.0, response_format = "mp3" } =
      await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return errJson("Please enter some text to turn into a voiceover.");
    }
    if (text.length > 10000) {
      return errJson("That script is too long. Please keep it under 10,000 characters.");
    }

    // Call Kokoro endpoint directly (gateway has been unreliable / cold-queueing).
    const startResp = await fetch(`${RUNPOD_BASE}/${KOKORO_ENDPOINT_ID}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: { text, voice, speed, response_format },
      }),
    });

    let data: any = await startResp.json().catch(() => ({}));
    if (!startResp.ok) {
      console.error("Gateway HTTP error:", startResp.status, data);
      return errJson(friendlyError(data, "We couldn't reach the voice service. Please try again in a moment."));
    }

    // If runsync didn't finish in time, RunPod returns { id, status: "IN_QUEUE" | "IN_PROGRESS" }.
    // Poll the gateway endpoint until it completes.
    if (data?.id && (data.status === "IN_QUEUE" || data.status === "IN_PROGRESS")) {
      const jobId = data.id;
      // Supabase edge functions cap around 150s; leave headroom to return friendly error.
      const deadline = Date.now() + 130_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2500));
        const sr = await fetch(`${RUNPOD_BASE}/${KOKORO_ENDPOINT_ID}/status/${jobId}`, {
          headers: { Authorization: `Bearer ${RUNPOD_API_KEY}` },
        });
        const sd: any = await sr.json().catch(() => ({}));
        if (sd?.status === "COMPLETED") { data = sd; break; }
        if (sd?.status === "FAILED" || sd?.status === "CANCELLED" || sd?.status === "TIMED_OUT") {
          return errJson(friendlyError(sd, "Voice generation didn't complete. Please try again."));
        }
      }
      if (data?.status !== "COMPLETED") {
        return errJson("Voice generation is taking longer than expected. Please try again in a minute.");
      }
    }

    // RunPod wraps response in { output: ... } OR returns inline
    const inner = data?.output ?? data;
    if (inner?.error) {
      console.error("Gateway returned error:", inner.error);
      return errJson(friendlyError(inner, "Voice generation failed. Please try again."));
    }
    // Kokoro returns audio_base64 directly; gateway sometimes wraps as a URL.
    const audioUrl: string | undefined = inner?.output?.url ?? inner?.url ?? inner?.audio_url;
    const audioB64: string | undefined =
      inner?.audio_base64 ?? inner?.output?.audio_base64 ?? inner?.audio ?? inner?.output?.audio;
    if (!audioUrl && !audioB64) {
      console.error("No audio in response:", JSON.stringify(data).slice(0, 1000));
      return errJson("The voice service returned no audio. Please try a shorter script or another voice.");
    }

    const ext = response_format === "wav" ? "wav" : response_format === "flac" ? "flac" : "mp3";
    const mime = ext === "wav" ? "audio/wav" : ext === "flac" ? "audio/flac" : "audio/mpeg";
    let finalUrl = audioUrl ?? "";
    try {
      let bytes: Uint8Array;
      if (audioB64) {
        const bin = atob(audioB64);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } else {
        const audioResp = await fetch(audioUrl!);
        if (!audioResp.ok) throw new Error(`fetch ${audioResp.status}`);
        bytes = new Uint8Array(await audioResp.arrayBuffer());
      }
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
      console.warn("Re-host failed:", e);
      if (!finalUrl) return errJson("Voice generation succeeded but audio couldn't be saved. Please try again.");
    }

    return json({ audio_url: finalUrl, source_url: audioUrl ?? null, characters: text.length, voice, format: response_format });
  } catch (err) {
    console.error("generate-speech error:", err);
    return errJson("Something went wrong while generating the voiceover. Please try again.");
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Always return HTTP 200 with { error } so supabase.functions.invoke
// surfaces our friendly message instead of "non-2xx status code".
function errJson(message: string) {
  return json({ error: message }, 200);
}

function friendlyError(payload: any, fallback: string): string {
  const raw = (payload?.error || payload?.message || "").toString();
  if (!raw) return fallback;
  // Strip noisy "status code 2xx" / stack traces
  if (/status code|HTTP \d+|Traceback|RunPod/i.test(raw)) return fallback;
  return raw.length > 200 ? fallback : raw;
}
