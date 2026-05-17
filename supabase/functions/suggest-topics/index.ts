import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI not configured" }, 500);

    const seed = Math.random().toString(36).slice(2, 8);
    const userPrompt = `Generate 3 fresh, distinct, scroll-stopping YouTube video topic ideas across different niches (history, science, tech, true crime, business, culture). Each topic should be 5-9 words, written like a search query a curious viewer would type. Avoid clichés. Variety seed: ${seed}.

Reply with ONLY this JSON: { "topics": [string, string, string] }`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (r.status === 429) return json({ error: "Rate limit" }, 429);
    if (!r.ok) return json({ error: "AI request failed" }, 502);
    const data = await r.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { topics?: string[] };
    try { parsed = JSON.parse(content); } catch { return json({ error: "Invalid JSON" }, 502); }
    const topics = (parsed.topics ?? []).slice(0, 3);
    return json({ topics });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}