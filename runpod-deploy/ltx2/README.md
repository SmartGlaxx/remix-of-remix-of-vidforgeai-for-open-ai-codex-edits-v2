# LTX-2.x worker (Capscify Studio Mode)

One RunPod serverless worker image serving both video models. The model
is selected by env (`MODEL_ID`, default `ltx-2.5`) or per-job `model_id`
override. The router above this worker owns the default/failover policy
(spec 6.3): 2.5 primary, 2.3 backup.

## Layout

- `handler.py` — serverless handler implementing the spec 6.4
  `/workflow/generate-video` contract (adapted to RunPod's envelope:
  `{"status", "output"}`, job_id/status supplied natively).
- `Dockerfile` — CUDA base + torch + official LTX-2 pipelines package.
  Weights are NOT in the image; they come from the attached volume.
- `requirements.txt` — runpod SDK, boto3 (Filebase), requests, Pillow.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `MODEL_ID` | `ltx-2.5` | Default model served by this endpoint |
| `VOLUME_ROOT` | `/runpod-volume` | Network volume mount point |
| `PIPELINE_MODULE` | `ltx_pipelines.distilled` | Pipeline module to invoke |
| `GEN_TIMEOUT` | `1800` | Seconds allowed for load + generation |
| `DEFAULT_RESOLUTION` | `1080p` | Fallback when input has no resolution |
| `IMAGE_ARG` | _(empty)_ | CLI flag for first-frame conditioning, e.g. `--image-path`. Empty = first_frame_url is accepted but ignored (recorded in warnings) |
| `BUCKET_ENDPOINT_URL`, `BUCKET_ACCESS_KEY_ID`, `BUCKET_SECRET_ACCESS_KEY`, `BUCKET_NAME` | — | Filebase S3 config (same names as api-gateway) |

## Input (job `input`)

Spec 6.4 fields: `project_id`, `scene_id`, `shot_id`, `model_id`,
`prompt`, `negative_prompt`, `duration_seconds` (clamped 2–30),
`resolution` (`1080p`, `720p`, or `WxH`), `aspect_ratio` (`16:9`
default, `9:16` swaps dims), `seed`, `first_frame_url`, `last_frame_url`,
`character_reference_urls`, `environment_reference_url`,
`audio_reference_urls`, `dialogue`, `camera_type`, `camera_motion`,
`transition_type`, `motion_level`, `audio_enabled` (default true),
`generation_settings`.

Resolution handling: the two-stage pipeline needs multiples of 64, so
generation runs at dims rounded up (1080p → 1920×1088, 720p →
1280×768) and the output is center-cropped to the requested size —
the same pattern as the 2.3/2.5 benchmarks. Dialogue is woven into the
prompt text (how native dialogue was produced in benchmarking).
`audio_enabled: false` strips the audio track with ffmpeg.

## Output (`output`)

`video_url`, `last_frame_url` (ffmpeg `-sseof`, same as api-gateway),
`audio_metadata` (`has_audio`, `codec`, `duration`),
`duration_actual`, `model_used`, `generation_metadata` (ids, seed,
resolution, frames, fps, generation seconds, audio flag, warnings,
reference urls). Errors return `{"status": "error", "error": ...}`.

## Endpoint configuration (deployment step, not code)

- Image: GitLab Container Registry `ltx2` (see root `.gitlab-ci.yml`).
- Attach the network volume at `/runpod-volume`.
- Env: `MODEL_ID=ltx-2.5` on the primary endpoint,
  `MODEL_ID=ltx-2.3` on the backup endpoint, plus Filebase secrets.
- Workers: 0–8 (account worker quota is 10 total across all endpoints),
  scaler `QUEUE_DELAY` (quoted string in RunPod's API).
- GPU class: TBD by validation (see below).

## Verification checklist (before first deploy)

1. **CLI flags**: confirm the distilled flag spellings in `handler.py`
   (`FLAG_DEFAULTS`) against the installed LTX-2 repo version. Any flag
   can be overridden via `PIPELINE_FLAG_<KEY>` env without a code change.
   UPDATE (first endpoint run, 2026-10-26): argparse accepted every flag
   except `--negative-prompt`, which the installed CLI rejects — so the
   worker no longer passes it (input still accepted, dropped with a
   warning). 2.3's flag mapping RESOLVED 2026-10-26: the distilled CLI
   has monolith vs split layouts — 2.3's fat checkpoint needs the
   monolith flags (--distilled-checkpoint-path + --gemma-root); the
   split flags crash it with video_vae_path missing (backup
   validation job 4156824c). Handler fixed accordingly.
2. **2.3 weights**: DONE 2026-10-26 — checkpoint (46.1GB) + Gemma
   encoder (18 files, 24.4GB) re-downloaded to `ltx23/`; ltx23 totals
   67 GiB with the upscaler that was already kept.
3. **Volume attach**: endpoint must mount the volume at
   `/runpod-volume`, or jobs fail fast listing the missing paths.
4. **Peak VRAM + resolution validation**: run a full generation on the
   target GPU class at 720p and 1080p and record peak VRAM. Benchmark
   ran on 96GB only; 48GB is a planning assumption, 24GB is not promised.
5. **Failover test** (spec Test G): 2.5 endpoint down → job routes to
   2.3, state preserved, fallback recorded.
6. **First-frame conditioning**: set `IMAGE_ARG` once the flag is
   confirmed, or first_frame_url stays ignored (warned, not silent).

## Known MVP scope limits

- Character/environment/audio references are accepted and recorded but
  do not yet drive conditioning (app-layer registries own them).
- IC-LoRA pose control is a later-phase addition (see project todos),
  not part of this worker.
- The worker generates one shot per job; the router/scheduler above it
  owns parallel fan-out and dependency ordering (spec 11).
