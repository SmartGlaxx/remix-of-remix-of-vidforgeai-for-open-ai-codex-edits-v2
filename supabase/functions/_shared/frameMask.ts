export type EditRegion = { x: number; y: number; width: number; height: number };
export function validRegion(region: EditRegion | null | undefined, maxArea = 0.5): region is EditRegion {
  return !!region && [region.x, region.y, region.width, region.height].every(Number.isFinite)
    && region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0
    && region.x + region.width <= 1 && region.y + region.height <= 1
    && region.width * region.height <= maxArea;
}

// Recheck broad suggestions against the opening before trusting them for a localized edit.
export function tightRegion(region: EditRegion | null | undefined): region is EditRegion {
  return validRegion(region, 0.12);
}
// Normalized bounds cover the moving object AND its destination, not the whole frame.
export function maskPixels(width: number, height: number, region: EditRegion): Uint8Array {
  if (!validRegion(region)) throw new Error("Invalid localized edit region.");
  const pixels = new Uint8Array(width * height * 4);
  const left = Math.floor(region.x * width), top = Math.floor(region.y * height);
  const right = Math.ceil((region.x + region.width) * width), bottom = Math.ceil((region.y + region.height) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels[(y * width + x) * 4 + 3] = x >= left && x < right && y >= top && y < bottom ? 0 : 255;
  return pixels;
}

// Shared openings change after upstream repairs. A cached ending belongs to one opening only.
export async function openingTag(opening: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(opening));
  return Array.from(new Uint8Array(digest).slice(0, 8), byte => byte.toString(16).padStart(2, "0")).join("");
}
