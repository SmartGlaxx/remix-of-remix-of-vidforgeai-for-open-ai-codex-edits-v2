import { useEffect, useState } from "react";

/** Draw the overview from the selected soundtrack's decoded samples. */
export default function TrackWaveform({ url }: { url?: string }) {
  const [shape, setShape] = useState("");
  useEffect(() => {
    setShape("");
    if (!url) return;
    const controller = new AbortController();
    let context: AudioContext | undefined;
    async function load(source: string) {
      const response = await fetch(source, { signal: controller.signal });
      if (!response.ok) return;
      const bytes = await response.arrayBuffer();
      if (controller.signal.aborted) return;
      context = new AudioContext({ sampleRate: 8000 });
      const audio = await context.decodeAudioData(bytes);
      if (controller.signal.aborted) return;
      const data = audio.getChannelData(0);
      const peaks = Array.from({ length: 480 }, (_, i) => {
        const start = Math.floor(i * data.length / 480);
        const end = Math.floor((i + 1) * data.length / 480);
        let peak = 0;
        for (let j = start; j < end; j += Math.max(1, Math.floor((end - start) / 96))) peak = Math.max(peak, Math.abs(data[j]));
        return peak;
      });
      const scale = 18 / Math.max(.01, ...peaks);
      setShape(peaks.map((v, i) => i + "," + (20 - v * scale)).concat(peaks.map((v, i) => i + "," + (20 + v * scale)).reverse()).join(" "));
    }
    void load(url).catch(() => {}).finally(() => context?.close());
    return () => controller.abort();
  }, [url]);
  return shape ? <svg aria-hidden="true" viewBox="0 0 480 40" preserveAspectRatio="none"><polygon points={shape}/></svg> : null;
}
