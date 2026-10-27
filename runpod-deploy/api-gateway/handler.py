"""
VoxAI / Workflow API Gateway
"""

import base64
import os
import tempfile
import time
import traceback
import uuid

import boto3
import requests
import runpod
from botocore.config import Config

# endpoint ids
ENDPOINTS = {
    "kokoro": os.environ.get("KOKORO_ENDPOINT_ID", "erpnk7ibq46vsv"),
    "zimage": os.environ.get("ZIMAGE_ENDPOINT_ID", "a6cjdpnprs4r1c"),
    "ltxv": os.environ.get("LTXV_ENDPOINT_ID", "pplcnagwfpyjgo"),
    "stable_audio": os.environ.get("STABLE_AUDIO_ENDPOINT_ID", "0kfc7l9nht1yr8"),
    "hallo2": os.environ.get("HALLO2_ENDPOINT_ID", "sbzo98l4kq8x5x"),
}

RUNPOD_API_KEY = os.environ.get("RUNPOD_API_KEY", "")
RUNPOD_BASE = "https://api.runpod.ai/v2"

# filebase s3 config
S3_ENDPOINT = os.environ.get("BUCKET_ENDPOINT_URL")
S3_ACCESS_KEY = os.environ.get("BUCKET_ACCESS_KEY_ID")
S3_SECRET_KEY = os.environ.get("BUCKET_SECRET_ACCESS_KEY")
S3_BUCKET = os.environ.get("BUCKET_NAME")


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def upload_base64_to_filebase(b64_data, prefix, ext):
    s3 = get_s3_client()
    raw = base64.b64decode(b64_data)

    key = f"{prefix}/{uuid.uuid4().hex}.{ext}"
    tmp = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}.{ext}")
    with open(tmp, "wb") as f:
        f.write(raw)

    s3.upload_file(tmp, S3_BUCKET, key)
    os.remove(tmp)

    head = s3.head_object(Bucket=S3_BUCKET, Key=key)
    cid = head.get("Metadata", {}).get("Cid", "") or head.get("Metadata", {}).get("cid", "")
    if cid:
        return f"https://ipfs.filebase.io/ipfs/{cid}"
    return f"https://{S3_BUCKET}.s3.filebase.com/{key}"


def call_endpoint_async(endpoint_key, payload):
    endpoint_id = ENDPOINTS[endpoint_key]
    url = f"{RUNPOD_BASE}/{endpoint_id}/run"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
    }
    resp = requests.post(url, json={"input": payload}, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()["id"]


def poll_job(endpoint_key, job_id, timeout=600):
    endpoint_id = ENDPOINTS[endpoint_key]
    url = f"{RUNPOD_BASE}/{endpoint_id}/status/{job_id}"
    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}"}

    start = time.time()
    while time.time() - start < timeout:
        resp = requests.get(url, headers=headers, timeout=30)
        data = resp.json()
        status = data.get("status")

        if status == "COMPLETED":
            return data.get("output", data)
        elif status == "FAILED":
            raise RuntimeError(f"Job failed: {data.get('error', 'unknown')}")

        time.sleep(3)

    raise TimeoutError(f"Job {job_id} timed out after {timeout}s")


def warm_up(endpoint_key):
    try:
        call_endpoint_async(endpoint_key, {"warmup": True})
    except Exception:
        pass


# voxai standalone endpoints

def voxai_generate_image(params):
    prompt = params.get("prompt")
    if not prompt:
        return {"error": "prompt is required"}

    warm_up("ltxv")

    job_id = call_endpoint_async("zimage", params)
    result = poll_job("zimage", job_id, timeout=300)
    image_data = result.get("image", result)

    return {
        "status": "success",
        "output": {
            "url": image_data.get("ipfs_url", image_data.get("url", "")),
            "prompt": params.get("prompt"),
        },
    }


def voxai_generate_video(params):
    prompt = params.get("prompt")
    if not prompt:
        return {"error": "prompt is required"}

    job_id = call_endpoint_async("ltxv", params)
    result = poll_job("ltxv", job_id, timeout=900)

    output = result.get("output", result) if isinstance(result, dict) else result
    return {"status": "success", "output": output}


