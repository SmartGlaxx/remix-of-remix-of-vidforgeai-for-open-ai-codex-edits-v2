export const PRESET = { duration: 10, resolution: "720p", fps: 24, draft: true, save_audio: true, prompt_upsampling: false, disable_safety_filter: false } as const;
export const ESTIMATED_COST = 0.05;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export function imageError(type: string, size: number) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return "Choose a JPG, PNG, or WebP illustration.";
  if (size <= 0 || size > MAX_IMAGE_BYTES) return "Choose an image smaller than 10 MB.";
  return "";
}
export function ownsImage(owner: string, path: string) {
  return path.startsWith(owner + "/") && !path.includes("..") && /^[\w/-]+\.(png|jpe?g|webp)$/i.test(path);
}
export function shouldSubmit(existing: unknown) { return !existing; }
export function providerState(status: string) {
  return status === "succeeded" ? "saving" : status === "processing" ? "generating" : status === "starting" ? "queued" : "failed";
}
export function canSave(job: {state: string; prediction_id: string | null; output_url: string | null}) {
  return job.state !== "ready" && Boolean(job.prediction_id && job.output_url);
}
export const VIDEO_MODELS = {
  pruna: { label: "Pruna P-Video", endpoint: "prunaai/p-video", estimate: ESTIMATED_COST },
  seedance: { label: "Seedance 2.0 Mini", endpoint: "bytedance/seedance-2.0-mini", estimate: 0.1 },
  ltx: { label: "LTX-2.5", endpoint: "runpod:brzqdegz3rq3gg", estimate: 0.08 },
} as const;
export type VideoModel = keyof typeof VIDEO_MODELS;
export const SEEDANCE_PRESET = { duration: 10, resolution: "720p", aspect_ratio: "16:9", generate_audio: true } as const;
/** Provider input per model; Seedance rejects Pruna-only keys. */
export const LTX_ENDPOINT = "brzqdegz3rq3gg";
/** LTX-2.5 on the owner's RunPod endpoint needs both frames; the illustration anchors start and end. */
export function ltxInput(duration: number, image: string, prompt: string) {
  return { prompt, duration_seconds: duration, resolution: "720p", aspect_ratio: "16:9", first_frame_url: image, last_frame_url: image, model_id: "ltx-2.5", audio_enabled: true };
}
export const isRunpodJob = (predictionId: string | null) => Boolean(predictionId?.startsWith("runpod:"));
export function runpodState(status: string) {
  return status === "COMPLETED" ? "saving" : status === "IN_PROGRESS" ? "generating" : status === "IN_QUEUE" ? "queued" : "failed";
}
export function providerInput(model: VideoModel, duration: number, image: string, prompt: string) {
  if (model === "ltx") return ltxInput(duration, image, prompt);
  return model === "seedance" ? { ...SEEDANCE_PRESET, duration, image, prompt } : { ...PRESET, duration, image, prompt };
}
