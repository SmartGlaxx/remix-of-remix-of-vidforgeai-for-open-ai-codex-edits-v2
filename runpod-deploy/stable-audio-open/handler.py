import io
import os
import tempfile
import traceback
import uuid

import runpod
import soundfile as sf
import torch

pipe = None

MODEL_ID = "stabilityai/stable-audio-open-1.0"


def load_model():
    global pipe
    if pipe is not None:
        return

    from diffusers import StableAudioPipeline

    print("Loading Stable Audio Open 1.0 pipeline...")
    pipe = StableAudioPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
        token=os.environ.get("HF_TOKEN"),
    )
    pipe = pipe.to("cuda")
    pipe.enable_vae_slicing()
    print("Pipeline loaded successfully.")


def handler(event):
    try:
        job_input = event["input"]

        prompt = job_input.get("prompt")
        if not prompt:
            return {"error": "prompt is required"}

        load_model()

        negative_prompt = job_input.get("negative_prompt", "Low quality.")
        duration = min(float(job_input.get("duration", 10.0)), 47.0)
        num_inference_steps = int(job_input.get("num_inference_steps", 100))
        seed = job_input.get("seed")
        guidance_scale = float(job_input.get("guidance_scale", 7.0))
        num_waveforms = int(job_input.get("num_waveforms", 1))
        output_format = job_input.get("output_format", "wav").lower()

        if output_format not in ("wav", "flac"):
            output_format = "wav"

        generator = None
        if seed is not None:
            generator = torch.Generator("cuda").manual_seed(int(seed))

        print(f"Generating audio: prompt='{prompt[:80]}', duration={duration}s, steps={num_inference_steps}")

        result = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=num_inference_steps,
            audio_end_in_s=duration,
            guidance_scale=guidance_scale,
            num_waveforms_per_prompt=num_waveforms,
            generator=generator,
        )

        audio = result.audios[0]
        audio_np = audio.T.float().cpu().numpy()
        sample_rate = pipe.vae.sampling_rate

        # save temp file
        output_filename = f"{uuid.uuid4().hex}.{output_format}"
        output_path = os.path.join(tempfile.gettempdir(), output_filename)
        sf.write(output_path, audio_np, sample_rate, format=output_format.upper())

        # upload to filebase
        import boto3
        from botocore.config import Config

        s3 = boto3.client(
            "s3",
            endpoint_url=os.environ.get("BUCKET_ENDPOINT_URL"),
            aws_access_key_id=os.environ.get("BUCKET_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("BUCKET_SECRET_ACCESS_KEY"),
            config=Config(signature_version="s3v4"),
            region_name="us-east-1",
        )
        bucket = os.environ.get("BUCKET_NAME")
        key = f"stable-audio/{output_filename}"
        s3.upload_file(output_path, bucket, key)
        head = s3.head_object(Bucket=bucket, Key=key)
        cid = head.get("Metadata", {}).get("Cid", "") or head.get("Metadata", {}).get("cid", "")
        audio_url = f"https://ipfs.filebase.io/ipfs/{cid}" if cid else f"https://{bucket}.s3.filebase.com/{key}"

        if os.path.exists(output_path):
            os.remove(output_path)

        return {
            "status": "success",
            "output": {
                "url": audio_url,
                "sample_rate": sample_rate,
                "format": output_format,
                "duration": duration,
            },
        }

    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "error": str(e)}


runpod.serverless.start({"handler": handler})
