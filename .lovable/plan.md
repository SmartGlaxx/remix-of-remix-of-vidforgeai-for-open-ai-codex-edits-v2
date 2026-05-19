## Goal
Align `generate-visual` and `generate-thumbnail` edge functions with this app's convention of using the `workflow/*` gateway namespace (the `voxai/*` namespace is reserved for the other app, even though both routes map to the same handler).

## Changes

1. **`supabase/functions/generate-visual/index.ts`**
   - Change the gateway `input.route` from `"voxai/generate-image"` to `"workflow/generate-image"`.
   - Update the inline comment so future edits keep using the workflow namespace.

2. **`supabase/functions/generate-thumbnail/index.ts`**
   - Same change: `input.route` → `"workflow/generate-image"`.

## Out of scope
- No changes to params, polling, re-hosting, frontend code, or `VideoStep` (already uses `workflow/full-video` and `workflow/stitch`).
- No backend/gateway changes — both routes resolve to the same handler, so this is purely a namespace alignment.
