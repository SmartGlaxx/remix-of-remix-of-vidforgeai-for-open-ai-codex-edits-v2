import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const CAMERA_KEYS = [
  "Dynamic First-Person (Action)",
  "Cinematic Close-Up (Emotion)",
  "Low-Angle Heroic (Power)",
  "Epic Wide Shot (Scale)",
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

    const sys = `You are a visual director. For EACH narration segment, output a SHORT visual scene description (the "conceptualPrompt") that a camera could literally photograph.

ALGORITHM (do not skip steps, do not echo the source):
1. PARSE the segment to extract its core emotion/theme (overwhelm, hope, isolation, urgency, freedom, conflict, etc.).
2. ABSTRACT-TO-CONCRETE MAPPING: turn that theme into a physical, tangible scene — objects, environment, scale, orientation. No narration, no speaking characters, no on-screen text.
3. SENSORY/VISUOSPATIAL: describe LAYOUT, COLOR, TEXTURE, LIGHT, and spatial relationships in vivid concrete imagery.
4. COMPRESS: rewrite into a SHORT image description — strictly 1 to 3 sentences, MUST be SHORTER than the source segment.

EXAMPLES
Source: "I am overwhelmed by deadlines."
Output: "A lone figure at the bottom of a steep paper canyon, giant boulders of crumpled documents teetering on the rims, dim amber light, towering vertical perspective."

Source: "The sun was very hot and they trudged across the empty plain for hours."
Output: "A blazing white sun scorches cracked earth, heat shimmer warping the horizon, two tiny silhouettes pressing forward through the haze."

HARD RULES — violations are rejected:
- NEVER copy, quote, or lightly rephrase the source segment. Transmute it into imagery.
- NEVER start with phrases like "A purely visual scene depicting" or "A scene showing" or "A picture of" followed by the original wording.
- 1 to 3 sentences. Must be visibly SHORTER than the source.
- No on-screen text, letters, words, logos, captions, UI.
- Avoid abstract nouns (freedom, success, anxiety, copyright, future) — show them as physical objects, spaces, light, gestures.
- People only when essential; prefer objects, environments, lighting, weather, scale.
- Concrete, photographable, spatially specific.

Also pick ONE cameraAngle from this exact list: ${CAMERA_KEYS.join(" | ")}.

Output STRICT JSON ONLY: {"frames":[{"conceptualPrompt":"...","cameraAngle":"..."}]}. Exactly ${count} items, in source order.`;
    const user = segments.map((t, i) => `SEGMENT ${i + 1}: ${t}`).join("\n\n");

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
      // If the AI failed or echoed the source, leave concept blank so the UI
      // shows "AI describing…" / lets the user re-plan, instead of polluting
      // the prompt with the raw narration text.
      let concept = typeof ai.conceptualPrompt === "string" ? ai.conceptualPrompt.trim() : "";
      const echoesSource =
        concept.length === 0 ||
        concept.toLowerCase().includes(sourceText.slice(0, 40).toLowerCase()) ||
        /^(a purely visual scene depicting|a scene showing|a picture of)\b/i.test(concept);
      if (echoesSource) concept = "";
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