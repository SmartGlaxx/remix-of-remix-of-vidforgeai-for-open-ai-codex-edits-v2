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

    const body = await req.json().catch(() => ({}));
    const {
      text,
      voice = "af_bella",
      speed = 1.0,
      response_format = "mp3",
      job_id: existingJobId,
      endpoint_id: existingEndpointId,
    } = body ?? {};

    const endpointId = existingEndpointId || KOKORO_ENDPOINT_ID;
    let jobId: string | undefined = existingJobId;
    let data: any = null;

    // Resume path: client is polling an in-flight job.
    if (jobId) {
      const sd = await pollJob(endpointId, jobId, RUNPOD_API_KEY, 120_000);
      if (sd.status === "processing") {
        return json({ status: "processing", job_id: jobId, endpoint_id: endpointId });
      }
      if (sd.status === "failed") {
        return errJson(friendlyError(sd.data, "Voice generation didn't complete. Please try again."));
      }
      data = sd.data;
    } else {
      if (!text || typeof text !== "string" || !text.trim()) {
        return errJson("Please enter some text to turn into a voiceover.");
      }
      if (text.length > 10000) {
        return errJson("That script is too long. Please keep it under 10,000 characters.");
      }

      // Always use /run (async) so we never block on cold starts.
      // Retry on transient "FastAPI server not ready" failures (worker still loading model).
      const MAX_SUBMIT_ATTEMPTS = 3; // initial + 2 retries
      let lastFailure: any = null;
      let completed = false;
      for (let attempt = 1; attempt <= MAX_SUBMIT_ATTEMPTS; attempt++) {
        const startResp = await fetch(`${RUNPOD_BASE}/${endpointId}/run`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RUNPOD_API_KEY}`,
          },
          body: JSON.stringify({ input: { text, voice, speed, response_format } }),
        });

        const startData: any = await startResp.json().catch(() => ({}));
        if (!startResp.ok || !startData?.id) {
          console.error("RunPod submit error:", startResp.status, startData);
          return errJson(friendlyError(startData, "We couldn't reach the voice service. Please try again in a moment."));
        }

        jobId = startData.id;
        // Poll with a 120s deadline; if not done, hand off to client.
        const sd = await pollJob(endpointId, jobId!, RUNPOD_API_KEY, 120_000);
        if (sd.status === "processing") {
          return json({ status: "processing", job_id: jobId, endpoint_id: endpointId });
        }
        if (sd.status === "failed") {
          lastFailure = sd.data;
          if (isServerNotReady(sd.data) && attempt < MAX_SUBMIT_ATTEMPTS) {
            console.warn(`Kokoro worker not ready (attempt ${attempt}/${MAX_SUBMIT_ATTEMPTS}), resubmitting...`);
            await new Promise((r) => setTimeout(r, 3000));
            continue;
          }
          return errJson(friendlyError(sd.data, "Voice generation didn't complete. Please try again."));
        }
        data = sd.data;
        completed = true;
        break;
      }
      if (!completed) {
        return errJson(friendlyError(lastFailure, "Voice generation didn't complete. Please try again."));
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

    return json({ status: "completed", audio_url: finalUrl, source_url: audioUrl ?? null, characters: (text?.length ?? 0), voice, format: response_format });
  } catch (err) {
    console.error("generate-speech error:", err);
    return errJson("Something went wrong while generating the voiceover. Please try again.");
  }
});

async function pollJob(
  endpointId: string,
  jobId: string,
  apiKey: string,
  budgetMs: number,
): Promise<{ status: "completed" | "failed" | "processing"; data?: any }> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const sr = await fetch(`${RUNPOD_BASE}/${endpointId}/status/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const sd: any = await sr.json().catch(() => ({}));
    if (sd?.status === "COMPLETED") return { status: "completed", data: sd };
    if (sd?.status === "FAILED" || sd?.status === "CANCELLED" || sd?.status === "TIMED_OUT") {
      return { status: "failed", data: sd };
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  return { status: "processing" };
}

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

function isServerNotReady(payload: any): boolean {
  const raw = JSON.stringify(payload ?? "").toLowerCase();
  return raw.includes("fastapi server not ready") || raw.includes("server not ready");
}
