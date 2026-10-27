export function validateFirstFrame(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("First frame must be a public HTTPS image URL.");
  }
  return url.href;
}

export function firstFrameIgnored(value: unknown): boolean {
  if (typeof value === "string") return /first_frame_url[\s\S]*ignored|ignored[\s\S]*first_frame_url/i.test(value);
  if (Array.isArray(value)) return value.some(firstFrameIgnored);
  if (value && typeof value === "object") return Object.values(value).some(firstFrameIgnored);
  return false;
}