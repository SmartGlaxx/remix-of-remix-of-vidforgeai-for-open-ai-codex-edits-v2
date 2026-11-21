# Video playback update

# Egg-price sandbox preview

- [x] Create the ordered illustration proof with exact Darian narration, word-synced captions, and illustrative receipt reveals; 11 proof/regression tests passed.
- [x] Render one Shotstack sandbox MP4 (c772cb77-9abe-4c77-82f9-ad8c1fdba800), verified 1920×1080 H.264/AAC and exactly 30.00 seconds. Exported beginning/middle/end spoken captions highlight current words; receipt values reveal in order without caption overlap. Saved narration is 22.18 seconds followed by the final receipt hold; active render 23.76 seconds, observed submission-to-download 7m 16s. No production render.

# Compound-interest sandbox revision

- [x] Refine world-space planted-foot walking, larger host, wave/shrug/per-bar reaches and uncropped bottom captions using saved Darian audio.
- [x] Eight retained tests passed; submitted one 1080p Shotstack sandbox render (67ffb01c-3366-408a-8a0a-d3177c2849d9).
- [x] Export verified as 1920×1080 H.264/AAC, 61.766667s; entrance/exit and beginning/middle/end captions inspected. Four chart cues match exported saved audio within 40ms. Shotstack total render time 387532ms, active render 52148ms, sandbox cost $0; no production render.

# Explainer script service

- [x] Deploy the existing brief-aware script function to resolve the live Missing title error (reproduced HTTP 400 before deployment, HTTP 200 afterward).
- [x] Verify authenticated Generate film plans and saves six scenes from a brief alone with no uncaught errors; three regression tests passed. Image/audio generation intentionally not run.
- [x] Check Script generation/regeneration, Explainer planning/resume/refresh, Storyboard handoff, and direct script requests. Fixed whitespace-only saved titles and gated both Script regeneration buttons. Five tests passed; authenticated phone/desktop light/dark checks passed, with live title/brief planning and cached responses for repeat appearance checks. Direct empty title/brief requests return helpful HTTP 400 messages. No script callers in background jobs or database function source; image/audio generation and final rendering not run.

# Director workspace

- [x] Replace the locked wizard with Script, Storyboard, Director, and Sequence URLs and honest navigation.
- [x] Persist editable Script, Director, and optional Music drafts; keep ongoing work alive during navigation.
- [x] Move sequence tools and optional music to Sequence; save and display sequence job IDs.
- [x] Verify authenticated draft refresh/navigation and mobile layout; 31 regression tests passed. No new paid GPU renders were started.

- [x] Automatically save completed Studio clips through existing video storage service.
- [x] Add playback error handling and direct video links.
- [x] Verify rehosting, fallback, and chaining tests and authenticated browser playback using a sample clip (no paid GPU job).
- [x] Unlock the backup engine (LTX-2.3) for chained/first-frame shots after conditioning was verified cross-model; update tests, fallback hint, and docs.

# Studio sequence stitching

- [x] Connect the live stitch endpoint with the confirmed route/params envelope and preserved clip audio.
- [x] Add Stitch Sequence, optional Music-tab soundtrack, saved final playback/download, and retain shots across tab changes.
- [x] Run 16 contract/panel/player tests and authenticated live stitching: two saved clips produced a stored/downloadable 16.06s H.264/AAC MP4; shots survived Music-tab navigation. Sandbox Chromium rejected media playback (including original clips), so in-browser playback remains unverified; storage download and audio/video tracks verified.
