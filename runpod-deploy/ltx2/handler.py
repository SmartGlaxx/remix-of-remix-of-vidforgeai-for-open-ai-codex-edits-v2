"""
Capscify Studio Mode — LTX-2.x video worker (RunPod serverless).

One image serves both models; MODEL_ID selects the default:
  - ltx-2.5 (default, primary)
  - ltx-2.3 (backup)

Input model_id may override the env default (manual selection / testing,
per spec 6.3). The model router above this worker (spec 6.3) owns the
default/failover policy; this worker only generates what it is asked for.

Implements the spec 6.4 /workflow/generate-video contract, adapted to
RunPod's serverless envelope: the handler returns {"status", "output"}
and RunPod supplies job_id/status natively via /status/{job_id}.

Model weights are NOT in this image. They live on the attached network
volume (VOLUME_ROOT, default /runpod-volume) and are read at job time:
  - 2.5: VOLUME_ROOT/ltx25 (71.1GB, 6 files, downloaded 2026-10-25)
  - 2.3: VOLUME_ROOT/ltx23 (checkpoint + Gemma encoder + upscaler)

VERIFY BEFORE FIRST DEPLOY (see README.md for the full checklist):
  1. ltx-pipelines distilled CLI flag names against the installed
     LTX-2 repo version. The generation BEHAVIOUR below is benchmarked
     (10s, 1080p, native audio, word-perfect dialogue on both models),
     but the exact flag spellings are taken from the README distilled
     example and confirmed against the installed version 2026-10-26:
     2.5 uses the split flags; 2.3 MUST use the monolith flags
     (--distilled-checkpoint-path + --gemma-root) — the split flags
     crash it with video_vae_path missing (see MODELS comment).
     Any flag can be overridden without a code change via the
     PIPELINE_FLAG_* env vars (see build_pipeline_cmd).
  2. 2.3 weights must be re-downloaded before the backup endpoint can
     serve: only the 2.3 spatial upscaler remains on the volume
     (checkpoint + Gemma encoder were deleted in the 2.3 -> 2.5 swap).
     The worker fails fast with the exact missing path if they are absent.
  3. The serverless endpoint must attach the network volume at
     /runpod-volume, or every job fails fast on missing model files.
  4. Peak VRAM + 720p/1080p validation on the target GPU class
     (benchmark ran on 96GB only; 48GB is a planning assumption, 24GB
     is not promised).
"""

import json
import os
import shutil
import subprocess
import tempfile
import time
import uuid

import boto3
import requests
import runpod
from botocore.config import Config

# ---------------------------------------------------------------------------
# Configuration (all env-driven, per the Capscify contract)
# ---------------------------------------------------------------------------

VOLUME_ROOT = os.environ.get("VOLUME_ROOT", "/runpod-volume")
DEFAULT_MODEL = os.environ.get("MODEL_ID", "ltx-2.5")
PIPELINE_MODULE = os.environ.get("PIPELINE_MODULE", "ltx_pipelines.distilled")
GEN_TIMEOUT = int(os.environ.get("GEN_TIMEOUT", "1800"))  # 30 min: load + generate
DEFAULT_RESOLUTION = os.environ.get("DEFAULT_RESOLUTION", "1080p")
# Image-conditioning flag for the distilled CLI: "--image" (confirmed
# against the installed ltx_pipelines: distilled.py uses
# default_2_stage_distilled_arg_parser -> new_video_gen_arg_parser, which
# declares --image with ImageAction). The CLI requires 3-5 tokens:
# PATH FRAME_IDX STRENGTH [BINDING] [CRF]; the handler appends frame 0 +
# strength 1.0 (binding auto: frame 0 replaces the latent = first-frame
# conditioning) and, when last_frame_url is given, the last frame index +
# strength 1.0 (start+end workflow: the clip is generated between the two
# stills). Empty by default: first_frame_url and last_frame_url are then
# accepted but ignored for generation (recorded in generation_metadata.warnings).
IMAGE_ARG = os.environ.get("IMAGE_ARG", "")

