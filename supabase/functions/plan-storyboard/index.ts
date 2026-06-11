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

    const sys = `You are a visual director performing "Abstract-to-Concrete Semantic Translation" and "Visuospatial Paraphrasing" on narration segments.

For EACH script segment, produce a "conceptualPrompt" by executing this EXACT algorithmic pipeline — do NOT paraphrase or rewrite the sentence:

1. PARSE the input text to extract its core emotional or conceptual theme (e.g. overwhelm, hope, isolation, urgency, freedom).
2. ABSTRACT-TO-CONCRETE MAPPING: translate that abstract meaning into a physical, tangible scene that a camera could literally photograph. No abstractions, no narration, no characters speaking, no on-screen text.
3. SENSORY DESCRIPTIVE TRANSMUTATION: render the theme as a physical scenario using metaphorical objects, environment, scale, and orientation.
4. VISUOSPATIAL PARAPHRASING: write ONE highly descriptive sentence (or two short ones) detailing the visual LAYOUT, physical ORIENTATION, COLORS, TEXTURES, LIGHT, and spatial relationships of that scene — a true "word picture".
5. The output must read like a still-frame description a cinematographer could shoot, not like a rewrite of the narration.

EXAMPLE
Input: "I am overwhelmed by deadlines."
Output: "A person standing at the bottom of a steep canyon as giant, loose boulders of paper look ready to slide down from the rims."

HARD RULES
- Never echo or lightly rephrase the source text — transmute it into imagery.
- No on-screen text, letters, words, logos, captions, or UI.
- Avoid abstract nouns (freedom, success, anxiety) in the output; show them as objects/spaces/light instead.
- People only when essential to the metaphor; otherwise prefer objects, landscapes, environments.
- 1–2 sentences, concrete, photographable, spatially specific.

Also pick ONE cameraAngle from this exact list: ${CAMERA_KEYS.join(" | ")}.

Output STRICT JSON ONLY: {"frames":[{"conceptualPrompt":"...","cameraAngle":"..."}]}. Exactly ${count} items, in order.`;
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