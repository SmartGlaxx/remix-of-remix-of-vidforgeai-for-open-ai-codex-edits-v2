# Video playback update

# Explainer narration and colored whiteboard render

- [x] Play narration at rate 1 and stop clips at the decoded narration duration; regression test verifies 2s + 3s narration stops at 5s, not the requested 60s slot. Local Chromium recording with 2s sample audio contains playable video/audio (1.949s container duration); no paid generation.
- [x] Sample colored ink and reveal each stroke in its average color; both whiteboard prompts updated. Yellow/blue/red local recording inspected; 27 Explainer tests and worker syntax check pass. Prepared for commit; Railway rebuild remains externally unverified.

# Explainer Studio release verification

- [x] Apply the existing background export migration to the connected live backend, preserve owner-only RLS and worker-only claiming, remove the disallowed auth foreign key in a follow-up migration, and refresh the schema cache.
- [x] Live opt-in security test passed: owner reads, foreign/anonymous denial, ownership spoof/update/delete denial, worker-only claim RPC. Signed-in 30-second submission was held before generation, persisted across browser close/reopen, then cleaned up; schema cache table read returned HTTP 200.
- [ ] Deploy a persistent CPU Docker export worker connected to this backend; no export worker is found on RunPod (two stopped unrelated pods), no persistent host is connected, and this sandbox cannot host Docker. Run on an always-on Linux CPU VPS/container service; securely provision backend access or implement a server-side worker bridge since Cloud owners cannot retrieve the managed service-role key.
- [ ] Authorized browser-closed export and reopened MP4 playback; blocked on worker deployment and owner authorization of paid image/speech generation. Do not mark the factory complete.

# Automatic Character Animation direction

- [x] Add bounded action replanning after two failed camera/location corrections; validate live planner against the actual opening, preserve durations/narration/cuts, retain private edit provenance and reviews, and pass 118 regression tests. Deploy character-film and character-film-worker.
- [ ] Accepted seated café A → B → C proof: localized masked edits still change framing and lift too far; saved candidates share B exactly but both fail continuity review. Used 9/20 image calls; video remains unauthorized. Original attempts predate provenance receipts, so their actual provider input cannot be independently verified.
- [x] Add durable one-click topic/script → observed scene direction → paired frames → continuity checks → Pruna → saved assembly; retain deliberate storyboard editing, three unwired format placeholders and the existing single-clip tool.
- [x] Test scene anchors, shared boundary asset IDs, 2–10 second action timing, preparation allowance bounds, two overlapping jobs, restart safety, and rejection before paid submission. Full regression suite passed (113 tests), followed by the additional authoritative-boundary test.
- [x] Deploy generate-script, character-film and character-film-worker; signed-in café preparation inspected the original image, saved three directed shots and frames, automatically attempted two bounded corrections, then STOPPED at failed continuity review without any animation attempts. Draft 260b6a70-3989-458e-af5b-b6f6ef65f95a; shot two end and shot three start use the identical asset. Desktop/phone checks show no page errors or mobile horizontal overflow; placeholders are disabled.
- [ ] Café proof is not ready to render: the live frame reviewer rejects shot one's camera/landmark/pose changes after two corrections. Saved opening and corrected ending are available in Preview; no video authorization or public publish. Rendered 0/25/50/75/100% motion inspection remains blocked until valid frames and the owner's paid render.

# PR #26 Preview verification

- [x] Restore original single-Daniel café opening, replace seated and mug-raised poses, reuse reviewed end poses as continuation storyboard starts, verify all three pairs signed in and after refresh; Generate film remains unclicked and draft has no animation attempts.
- [ ] Live café continuity blocked: gateway template is ghcr.io/smartglaxx/gateway:latest but worker hbzukmct16pwhi rejects capscify/extract-frame. Live job sync-b7ef8337-a627-4286-9018-abd49287f27f-e1 failed with Unknown route: capscify/extract-frame. Commit dfa657b-or-later activation cannot be confirmed. Request builder stops with Waiting for the preceding final frame; no returned frame or actual Pruna image exists to compare. Locally decoded saved-clip last frame and blocked-comparison evidence delivered; owner must activate the updated gateway before live continuity can be verified.

