FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg git && rm -rf /var/lib/apt/lists/*

# upgrade pytorch and remove incompatible torchao
RUN pip install --no-cache-dir torch==2.5.1 torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
RUN pip uninstall -y torchao || true

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# need latest diffusers for LTXConditionPipeline
RUN pip install --no-cache-dir git+https://github.com/huggingface/diffusers

# quick import check
RUN python3 -c "\
from transformers import T5EncoderModel, T5TokenizerFast; print('T5EncoderModel OK'); \
from diffusers import LTXConditionPipeline; print('LTXConditionPipeline OK'); \
import sentencepiece; print('sentencepiece OK')"

COPY handler.py /app/

CMD ["python3", "-u", "/app/handler.py"]
