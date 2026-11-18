import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM = `You are an elite YouTube long-form scriptwriter. Given a title, tone, duration, hook style, and language, write a high-retention script structured into clearly timed sections.
Return STRICT JSON only.`;

const explainerPlan = z.object({
  scenes: z.array(z.object({
    line: z.string().trim().min(1).max(600),
    prompt: z.string().trim().min(1).max(2200),
    label: z.string().trim().min(1).max(100),
    diagram: z.object({
      kind: z.enum(["flow", "comparison", "sequence"]),
      labels: z.array(z.string().trim().min(1).max(32)).length(3),
    }).optional().catch(undefined),
  })).length(6),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("TOGETHER_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const { title, tone, duration, hook, language, explainerBrief } = await req.json().catch(() => ({}));
    const shortFilm = explainerBrief !== undefined;
    if (shortFilm && (typeof explainerBrief !== "string" || !explainerBrief.trim())) {
      return json({ error: "Enter a video brief and retry." }, 400);
    }
    if (!shortFilm && (typeof title !== "string" || !title.trim())) return json({ error: "Enter a title or topic and retry." }, 400);
    const userPrompt = shortFilm ? `Write a one-minute illustrated explainer based on this creative brief:
${explainerBrief.slice(0, 5000)}
Output JSON with a title and exactly six scenes. Each scene has a line (16–21 spoken words), a prompt (one concrete shadow cutout illustration with consistent characters and palette), a label (a short takeaway, four words maximum), and a diagram with kind ("flow", "comparison", or "sequence") and exactly three short labels (up to 14 characters each) specific to the idea. Return diagram as {kind, labels}. Make each scene advance the explanation. Use examples from the brief accurately.` : `Title: """${String(title).slice(0, 300)}"""
Tone: ${tone || "Engaging & Dramatic"}
Duration: ${duration || "8-10 min"}
Hook style: ${hook || "Shocking Fact"}
Language: ${language || "English"}

Write a full script. Reply with ONLY this JSON:
{
  "sections": [
    { "section": "HOOK (0:00 - 0:30)", "text": "..." },
    { "section": "CONTEXT (0:30 - 2:00)", "text": "..." },
    { "section": "RISING ACTION (2:00 - 5:00)", "text": "..." },
    { "section": "CLIMAX (5:00 - 8:00)", "text": "..." },
    { "section": "RESOLUTION (8:00 - 10:00)", "text": "..." }
  ],
  "meta": { "words": number, "minutes": number, "retention": number }
}
Each section text should be a punchy paragraph (80-160 words). Adjust section timestamps to match the requested duration.`;

    const r = await fetch("https://api.together.xyz/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V4.1-Flash",
        messages: [{ role: "system", content: shortFilm ? "Direct a clear illustrated short film. Return strict JSON with title and scenes, each containing line, prompt and label." : SYSTEM }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return json({ error: "Rate limit exceeded." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!r.ok) { console.error(await r.text()); return json({ error: "AI request failed" }, 502); }
    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      try {
        parsed = extractJson(content);
      } catch (e) {
        console.error("Invalid JSON from AI:", content);
        return json({ error: "AI returned invalid JSON" }, 502);
      }
    }
    if (shortFilm) {
      const result = explainerPlan.safeParse(parsed);
      if (!result.success) {
        return json({ error: "The planner returned an incomplete scene list. Click Generate film to try again." }, 502);
      }
      return json(result.data);
    }
    return json(parsed);
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function extractJson(raw: string): unknown {
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = s.search(/[\{\[]/);
  const open = s[start];
  const close = open === "[" ? "]" : "}";
  const end = s.lastIndexOf(close);
  if (start === -1 || end === -1) throw new Error("No JSON found");
  s = s.substring(start, end + 1);
  try { return JSON.parse(s); } catch {
    s = s.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(s);
  }
}