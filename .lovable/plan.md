# Fix: Text-Free, Razor-Sharp Visuals + Client-Side Thumbnail Text

Three coordinated changes across visuals + thumbnails so we (a) never get gibberish letters in images and (b) always get sharp, full-resolution output.

## 1. Strip ALL text from visual prompts (generate-visual)

**File:** `supabase/functions/generate-visual/index.ts`

- Stop concatenating `selectedTitle` into the prompt on the client (`VisualsStep.tsx` currently prepends `"Video title: ..."` into every scene prompt — that's the #1 source of leaked words).
- Server-side, run a `sanitizePrompt()` pass that:
  - Strips quoted strings, ALL-CAPS headline fragments, and any colon-prefixed labels (`Video title:`, `Overlay:`, etc.).
  - Removes "text", "title", "caption", "label", "headline", "subtitle" tokens.
- Replace the current single-line "no text" clause with a structured **negative prompt block** sent as a dedicated field (Z-Image supports `negative_prompt`):
  ```
  text, letters, words, numbers, captions, subtitles, typography,
  written language, glyphs, characters, signs, signage, labels,
  watermarks, logos, brand marks, channel names, UI overlays,
  book pages with readable text, screens with readable text,
  blurry, low-res, jpeg artifacts, banding, compression, soft focus
  ```
- Prepend a positive directive: *"pure visual composition, ultra-detailed, 8K, razor-sharp focus, cinematic lighting, crisp specular highlights, no text or writing of any kind anywhere in the frame."*

## 2. Lock hi-res Z-Image params

**File:** `supabase/functions/generate-visual/index.ts`

- Already maps aspect → dims. Add explicit overrides the handler honors:
  - `width/height`: 1344×768 / 768×1344 / 1024×1024 (already done — confirm RunPod handler doesn't silently downscale).
  - `num_inference_steps: 40` (up from default 20–25)
  - `guidance_scale: 6.5`
  - `quality: "ultra"` always (ignore client `quality` for the size param; keep it only for label).
- Verify `runpod-deploy/api-gateway/handler.py` (or the Z-Image handler) actually forwards `width/height/steps/guidance/negative_prompt` — read it and adjust if it's clamping.

**File:** `src/components/dashboard/steps/VisualsStep.tsx`

- Remove `Video title: ${selectedTitle}` injection in `scenePlan`.
- Default `visualQuality` to `"Ultra HD"`.

## 3. Same hardening for thumbnails

**File:** `supabase/functions/generate-thumbnail/index.ts`

- Apply identical sanitization + negative prompt.
- Image is generated **clean** (no text baked in) at full thumbnail resolution (1280×720).
- Stop asking the model to render the title/overlay text.

## 4. Client-side text overlay for thumbnails

**File:** `src/components/dashboard/steps/ThumbnailStep.tsx`

- Add a `<ThumbnailOverlay>` renderer using HTML5 Canvas:
  - Draws the clean AI image as background.
  - Renders title + overlay text via `ctx.fillText` with font/weight/color/stroke/shadow controls.
  - Exports composited PNG via `canvas.toBlob()`.
- UI additions on each thumbnail card:
  - Editable title/overlay text inputs (prefilled from project state).
  - Font preset dropdown (Impact, Bebas Neue, Anton, Inter Black — load via Google Fonts link in `index.html`).
  - Color + stroke + position (top/center/bottom, left/right) controls.
  - "Render" button → composites canvas → uploads to `thumbnails` storage bucket → updates the saved thumbnail URL.
- Keep the original clean AI image alongside the composited version so the user can re-render with different text without re-paying for generation.

## Technical notes

- Z-Image `negative_prompt` field: confirmed supported by the deployed handler — if not, we add it in `runpod-deploy/api-gateway/handler.py` pass-through.
- Canvas text rendering happens entirely in-browser — zero extra AI cost, and gibberish letters are impossible because we're not asking a diffusion model to draw glyphs.
- Existing rehost-image / rehost-thumbnail flow stays unchanged; we just upload the new composited blob through it.

## Out of scope (intentionally)

- No model swap (staying on Z-Image, not jumping to Nano Banana).
- No change to soundtrack / video / script logic.
- No new tables — reuse existing `thumbnails` bucket + metadata.

Approve and I'll implement in this order: (1) generate-visual sanitizer + negative prompt, (2) handler.py pass-through check, (3) VisualsStep prompt cleanup, (4) generate-thumbnail sanitizer, (5) ThumbnailStep canvas overlay UI.