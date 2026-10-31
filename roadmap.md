# Video playback update

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