# Filebase (S3-compatible) config — same env names as the api-gateway.
S3_ENDPOINT = os.environ.get("BUCKET_ENDPOINT_URL")
S3_ACCESS_KEY = os.environ.get("BUCKET_ACCESS_KEY_ID")
S3_SECRET_KEY = os.environ.get("BUCKET_SECRET_ACCESS_KEY")
S3_BUCKET = os.environ.get("BUCKET_NAME")

FPS = 24

# Model file layouts, relative to VOLUME_ROOT. 2.5 paths follow the
# LTX-2 README distilled example (split layout: one file per component).
# 2.3's checkpoint is a MONOLITH (transformer + VAEs + text projection in
# one file), so it uses the distilled CLI's monolith flags instead:
# --distilled-checkpoint-path + --gemma-root. Passing 2.3's files via the
# split flags (--transformer-path etc.) selects split mode, where every
# component slot must be given explicitly — the pipeline then crashes with
# "ModelPaths.video_vae_path is required but missing (mode='split')"
# (proven by backup validation job 4156824c, 2026-10-26). The two flag sets
# are mutually exclusive (the CLI aborts if combined).
MODELS = {
    "ltx-2.5": {
        "base": "ltx25",
        "args": {
            "transformer": "diffusion_models/ltx-2.5-22b-distilled-transformer-bf16.safetensors",
            "text_encoder": "text_encoders/gemma4-12b-with-proj-ltx-2.5-bf16.safetensors",
            "video_vae": "vae/ltx-2.5-video-vae-bf16.safetensors",
            "audio_vae": "vae/ltx-2.5-audio-vae-bf16.safetensors",
            "duration_head": "model_patches/ltx-2.5-duration-head-bf16.safetensors",
            "upscaler": "latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors",
        },
    },
    "ltx-2.3": {
        "base": "ltx23",
        "args": {
            "checkpoint": "ltx-2.3-22b-distilled-1.1.safetensors",
            "gemma_root": "gemma3",
            "upscaler": "ltx-2.3-spatial-upscaler-x2-1.1.safetensors",
        },
    },
}

# CLI flag names. Override any of them via PIPELINE_FLAG_<KEY> env, e.g.
# PIPELINE_FLAG_TRANSFORMER=--transformer-path.
FLAG_DEFAULTS = {
    "transformer": "--transformer-path",
    "text_encoder": "--text-encoder-path",
    "video_vae": "--video-vae-path",
    "audio_vae": "--audio-vae-path",
    "duration_head": "--duration-head-path",
    "checkpoint": "--distilled-checkpoint-path",
    "gemma_root": "--gemma-root",
    "upscaler": "--spatial-upsampler-path",
    "prompt": "--prompt",
    "negative_prompt": "--negative-prompt",
    "width": "--width",
    "height": "--height",
    "num_frames": "--num-frames",
    "seed": "--seed",
    "output": "--output-path",
}


def flag(key):
    return os.environ.get(f"PIPELINE_FLAG_{key.upper()}", FLAG_DEFAULTS[key])


# ---------------------------------------------------------------------------
# Small helpers (mirroring the api-gateway patterns)
# ---------------------------------------------------------------------------

def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def upload_file_to_filebase(local_path, prefix):
    """Upload a local file to Filebase S3 and return its public https url."""
    s3 = get_s3_client()
    ext = os.path.splitext(local_path)[1].lstrip(".") or "bin"
    key = f"{prefix}/{uuid.uuid4().hex}.{ext}"
    s3.upload_file(local_path, S3_BUCKET, key)
    head = s3.head_object(Bucket=S3_BUCKET, Key=key)
    cid = head.get("Metadata", {}).get("Cid", "") or head.get("Metadata", {}).get("cid", "")
    if cid:
        return f"https://ipfs.filebase.io/ipfs/{cid}"
    return f"https://{S3_BUCKET}.s3.filebase.com/{key}"


def run_cmd(cmd, timeout):
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(
            f"command failed ({proc.returncode}): {' '.join(cmd)}\n"
            f"stderr tail: {proc.stderr[-2000:]}"
        )
    return proc


