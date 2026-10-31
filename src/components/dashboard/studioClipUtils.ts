import type { StudioShot, StudioTake } from "@/contexts/ProjectContext";

/** Shared frame/video URL check: public HTTPS only, never http:, data:/Base64 or credentials. */
export function validateFrameUrl(value: string, label = "Frame"): string | undefined {
  if (!value.trim()) return undefined;
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error(`${label} must be a public HTTPS image URL.`); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${label} must be a public HTTPS image URL.`);
  }
  return url.href;
}

export function isValidFrameUrl(value: string): boolean {
  try { return !!validateFrameUrl(value); } catch { return false; }
}

export function firstFrameIgnored(value: unknown): boolean {
  if (typeof value === "string") return /first_frame_url[\s\S]*ignored|ignored[\s\S]*first_frame_url/i.test(value);
  if (Array.isArray(value)) return value.some(firstFrameIgnored);
  if (value && typeof value === "object") return Object.values(value).some(firstFrameIgnored);
  return false;
}

/** Estimated invoice baseline for the shared BLACKWELL_96 pool (both tiers). Editable in the panel. */
export const DEFAULT_POOL_RATE_PER_HOUR = 2.5;

/** Cost from worker execution seconds only (queue time is excluded). */
export const takeCost = (generationSeconds: number | undefined, ratePerHour: number) =>
  ((generationSeconds ?? 0) * ratePerHour) / 3600;

export const activeTake = (shot: StudioShot): StudioTake | undefined => shot.takes[shot.activeTakeIndex];

export function sequenceSummary(shots: StudioShot[], ratePerHour: number) {
  const total = shots.reduce((sum, s) => sum + s.takes.reduce((t, k) => t + takeCost(k.generationSeconds, ratePerHour), 0), 0);
  const approved = shots.filter((s) => activeTake(s)?.status === "passed");
  const approvedSeconds = approved.reduce((sum, s) => sum + s.durationSeconds, 0);
  return {
    total,
    approvedShots: approved.length,
    approvedSeconds,
    perApprovedShot: approved.length > 0 ? total / approved.length : 0,
    perFinishedMinute: approvedSeconds > 0 ? total / (approvedSeconds / 60) : 0,
  };
}

/** Approve a take: it becomes the active take; the next unapproved shot re-anchors its start to this take's last frame. */
export function approveTake(shots: StudioShot[], shotIndex: number, takeIndex: number): StudioShot[] {
  const next = shots.map((s) => ({ ...s, takes: [...s.takes] }));
  const shot = next[shotIndex];
  const take = shot?.takes[takeIndex];
  if (!take || !take.videoUrl) return shots;
  shot.takes = shot.takes.map((k, i) => (i === takeIndex ? { ...k, status: "passed" } : k));
  shot.activeTakeIndex = takeIndex;
  const anchor = take.lastFrame ?? shot.lastFrame;
  const dependent = next[shotIndex + 1];
  if (dependent && activeTake(dependent)?.status !== "passed" && dependent.firstFrame !== anchor) {
    next[shotIndex + 1] = { ...dependent, firstFrame: anchor };
  }
  return next;
}

export function rejectTake(shots: StudioShot[], shotIndex: number, takeIndex: number): StudioShot[] {
  return shots.map((s, i) => i !== shotIndex ? s : {
    ...s, takes: s.takes.map((k, j) => (j === takeIndex && k.status !== "failed" ? { ...k, status: "failed", rejected: true } : k)),
  });
}