def voxai_generate_audio(params):
    prompt = params.get("prompt")
    if not prompt:
        return {"error": "prompt is required"}

    job_id = call_endpoint_async("stable_audio", params)
    result = poll_job("stable_audio", job_id, timeout=900)

    output = result.get("output", result) if isinstance(result, dict) else result
    return {"status": "success", "output": output}


def voxai_generate_tts(params):
    text = params.get("text")
    if not text:
        return {"error": "text is required"}

    job_id = call_endpoint_async("kokoro", params)
    result = poll_job("kokoro", job_id, timeout=300)

    # kokoro returns base64, upload to filebase for public url
    audio_b64 = result.get("audio_base64", "")
    if not audio_b64:
        return {"error": "No audio returned from Kokoro"}

    fmt = result.get("format", "mp3")
    audio_url = upload_base64_to_filebase(audio_b64, "kokoro", fmt)

    return {
        "status": "success",
        "output": {
            "url": audio_url,
            "format": fmt,
            "voice": params.get("voice", "af_heart"),
            "text": text,
        },
    }


def voxai_lip_sync(params):
    if not params.get("image_url") or not params.get("audio_url"):
        return {"error": "image_url and audio_url are required"}

    job_id = call_endpoint_async("hallo2", params)

    # lip sync is long running, return job id for polling
    return {
        "status": "success",
        "output": {
            "job_id": job_id,
            "endpoint_id": ENDPOINTS["hallo2"],
            "poll_url": f"{RUNPOD_BASE}/{ENDPOINTS['hallo2']}/status/{job_id}",
            "message": "Lip-sync job submitted. Poll the poll_url for results.",
        },
    }


# workflow endpoints

def workflow_full_video(params):
    text = params.get("text", params.get("script", ""))
    if not text:
        return {"error": "text or script is required"}

    results = {}

    # generate voice
    voice_params = {
        "text": text,
        "voice": params.get("voice", "af_heart"),
        "speed": params.get("speed", 1.0),
    }
    tts_result = voxai_generate_tts(voice_params)
    if tts_result.get("status") != "success":
        return {"error": f"TTS failed: {tts_result.get('error', 'unknown')}"}
    results["voice"] = tts_result["output"]
    voice_url = tts_result["output"]["url"]

    # use provided image or generate new one
    image_url = params.get("image_url")
    if image_url:
        results["image"] = {"url": image_url, "source": "provided"}
    else:
        image_prompt = params.get("image_prompt", f"Cinematic portrait for: {text[:100]}")
        image_result = voxai_generate_image({"prompt": image_prompt})
        if image_result.get("status") != "success":
            return {"error": f"Image generation failed: {image_result.get('error', 'unknown')}"}
        results["image"] = image_result["output"]
        image_url = image_result["output"]["url"]

    # generate music (async, runs in parallel with video)
    music_prompt = params.get("music_prompt", "Cinematic ambient background music, soft and atmospheric")
    music_params = {
        "prompt": music_prompt,
        "duration": params.get("music_duration", 15.0),
        "num_inference_steps": params.get("music_steps", 100),
    }
    audio_job = call_endpoint_async("stable_audio", music_params)

    # generate video (runs while music generates)
    video_params = {
        "prompt": params.get("video_prompt", f"Cinematic scene: {text[:100]}"),
        "negative_prompt": "text, words, letters, subtitles, captions, watermark, logo, title, typography, writing, numbers, gibberish text, worst quality, blurry, distorted",
        "image_url": image_url,
        "height": params.get("height", 480),
        "width": params.get("width", 832),
        "num_frames": params.get("num_frames", 361),
        "num_inference_steps": params.get("video_steps", 8),
        "fps": params.get("fps", 24),
        "seed": params.get("seed"),
    }
    video_job = call_endpoint_async("ltxv", video_params)

    # wait for music and video
    music_result = poll_job("stable_audio", audio_job, timeout=900)
    music_output = music_result.get("output", music_result) if isinstance(music_result, dict) else music_result
    results["music"] = music_output

    video_result = poll_job("ltxv", video_job, timeout=900)
    video_output = video_result.get("output", video_result) if isinstance(video_result, dict) else video_result
    results["video"] = video_output

    # lip sync only if image has a face, otherwise skip
    skip_lipsync = params.get("skip_lipsync", False)
    if not skip_lipsync and voice_url and image_url:
        try:
            lipsync_params = {
                "image_url": image_url,
                "audio_url": voice_url,
                "pose_weight": params.get("pose_weight", 1.0),
                "face_weight": params.get("face_weight", 1.0),
                "lip_weight": params.get("lip_weight", 1.0),
            }
            lipsync_job = call_endpoint_async("hallo2", lipsync_params)
            results["lip_sync"] = {
                "job_id": lipsync_job,
                "poll_url": f"{RUNPOD_BASE}/{ENDPOINTS['hallo2']}/status/{lipsync_job}",
                "message": "Lip-sync job submitted. Poll the poll_url for results. Will fail gracefully if no face detected.",
            }
        except Exception as e:
            results["lip_sync"] = {"skipped": True, "reason": str(e)}
    else:
        results["lip_sync"] = {"skipped": True, "reason": "lip sync disabled or missing inputs"}

    return {
        "status": "success",
        "output": results,
    }


