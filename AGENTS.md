# Project rules

- Studio clip chaining is explicit and primary-only until backup conditioning is verified; retain completed shots while rendering and isolate URL/warning validation in studioClipUtils so the flow can be tested without GPU jobs.
- Studio clips use the existing rehost-video service before playback; keep the source on saving failure and isolate playback recovery in StudioClipPlayer so storage outages never discard completed shots.