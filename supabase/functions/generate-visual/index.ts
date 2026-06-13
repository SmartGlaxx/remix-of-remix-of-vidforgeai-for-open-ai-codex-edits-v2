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
    const ambiance = safeText(body.ambiance, "Neutral & Realistic");
    const camera = safeText(body.camera, "Epic Wide Shot (Scale)");
    const engine = safeText(body.engine, "IMAX Hollywood Quality");
    const palette = safeText(body.palette, "Teal & Tangerine");
    const index = Number.isFinite(Number(body.index)) ? Number(body.index) : 0;
    const bible = (body.visual_bible && typeof body.visual_bible === "object") ? body.visual_bible : null;
    const extraNegative = typeof body.negative_prompt === "string" ? body.negative_prompt.slice(0, 600) : "";
    const usePromptAsIs = body.use_prompt_as_is === true; // when image_prompt already includes bible

    const dims = aspectRatio === "9:16" ? { width: 768, height: 1344 }
      : aspectRatio === "1:1" ? { width: 1024, height: 1024 }
      : { width: 1344, height: 768 };

    const cleanPrompt = sanitizePrompt(prompt);
    const stylePreset = PRESET_STYLE[style] ?? PRESET_STYLE["Cinematic"];
    const ambiancePreset = AMBIANCE[ambiance] ?? AMBIANCE["Neutral & Realistic"];
    const cameraPreset = CAMERA[camera] ?? CAMERA["Epic Wide Shot (Scale)"];
    const enginePreset = ENGINE[engine] ?? ENGINE["IMAX Hollywood Quality"];
    const palettePreset = PALETTE[palette] ?? PALETTE["Teal & Tangerine"];

    // Visual Bible anchor — forces consistency across the whole sequence.
    const bibleAnchor = bible ? [
      bible.style && `Visual style: ${bible.style}`,
      bible.time_period && `Time period: ${bible.time_period}`,
      bible.location_world && `World: ${bible.location_world}`,
      bible.color_palette && `Palette: ${bible.color_palette}`,
      bible.lighting && `Lighting: ${bible.lighting}`,
      bible.camera_style && `Camera grammar: ${bible.camera_style}`,
      bible.realism_level && `Realism: ${bible.realism_level}`,
      bible.culture_influence && `Culture: ${bible.culture_influence}`,
      Array.isArray(bible.recurring_motifs) && bible.recurring_motifs.length && `Recurring motifs: ${bible.recurring_motifs.join(", ")}`,
    ].filter(Boolean).join(". ") : "";

    // If the AI already authored a full image_prompt that bakes in the bible,
    // skip duplicating style/camera/palette presets so we don't bloat the prompt.
    const finalPrompt = usePromptAsIs
      ? [bibleAnchor, cleanPrompt].filter(Boolean).join(". ")
      : [
          cleanPrompt,
          bibleAnchor,
          stylePreset,
          ambiancePreset,
          cameraPreset,
          enginePreset,
          palettePreset,
        ].filter(Boolean).join(", ");

    const bibleNegatives = bible && Array.isArray(bible.avoid) && bible.avoid.length
      ? bible.avoid.join(", ")
      : "";
    const negativePrompt = [UNIVERSAL_NEGATIVE, bibleNegatives, extraNegative].filter(Boolean).join(", ");

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
          negative_prompt: negativePrompt,
          width: dims.width,
          height: dims.height,
          n: 1,
          steps: 28,
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
      negative_prompt: negativePrompt,
    });
  } catch (e) {
    console.error("generate-visual error:", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});

function safeText(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.slice(0, 120) || fallback;
}

