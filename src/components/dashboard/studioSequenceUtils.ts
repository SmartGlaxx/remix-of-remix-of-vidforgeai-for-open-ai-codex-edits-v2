import { validateFirstFrame } from "./studioClipUtils";

export function sequenceVideoUrl(value: unknown): string {
  if (!value || typeof value !== "object") throw new Error("Stitch finished without a video URL");
  const output = value as Record<string, unknown>;
  if (output.error) throw new Error(typeof output.error === "string" ? output.error : "Stitch failed");
  if (output.output) return sequenceVideoUrl(output.output);
  const raw = output.video_url ?? output.url;
  if (typeof raw !== "string") throw new Error("Stitch finished without a video URL");
  const url = validateFirstFrame(raw);
  if (!url) throw new Error("Stitch finished without a video URL");
  return url;
}