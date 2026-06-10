import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const CAMERA_KEYS = [
  "Dynamic First-Person (Action)",
  "Cinematic Close-Up (Emotion)",
  "Low-Angle Heroic (Power)",
  "Epic Landscape (Scale)",
  "Dutch Angle (Tension)",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    const body = await req.json().catch(() => ({}));
    const scriptText = String(body.scriptText ?? "").trim();
    const count = Math.max(1, Math.min(120, Number(body.count) || 12));
    if (!scriptText) return json({ error: "scriptText required" }, 400);

    // Deterministic word-based segmentation for source text snippets.
    const words = scriptText.replace(/\s+/g, " ").trim().split(" ");
    const segments: string[] = [];
    for (let i = 0; i < count; i++) {
      const s = Math.floor((i * words.length) / count);
      const e = Math.floor(((i + 1) * words.length) / count);
      segments.push(words.slice(s, Math.max(e, s + 6)).join(" "));
    }

    const sys = `You are a Hollywood director storyboarding a video. For each script segment, produce a concrete VISUAL METAPHOR prompt (no people unless essential, no text/words to render) and pick ONE camera angle from this exact list: ${CAMERA_KEYS.join(" | ")}. Output STRICT JSON only: {"frames":[{"conceptualPrompt":"...","cameraAngle":"..."}]}. Exactly ${count} items, same order.`;
    const user = segments.map((t, i) => `SEGMENT ${i + 1}: ${t}`).join("\n\n");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return json({ error: `AI gateway ${r.status}: ${t}` }, 502);
    }
    const data = await r.json();
    let parsed: any = {};
    try { parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}"); } catch {}
    const aiFrames: any[] = Array.isArray(parsed.frames) ? parsed.frames : [];

    const frames = segments.map((sourceText, i) => {
      const ai = aiFrames[i] || {};
      const cam = CAMERA_KEYS.includes(ai.cameraAngle) ? ai.cameraAngle : CAMERA_KEYS[i % CAMERA_KEYS.length];
      const concept = typeof ai.conceptualPrompt === "string" && ai.conceptualPrompt.trim()
        ? ai.conceptualPrompt.trim()
        : `A purely visual scene depicting: ${sourceText.slice(0, 400)}`;
      return { sourceText, conceptualPrompt: concept, cameraAngle: cam };
    });

    return json({ frames });
  } catch (e) {
    console.error("plan-storyboard error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}