# storage

def storage_list(params):
    s3 = get_s3_client()
    prefix = params.get("prefix", "")
    max_keys = min(int(params.get("limit", 100)), 1000)

    resp = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix, MaxKeys=max_keys)
    files = []
    for obj in resp.get("Contents", []):
        try:
            head = s3.head_object(Bucket=S3_BUCKET, Key=obj["Key"])
            cid = head.get("Metadata", {}).get("Cid", "") or head.get("Metadata", {}).get("cid", "")
            url = f"https://ipfs.filebase.io/ipfs/{cid}" if cid else ""
        except Exception:
            url = ""

        files.append({
            "key": obj["Key"],
            "size": obj["Size"],
            "url": url,
            "last_modified": obj["LastModified"].isoformat(),
        })

    return {"status": "success", "files": files, "count": len(files)}


def storage_delete(params):
    key = params.get("key")
    if not key:
        return {"error": "key is required"}

    s3 = get_s3_client()
    s3.delete_object(Bucket=S3_BUCKET, Key=key)
    return {"status": "success", "deleted": key}


def storage_cleanup(params):
    s3 = get_s3_client()
    prefix = params.get("prefix", "")
    max_age_hours = int(params.get("max_age_hours", 24))

    resp = s3.list_objects_v2(Bucket=S3_BUCKET, Prefix=prefix, MaxKeys=1000)
    deleted = []
    cutoff = time.time() - (max_age_hours * 3600)

    for obj in resp.get("Contents", []):
        if obj["LastModified"].timestamp() < cutoff:
            s3.delete_object(Bucket=S3_BUCKET, Key=obj["Key"])
            deleted.append(obj["Key"])

    return {"status": "success", "deleted_count": len(deleted), "deleted": deleted}


