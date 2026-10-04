# Personal-Use 10-Minute Video: Cost, Time & Model Breakdown

No code changes — this is the full numbers analysis you asked for, so you can decide whether to ditch the multi-user RunPod plan.

## The workload for one 10-minute video

```text
Script (~1,500 words)
  → Kokoro TTS voiceover            (~10 min of audio)
  → 15 scene images                 (one per ~40s clip)
  → 15 video clips @ ~40s each      (image-to-video)
  → Stable Audio music bed
  → FFmpeg stitch + mix             → final 10-min MP4
```

## Option A — RunPod Serverless, personal use (keep current stack)

| Stage | Model | GPU | Time | Cost |
|---|---|---|---|---|
| Voiceover | Kokoro TTS | CPU/cheap GPU | ~1–2 min | ~$0.01 |
| 15 images | Z-Image / FLUX.2-dev | RTX 4090 ($0.69/hr) | ~15 × 15s = ~4 min | ~$0.05 |
| 15 clips | LTX-2 (image-to-video, 480p–720p) | RTX 4090 | ~15 × 2–4 min = 30–60 min | ~$0.35–0.70 |
| Music | Stable Audio Open | same GPU | ~1 min | ~$0.01 |
| Stitch | FFmpeg | CPU | ~1–2 min | ~$0.01 |
| **Total** | | | **~40–70 min** | **~$0.45–0.80 per video** |

Notes:
- Serverless bills per second only while running — personal use means near-zero idle cost. This is actually the cheapest option per video.
- At 720p with higher quality settings, clip time can double (~1.5–2 hrs, ~$1.50).
- Cold starts add ~1–3 min per stage unless you keep a worker warm (don't — warm workers cost ~$17/day idle).

## Option B — RunPod Pod (rent a GPU by the hour, do everything in one session)

- RTX 4090 pod: ~$0.69/hr. Boot it, run the whole pipeline in ComfyUI, shut it down.
- 10-min video ≈ 1–2 hours of pod time = **~$0.70–1.40 per video**, same models.
- Advantage: no cold starts, you can eyeball each clip and regenerate bad ones inside the same session. Best fit for personal use with manual quality control.

## Option C — Fully local (your own GPU)

- Needs an RTX 3090/4090/5090-class card (24GB VRAM ideal; LTX-Video runs on 12GB with quantization).
- Cost per video ≈ electricity only (~$0.10–0.30). Time similar to Option B.
- Only worth it if you'll make 50+ videos — a 4090 rig is ~$2,000+ upfront.

## Option D — No infra at all (managed APIs)

- LTX Studio / Replicate / fal.ai per-generation pricing: image-to-video clips run ~$0.10–0.50 each → 15 clips ≈ **$2–8 per video**, plus ~$0.10 for TTS/images.
- Zero setup, zero maintenance, but 5–10× the per-video cost of Option A/B.

## Practical verdict

- **Keep RunPod, drop the "product" scope.** Your current serverless setup already works for personal use — you just stop building multi-user/payment polish. Cost is under $1 per 10-min video.
- **Best personal workflow:** Option B (hourly pod + ComfyUI). You get to review each of the 15 clips and regenerate the bad ones before stitching — that manual loop is what makes output watchable, and it's free of the engineering cost of automating it.
- **Time budget:** expect ~1.5–2 hours wall-clock per finished 10-min video including your review/regeneration passes. Fully automated, ~45–70 min.
- **Models to use:** LTX-2 (or LTX-Video 13B) for clips, Z-Image or FLUX.2-dev for images, Kokoro for voice, Stable Audio Open for music, FFmpeg for stitch — i.e. exactly what you already have deployed.

## If you want to proceed

Tell me which option and I'll plan the concrete changes (e.g. strip the app to a single-user local tool, or write a runbook for the pod workflow).
