import runpod
import torch
import os
import uuid
import requests
import tempfile
from io import BytesIO

# pre-import transformers
try:
    from transformers import T5EncoderModel, T5TokenizerFast
    print("T5EncoderModel imported successfully")
except Exception as e:
    print(f"WARNING: Failed to import T5: {e}")
    import traceback
    traceback.print_exc()

pipe = None
fp8_enabled = False

MODEL_PATH = os.environ.get("MODEL_PATH", "/runpod-volume/ltxv-13b-distilled")


def load_models():
    global pipe, fp8_enabled

    if pipe is not None:
        return

    from diffusers import LTXConditionPipeline

    print(f"Loading model from {MODEL_PATH}...")

    pipe = LTXConditionPipeline.from_pretrained(
        MODEL_PATH,
        torch_dtype=torch.bfloat16,
        local_files_only=True,
    )

    # cpu offload for memory saving
    pipe.enable_sequential_cpu_offload()
    pipe.vae.enable_tiling()
    fp8_enabled = False

    print("Model loaded successfully!")


def download_image(url):
    from PIL import Image

    response = requests.get(url, timeout=30)
    response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    if not content_type.startswith("image/"):
        raise ValueError(f"URL does not point to an image: {content_type}")

    if len(response.content) > 20 * 1024 * 1024:
        raise ValueError("Image too large (max 20MB)")

    return Image.open(BytesIO(response.content)).convert("RGB")


def handler(job):
    try:
        job_input = job["input"]

        prompt = job_input.get("prompt")
        if not prompt:
            return {"error": "Missing required field: prompt"}

        load_models()

        negative_prompt = job_input.get("negative_prompt", "worst quality, inconsistent motion, blurry, jittery, distorted")
        height = job_input.get("height", 480)
        width = job_input.get("width", 832)
        num_frames = job_input.get("num_frames", 97)
        num_inference_steps = job_input.get("num_inference_steps", 8)
        guidance_scale = job_input.get("guidance_scale", 1.0)
        fps = job_input.get("fps", 24)
        seed = job_input.get("seed", None)

        # align dimensions
        height = (height // 32) * 32
        width = (width // 32) * 32

        # Align frames (must be divisible by 8 + 1)
        num_frames = ((num_frames - 1) // 8) * 8 + 1

        generator = None
        if seed is not None and seed >= 0:
            generator = torch.Generator(device="cuda").manual_seed(seed)

        # check for reference image
        image_url = job_input.get("image_url")
        reference_images = job_input.get("reference_images", [])

        conditions = None
        inference_type = "text-to-video"

        if image_url or reference_images:
            from diffusers.pipelines.ltx.pipeline_ltx_condition import LTXVideoCondition
            from diffusers.utils import export_to_video, load_video

            img_url = image_url if image_url else reference_images[0]
            image = download_image(img_url)

            # convert image to video condition
            video_frames = export_to_video([image])
            video = load_video(video_frames)
            conditions = [LTXVideoCondition(video=video, frame_index=0)]
            inference_type = "image-to-video"

        # run inference
        pipe_kwargs = dict(
            prompt=prompt,
            negative_prompt=negative_prompt,
            width=width,
            height=height,
            num_frames=num_frames,
            num_inference_steps=num_inference_steps,
            guidance_scale=guidance_scale,
            decode_timestep=0.05,
            image_cond_noise_scale=0.025,
            generator=generator,
            output_type="pil",
        )

        if conditions is not None:
            pipe_kwargs["conditions"] = conditions

        output = pipe(**pipe_kwargs).frames[0]

        # Save video
        from diffusers.utils import export_to_video

        output_filename = f"{uuid.uuid4().hex}.mp4"
        output_path = os.path.join(tempfile.gettempdir(), output_filename)
        export_to_video(output, output_path, fps=fps)

        # upload to filebase
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            endpoint_url=os.environ.get("BUCKET_ENDPOINT_URL", "https://s3.filebase.com"),
            aws_access_key_id=os.environ.get("BUCKET_ACCESS_KEY_ID", "BD440AF08461870E4884"),
            aws_secret_access_key=os.environ.get("BUCKET_SECRET_ACCESS_KEY", "6Q2qS1oiTwWRaaz4TL0J7tbUuExdPvd5PQ1yeGzi"),
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
        bucket = os.environ.get("BUCKET_NAME", "z-image")
        key = f"ltxv/{output_filename}"
        s3.upload_file(output_path, bucket, key)
        head = s3.head_object(Bucket=bucket, Key=key)
        cid = head.get("Metadata", {}).get("Cid", "") or head.get("Metadata", {}).get("cid", "")
        video_url = f"https://ipfs.filebase.io/ipfs/{cid}" if cid else f"https://{bucket}.s3.filebase.com/{key}"

        if os.path.exists(output_path):
            os.remove(output_path)

        duration = num_frames / fps

        return {
            "status": "success",
            "output": {
                "url": video_url,
                "duration": round(duration, 2),
                "format": "mp4",
                "resolution": f"{width}x{height}",
                "frames": num_frames,
                "fps": fps,
                "inference_type": inference_type,
                "seed": seed,
                "fp8_enabled": fp8_enabled,
            },
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}


runpod.serverless.start({"handler": handler})
