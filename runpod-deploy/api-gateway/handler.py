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

    # generate image
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

    # submit lip sync (async, client polls for result)
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
        "message": "Lip-sync job submitted. Poll the poll_url for results.",
    }

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
