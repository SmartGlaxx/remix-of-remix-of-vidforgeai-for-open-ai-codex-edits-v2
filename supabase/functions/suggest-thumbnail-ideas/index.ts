import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI gateway not configured" }, 500);
    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim().slice(0, 240);
    if (!title) return json({ error: "title is required" }, 400);
    const style = String(body.style ?? "").trim().slice(0, 80);
    const videoStyle = String(body.video_style ?? "").trim().slice(0, 80);

    const sys = "You design YouTube thumbnails that maximise click-through. Return only the requested JSON.";
    const user = [
      `Video title: "${title}".`,
      style ? `Thumbnail style preset: ${style}.` : "",
      videoStyle ? `Video visual style: ${videoStyle}.` : "",
      `Return 3 DISTINCT thumbnail scene description options (each 1-2 sentences, vivid, concrete subjects/lighting/composition — NO text mentions) and ONE bold short text overlay (1-4 words, ALL CAPS, punchy, derived from the title).`,
    ].filter(Boolean).join(" ");

    const tools = [{
      type: "function",
      function: {
        name: "suggest_thumbnail",
        description: "Return thumbnail descriptions and overlay text.",
        parameters: {
          type: "object",
          properties: {
            descriptions: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
            text_overlay: { type: "string" },
          },
          required: ["descriptions", "text_overlay"],
          additionalProperties: false,
        },
      },
    }];

    const r = await fetch(LOVABLE_AI, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        tools,
        tool_choice: { type: "function", function: { name: "suggest_thumbnail" } },
      }),
    });
    if (r.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted." }, 402);
    const data = await r.json();
    if (!r.ok) return json({ error: "AI gateway error", details: data }, 500);
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = typeof args === "string" ? JSON.parse(args) : args;
    return json({
      descriptions: parsed?.descriptions ?? [],
      text_overlay: parsed?.text_overlay ?? "",
    });
  } catch (e) {
    console.error("suggest-thumbnail-ideas error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}