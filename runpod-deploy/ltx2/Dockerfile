# Capscify Studio Mode — LTX-2.x worker image
# Mirrors the runpod-deploy/ltxv-13b pattern, but installs the official
# LTX-2 pipelines package instead of the diffusers LTX pipeline.
#
# Model weights are NOT baked into this image. They are read at job time
# from the attached network volume (VOLUME_ROOT, default /runpod-volume):
#   ltx25/  (LTX-2.5, 71.1GB) and ltx23/ (LTX-2.3, ~70GB).
# The serverless endpoint MUST attach that volume or every job fails
# fast with the exact missing path.

FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg git && rm -rf /var/lib/apt/lists/*

# Same torch pin as the proven ltxv-13b worker; bump only if
# ltx-pipelines requires a newer torch.
RUN pip install --no-cache-dir torch==2.5.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
RUN pip uninstall -y torchao || true

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Official LTX-2 pipelines (distilled T2V/I2V with native audio).
RUN git clone https://github.com/Lightricks/LTX-2.git /root/LTX-2 \
    && pip install --no-cache-dir -e /root/LTX-2/packages/ltx-core -e /root/LTX-2/packages/ltx-pipelines

# Install check that does not import heavy modules (no GPU at build time).
RUN python3 -c "import importlib.util as u; assert u.find_spec('ltx_pipelines'), 'ltx_pipelines missing'; print('ltx_pipelines OK')"

COPY handler.py /app/

CMD ["python3", "-u", "/app/handler.py"]
