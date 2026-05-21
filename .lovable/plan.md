# Fix Quick Heal block + persist generated music

Goal: stop the browser from ever touching `ipfs.filebase.io`, shrink files ~7×, and let users reload a project and see their previously generated tracks.

## 1. Storage bucket `soundtracks`
- Public read, writes via service-role only.
- Path layout: `<user_id>/<project_id>/<segment-slug>-<uuid>.mp3`.
- Created via migration with RLS policies on `storage.objects`.

## 2. New edge function `rehost-audio`
Mirrors `rehost-image`, with one extra step:

1. `fetch(ipfsUrl)` server-side, 3 attempts + 2 s backoff.
2. Transcode WAV → **192 kbps MP3** using `@ffmpeg/ffmpeg` (WASM build, runs inside Deno edge runtime). One call per track, ~1–2 s for a 30 s clip.
3. Upload MP3 to `soundtracks` bucket with `contentType: audio/mpeg`.
4. Return `{ url: <supabase public url>, rehosted: true, bytes, duration }`.
5. On any failure (fetch, transcode, upload) → return `{ url: <original ipfs url>, rehosted: false }` so generation never breaks.

Quality at 192 kbps: effectively transparent for background score under voiceover. ~720 KB per 30 s clip vs ~5 MB WAV.

## 3. Persistence table `soundtracks`
Columns (domain only): `project_id`, `segment_label`, `prompt`, `genre`, `bpm`, `mix`, `duration`, `intensity`, `storage_path`, `public_url`, `source_url`.

Access rules:
- Owner-only read/write, scoped by `user_id = auth.uid()`.
- Insert allowed only when the row's `user_id` matches the caller.

## 4. Wire `SoundtrackStep.tsx`
- After resolving the audio URL (sync response or `pollJob`), call `rehost-audio` with that URL.
- Use the returned URL on the `<audio>` element (so Quick Heal sees only `*.supabase.co`).
- If `rehosted: true`, also insert a row into `soundtracks` with the project + segment metadata.
- On component mount (and when `project_id` changes), query `soundtracks` for the current project and prepopulate the **Generated Tracks** panel. Sort by `created_at desc`.
- Add a small trash icon per track to delete (removes row + storage object).

## 5. UI changes (minimal)
- Same panel, same controls, same audio player.
- Add a "Saved" badge on tracks loaded from the database vs freshly generated (purely cosmetic).
- No changes to genre/BPM/mix selectors, mood timeline, or the generation flow.

## Out of scope
- No TTL/auto-cleanup yet (can add later if storage grows).
- No changes to `generate-soundtrack` or the RunPod handler.
- No changes to image/video rehosting.

## Technical notes
- ffmpeg WASM in Deno edge: `import { FFmpeg } from "npm:@ffmpeg/ffmpeg@0.12"`. Cold-start adds ~300 ms first call; warm calls are fast.
- Memory: 5 MB WAV in, ~720 KB MP3 out — well within edge function limits.
- Project ID source: read from `useProject()` context (already available in `SoundtrackStep`). If no `project_id` exists yet, fall back to rehost-only (skip DB insert) so the flow still works for unsaved drafts.

## Expected cost at 1,000 users × 10 songs/month × 12 months
- Storage: ~7 GB/year cumulative → **~$12/year**
- Egress (3 plays/track avg): ~250 GB/year → **~$22/year**
- **Total ~$35/year**, comfortably inside the $25/month free Cloud balance.
