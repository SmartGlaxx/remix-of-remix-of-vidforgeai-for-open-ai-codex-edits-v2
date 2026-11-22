export const PRESET = { duration: 10, resolution: "720p", fps: 24, draft: true, save_audio: true, prompt_upsampling: false, disable_safety_filter: false } as const;
export const ESTIMATED_COST = 0.05; // Replicate published 720p Draft rate: $0.005/s, verified 2026-11-22.
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
