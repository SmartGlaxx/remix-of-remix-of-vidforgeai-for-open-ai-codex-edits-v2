import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    const RUNPOD_ENDPOINT_ID = Deno.env.get("RUNPOD_ENDPOINT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!RUNPOD_API_KEY || !RUNPOD_ENDPOINT_ID) {
      return new Response(
        JSON.stringify({ error: "RunPod credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = userData.user.id;

    const { text, voice = "af_bella", speed = 1.0, response_format = "mp3", language = "en-us" } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > 10000) {
      return new Response(
        JSON.stringify({ error: "Text too long (max 10,000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call RunPod
    const runpodUrl = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}/runsync`;
    const runpodResponse = await fetch(runpodUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          input: text,
          voice,
          speed,
          response_format,
          model: "kokoro",
        },
      }),
    });

    if (!runpodResponse.ok) {
      const errText = await runpodResponse.text();
      console.error("RunPod error:", errText);
      return new Response(
        JSON.stringify({ error: "TTS generation failed", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const runpodData = await runpodResponse.json();
    const audioBase64 = runpodData?.output?.audio_base64;

    if (!audioBase64) {
      console.error("No audio in response:", JSON.stringify(runpodData).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No audio returned from TTS service" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decode and upload to storage
    const binaryString = atob(audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const fileName = `${userId}/${crypto.randomUUID()}.${response_format}`;
    const { error: uploadError } = await supabase.storage
      .from("audio-outputs")
      .upload(fileName, bytes, {
        contentType: response_format === "mp3" ? "audio/mpeg" : "audio/wav",
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Failed to upload audio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("audio-outputs")
      .getPublicUrl(fileName);

    const audioUrl = publicUrlData.publicUrl;

    // Log generation
    await supabase.from("generations").insert({
      user_id: userId,
      text,
      voice,
      model: "kokoro",
      language,
      speed,
      response_format,
      audio_url: audioUrl,
      characters: text.length,
    });

    await supabase.from("usage_logs").insert({
      user_id: userId,
      characters: text.length,
      model: "kokoro",
    });

    return new Response(
      JSON.stringify({ audio_url: audioUrl, audio_base64: audioBase64, characters: text.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
