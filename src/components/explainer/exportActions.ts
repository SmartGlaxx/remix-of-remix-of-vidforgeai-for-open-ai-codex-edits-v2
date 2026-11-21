// All action clips are silent. Fit each source into a shared landscape frame.
export async function exportActions(sources: string[], signal: AbortSignal): Promise<Blob> {
  const mime = ["video/mp4", "video/webm;codecs=vp8", "video/webm"].find(type =>
    typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
  if (!mime) throw new Error("This browser cannot record video. Try Chrome or Edge.");
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const pen = canvas.getContext("2d");
  if (!pen || !canvas.captureStream) throw new Error("This browser cannot export canvas video.");
  const videos = new Map<string, HTMLVideoElement>();
  let stream: MediaStream | undefined;
  let frame = 0;
  let recorder: MediaRecorder | undefined;
  const lifetime = new AbortController();
  const abort = () => lifetime.abort();
  signal.addEventListener("abort", abort);
  function waitFor(video: HTMLVideoElement, event: string, start: () => void | Promise<void>) {
    return new Promise<void>((resolve,reject) => {
      const listeners = new AbortController();
      function finish(error?: Error) {
        listeners.abort();
        if (error) reject(error); else resolve();
      }
      if (signal.aborted || lifetime.signal.aborted) return finish(new Error("Export cancelled."));
      const opts = {once:true, signal:listeners.signal};
      video.addEventListener(event, () => finish(), opts);
      video.addEventListener("error", () => finish(new Error("Could not read an action clip.")), opts);
      lifetime.signal.addEventListener("abort", () => finish(new Error("Export interrupted.")), opts);
      Promise.resolve().then(start).catch(finish);
    });
  }
  try {
    await Promise.all([...new Set(sources)].map(async src => {
      const video = document.createElement("video");
      video.muted = true; video.playsInline = true; video.preload = "auto";
      videos.set(src,video);
      await waitFor(video,"loadeddata",() => {video.src = src;});
    }));
    function draw(video: HTMLVideoElement) {
      const scale = Math.min(canvas.width/video.videoWidth,canvas.height/video.videoHeight);
      const w = video.videoWidth*scale, h = video.videoHeight*scale;
      pen!.fillStyle = "black"; pen!.fillRect(0,0,canvas.width,canvas.height);
      pen!.drawImage(video,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
    }
    draw(videos.get(sources[0])!);
    stream = canvas.captureStream(30);
    recorder = new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000});
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => {if (event.data.size) chunks.push(event.data);};
    recorder.onerror = abort;
    recorder.start();
    for (const src of sources) {
      const video = videos.get(src)!;
      if (video.currentTime > 0) await waitFor(video,"seeked",() => {video.currentTime = 0;});
      function paint() {draw(video); frame = requestAnimationFrame(paint);}
      paint();
      await waitFor(video,"ended",() => video.play());
      cancelAnimationFrame(frame);
    }
    const stopped = new Promise<void>(resolve => recorder!.onstop = () => resolve());
    recorder.stop();
    await stopped;
    if (!chunks.length) throw new Error("No video was recorded. Retry with the tab visible.");
    return new Blob(chunks,{type:mime});
  } finally {
    lifetime.abort();
    signal.removeEventListener("abort",abort);
    cancelAnimationFrame(frame);
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach(track => track.stop());
    videos.forEach(video => {video.pause(); video.removeAttribute("src"); video.load();});
  }
}