const PRESET_STYLE: Record<string, string> = {
  "Cinematic": "Masterpiece, captured on 35mm anamorphic lens, shallow depth of field, natural highlights, intricate textures, volumetric atmosphere, cinematic storytelling composition, 8k resolution",
  "Documentary": "Photojournalism style, candid moment, unedited raw photograph, street photography aesthetic, authentic textures, high contrast, documentary film grain",
  "Comic Book": "Graphic novel illustration, dynamic action lines, cel-shaded, vibrant ink work, stylized digital art, high-impact composition, bold outlines, modern webtoon aesthetic",
  "Anime": "Hand-drawn premium anime aesthetic, hyper-detailed backgrounds, emotional lighting, beautiful color gradient sky, fluid visual flow",
  "Oil Painting": "Impressionist oil on canvas, heavy impasto texture, visible palette knife strokes, classical fine art, rich pigment layers, museum-tier masterpiece composition, artistic chiaroscuro",
  "3D Render": "Ray-traced 3D graphic, Unreal Engine 5 render, Octane Render, hyper-detailed subsurface scattering, metallic and glass textures, futuristic digital art, flawless geometric depth",
  "Vintage Cyber-Pop": "1980s retro-futurism, synthwave aesthetic, VHS glitch texture, analog film distortion, neon wireframes, highly stylized nostalgia",
  "Editorial Fashion": "Vogue editorial cover style, high-fashion studio photography, avant-garde composition, perfect symmetry, razor-sharp focus on luxury fabric textures and skin details",
};

const AMBIANCE: Record<string, string> = {
  "Light & Vibrant": "High-key lighting, soft morning sun, warm lens flare, optimistic tone, bright exposed highlights, radiant glow",
  "Neutral & Realistic": "Balanced diffuse lighting, true-to-life color grading, realistic exposure, standard environmental reflections, natural color palette",
  "Dark & Somber": "Low-key lighting, heavy dramatic shadows, neo-noir undertones, deep moody atmosphere, single-source illumination, mysterious tone",
};

const CAMERA: Record<string, string> = {
  "Dynamic First-Person (Action)": "First-person point-of-view perspective, immersive action angle, low to the ground tracking shot, wide-angle distortion, high-octane composition",
  "Cinematic Close-Up (Emotion)": "Extreme macro close-up, tight framing, intimate details, shallow depth of field, crisp focus on textures, emotional character depth",
  "Low-Angle Heroic (Power)": "Low-angle worm's-eye view, dramatic upward perspective, powerful scale, heroic camera stance, looking up at the focal point",
  "Epic Wide Shot (Scale)": "Extreme wide-angle establishing shot, sweeping vista, massive sense of scale, rule of thirds layout, atmospheric depth",
  "Dutch Angle (Tension)": "Tilted frame, dramatic Dutch angle, asymmetrical composition, high psychological tension, unexpected off-axis perspective",
};

const ENGINE: Record<string, string> = {
  "IMAX Hollywood Quality": "Arri Alexa LF camera body, Panavision Primo lenses, ultra-crisp resolution, flawless edge-to-edge sharpness, high-end production budget look",
  "Analog Film Nostalgia": "Shot on Kodachrome 64, 120mm medium format film, subtle grain, organic color bleeding, slight vintage chromatic aberration",
  "CGI Hyper-Realism": "Redshift renderer, V-Ray illumination architecture, physically-based rendering (PBR), meticulously simulated physical materials, raytraced accuracy",
  "National Geographic Raw": "Native uncompressed RAW file, zero post-processing artifacts, extreme environmental weather-sealing texture, natural atmospheric distortion",
};

const PALETTE: Record<string, string> = {
  "Cyberpunk Neon": "Electric cyan, hot magenta, and deep violet colorway, intense color contrast, glowing neon accents, high saturation",
  "Teal & Tangerine": "Hollywood teal and orange color grading, complementary color harmony, cinematic block-buster palette, rich skin tones",
  "Monochromatic Noir": "High-contrast black and white, deep silvers, rich charcoal blacks, pure stark whites, elegant timeless tonal gradient",
  "Earthy Pastel": "Muted sage greens, warm terracottas, soft beige, desaturated pastel tones, organic earth-inspired color harmony",
};

const UNIVERSAL_NEGATIVE = "text, typography, words, letters, alphabet, script, logo, watermark, signature, banner, UI, stamps, titles, blurred background elements, distorted anatomy, extra limbs, fused fingers, duplicate objects, static pose, deformed face, mirrored image";

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
