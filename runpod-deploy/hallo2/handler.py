"""
Hallo2 lip-sync handler
"""

import glob
import os
import shutil
import subprocess
import sys
import tempfile
import traceback
import uuid

import requests
import runpod
from omegaconf import OmegaConf

REPO_DIR = "/app/hallo2"
PRETRAINED_DIR = os.path.join(REPO_DIR, "pretrained_models")
CONFIG_PATH = os.path.join(REPO_DIR, "configs", "inference", "long.yaml")

S3_ENDPOINT = os.environ.get("BUCKET_ENDPOINT_URL")
S3_ACCESS_KEY = os.environ.get("BUCKET_ACCESS_KEY_ID")
S3_SECRET_KEY = os.environ.get("BUCKET_SECRET_ACCESS_KEY")
S3_BUCKET = os.environ.get("BUCKET_NAME")

# torch dynamo startup
STARTUP_SCRIPT = os.path.join(tempfile.gettempdir(), "_torch_startup.py")
with open(STARTUP_SCRIPT, "w") as f:
    f.write("import torch._dynamo\n")


def download_file(url: str, suffix: str) -> str:
    resp = requests.get(url, timeout=300, stream=True)
    resp.raise_for_status()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    for chunk in resp.iter_content(chunk_size=8192):
        tmp.write(chunk)
    tmp.close()

    # convert to wav if needed
    if suffix == ".wav":
        with open(tmp.name, "rb") as f:
            header = f.read(4)
        if header != b"RIFF":
            print(f"Audio is not WAV (header: {header[:4]}), converting to WAV...")
            wav_path = tmp.name + "_converted.wav"
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", tmp.name, "-ar", "16000", "-ac", "1", wav_path],
                capture_output=True, text=True,
            )
            if result.returncode == 0:
                os.unlink(tmp.name)
                os.rename(wav_path, tmp.name)
                print("Converted to WAV successfully")
            else:
                print(f"FFmpeg conversion failed: {result.stderr[-500:]}")

    return tmp.name


def upload_to_storage(file_path: str) -> str:
    import boto3
    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )

    key = f"hallo2/{uuid.uuid4().hex}{os.path.splitext(file_path)[1]}"
    s3.upload_file(file_path, S3_BUCKET, key)

    # get ipfs cid
    head = s3.head_object(Bucket=S3_BUCKET, Key=key)
    cid = head.get("Metadata", {}).get("Cid", "") or head.get("Metadata", {}).get("cid", "")

    if cid:
        return f"https://ipfs.filebase.io/ipfs/{cid}"
    return f"https://{S3_BUCKET}.s3.filebase.com/{key}"


def handler(event):
    tmp_paths = []

    try:
        job_input = event["input"]

        image_url = job_input.get("image_url")
        audio_url = job_input.get("audio_url")
        if not image_url or not audio_url:
            return {"error": "Both image_url and audio_url are required"}

        pose_weight = float(job_input.get("pose_weight", 1.0))
        face_weight = float(job_input.get("face_weight", 1.0))
        lip_weight = float(job_input.get("lip_weight", 1.0))
        guidance_scale = float(job_input.get("guidance_scale", 3.5))
        num_inference_steps = int(job_input.get("num_inference_steps", 40))
        face_expand_ratio = float(job_input.get("face_expand_ratio", 1.2))

        work_dir = tempfile.mkdtemp(prefix="hallo2_")
        tmp_paths.append(work_dir)

        print("Downloading input files...")
        image_path = download_file(image_url, suffix=".png")
        audio_path = download_file(audio_url, suffix=".wav")
        tmp_paths.extend([image_path, audio_path])

        output_dir = os.path.join(work_dir, "output")
        os.makedirs(output_dir, exist_ok=True)

        base_cfg = OmegaConf.load(CONFIG_PATH)
        overrides = OmegaConf.create({
            "source_image": image_path,
            "driving_audio": audio_path,
            "save_path": output_dir,
            "pose_weight": pose_weight,
            "face_weight": face_weight,
            "lip_weight": lip_weight,
            "face_expand_ratio": face_expand_ratio,
            "inference_steps": num_inference_steps,
            "cfg_scale": guidance_scale,
        })
        cfg = OmegaConf.merge(base_cfg, overrides)

        job_config_path = os.path.join(work_dir, "job_config.yaml")
        OmegaConf.save(cfg, job_config_path)

        print(f"Running Hallo2 inference: steps={num_inference_steps}, cfg={guidance_scale}")

        env = os.environ.copy()
        env["PYTHONPATH"] = REPO_DIR + ":" + env.get("PYTHONPATH", "")
        env["PYTHONSTARTUP"] = STARTUP_SCRIPT

        cmd = [
            sys.executable,
            os.path.join(REPO_DIR, "scripts", "inference_long.py"),
            "--config", job_config_path,
        ]

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=900,
            cwd=REPO_DIR,
            env=env,
        )

        print(f"Inference stdout (last 500 chars): {result.stdout[-500:]}")
        if result.returncode != 0:
            print(f"Inference stderr: {result.stderr[-2000:]}")
            return {
                "error": f"Inference failed (exit code {result.returncode})",
                "stderr": result.stderr[-2000:] if result.stderr else "",
                "stdout": result.stdout[-1000:] if result.stdout else "",
            }

        video_files = glob.glob(os.path.join(output_dir, "**", "*.mp4"), recursive=True)
        if not video_files:
            video_files = glob.glob(os.path.join(work_dir, "**", "*.mp4"), recursive=True)

        if not video_files:
            return {
                "error": "No output video found after inference",
                "stdout": result.stdout[-1000:] if result.stdout else "",
            }

        output_video = video_files[0]
        file_size_mb = os.path.getsize(output_video) / (1024 * 1024)
        print(f"Output video: {output_video} ({file_size_mb:.1f} MB)")

        video_url = upload_to_storage(output_video)
        print(f"Uploaded to: {video_url}")

        return {
            "status": "success",
            "output": {
                "url": video_url,
                "fps": 25,
                "file_size_mb": round(file_size_mb, 2),
                "format": "mp4",
            },
        }

    except subprocess.TimeoutExpired:
        return {"error": "Inference timed out after 15 minutes"}
    except requests.exceptions.RequestException as e:
        return {"error": f"Failed to download input file: {str(e)}"}
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e), "traceback": traceback.format_exc()}
    finally:
        for path in tmp_paths:
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path, ignore_errors=True)
                elif os.path.isfile(path):
                    os.unlink(path)
            except Exception:
                pass


runpod.serverless.start({"handler": handler})
