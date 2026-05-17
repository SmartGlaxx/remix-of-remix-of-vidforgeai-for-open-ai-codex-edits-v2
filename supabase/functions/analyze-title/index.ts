import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM = `You are a senior YouTube growth strategist who has analyzed millions of viral videos.
Given a user topic or seed title, you produce 4 distinct, high-CTR title candidates and honest SEO insights.
Scoring rubric (0-100):
- Curiosity gap (open loop)
- Specificity & numbers
- Emotional hook (shock, awe, fear, curiosity)
- Search keyword strength
- Length (40-65 chars optimal)

Estimate views as a range string like "1.2M" or "850K" based on niche realism — DO NOT inflate.
Estimate CTR as a percent string like "12.4%". Top viral titles cluster 10-16%; weak ones 3-6%.
Language must match the input language.
Return STRICT JSON only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const { topic } = await req.json().catch(() => ({}));
    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      return json({ error: "Topic must be at least 3 characters" }, 400);
    }

    const userPrompt = `Topic / seed: """${topic.trim().slice(0, 500)}"""

Generate 4 title candidates and SEO insights. Reply with ONLY this JSON shape:
{
  "titles": [
    { "title": string, "score": number, "views": string, "ctr": string, "language": string, "reason": string }
  ],
  "seo": {
    "competition": "Low" | "Medium" | "High",
    "search_volume": string,
    "trending": "↑ Rising" | "→ Steady" | "↓ Declining",
    "primary_keyword": string,
    "notes": string
  }
}`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (r.status === 429) return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted. Add credits in Workspace settings." }, 402);
    if (!r.ok) {
      const txt = await r.text();
      console.error("AI error", r.status, txt);
      return json({ error: "AI request failed" }, 502);
    }

    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: unknown;
    try { parsed = JSON.parse(content); } catch {
      return json({ error: "AI returned invalid JSON" }, 502);
    }

    return json(parsed);
  } catch (e) {
    console.error("analyze-title error", e);
    return json({ error: String((e as Error).message) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}