- [x] Apply storyboard columns and deploy the four requested functions; both frame columns confirmed in the database.
- [x] Verify all four signed-in Explainer formats without paid video generation; three six-scene planners now succeed with per-scene end poses and transitions, Character Animation restores the saved café draft.
- [x] Verify paired Pruna frame payloads and continuation selection with regression tests; 97 app tests and two actual-frame utility tests pass. Café draft has six saved medium-quality storyboard images, no animation attempts, 30 seconds and US$0.15 estimated video cost.
- [ ] Verify live extracted final-frame continuation; blocked until the updated RunPod gateway image is built by the existing GitHub workflow and loaded by the worker. The current live gateway rejects capscify/extract-frame. Do not start a paid film while this is unresolved.
- [x] Correct café opening artwork: original uploaded single-Daniel image is the actual shot-one input; reviewed seated and mug-raised images replace the inconsistent draft boards. No settled films or paid clips changed.
- [x] Return the direct Preview link and leave paid rendering to the owner; no paid video render or public publish.

# Character long-film workflow

- [x] Add separate film setup, editable chapter/shot plan, native or uploaded chapter narration, and a prepared 30-second draft; preserve the single-clip tool. Character Animation now shows "Animate an image" above "Create a film"; the 30-second draft (3 shots, US$0.15, state draft) is planned and waiting, and no paid prediction was submitted.
- [x] Deploy durable owner-scoped film execution, idempotent clip submissions, saved chapter/final assembly, stop and recovery controls. character-film (client API + assembly callback), character-film-worker (durable tick, 4-minute lease, self-wake) and character-animation (service-key internal calls, film wake on clip completion) are deployed; a 5-minute reconciliation sweep (288 runs/day) re-arms any lost wake.
- [x] Test mocked 3-minute and 30-minute paths, duplicate/restart safety and stitch recovery; check signed-in Preview without paid provider calls or public publishing. 18-clip/2-chapter and 180-clip/16-MP4 paths pass with one paid prediction per shot; billing pause, worker restart, stitch retry, continuation ordering and stop all pass. Signed-in preview confirms the panel, the US$0.15 estimate, restore after refresh, foreign film 404, bad duration 400 and unsigned 401.

# Animate an image

- [x] Add private illustration upload, fixed 10-second 720p/24fps Draft/native-audio generation, saved takes and downloads above the existing Character Animation tools.
- [x] Deploy authenticated, idempotent Replicate jobs with verified completion webhooks and same-prediction storage recovery. Signed-in duplicate submission returns the existing attempt; alternative owner is ignored; foreign input, missing session, unknown job and forged webhook are rejected.
- [x] All 75 tests passed; automatic build OK. Signed-in desktop/mobile upload and failed-take/image/prompt refresh restoration checked with no browser errors or horizontal overflow.
- [ ] Real saved clip, audio metadata, webhook completion, refresh playback and download verification blocked by Replicate HTTP 402 (account needs credit). One authorized submission attempted, no prediction ID returned, no paid retry; published estimate is $0.05, actual charge unavailable. Owner must add Replicate credit before another deliberate attempt.

# Phase 0 Daniel visual approval

- [x] Prepare one 3840×2160 board from original reusable Daniel artwork: stand, walk, wave, point, and a furnished 16:9 teaching scene; inspect the 480×270 phone-size scene. Corrected an overlapping caption highlight and inverted waving palm; nine existing proof tests passed, build OK. No render submitted or active preview changed.
- [x] Owner accepted the current Daniel as a temporary host; skip further board reviews and keep his artwork independently replaceable.
- [x] Integrated separate Daniel art/performance/room into the server-only daniel-proof sandbox format; reused saved narration and derived its loudness without new speech charges. Thirteen regression tests passed. Render 4c0e9828-8ef4-4c43-a3ba-a972e4aaf251 completed: 1920×1080 H.264/AAC, 61.433333s, 33.576s active rendering, 2m45s observed completion, $0 Shotstack sandbox. Consecutive exported walk/wave frames, each saved-number growth cue, shrug, and beginning/middle/end captions inspected. Local Playwright preview startup hung; deterministic JS execution and actual exported frames verified instead. No production render or app-page changes.
- [ ] After moving-proof review, prioritize the self-service in-app flow: own narration → host → layout → Preview → edit a line → Preview again; blocked on owner video review.

# Cartoon host redesign

- [x] Replace tubular limbs with contoured cartoon artwork, collared shirt, defined hands/shoes and expressive blinking eyes while retaining the existing motion and narration timeline.
- [x] Check walking, wave, shrug, pointing and captions in a local animated preview with no runtime errors; nine timing/cartoon regression tests passed. No new Shotstack or production render submitted.

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
