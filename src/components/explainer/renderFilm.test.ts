import { afterEach, expect, it, vi } from "vitest";
import { renderFilm } from "./renderFilm";

vi.mock("./sceneStyles", () => ({ boardStrokes: () => [], drawBoard: vi.fn(), drawComic: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("plays two narrations at rate 1, schedules their natural lengths, and stops at 5 seconds instead of the 60-second slot", async () => {
  let time = 0;
  let stopTime = -1;
  const sources: { playbackRate: { value: number }; start: ReturnType<typeof vi.fn> }[] = [];
  const durations = [2, 3];
  class AudioContextMock {
    get currentTime() { return time; }
    resume = async () => {};
    close = async () => {};
    decodeAudioData = async () => ({ duration: durations.shift() });
    createMediaStreamDestination = () => ({ stream: { getAudioTracks: () => [{}] } });
    createBufferSource() {
      const source = { playbackRate: { value: 0 }, connect: vi.fn(), start: vi.fn() };
      sources.push(source);
      return source;
    }
  }
  class RecorderMock {
    static isTypeSupported() { return true; }
    mimeType = "video/mp4";
    state = "inactive";
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start() { this.state = "recording"; }
    stop() {
      stopTime = time;
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["recorded"]) });
      this.onstop?.();
    }
  }
  vi.stubGlobal("AudioContext", AudioContextMock);
  vi.stubGlobal("MediaRecorder", RecorderMock);
  vi.stubGlobal("Image", class { decode = async () => {}; });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queueMicrotask(() => { time += 1; callback(time); });
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: () => ({ addTrack: vi.fn(), getTracks: () => [{ stop: vi.fn() }] }),
  });
  const signal = new AbortController().signal;
  Object.defineProperty(signal, "throwIfAborted", { value: () => {} });
  const scene = { line: "Narration", prompt: "Drawing", label: "Scene", image: "image", audio: "audio" };
  const result = await renderFilm([scene, scene], vi.fn(), signal, "whiteboard", 60);
  expect(sources.map(source => source.playbackRate.value)).toEqual([1, 1]);
  expect(sources.map(source => source.start.mock.calls[0][0])).toEqual([0, 2]);
  expect(stopTime).toBe(5);
  expect(result.size).toBeGreaterThan(0);
});