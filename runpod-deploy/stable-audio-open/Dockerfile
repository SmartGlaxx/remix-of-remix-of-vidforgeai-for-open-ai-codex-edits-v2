FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# upgrade pytorch and remove incompatible torchao
RUN pip install --no-cache-dir torch==2.5.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
RUN pip uninstall -y torchao || true

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# quick import check
RUN python3 -c "from diffusers import StableAudioPipeline; print('StableAudioPipeline OK')"

COPY handler.py .

CMD ["python3", "-u", "handler.py"]
