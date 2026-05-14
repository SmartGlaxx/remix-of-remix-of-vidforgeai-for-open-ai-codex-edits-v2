FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    git \
    git-lfs \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/fudan-generative-vision/hallo2.git /app/hallo2

WORKDIR /app/hallo2

# install deps
RUN pip install --no-cache-dir --upgrade pip && \
    rm -rf /usr/lib/python3/dist-packages/blinker* || true && \
    sed -i '/^opencv-python==/d' requirements.txt && \
    sed -i '/^xformers/d' requirements.txt && \
    pip install --no-cache-dir --ignore-installed -r requirements.txt && \
    pip install --no-cache-dir \
        runpod>=1.7.0 \
        requests>=2.31.0 \
        pydub>=0.25.1 \
        huggingface_hub \
        boto3>=1.34.0

# pin correct pytorch + xformers versions
RUN pip install --no-cache-dir --force-reinstall \
    torch==2.3.1 torchvision==0.18.1 torchaudio==2.3.1 \
    --index-url https://download.pytorch.org/whl/cu121
RUN pip install --no-cache-dir --force-reinstall \
    xformers==0.0.27 --index-url https://download.pytorch.org/whl/cu121

# fix numpy + onnxruntime compatibility
RUN pip install --no-cache-dir --force-reinstall numpy==1.26.4
RUN pip uninstall -y onnxruntime onnxruntime-gpu || true
RUN pip install --no-cache-dir onnxruntime-gpu==1.17.1

# verify imports
RUN python3 -c "\
import torch; print(f'PyTorch {torch.__version__}'); \
import numpy; print(f'numpy {numpy.__version__}'); \
import xformers; print(f'xformers OK'); \
import onnxruntime; print(f'onnxruntime {onnxruntime.__version__}'); \
from diffusers import AutoencoderKL, DDIMScheduler; print('diffusers OK'); \
from transformers import Wav2Vec2Model, Wav2Vec2Processor; print('wav2vec OK'); \
import cv2; print(f'opencv {cv2.__version__}'); \
import insightface; print('insightface OK'); \
import mediapipe; print('mediapipe OK'); \
from audio_separator.separator import Separator; print('audio_separator OK'); \
from omegaconf import OmegaConf; print('omegaconf OK'); \
import librosa; print('librosa OK'); \
print('all imports ok')"

# download pretrained models
RUN huggingface-cli download fudan-generative-ai/hallo2 \
        --local-dir ./pretrained_models && \
    echo "Pretrained models downloaded successfully"

COPY handler.py /app/hallo2/handler.py

ENV PYTHONPATH="/app/hallo2"

WORKDIR /app/hallo2

CMD ["python3", "-u", "handler.py"]
