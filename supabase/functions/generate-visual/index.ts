import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const RUNPOD_BASE = "https://api.runpod.ai/v2";
// The unified gateway has been unreliable (no available workers), so we call
// the Z-Image endpoint directly. The client still polls via runpod-gateway
// status action which works against any endpoint_id.
const ZIMAGE_ENDPOINT_ID = Deno.env.get("ZIMAGE_ENDPOINT_ID") || "a6cjdpnprs4r1c";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const RUNPOD_API_KEY = Deno.env.get("RUNPOD_API_KEY");
    if (!RUNPOD_API_KEY) {
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

    // Map aspect ratio → explicit hi-res dimensions so Z-Image stops
    // returning 512×512 thumbnails. These are the user-requested defaults.
    const dims = aspectRatio === "9:16" ? { width: 768, height: 1344 }
      : aspectRatio === "1:1" ? { width: 1024, height: 1024 }
      : { width: 1344, height: 768 }; // default 16:9

    // Hard-strip ANY textual / titular content from the incoming prompt so the
    // diffusion model never tries to render letters (the #1 cause of gibberish).
    const cleanPrompt = sanitizePrompt(prompt);

    const preset = STYLE_PRESETS[style] ?? STYLE_PRESETS["Cinematic"];

    const finalPrompt = [
      preset.prompt,
      cleanPrompt,
      `Aspect ratio ${aspectRatio}.`,
      motion === "Static" ? "Static image, no camera movement, no animation." : `Motion direction: ${motion}.`,
      "Absolutely no text, letters, words, numbers, captions, typography, signs, logos, or watermarks anywhere in the frame.",
    ].join(" ");

    const negativePrompt = [
      preset.negative_prompt,
      // Always-on anti-text / anti-low-quality guardrails
      "text, letters, words, numbers, captions, subtitles, typography, glyphs, alphabet, fonts",
      "signs, signage, labels, watermarks, logos, brand marks, channel names, UI overlays, subtitle bar",
      "book pages with readable text, screens with readable text, newspaper text",
      "blurry, low-res, low resolution, jpeg artifacts, banding, compression artifacts, soft focus, noisy, pixelated, deformed",
    ].join(", ");

    // Submit directly to the Z-Image endpoint (bypassing the gateway).
    const r = await fetch(`${RUNPOD_BASE}/${ZIMAGE_ENDPOINT_ID}/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          prompt: finalPrompt,
          negative_prompt: negativePrompt,
          aspect_ratio: aspectRatio,
          quality: "ultra",
          width: dims.width,
          height: dims.height,
          num_inference_steps: Math.max(preset.steps ?? 8, 8),
          guidance_scale: preset.cfg_scale ?? 6.0,
          cfg_scale: preset.cfg_scale ?? 6.0,
          steps: preset.steps ?? 8,
          seed: body.seed ?? Math.floor(Date.now() / 1000) + index,
        },
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: data?.error || "RunPod image request failed", details: data }, r.status);
    if (data?.error) return json({ error: data.error, details: data }, 502);

    return json({
      job_id: data?.id,
      endpoint_id: ZIMAGE_ENDPOINT_ID,
      status: data?.status || "IN_QUEUE",
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

// Style-specific prompt presets engineered for Z-Image to beat Nano Banana 2.
// Each preset injects industry-grade vocabulary that pushes the diffusion model
// toward authentic texture / lighting / medium fidelity for that style.
const STYLE_PRESETS: Record<string, { prompt: string; negative_prompt: string; cfg_scale: number; steps: number }> = {
  "Cinematic": {
    prompt: "Master shot film still, dramatic side-lit cinematic portrait, raw tactile skin texture, anamorphic lens flare, vintage 35mm Arri Alexa grain, volumetric atmosphere, split-toning, cinematic dark ambiance, deep shadows, micro-contrast, masterpiece composition.",
    negative_prompt: "3d render, CGI, airbrushed skin, plastic texture, synthetic lighting, vector art, smooth, perfect skin, cartoon",
    cfg_scale: 5.0,
    steps: 8,
  },
  "Documentary": {
    prompt: "Award-winning photojournalism, authentic candid moment, sharp subject focus, natural overcast daytime lighting, harsh environmental textures, shallow depth of field, subtle motion blur on edges, National Geographic aesthetic, high fidelity raw scan, lifelike expressions.",
    negative_prompt: "studio lighting, glamorous, posed, makeup, studio backdrop, hyper-saturated, clean, commercial, pristine",
    cfg_scale: 4.5,
    steps: 7,
  },
  "Comic Book": {
    prompt: "Premium graphic novel splash page, heavy ink linework, stylized dramatic chiaroscuro shadows, authentic retro Ben-Day dot screen-tones, dynamic action composition, high-contrast ink wash, gritty noir comic aesthetic, masterfully drawn, crisp ink edges.",
    negative_prompt: "3d render, photorealism, blurry texture, watercolor, messy sketch, digital airbrush, blended gradients, smooth",
    cfg_scale: 6.5,
    steps: 9,
  },
  "Anime": {
    prompt: "Theatrical anime cel animation frame, hand-painted gouache background scenery, crisp line art, beautiful light scattering, chromatic aberration, emotional lighting, cinematic anime masterpiece, intricate details, highly atmospheric, key animation quality.",
    negative_prompt: "3d, CGI, photorealistic, low-quality fanart, messy lines, bad anatomy, blurry backdrop, rough sketch",
    cfg_scale: 6.0,
    steps: 8,
  },
  "Oil Painting": {
    prompt: "Fine art museum masterpiece, thick impasto oil painting, visible heavy palette knife textures, cracked dried oil glaze layers, classic Baroque chiaroscuro lighting, rich deep pigments, dramatic classical composition, textured canvas visible, high artistic fidelity.",
    negative_prompt: "digital art, smooth render, photography, photograph, clean vector, 3d render, airbrush, glossy, flat colors",
    cfg_scale: 5.5,
    steps: 9,
  },
  "3D Render": {
    prompt: "Photorealistic 3D asset showcase, ultra-precise Octane render, global illumination, raytraced sub-surface scattering, microscopic material imperfections, high-fidelity subsurface displacement map, pristine industrial design, flawless geometric shadows, cinematic studio product render.",
    negative_prompt: "2d drawing, painting, flat shading, low-poly, bad topology, blurry textures, amateur sketch, noise, film grain",
    cfg_scale: 6.0,
    steps: 8,
  },
};

function sanitizePrompt(raw: string): string {
  let s = raw;
  // Drop "Video title: ..." / "Overlay: ..." / "Caption: ..." labels and the
  // sentence that follows up to the next period.
  s = s.replace(/\b(video\s+title|title|overlay|caption|headline|subtitle|label|text)\s*:\s*[^.]*\.?/gi, "");
  // Drop anything in quotes — diffusion models often try to render quoted text.
  s = s.replace(/["“”„‟"'‘’`][^"“”„‟"'‘’`]{1,120}["“”„‟"'‘’`]/g, "");
  // Drop ALL-CAPS runs of 2+ words (headline-style fragments).
  s = s.replace(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,})\b/g, "");
  // Strip the words text/title/caption etc. wherever they appear standalone.
  s = s.replace(/\b(text|letters?|words?|captions?|subtitles?|titles?|headlines?|typography|logos?|watermarks?)\b/gi, "");
  return s.replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
