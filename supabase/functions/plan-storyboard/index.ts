import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const CAMERA_KEYS = [
  "Dynamic First-Person (Action)",
  "Cinematic Close-Up (Emotion)",
  "Low-Angle Heroic (Power)",
  "Epic Wide Shot (Scale)",
  "Dutch Angle (Tension)",
];

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with", "without", "that", "this", "these", "those", "was", "were", "is", "are", "be", "been", "being", "it", "its", "they", "them", "their", "you", "your", "we", "our", "i", "me", "my", "he", "she", "his", "her", "as", "at", "by", "from", "into", "then", "now", "just", "not", "once", "across", "all",
]);

function cleanWords(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP_WORDS.has(w));
}

function compactConcept(text: string, sourceText: string) {
  const sentences = text.replace(/\s+/g, " ").trim().split(SENTENCE_SPLIT).filter(Boolean).slice(0, 3);
  let compact = sentences.join(" ").trim();
  const sourceWordLimit = Math.max(24, cleanWords(sourceText).length - 2);
  const maxWords = Math.min(38, sourceWordLimit);
  const words = compact.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) {
    const complete = sentences.find((sentence) => sentence.split(/\s+/).filter(Boolean).length <= maxWords);
    if (complete) return complete.trim();
    const clipped = words.slice(0, maxWords);
    while (clipped.length > 8 && /^(a|an|the|of|to|in|on|at|by|from|with|without|through|across|over|under|and|or|but)$/i.test(clipped[clipped.length - 1].replace(/[,.!?;:]+$/, ""))) {
      clipped.pop();
    }
    compact = `${clipped.join(" ").replace(/[,.!?;:]+$/, "")}.`;
  }
  return compact;
}

function overlapsSourceTooMuch(concept: string, sourceText: string) {
  const c = cleanWords(concept);
  const s = cleanWords(sourceText);
  if (!concept.trim()) return true;
  if (/^(a purely visual scene depicting|a scene showing|a picture of)\b/i.test(concept)) return true;
  if (sourceText.slice(0, 40).trim() && concept.toLowerCase().includes(sourceText.slice(0, 40).toLowerCase())) return true;
  if (c.length < 6 || s.length < 8) return false;
  const shared = c.filter((word) => s.includes(word)).length;
  return shared / Math.max(1, c.length) > 0.72;
}

function fallbackConcept(sourceText: string, index: number) {
  const lower = sourceText.toLowerCase();
  let concept = "A solitary figure faces a vast physical obstacle, surrounded by dramatic light, heavy texture, and a clear path cutting through the scene.";
  if (/deadline|overwhelm|pressure|stress|burden|too much|urgent|rush/.test(lower)) {
    concept = "A lone person stands at the base of a steep canyon as loose boulders of paper and metal teeter above, cold shadows pressing inward.";
  } else if (/sun|hot|heat|desert|plain|dry|scorch|summer/.test(lower)) {
    concept = "A white sun burns over cracked earth, heat shimmer bending the horizon while tiny silhouettes push through pale dust.";
  } else if (/stone|structure|monument|carved|terrain|machinery|ancient|pyramid|temple/.test(lower)) {
    concept = "Colossal carved stone blocks crawl across a harsh rocky expanse, dust curling around their bases under a hard white sky. Far ahead, an unfinished monument rises in stacked silhouettes, dwarfing the empty terrain.";
  } else if (/hope|dream|future|begin|new|rise|grow|build/.test(lower)) {
    concept = "A small green shoot breaks through dark cracked ground as warm light spills over distant rooftops, turning wet stone edges gold.";
  } else if (/alone|isolation|silent|empty|lost|separate/.test(lower)) {
    concept = "A single chair sits in the center of a vast dim hall, surrounded by long empty shadows and a thin shaft of blue window light.";
  } else if (/conflict|fight|battle|against|danger|threat|fear/.test(lower)) {
    concept = "Two opposing walls of storm cloud collide above a narrow bridge, sparks of light catching on wet stone while the path trembles between them.";
  } else if (/time|history|years|centur|old|memory|past/.test(lower)) {
    concept = "An ancient corridor stretches into dusty golden light, its cracked floor layered with sand, worn tools, and long shadows from unseen columns.";
  }
  return compactConcept(concept, sourceText || `frame ${index + 1}`);
}

function parseJsonObject(content: string) {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return {};
  try { return JSON.parse(stripped.slice(start, end + 1)); } catch { return {}; }
}

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

    const sys = `You are a semantic image-metaphor director. For EACH narration segment, transform the source into a DIFFERENT, SHORTER, concrete image prompt. The conceptualPrompt is NOT a summary and NOT a rewrite; it is a new photographable visual metaphor.

ALGORITHM (do not skip steps, do not echo the source):
1. PARSE the segment to extract its core emotion/theme (overwhelm, hope, isolation, urgency, freedom, conflict, etc.).
2. ABSTRACT-TO-CONCRETE MAPPING: turn that theme into a physical, tangible scene — objects, environment, scale, orientation. No narration, no speaking characters, no on-screen text.
3. SENSORY/VISUOSPATIAL: describe LAYOUT, COLOR, TEXTURE, LIGHT, and spatial relationships in vivid concrete imagery.
4. COMPRESS: rewrite into a SHORT image description — strictly 1 to 2 sentences, MUST be SHORTER than the source segment.

EXAMPLES
Source: "I am overwhelmed by deadlines."
Output: "A lone figure at the bottom of a steep paper canyon, giant boulders of crumpled documents teetering on the rims, dim amber light, towering vertical perspective."

Source: "The sun was very hot and they trudged across the empty plain for hours."
Output: "A blazing white sun scorches cracked earth, heat shimmer warping the horizon, two tiny silhouettes pressing forward through the haze."

HARD RULES — violations are rejected:
- NEVER copy, quote, or lightly rephrase the source segment. Transmute it into imagery.
- NEVER start with phrases like "A purely visual scene depicting" or "A scene showing" or "A picture of" followed by the original wording.
- 1 to 2 sentences. Must be visibly SHORTER than the source. Aim for 18–38 words.
- Use different nouns than the source where possible. Do not preserve the original sentence structure.
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
        max_tokens: 8192,
        temperature: 0.85,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return json({ error: `AI gateway ${r.status}: ${t}` }, 502);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = parseJsonObject(content);
    const aiFrames: any[] = Array.isArray(parsed.frames) ? parsed.frames : [];

    const frames = segments.map((sourceText, i) => {
      const ai = aiFrames[i] || {};
      const cam = CAMERA_KEYS.includes(ai.cameraAngle) ? ai.cameraAngle : CAMERA_KEYS[i % CAMERA_KEYS.length];
      let concept = compactConcept(typeof ai.conceptualPrompt === "string" ? ai.conceptualPrompt : "", sourceText);
      if (overlapsSourceTooMuch(concept, sourceText)) concept = fallbackConcept(sourceText, i);
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