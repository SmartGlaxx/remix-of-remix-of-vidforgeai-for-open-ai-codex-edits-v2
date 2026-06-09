import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TOGETHER_API_KEY = Deno.env.get("TOGETHER_API_KEY") || "tgp_v1_BfPNWsyln0I2bD9bSbrMNhpFXmnKj93uzHwt_1jEJ5M";
const TOGETHER_MODEL = "black-forest-labs/FLUX.2-dev";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!TOGETHER_API_KEY) {
      return json({ error: "Image generation backend is not configured" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return json({ error: "prompt is required" }, 400);
    if (prompt.length > 2500) return json({ error: "prompt is too long" }, 400);

    const style = safeText(body.style, "Cinematic");
    const aspectRatio = safeText(body.aspect_ratio, "16:9");
    const quality = safeText(body.quality, "HD");
    const motion = safeText(body.motion, "Static");
    const index = Number.isFinite(Number(body.index)) ? Number(body.index) : 0;

    const dims = aspectRatio === "9:16" ? { width: 768, height: 1344 }
      : aspectRatio === "1:1" ? { width: 1024, height: 1024 }
      : { width: 1344, height: 768 };

    const cleanPrompt = sanitizePrompt(prompt);
    const preset = STYLE_PRESETS[style] ?? STYLE_PRESETS["Cinematic"];

    const finalPrompt = [
      preset.prompt,
      cleanPrompt,
      `Aspect ratio ${aspectRatio}.`,
      motion === "Static" ? "Static image, no camera movement, no animation." : `Motion direction: ${motion}.`,
      "Absolutely no text, letters, words, numbers, captions, typography, signs, logos, or watermarks anywhere in the frame.",
    ].join(" ");

    // call together ai flux.2-dev with exponential backoff on 429s
    const maxAttempts = 6;
    let r: Response | null = null;
    let data: any = {};
    let lastErr = "Image generation failed";
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      r = await fetch("https://api.together.xyz/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOGETHER_API_KEY}`,
        },
        body: JSON.stringify({
          model: TOGETHER_MODEL,
          prompt: finalPrompt,
          width: dims.width,
          height: dims.height,
          n: 1,
          steps: preset.steps ?? 28,
        }),
      });

      data = await r.json().catch(() => ({}));
      if (r.ok && !data?.error) break;

      lastErr = data?.error?.message || data?.error || `HTTP ${r.status}`;
      const isRate = r.status === 429 || /rate|too many/i.test(String(lastErr));
      if (!isRate || attempt === maxAttempts - 1) {
        return json({ error: lastErr }, 502);
      }
      const resetHeader = Number(r.headers.get("x-ratelimit-reset")) || 0;
      const base = Math.max(resetHeader * 1000, 1500 * Math.pow(2, attempt));
      const jitter = Math.floor(Math.random() * 750);
      await new Promise((res) => setTimeout(res, base + jitter));
    }
    if (!r || !r.ok) return json({ error: lastErr }, 502);

    const imageUrl = data?.data?.[0]?.url;
    if (!imageUrl) return json({ error: "No image URL returned" }, 502);

    return json({
      image_url: imageUrl,
      url: imageUrl,
      status: "COMPLETED",
      prompt: finalPrompt,
    });
  } catch (e) {
    console.error("generate-visual error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function safeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 80) || fallback;
}

const STYLE_PRESETS: Record<string, { prompt: string; negative_prompt: string; cfg_scale: number; steps: number }> = {
  "Cinematic": {
    prompt: "Pure landscape photography only. Sweeping cinematic landscape, vast natural scenery, mountains, valleys, forests, oceans, skies, or open terrain. Wide establishing shot, no people, no characters, no human figures, no portraits, no faces. Vivid natural colors, golden hour or dramatic lighting, ultra sharp focus, professional landscape photography, ultra wide angle, epic vista, atmospheric depth.",
    negative_prompt: "people, person, man, woman, child, human, figure, portrait, face, body, character, crowd, silhouette of person",
    cfg_scale: 5.0,
    steps: 28,
  },
  "Documentary": {
    prompt: "Authentic documentary photography, focus on the subject matter and environment, natural daylight, real world setting, National Geographic quality, vivid colors, sharp detail, wide angle, show the actual topic described.",
    negative_prompt: "",
    cfg_scale: 4.5,
    steps: 28,
  },
  "Comic Book": {
    prompt: "Vivid comic book illustration, bold colors, clean ink linework, dynamic composition, action pose, bright contrasting palette, professional graphic novel quality.",
    negative_prompt: "",
    cfg_scale: 6.5,
    steps: 28,
  },
  "Anime": {
    prompt: "Beautiful anime illustration, vibrant colors, clean line art, detailed background scenery, expressive characters, bright atmospheric lighting, high quality anime art.",
    negative_prompt: "",
    cfg_scale: 6.0,
    steps: 28,
  },
  "Oil Painting": {
    prompt: "Classical oil painting, rich vivid pigments, visible brush strokes, warm natural lighting, beautiful composition, museum quality fine art, detailed and colorful.",
    negative_prompt: "",
    cfg_scale: 5.5,
    steps: 28,
  },
  "3D Render": {
    prompt: "Photorealistic 3D render, clean studio lighting, global illumination, sharp details, vibrant materials, professional product visualization, high fidelity.",
    negative_prompt: "",
    cfg_scale: 6.0,
    steps: 28,
  },
};

function sanitizePrompt(raw: string): string {
  let s = raw;
  // strip section labels like "HOOK (0:00 - 0:30)" or "RISING ACTION (2:00 - 5:00)"
  s = s.replace(/\b(HOOK|CONTEXT|RISING\s+ACTION|CLIMAX|RESOLUTION|INTRO|OUTRO|CONCLUSION)\s*\([^)]*\)/gi, "");
  // strip standalone section labels
  s = s.replace(/\b(HOOK|CONTEXT|RISING\s+ACTION|CLIMAX|RESOLUTION|INTRO|OUTRO|CONCLUSION)\b/gi, "");
  // strip timestamps like (0:00 - 0:30)
  s = s.replace(/\(\d+:\d+\s*-\s*\d+:\d+\)/g, "");
  s = s.replace(/\b(video\s+title|title|overlay|caption|headline|subtitle|label|text)\s*:\s*[^.]*\.?/gi, "");
  s = s.replace(/["""„‟"'''`][^"""„‟"'''`]{1,120}["""„‟"'''`]/g, "");
  s = s.replace(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,})\b/g, "");
  s = s.replace(/\b(text|letters?|words?|captions?|subtitles?|titles?|headlines?|typography|logos?|watermarks?)\b/gi, "");
  return s.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