def workflow_stitch(params):
    video_url = params.get("video_url")
    voice_url = params.get("voice_url")
    music_url = params.get("music_url")
    music_volume = float(params.get("music_volume", 0.3))

    if not video_url:
        return {"error": "video_url is required"}

    import subprocess

    work_dir = os.path.join(tempfile.gettempdir(), uuid.uuid4().hex)
    os.makedirs(work_dir, exist_ok=True)

    try:
        # download input files
        video_path = os.path.join(work_dir, "video.mp4")
        r = requests.get(video_url, timeout=120)
        r.raise_for_status()
        with open(video_path, "wb") as f:
            f.write(r.content)

        inputs = ["-i", video_path]
        filter_parts = []
        audio_count = 0

        if voice_url:
            voice_path = os.path.join(work_dir, "voice.mp3")
            r = requests.get(voice_url, timeout=120)
            r.raise_for_status()
            with open(voice_path, "wb") as f:
                f.write(r.content)
            inputs += ["-i", voice_path]
            audio_count += 1
            filter_parts.append(f"[{audio_count}:a]volume=1.0[voice]")

        if music_url:
            music_path = os.path.join(work_dir, "music.mp3")
            r = requests.get(music_url, timeout=120)
            r.raise_for_status()
            with open(music_path, "wb") as f:
                f.write(r.content)
            inputs += ["-i", music_path]
            audio_count += 1
            filter_parts.append(f"[{audio_count}:a]volume={music_volume}[music]")

        output_path = os.path.join(work_dir, "output.mp4")

        if voice_url and music_url:
            filter_str = f"[1:a]volume=1.0[voice];[2:a]volume={music_volume}[music];[voice][music]amix=inputs=2:duration=longest[out]"
            cmd = ["ffmpeg", "-y"] + inputs + ["-filter_complex", filter_str, "-map", "0:v", "-map", "[out]", "-c:v", "copy", "-c:a", "aac", "-shortest", output_path]
        elif voice_url:
            cmd = ["ffmpeg", "-y"] + inputs + ["-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", output_path]
        elif music_url:
            cmd = ["ffmpeg", "-y"] + inputs + ["-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-shortest", output_path]
        else:
            import shutil
            shutil.copy(video_path, output_path)
            cmd = None

        if cmd:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                return {"error": f"ffmpeg failed: {result.stderr[-500:]}"}

        # upload to filebase
        s3 = get_s3_client()
        key = f"stitched/{uuid.uuid4().hex}.mp4"
        s3.upload_file(output_path, S3_BUCKET, key)
        head = s3.head_object(Bucket=S3_BUCKET, Key=key)
        cid = head.get("Metadata", {}).get("Cid", "") or head.get("Metadata", {}).get("cid", "")
        final_url = f"https://ipfs.filebase.io/ipfs/{cid}" if cid else f"https://{S3_BUCKET}.s3.filebase.com/{key}"

        file_size = os.path.getsize(output_path)

        return {
            "status": "success",
            "output": {
                "url": final_url,
                "format": "mp4",
                "size_bytes": file_size,
            },
        }
    finally:
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)


def job_status(params):
    endpoint_id = params.get("endpoint_id")
    job_id = params.get("job_id")
    if not endpoint_id or not job_id:
        return {"error": "endpoint_id and job_id are required"}

    url = f"{RUNPOD_BASE}/{endpoint_id}/status/{job_id}"
    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}"}
    resp = requests.get(url, headers=headers, timeout=30)
    return resp.json()


# ---------------------------------------------------------------------------
# Capscify Phase 1: single-shot image-to-video bridge
# ---------------------------------------------------------------------------

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


