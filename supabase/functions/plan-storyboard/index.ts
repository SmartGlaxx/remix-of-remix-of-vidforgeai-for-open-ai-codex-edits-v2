import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const CAMERA_KEYS = [
  "Dynamic First-Person (Action)",
  "Cinematic Close-Up (Emotion)",
  "Low-Angle Heroic (Power)",
  "Epic Wide Shot (Scale)",
  "Dutch Angle (Tension)",
];

function parseJsonObject(content: string) {
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return {};
  try { return JSON.parse(stripped.slice(start, end + 1)); } catch { return {}; }
}

// Strip every timestamp/section label that pollutes the narration.
function stripScriptNoise(raw: string): string {
  let s = raw;
  // [00:12], (0:45), 00:12 - 00:30, 0:45 –
  s = s.replace(/[\[\(]?\s*\d{1,2}:\d{2}(?:\s*[-–—]\s*\d{1,2}:\d{2})?\s*[\]\)]?/g, " ");
  // Section labels with brackets: HOOK (0:00 - 0:30)
  s = s.replace(/\b(HOOK|CONTEXT|RISING\s+ACTION|CLIMAX|RESOLUTION|INTRO|OUTRO|CONCLUSION|SECTION|SCENE|PART|CHAPTER)\b\s*[:\-]?\s*/gi, " ");
  // Stage cues like [PAUSE], (laughs)
  s = s.replace(/\[(?:[^\]]{1,40})\]/g, " ");
  s = s.replace(/\((?:pause|beat|laughs|sigh|silence)\)/gi, " ");
  return s.replace(/\s{2,}/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);
    const body = await req.json().catch(() => ({}));
    const rawScript = String(body.scriptText ?? "").trim();
    if (!rawScript) return json({ error: "scriptText required" }, 400);
    const targetCount = Math.max(3, Math.min(80, Number(body.count) || 12));
    const title = String(body.title ?? "").slice(0, 240);
    const globalStyle = String(body.style ?? "Cinematic").slice(0, 60);
    const globalPalette = String(body.palette ?? "Teal & Tangerine").slice(0, 60);
    const globalAmbiance = String(body.ambiance ?? "Neutral & Realistic").slice(0, 60);
    const globalEngine = String(body.engine ?? "IMAX Hollywood Quality").slice(0, 60);

    const scriptText = stripScriptNoise(rawScript);

    const sys = `You are an award-winning visual director planning a fully consistent image sequence for an AI video. Pipeline: Title -> structured script -> idea-based segments -> Visual Bible -> conceptual metaphors -> consistent image prompts.

STEP A — VISUAL BIBLE (one for the whole video)
Decide a single coherent visual world that fits the WHOLE script. Lock it down:
- style (e.g. "Cinematic photoreal documentary")
- time_period (e.g. "Late Bronze Age, ~1200 BCE" or "Near-future 2045")
- location_world (one specific world the story lives in)
- color_palette (3-5 named colors, must match the user's palette hint when sensible)
- lighting (single recurring lighting language)
- camera_style (one consistent grammar)
- realism_level ("photoreal" | "stylized illustration" | "painterly" | "anime")
- culture_influence
- recurring_motifs (3-6 visual motifs that reappear across frames — props, materials, textures, shapes)
- avoid (forbidden worlds/eras/aesthetics — what would break consistency)

The bible is GLOBAL. Every frame must obey it. Do NOT jump between unrelated worlds (no mixing ancient vaults, icebergs, cyberpunk cities, temples unless the bible explicitly allows it).

STEP B — INTELLIGENT IDEA-BASED SEGMENTATION
Read the ENTIRE script and split it into "visual idea groups" at NATURAL BREAKS:
- topic shift, emotional shift, location shift, example shift, argument shift, metaphor shift, scene/action shift.

RULES:
- A segment may be 1 sentence or 20 sentences. Length MUST vary. NEVER split by fixed length.
- Each segment text must be a CONTIGUOUS verbatim slice of the cleaned script (no rewriting, no reshuffling, preserve original wording).
- Concatenating all segment.text in order must reconstruct the cleaned script (you may drop pure whitespace).
- Aim for roughly ${targetCount} segments (±40%). Prefer fewer, meatier segments over many tiny ones.
- Never split mid-sentence.

STEP C — PER-SEGMENT VISUAL PLAN
For each segment produce:
- summary: 1 short line, what this segment is really about
- emotional_tone: 1-3 words
- visual_purpose: what this image must accomplish in the sequence
- conceptual_metaphor: ONE concrete photographable scene that lives inside the Visual Bible — never echo the segment text, never use abstract nouns, no on-screen text. 1-2 sentences, shorter than the segment.
- image_prompt: a full director-ready prompt that bakes in the Visual Bible (style + world + palette + lighting + camera + recurring motifs) + the conceptual metaphor + continuity with previous frame. 40-80 words. No text/letters/logos/captions.
- negative_prompt: short, frame-specific negatives in addition to global ones
- camera_angle: pick exactly one of ${CAMERA_KEYS.join(" | ")}
- previous_image_dependency: true if this frame should visually continue the previous frame's world/lighting/subject (almost always true)

STEP D — CONTINUITY
Every image_prompt must share: same world, same style, same lighting language, same camera grammar, recurring motifs, consistent subject scale. The viewer must feel one director shot every frame.

OUTPUT — STRICT JSON ONLY, this exact schema:
{
  "visual_bible": {
    "style": "", "time_period": "", "location_world": "", "color_palette": "",
    "lighting": "", "camera_style": "", "realism_level": "", "culture_influence": "",
    "recurring_motifs": [], "avoid": []
  },
  "segments": [
    {
      "segment_id": "seg-1",
      "text": "<verbatim slice of cleaned script>",
      "summary": "",
      "emotional_tone": "",
      "visual_purpose": "",
      "conceptual_metaphor": "",
      "image_prompt": "",
      "negative_prompt": "",
      "camera_angle": "Epic Wide Shot (Scale)",
      "previous_image_dependency": true
    }
  ]
}`;

    const user = `TITLE: ${title || "(untitled)"}
USER STYLE HINT: ${globalStyle}
USER PALETTE HINT: ${globalPalette}
USER AMBIANCE HINT: ${globalAmbiance}
USER ENGINE HINT: ${globalEngine}
TARGET SEGMENT COUNT: ~${targetCount} (you may deviate ±40% to honor natural idea breaks)

CLEANED SCRIPT (no timestamps, no section labels):
"""
${scriptText}
"""

Plan the Visual Bible and segment the script by IDEA SHIFTS. Return STRICT JSON matching the schema. Segment.text must be verbatim contiguous slices of the cleaned script.`;

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
        max_tokens: 16384,
        temperature: 0.75,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return json({ error: `AI gateway ${r.status}: ${t}` }, 502);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    const parsed: any = parseJsonObject(content);
    const bible = parsed.visual_bible || {};
    const rawSegs: any[] = Array.isArray(parsed.segments) ? parsed.segments : [];
    if (!rawSegs.length) return json({ error: "AI returned no segments. Try again." }, 502);

    const visual_bible = {
      style: String(bible.style ?? globalStyle),
      time_period: String(bible.time_period ?? ""),
      location_world: String(bible.location_world ?? ""),
      color_palette: String(bible.color_palette ?? globalPalette),
      lighting: String(bible.lighting ?? globalAmbiance),
      camera_style: String(bible.camera_style ?? ""),
      realism_level: String(bible.realism_level ?? "photoreal"),
      culture_influence: String(bible.culture_influence ?? ""),
      recurring_motifs: Array.isArray(bible.recurring_motifs) ? bible.recurring_motifs.map(String).slice(0, 8) : [],
      avoid: Array.isArray(bible.avoid) ? bible.avoid.map(String).slice(0, 10) : [],
    };

    const frames = rawSegs.map((s, i) => {
      const cam = CAMERA_KEYS.includes(s.camera_angle) ? s.camera_angle : CAMERA_KEYS[i % CAMERA_KEYS.length];
      return {
        segment_id: String(s.segment_id ?? `seg-${i + 1}`),
        sourceText: String(s.text ?? "").trim(),
        summary: String(s.summary ?? "").trim(),
        emotional_tone: String(s.emotional_tone ?? "").trim(),
        visual_purpose: String(s.visual_purpose ?? "").trim(),
        conceptualPrompt: String(s.conceptual_metaphor ?? "").trim(),
        imagePrompt: String(s.image_prompt ?? "").trim(),
        negativePrompt: String(s.negative_prompt ?? "").trim(),
        cameraAngle: cam,
        previous_image_dependency: s.previous_image_dependency !== false,
      };
    }).filter((f) => f.sourceText.length > 0);

    return json({ visual_bible, frames });
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