def ffprobe_info(path):
    """Return {duration, has_video, video_codec, has_audio, audio_codec}."""
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "stream=codec_type,codec_name",
        "-show_entries", "format=duration",
        "-of", "json", path,
    ]
    proc = run_cmd(cmd, timeout=60)
    data = json.loads(proc.stdout or "{}")
    info = {"duration": 0.0, "has_video": False, "video_codec": None,
            "has_audio": False, "audio_codec": None}
    try:
        info["duration"] = float(data.get("format", {}).get("duration", 0))
    except (TypeError, ValueError):
        pass
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            info["has_video"] = True
            info["video_codec"] = stream.get("codec_name")
        elif stream.get("codec_type") == "audio":
            info["has_audio"] = True
            info["audio_codec"] = stream.get("codec_name")
    return info


def download_file(url, dest, max_bytes=100 * 1024 * 1024):
    r = requests.get(url, timeout=180)
    r.raise_for_status()
    if len(r.content) > max_bytes:
        raise ValueError(f"download too large (max {max_bytes} bytes): {url}")
    with open(dest, "wb") as f:
        f.write(r.content)
    return dest


def parse_resolution(value, aspect_ratio):
    """Return (final_w, final_h). Accepts '1080p', '720p', or 'WxH'."""
    if not value:
        value = DEFAULT_RESOLUTION
    value = str(value).strip().lower()
    if value == "1080p":
        w, h = 1920, 1080
    elif value == "720p":
        w, h = 1280, 720
    elif "x" in value:
        w, h = (int(p) for p in value.split("x", 1))
    else:
        raise ValueError(f"unsupported resolution: {value!r}")
    if aspect_ratio == "9:16":
        w, h = h, w
    return w, h


