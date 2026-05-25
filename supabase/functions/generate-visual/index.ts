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

    const seed = body.seed ?? Math.floor(Date.now() / 1000) + index;

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
          seed,
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
    prompt: "Master shot film still, dramatic side-lit cinematic portrait, raw tactile skin texture, anamorphic lens flare, vintage 35mm Arri Alexa grain, volumetric atmosphere, split-toning, cinematic dark ambiance, deep shadows, micro-contrast, masterpiece composition.",
    negative_prompt: "",
    cfg_scale: 5.0,
    steps: 28,
  },
  "Documentary": {
    prompt: "Award-winning photojournalism, authentic candid moment, sharp subject focus, natural overcast daytime lighting, harsh environmental textures, shallow depth of field, National Geographic aesthetic, high fidelity raw scan, lifelike expressions.",
    negative_prompt: "",
    cfg_scale: 4.5,
    steps: 28,
  },
  "Comic Book": {
    prompt: "Premium graphic novel splash page, heavy ink linework, stylized dramatic chiaroscuro shadows, authentic retro Ben-Day dot screen-tones, dynamic action composition, high-contrast ink wash, gritty noir comic aesthetic, masterfully drawn, crisp ink edges.",
    negative_prompt: "",
    cfg_scale: 6.5,
    steps: 28,
  },
  "Anime": {
    prompt: "Theatrical anime cel animation frame, hand-painted gouache background scenery, crisp line art, beautiful light scattering, chromatic aberration, emotional lighting, cinematic anime masterpiece, intricate details, highly atmospheric, key animation quality.",
    negative_prompt: "",
    cfg_scale: 6.0,
    steps: 28,
  },
  "Oil Painting": {
    prompt: "Fine art museum masterpiece, thick impasto oil painting, visible heavy palette knife textures, cracked dried oil glaze layers, classic Baroque chiaroscuro lighting, rich deep pigments, dramatic classical composition, textured canvas visible, high artistic fidelity.",
    negative_prompt: "",
    cfg_scale: 5.5,
    steps: 28,
  },
  "3D Render": {
    prompt: "Photorealistic 3D asset showcase, ultra-precise Octane render, global illumination, raytraced sub-surface scattering, microscopic material imperfections, high-fidelity subsurface displacement map, pristine industrial design, flawless geometric shadows, cinematic studio product render.",
    negative_prompt: "",
    cfg_scale: 6.0,
    steps: 28,
  },
};

function sanitizePrompt(raw: string): string {
  let s = raw;
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
