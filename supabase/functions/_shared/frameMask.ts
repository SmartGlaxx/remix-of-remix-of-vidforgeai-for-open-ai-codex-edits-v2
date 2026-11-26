export type EditRegion = { x: number; y: number; width: number; height: number };
// Normalized bounds cover the moving object AND its destination, not the whole frame.
export function maskPixels(width: number, height: number, region: EditRegion): Uint8Array {
  if (![region.x, region.y, region.width, region.height].every(Number.isFinite) || region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0 || region.x + region.width > 1 || region.y + region.height > 1 || region.width * region.height > 0.5) throw new Error("Invalid localized edit region.");
  const pixels = new Uint8Array(width * height * 4);
  const left = Math.floor(region.x * width), top = Math.floor(region.y * height);
  const right = Math.ceil((region.x + region.width) * width), bottom = Math.ceil((region.y + region.height) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels[(y * width + x) * 4 + 3] = x >= left && x < right && y >= top && y < bottom ? 0 : 255;
  return pixels;
}