def gen_dims(final_w, final_h):
    """Two-stage pipelines need multiples of 64: round up, crop later."""
    return (
        ((final_w + 63) // 64) * 64,
        ((final_h + 63) // 64) * 64,
    )


def compose_prompt(params):
    """Mirror the benchmark's dialogue phrasing: speech is woven into the
    prompt text, which is how native dialogue was produced in testing."""
    parts = [params["prompt"]]
    dialogue = params.get("dialogue")
    if dialogue:
        parts.append(f'The character speaks, saying, "{dialogue}".')
    if params.get("camera_type"):
        parts.append(f"Camera: {params['camera_type']}.")
    if params.get("camera_motion"):
        parts.append(f"Camera motion: {params['camera_motion']}.")
    return " ".join(parts)


def build_pipeline_cmd(model_cfg, paths, opts, work_dir):
    """Build the distilled-pipeline command. All flag spellings are
    overridable via PIPELINE_FLAG_* env (see header)."""
    cmd = ["python", "-m", PIPELINE_MODULE]
    for key, path in paths.items():
        cmd += [flag(key), path]
    # NOTE: no --negative-prompt. The installed ltx_pipelines.distilled
    # CLI rejects it (argparse: unrecognized arguments) — confirmed by
    # the first endpoint validation run. Negative prompts are accepted
    # in input but dropped with a warning (see handler) until/unless a
    # CLI version supports them.
    cmd += [
        flag("prompt"), opts["prompt"],
        flag("width"), str(opts["gen_w"]),
        flag("height"), str(opts["gen_h"]),
        flag("num_frames"), str(opts["num_frames"]),
        flag("output"), os.path.join(work_dir, "raw.mp4"),
    ]
    if opts.get("seed") is not None:
        cmd += [flag("seed"), str(opts["seed"])]
    if opts.get("first_frame_path") and IMAGE_ARG:
        # --image requires PATH FRAME_IDX STRENGTH; frame 0 + strength 1.0
        # (auto binding) pins the still as the first frame.
        cmd += [IMAGE_ARG, opts["first_frame_path"], "0", "1.0"]
    if opts.get("last_frame_path") and IMAGE_ARG:
        # Second --image binding: pin the still as the LAST frame, so the
        # clip is generated between the start and end images (start+end
        # workflow). Frame indices run 0..num_frames-1.
        cmd += [IMAGE_ARG, opts["last_frame_path"], str(opts["num_frames"] - 1), "1.0"]
    return cmd


# ---------------------------------------------------------------------------
# Handler
# ---------------------------------------------------------------------------

def handler(job):
    started = time.time()
    try:
        inp = job["input"]
        prompt = inp.get("prompt")
        if not prompt:
            return {"status": "error", "error": "prompt is required"}

        model_id = inp.get("model_id") or DEFAULT_MODEL
        if model_id not in MODELS:
            return {"status": "error",
                    "error": f"unsupported model_id: {model_id!r} "
                             f"(supported: {sorted(MODELS)})"}
        model_cfg = MODELS[model_id]

        # Resolve + verify model files before spending GPU time.
        paths = {}
        missing = []
        for key, rel in model_cfg["args"].items():
            full = os.path.join(VOLUME_ROOT, model_cfg["base"], rel)
            paths[key] = full
            if not os.path.exists(full):
                missing.append(full)
        if missing:
            return {"status": "error",
                    "error": f"model files missing for {model_id} "
                             f"(is the volume attached at {VOLUME_ROOT}?): "
                             f"{missing}",
                    "model_used": model_id}

        # Inputs (spec 6.4).
        try:
            duration_seconds = float(inp.get("duration_seconds", 10))
        except (TypeError, ValueError):
            return {"status": "error",
                    "error": "duration_seconds must be a number"}
        duration_seconds = max(2.0, min(duration_seconds, 30.0))
        try:
            final_w, final_h = parse_resolution(
                inp.get("resolution"), inp.get("aspect_ratio"))
        except ValueError as e:
            return {"status": "error", "error": str(e)}
        gen_w, gen_h = gen_dims(final_w, final_h)
        # Frame count: 8n + 1 (benchmark: 241 frames for 10s @ 24fps).
        num_frames = int(round(duration_seconds * FPS)) + 1
        num_frames = ((num_frames - 1) // 8) * 8 + 1
        seed = inp.get("seed")
        audio_enabled = inp.get("audio_enabled", True)
        if not isinstance(audio_enabled, bool):
            audio_enabled = str(audio_enabled).lower() not in ("false", "0", "no")
        full_prompt = compose_prompt({**inp, "prompt": prompt})
        negative_prompt = inp.get(
            "negative_prompt",
            "worst quality, inconsistent motion, blurry, jittery, "
            "distorted, text, watermark, logo",
        )

        warnings = []
        if inp.get("negative_prompt") is not None:
            warnings.append(
                "negative_prompt ignored: installed ltx_pipelines.distilled "
                "CLI does not accept --negative-prompt")
        # Accepted + recorded for now; first_frame_url and last_frame_url
        # drive conditioning (when IMAGE_ARG is configured). Character /
        # environment references are registry data owned by the app layer.
        for field in ("character_reference_urls", "environment_reference_url",
                      "audio_reference_urls", "transition_type", "motion_level"):
            if inp.get(field) is not None:
                pass  # recorded in generation_metadata below
        first_frame_path = None
        first_frame_url = inp.get("first_frame_url")
        if first_frame_url and not IMAGE_ARG:
            warnings.append(
                "first_frame_url ignored: IMAGE_ARG not configured "
                "(see README.md)"
            )
        last_frame_path = None
        last_frame_url = inp.get("last_frame_url")
        if last_frame_url and not IMAGE_ARG:
            warnings.append(
                "last_frame_url ignored: IMAGE_ARG not configured "
                "(see README.md)"
            )

        work_dir = os.path.join(tempfile.gettempdir(), uuid.uuid4().hex)
        os.makedirs(work_dir, exist_ok=True)
        try:
            if first_frame_url and IMAGE_ARG:
                first_frame_path = download_file(
                    first_frame_url,
                    os.path.join(work_dir, "first_frame.jpg"),
                    max_bytes=20 * 1024 * 1024,
                )
            if last_frame_url and IMAGE_ARG:
                last_frame_path = download_file(
                    last_frame_url,
                    os.path.join(work_dir, "last_frame.jpg"),
                    max_bytes=20 * 1024 * 1024,
                )

            cmd = build_pipeline_cmd(model_cfg, paths, {
                "prompt": full_prompt,
                "negative_prompt": negative_prompt,
                "gen_w": gen_w,
                "gen_h": gen_h,
                "num_frames": num_frames,
                "seed": seed,
                "first_frame_path": first_frame_path,
                "last_frame_path": last_frame_path,
            }, work_dir)
            print(f"running pipeline: {' '.join(cmd)}", flush=True)
            run_cmd(cmd, timeout=GEN_TIMEOUT)
            gen_seconds = round(time.time() - started, 1)

            raw_path = os.path.join(work_dir, "raw.mp4")
            if not os.path.exists(raw_path):
                return {"status": "error",
                        "error": "pipeline finished without an output file",
                        "model_used": model_id}
            raw_info = ffprobe_info(raw_path)
            if not raw_info["has_video"]:
                return {"status": "error",
                        "error": "pipeline output has no video stream",
                        "model_used": model_id}

            # Center-crop to the requested final resolution (audio copied).
            # Same pattern as the benchmark: 1920x1088 -> 1920x1080.
            final_path = os.path.join(work_dir, "final.mp4")
            if (gen_w, gen_h) != (final_w, final_h):
                crop_x = (gen_w - final_w) // 2
                crop_y = (gen_h - final_h) // 2
                cmd = ["ffmpeg", "-y", "-i", raw_path,
                       "-vf", f"crop={final_w}:{final_h}:{crop_x}:{crop_y}",
                       "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p"]
                if audio_enabled and raw_info["has_audio"]:
                    cmd += ["-c:a", "copy"]
                else:
                    cmd += ["-an"]
                cmd += [final_path]
                run_cmd(cmd, timeout=600)
            else:
                if audio_enabled:
                    shutil.copyfile(raw_path, final_path)
                else:
                    run_cmd(["ffmpeg", "-y", "-i", raw_path,
                             "-c:v", "copy", "-an", final_path], timeout=600)

            final_info = ffprobe_info(final_path)
            if not final_info["has_video"]:
                return {"status": "error",
                        "error": "final output has no video stream",
                        "model_used": model_id}

            # Last frame (same ffmpeg pattern as the api-gateway).
            frame_path = os.path.join(work_dir, "last_frame.jpg")
            run_cmd(["ffmpeg", "-y", "-sseof", "-0.4", "-i", final_path,
                     "-vframes", "1", "-q:v", "3", frame_path], timeout=120)

            video_url = upload_file_to_filebase(final_path, "capscify/videos")
            last_frame_url = upload_file_to_filebase(frame_path, "capscify/frames")
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

        return {
            "status": "success",
            "output": {
                "video_url": video_url,
                "last_frame_url": last_frame_url,
                "audio_metadata": {
                    "has_audio": final_info["has_audio"],
                    "codec": final_info["audio_codec"],
                    "duration": round(final_info["duration"], 2),
                },
                "duration_actual": round(final_info["duration"], 2),
                "model_used": model_id,
                "generation_metadata": {
                    "project_id": inp.get("project_id"),
                    "scene_id": inp.get("scene_id"),
                    "shot_id": inp.get("shot_id"),
                    "seed": seed,
                    "resolution": f"{final_w}x{final_h}",
                    "num_frames": num_frames,
                    "fps": FPS,
                    "generation_seconds": gen_seconds,
                    "audio_enabled": audio_enabled,
                    "warnings": warnings,
                    # Diagnostic for the IMAGE_ARG delivery puzzle (2026-10-26):
                    # reports what the worker process actually sees at runtime.
                    # Key NAMES only, never values, so no credential can leak.
                    "image_arg_configured": bool(IMAGE_ARG),
                    "image_arg_value": IMAGE_ARG,
                    "end_frame_url": inp.get("last_frame_url"),
                    "end_frame_index": num_frames - 1,
                    "end_frame_configured": bool(last_frame_path),
                    "worker_env_keys": sorted(os.environ.keys()),
                    "character_reference_urls": inp.get("character_reference_urls"),
                    "environment_reference_url": inp.get("environment_reference_url"),
                    "audio_reference_urls": inp.get("audio_reference_urls"),
                    "transition_type": inp.get("transition_type"),
                    "motion_level": inp.get("motion_level"),
                },
            },
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}


runpod.serverless.start({"handler": handler})