def extract_last_frame(video_url, work_dir):
    """Download an mp4 and extract its last frame as a jpg. Returns local path."""
    import subprocess

    video_path = os.path.join(work_dir, "clip.mp4")
    r = requests.get(video_url, timeout=180)
    r.raise_for_status()
    if len(r.content) > 500 * 1024 * 1024:
        raise ValueError("Video too large (max 500MB)")
    with open(video_path, "wb") as f:
        f.write(r.content)

    frame_path = os.path.join(work_dir, "last_frame.jpg")
    cmd = [
        "ffmpeg", "-y",
        "-sseof", "-0.4", "-i", video_path,
        "-vframes", "1", "-q:v", "3",
        frame_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if proc.returncode != 0 or not os.path.exists(frame_path):
        raise RuntimeError(f"ffmpeg last-frame extraction failed: {proc.stderr[-500:]}")
    return frame_path


def capscify_generate_video(params):
    """
    Phase 1 contract:
      input:  { image_url, prompt, negative_prompt, duration_seconds (2-30),
                seed, [width, height, fps, num_inference_steps] }
      output: { video_url, last_frame_url, duration_seconds, num_frames,
                fps, resolution, seed, ltxv_job_id }

    Async model: this worker submits to the ltxv endpoint and polls it
    internally (up to ~20 min). Lovable submits via RunPod /run and polls
    THIS job with RunPod's native /status/{job_id} endpoint.
    """
    prompt = params.get("prompt")
    if not prompt:
        return {"error": "prompt is required"}

    image_url = params.get("image_url")
    negative_prompt = params.get(
        "negative_prompt",
        "worst quality, inconsistent motion, blurry, jittery, distorted, text, watermark, logo",
    )
    try:
        duration_seconds = float(params.get("duration_seconds", 10))
    except (TypeError, ValueError):
        return {"error": "duration_seconds must be a number"}
    duration_seconds = max(2.0, min(duration_seconds, 30.0))

    seed = params.get("seed")
    fps = int(params.get("fps", 24))
    width = int(params.get("width", 832))
    height = int(params.get("height", 480))

    # LTX-Video requires num_frames = 8n + 1
    num_frames = int(round(duration_seconds * fps))
    num_frames = ((num_frames - 1) // 8) * 8 + 1
    num_frames = max(9, num_frames)

    # predictive warm-up: wake the gpu worker while inputs are validated
    warm_up("ltxv")

    ltx_params = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "height": height,
        "width": width,
        "num_frames": num_frames,
        "num_inference_steps": int(params.get("num_inference_steps", 8)),
        "fps": fps,
        "seed": seed,
    }
    if image_url:
        ltx_params["image_url"] = image_url

    job_id = call_endpoint_async("ltxv", ltx_params)
    result = poll_job("ltxv", job_id, timeout=1200)
    output = result.get("output", result) if isinstance(result, dict) else {}
    video_url = output.get("url") if isinstance(output, dict) else None
    if not video_url:
        return {"error": "ltxv job completed without a video url", "ltxv_result": result}

    work_dir = os.path.join(tempfile.gettempdir(), uuid.uuid4().hex)
    os.makedirs(work_dir, exist_ok=True)
    try:
        frame_path = extract_last_frame(video_url, work_dir)
        last_frame_url = upload_file_to_filebase(frame_path, "capscify/frames")
    finally:
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)

    return {
        "status": "success",
        "output": {
            "video_url": video_url,
            "last_frame_url": last_frame_url,
            "duration_seconds": round(num_frames / fps, 2),
            "num_frames": num_frames,
            "fps": fps,
            "resolution": f"{width}x{height}",
            "seed": seed,
            "ltxv_job_id": job_id,
        },
    }


# ---------------------------------------------------------------------------
# Capscify Phase 2: FFmpeg stitch & audio sync worker
# ---------------------------------------------------------------------------

def _ffprobe_duration(path):
    import subprocess
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration",
           "-of", "default=noprint_wrappers=1:nokey=1", path]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    try:
        return float(proc.stdout.strip())
    except (TypeError, ValueError, AttributeError):
        return 0.0


def _clip_has_audio(path):
    import subprocess
    cmd = ["ffprobe", "-v", "error", "-select_streams", "a",
           "-show_entries", "stream=codec_type",
           "-of", "csv=p=0", path]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return "audio" in proc.stdout


def _srt_timestamp(seconds):
    ms = int(round(float(seconds) * 1000))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _build_srt(segments):
    lines = []
    idx = 1
    for seg in segments:
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        start = float(seg.get("start", 0))
        end = float(seg.get("end", start + 2))
        lines.append(f"{idx}\n{_srt_timestamp(start)} --> {_srt_timestamp(end)}\n{text}\n")
        idx += 1
    return "\n".join(lines)


def _vtt_to_srt(text):
    lines = text.splitlines()
    while lines and (lines[0].strip() == "" or lines[0].startswith("WEBVTT")):
        lines.pop(0)
    return "\n".join(l.replace(".", ",") if "-->" in l else l for l in lines)


