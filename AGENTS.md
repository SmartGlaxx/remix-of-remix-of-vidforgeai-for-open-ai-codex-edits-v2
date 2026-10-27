# Project rules

- Studio clip chaining is explicit; first-frame conditioning is verified on both LTX-2.5 (primary) and LTX-2.3 (backup, verified 2026-10-27), so either engine may render chained shots; retain completed shots while rendering and isolate URL/warning validation in studioClipUtils so the flow can be tested without GPU jobs.
- Studio clips use the existing rehost-video service before playback; keep the source on saving failure and isolate playback recovery in StudioClipPlayer so storage outages never discard completed shots.
