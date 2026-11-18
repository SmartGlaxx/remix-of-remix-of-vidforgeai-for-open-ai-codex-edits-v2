export interface FilmScene {
  line: string;
  prompt: string;
  label: string;
  diagram?: {kind: "flow" | "comparison" | "sequence"; labels: string[]};
  image?: string;
  audio?: string;
  job_id?: string;
  endpoint_id?: string;
}

async function loadImage(url: string) {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  return image;
}

export async function renderFilm(scenes: FilmScene[], progress: (seconds: number) => void, signal: AbortSignal) {
  const mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(type =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
  if (!mime) throw new Error("Video export requires a browser with MediaRecorder support.");
  const ctx = new AudioContext();
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const pen = canvas.getContext("2d")!;
  let stream: MediaStream | undefined;
  let frame = 0;
  try {
    await ctx.resume();
    const assets = await Promise.all(scenes.map(async scene => {
      const [image, response] = await Promise.all([loadImage(scene.image!), fetch(scene.audio!, {signal})]);
      if (!response.ok) throw new Error("Could not load the saved narration.");
      const audio = await ctx.decodeAudioData(await response.arrayBuffer());
      return {image, audio};
    }));
    signal.throwIfAborted();
    const total = assets.reduce((sum, asset) => sum + asset.audio.duration, 0);
    const rate = total / 60;
    if (!(rate > 0)) throw new Error("Narration has no playable duration.");
    const output = ctx.createMediaStreamDestination();
    stream = canvas.captureStream(30);
    stream.addTrack(output.stream.getAudioTracks()[0]);
    const recorder = new MediaRecorder(stream, {mimeType: mime, videoBitsPerSecond: 4000000});
    const parts: Blob[] = [];
    const starts: number[] = [];
    let offset = 0;
    for (const asset of assets) {
      starts.push(offset);
      offset += asset.audio.duration / rate;
    }
    function draw(t: number) {
      let i = starts.length - 1;
      while (i > 0 && starts[i] > t) i--;
      const p = Math.min(1, (t - starts[i]) / (assets[i].audio.duration / rate));
      const image = assets[i].image;
      const scale = Math.max(1280 / image.width, 720 / image.height) * 1.08;
      const w = image.width * scale, h = image.height * scale;
      pen.drawImage(image, (1280-w)*(.35+.3*(i%2 ? 1-p : p)), (720-h)/2, w, h);
      const diagram = scenes[i].diagram;
      if (diagram) {
        pen.save();
        const vertical = diagram.kind === "comparison";
        for (const [step, label] of diagram.labels.entries()) {
          const reveal = Math.min(1, Math.max(0, (p * 4 - step) * 2));
          pen.globalAlpha = reveal;
          const x = vertical ? 846 : 64 + step * 390;
          const y = (vertical ? 72 + step * 70 : 70) + (1-reveal) * 24;
          pen.fillStyle = "#102323eb";
          pen.fillRect(x, y, 350, 54);
          pen.fillStyle = "#edc078";
          pen.fillRect(x, y, 5, 54);
          pen.font = "bold 26px sans-serif";
          pen.fillStyle = "white";
          pen.fillText(label, x+18, y+35, 315);
          if (diagram.kind === "flow" && step < 2) pen.fillText("→", x+354, y+35);
        }
        pen.restore();
      }
      const gradient = pen.createLinearGradient(0, 430, 0, 720);
      gradient.addColorStop(0, "transparent");
      gradient.addColorStop(1, "#051016");
      pen.fillStyle = gradient;
      pen.fillRect(0, 430, 1280, 290);
      pen.fillStyle = "#ffe7b0";
      pen.font = "bold 52px sans-serif";
      pen.fillText(scenes[i].label, 64, 617 + 26*Math.max(0,1-p*8), 1152);
      pen.fillStyle = "#54dab4";
      pen.fillRect(64, 655, 1152 * t / 60, 5);
    }
    draw(0);
    return await new Promise<Blob>((resolve, reject) => {
      const abort = () => { if (recorder.state !== "inactive") recorder.stop(); reject(new Error("Render interrupted. Your scenes are saved.")); };
      recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      recorder.onerror = () => { abort(); };
      recorder.onstop = () => {
        signal.removeEventListener("abort", abort);
        if (parts.length) resolve(new Blob(parts, {type: recorder.mimeType}));
        else reject(new Error("The browser returned an empty recording."));
      };
      recorder.start(1000);
      signal.addEventListener("abort", abort, {once: true});
      const start = ctx.currentTime;
      assets.forEach(({audio}, i) => {
        const source = ctx.createBufferSource();
        source.buffer = audio;
        source.playbackRate.value = rate;
        source.connect(output);
        source.start(start + starts[i]);
      });
      function tick() {
        const t = ctx.currentTime - start;
        draw(Math.min(60,t));
        progress(Math.floor(t));
        if (t >= 60) recorder.stop();
        else frame = requestAnimationFrame(tick);
      }
      tick();
    });
  } finally {
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop());
    await ctx.close();
  }
}