def capscify_stitch_final(params):
    """
    Phase 2 contract:
      input:  { video_clips: [{url, shot_index}],
                voiceover_url?, soundtrack_url?, subtitles?,
                resolution? ("1280x720"), music_volume? (0-1),
                ducking? (default true),
                preserve_clip_audio? (default true) }
      subtitles: url to .srt/.vtt, or {"segments":[{start,end,text}]}, or [...]
      output: { final_video_url, duration_seconds, clips_used, resolution,
                voiceover, soundtrack, subtitles, clip_audio_preserved }

    Clips are normalized (scale/pad/fps/h264 + AAC 48kHz stereo audio)
    before concat so there is no A/V drift. With preserve_clip_audio
    (default), each clip's native audio is carried through the concat;
    clips without an audio track get a silent track so the concat stays
    uniform. Voiceover (when present) ducks both clip audio and music
    when ducking is on. With preserve_clip_audio=false, the legacy
    behavior applies: clip audio is stripped and only voiceover /
    soundtrack are mixed. All audio is trimmed/padded to the exact
    video duration.
    """
    import subprocess

    clips = params.get("video_clips")
    if not clips or not isinstance(clips, list):
        return {"error": "video_clips[] is required (non-empty array)"}
    clips = sorted(clips, key=lambda c: c.get("shot_index", 0))

    voiceover_url = params.get("voiceover_url")
    soundtrack_url = params.get("soundtrack_url")
    subtitles = params.get("subtitles")
    music_volume = float(params.get("music_volume", 0.35))
    ducking = bool(params.get("ducking", True))
    preserve_clip_audio = bool(params.get("preserve_clip_audio", True))

    try:
        w, h = params.get("resolution", "1280x720").lower().split("x")
        W, H = int(w), int(h)
    except (ValueError, AttributeError):
        return {"error": "resolution must look like '1280x720'"}
    W -= W % 2
    H -= H % 2  # h264 requires even dimensions

    work_dir = os.path.join(tempfile.gettempdir(), uuid.uuid4().hex)
    os.makedirs(work_dir, exist_ok=True)
    try:
        # 1. download + normalize each clip to identical codec/geometry/fps
        norm_files = []
        for i, clip in enumerate(clips):
            url = clip.get("url")
            if not url:
                return {"error": f"video_clips[{i}] missing url"}
            src = os.path.join(work_dir, f"src_{i}.mp4")
            r = requests.get(url, timeout=180)
            r.raise_for_status()
            if len(r.content) > 500 * 1024 * 1024:
                return {"error": f"video_clips[{i}] too large (max 500MB)"}
            with open(src, "wb") as f:
                f.write(r.content)
            norm = os.path.join(work_dir, f"norm_{i}.mp4")
            vf = (f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
                  f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24")
            if preserve_clip_audio and _clip_has_audio(src):
                # keep native audio, normalized to AAC 48kHz stereo
                cmd = ["ffmpeg", "-y", "-i", src, "-vf", vf,
                       "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                       "-pix_fmt", "yuv420p",
                       "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                       "-shortest", norm]
            elif preserve_clip_audio:
                # no audio track: add a silent track so the concat stays uniform
                cmd = ["ffmpeg", "-y", "-i", src,
                       "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
                       "-vf", vf, "-map", "0:v", "-map", "1:a",
                       "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                       "-pix_fmt", "yuv420p",
                       "-c:a", "aac", "-b:a", "192k", "-shortest", norm]
            else:
                # legacy: strip clip audio, video-only concat
                cmd = ["ffmpeg", "-y", "-i", src, "-vf", vf,
                       "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                       "-pix_fmt", "yuv420p", "-an", norm]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
            if proc.returncode != 0:
                return {"error": f"normalize clip {i} failed: {proc.stderr[-400:]}"}
            norm_files.append(norm)

        # 2. concat (demuxer is safe: all clips now uniform)
        list_path = os.path.join(work_dir, "concat.txt")
        with open(list_path, "w") as f:
            for nf in norm_files:
                f.write(f"file '{nf}'\n")
        concat_path = os.path.join(work_dir, "concat.mp4")
        cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
               "-i", list_path, "-c", "copy", concat_path]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        if proc.returncode != 0:
            return {"error": f"concat failed: {proc.stderr[-400:]}"}
        total_d = _ffprobe_duration(concat_path)
        if total_d <= 0:
            return {"error": "could not determine concatenated duration"}
        D = f"{total_d:.3f}"

        # 3. download audio tracks
        inputs = ["-i", concat_path]
        has_voice = False
        has_music = False
        if voiceover_url:
            vp = os.path.join(work_dir, "voice.mp3")
            r = requests.get(voiceover_url, timeout=180)
            r.raise_for_status()
            with open(vp, "wb") as f:
                f.write(r.content)
            inputs += ["-i", vp]
            has_voice = True
        if soundtrack_url:
            mp = os.path.join(work_dir, "music.mp3")
            r = requests.get(soundtrack_url, timeout=180)
            r.raise_for_status()
            with open(mp, "wb") as f:
                f.write(r.content)
            inputs += ["-i", mp]
            has_music = True

        # input indices: 0=concat (video+audio when preserving),
        # 1=voice?, 2=music? (voice added before music)
        vi = 1 if has_voice else None
        mi = (2 if has_voice else 1) if has_music else None
        sc = "sidechaincompress=threshold=0.03:ratio=6:attack=300:release=800"

        if preserve_clip_audio:
            clip = f"[0:a]atrim=0:{D},apad=whole_dur={D}[clip];"
            if has_voice and has_music and ducking:
                # NOTE: a filter output feeding a sidechaincompress sidechain
                # AND another filter must be explicitly split — this ffmpeg
                # build drops the second consumer's audio otherwise (voice
                # vanished after ~2.5s in local tests without asplit).
                fc = (clip +
                      f"[{vi}:a]atrim=0:{D},apad=whole_dur={D}[voice];"
                      f"[{mi}:a]volume={music_volume},atrim=0:{D}[music];"
                      f"[voice]asplit=3[voice_sc1][voice_sc2][voice_mix];"
                      f"[clip][voice_sc1]{sc}[duckedclip];"
                      f"[music][voice_sc2]{sc}[duckedmusic];"
                      f"[duckedclip][voice_mix][duckedmusic]amix=inputs=3:"
                      f"duration=first:dropout_transition=0[aout]")
            elif has_voice and has_music:
                fc = (clip +
                      f"[{vi}:a]atrim=0:{D},apad=whole_dur={D}[voice];"
                      f"[{mi}:a]volume={music_volume},atrim=0:{D}[music];"
                      f"[clip][voice][music]amix=inputs=3:"
                      f"duration=first:dropout_transition=0[aout]")
            elif has_voice and ducking:
                fc = (clip +
                      f"[{vi}:a]atrim=0:{D},apad=whole_dur={D}[voice];"
                      f"[voice]asplit=2[voice_sc][voice_mix];"
                      f"[clip][voice_sc]{sc}[duckedclip];"
                      f"[duckedclip][voice_mix]amix=inputs=2:"
                      f"duration=first:dropout_transition=0[aout]")
            elif has_voice:
                fc = (clip +
                      f"[{vi}:a]atrim=0:{D},apad=whole_dur={D}[voice];"
                      f"[clip][voice]amix=inputs=2:"
                      f"duration=first:dropout_transition=0[aout]")
            elif has_music:
                fc = (clip +
                      f"[{mi}:a]volume={music_volume},atrim=0:{D}[music];"
                      f"[clip][music]amix=inputs=2:"
                      f"duration=first:dropout_transition=0[aout]")
            else:
                fc = None
        else:
            if has_voice and has_music and ducking:
                fc = (f"[{vi}:a]atrim=0:{D},apad=whole_dur={D},asetpts=PTS-STARTPTS[voice];"
                      f"[{mi}:a]volume={music_volume},atrim=0:{D}[music];"
                      f"[voice]asplit=2[voice_sc][voice_mix];"
                      f"[music][voice_sc]{sc}[ducked];"
                      f"[voice_mix][ducked]amix=inputs=2:duration=first:dropout_transition=0[aout]")
            elif has_voice and has_music:
                fc = (f"[{vi}:a]atrim=0:{D},apad=whole_dur={D}[voice];"
                      f"[{mi}:a]volume={music_volume},atrim=0:{D}[music];"
                      f"[voice][music]amix=inputs=2:duration=first:dropout_transition=0[aout]")
            elif has_voice:
                fc = f"[{vi}:a]atrim=0:{D},apad=whole_dur={D}[aout]"
            elif has_music:
                fc = f"[{mi}:a]volume={music_volume},atrim=0:{D}[aout]"
            else:
                fc = None

        av_path = os.path.join(work_dir, "av.mp4")
        if fc:
            cmd = (["ffmpeg", "-y"] + inputs +
                   ["-filter_complex", fc, "-map", "0:v", "-map", "[aout]",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-movflags", "+faststart", av_path])
        elif preserve_clip_audio:
            # clip audio only: carry both streams through untouched
            cmd = (["ffmpeg", "-y"] + inputs +
                   ["-map", "0:v", "-map", "0:a",
                    "-c:v", "copy", "-c:a", "copy",
                    "-movflags", "+faststart", av_path])
        else:
            cmd = (["ffmpeg", "-y"] + inputs +
                   ["-c:v", "copy", "-movflags", "+faststart", av_path])
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
        if proc.returncode != 0:
            return {"error": f"audio mix failed: {proc.stderr[-500:]}"}

        # 4. subtitles -> soft-muxed mov_text track
        final_path = av_path
        srt_text = None
        if subtitles:
            if isinstance(subtitles, str):
                r = requests.get(subtitles, timeout=60)
                r.raise_for_status()
                body = r.text
                srt_text = _vtt_to_srt(body) if "WEBVTT" in body[:32] else body
            elif isinstance(subtitles, dict):
                srt_text = _build_srt(subtitles.get("segments", []))
            elif isinstance(subtitles, list):
                srt_text = _build_srt(subtitles)
        if srt_text and srt_text.strip():
            srt_path = os.path.join(work_dir, "subs.srt")
            with open(srt_path, "w") as f:
                f.write(srt_text)
            subbed_path = os.path.join(work_dir, "final.mp4")
            cmd = ["ffmpeg", "-y", "-i", av_path, "-i", srt_path,
                   "-c", "copy", "-c:s", "mov_text",
                   "-movflags", "+faststart", subbed_path]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
            if proc.returncode != 0:
                return {"error": f"subtitle mux failed: {proc.stderr[-400:]}"}
            final_path = subbed_path

        final_url = upload_file_to_filebase(final_path, "capscify/final")
        return {
            "status": "success",
            "output": {
                "final_video_url": final_url,
                "duration_seconds": round(total_d, 2),
                "clips_used": len(norm_files),
                "resolution": f"{W}x{H}",
                "voiceover": has_voice,
                "soundtrack": has_music,
                "subtitles": bool(srt_text and srt_text.strip()),
                "clip_audio_preserved": preserve_clip_audio,
            },
        }
    finally:
        import shutil
        shutil.rmtree(work_dir, ignore_errors=True)


# routes

ROUTES = {
    "voxai/generate-image": voxai_generate_image,
    "voxai/generate-video": voxai_generate_video,
    "voxai/generate-audio": voxai_generate_audio,
    "voxai/generate-tts": voxai_generate_tts,
    "voxai/lip-sync": voxai_lip_sync,
    "workflow/generate-image": voxai_generate_image,
    "workflow/generate-video": voxai_generate_video,
    "workflow/generate-audio": voxai_generate_audio,
    "workflow/generate-tts": voxai_generate_tts,
    "workflow/lip-sync": voxai_lip_sync,
    "workflow/full-video": workflow_full_video,
    "workflow/stitch": workflow_stitch,
    "storage/list": storage_list,
    "storage/delete": storage_delete,
    "storage/cleanup": storage_cleanup,
    "job/status": job_status,
    "capscify/generate-video": capscify_generate_video,
    "capscify/stitch-final": capscify_stitch_final,
}


def handler(event):
    try:
        job_input = event["input"]
        route = job_input.get("route", "")
        params = job_input.get("params", {})

        if not route:
            return {
                "error": "route is required",
                "available_routes": list(ROUTES.keys()),
            }

        handler_fn = ROUTES.get(route)
        if not handler_fn:
            return {
                "error": f"Unknown route: {route}",
                "available_routes": list(ROUTES.keys()),
            }

        return handler_fn(params)

    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "error": str(e)}


runpod.serverless.start({"handler": handler})
