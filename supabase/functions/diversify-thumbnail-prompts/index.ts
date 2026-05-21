import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_AI = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI gateway not configured" }, 500);
    const body = await req.json().catch(() => ({}));
    const title = String(body.title ?? "").trim().slice(0, 240);
    const description = String(body.description ?? "").trim().slice(0, 800);
    const overlay = String(body.text_overlay ?? "").trim().slice(0, 80);
    const styleName = String(body.style ?? "").trim().slice(0, 80);
    const videoStyle = String(body.video_style ?? "").trim().slice(0, 80);
    const count = Math.max(2, Math.min(8, Number(body.count) || 4));

    const sys = "You are a thumbnail art director. Produce maximally DIFFERENT scene directions. Return only requested JSON.";
    const user = [
      `Video title: "${title}".`,
      `Thumbnail description: ${description}.`,
      overlay ? `Text overlay shown on thumbnail: "${overlay}".` : "",
      styleName ? `Thumbnail style preset: ${styleName}.` : "",
      videoStyle ? `Underlying video visual style: ${videoStyle}.` : "",
      `Produce ${count} DIFFERENT scene directions. Each must vary in: framing (close-up/wide/over-the-shoulder/top-down/etc), camera angle, focal subject placement, lighting (golden hour/blue hour/neon/studio/dramatic shadow/etc), color palette, mood, and composition. Every direction MUST reference the title's subject, complement the description, and leave clear space for the overlay text. Each direction: 1-2 sentences, concrete and vivid, no text-on-image instructions.`,
    ].filter(Boolean).join(" ");

    const tools = [{
      type: "function",
      function: {
        name: "diversify",
        description: "Return distinct scene directions.",
        parameters: {
          type: "object",
          properties: {
            directions: { type: "array", minItems: count, maxItems: count, items: { type: "string" } },
          },
          required: ["directions"],
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
        tool_choice: { type: "function", function: { name: "diversify" } },
      }),
    });
    if (r.status === 429) return json({ error: "Rate limited, try again shortly." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted." }, 402);
    const data = await r.json();
    if (!r.ok) return json({ error: "AI gateway error", details: data }, 500);
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = typeof args === "string" ? JSON.parse(args) : args;
    return json({ directions: parsed?.directions ?? [] });
  } catch (e) {
    console.error("diversify-thumbnail-prompts error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}