import { maskPixels, type EditRegion } from "./frameMask.ts";

type Raster = { width: number; height: number; data: Uint8Array };

// Fit the opening into the provider's landscape canvas without stretching a panoramic shot.
export function maskedCanvas(opening: Raster, region: EditRegion, width = 1536, height = 1024) {
  const scale = Math.min(width / opening.width, height / opening.height);
  const w = Math.max(1, Math.round(opening.width * scale));
  const h = Math.max(1, Math.round(opening.height * scale));
  const left = Math.floor((width - w) / 2);
  const top = Math.floor((height - h) / 2);
  const mask = maskPixels(opening.width, opening.height, region);
  const canvas = new Uint8Array(width * height * 4);
  const canvasMask = new Uint8Array(canvas.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      canvas[i + 3] = 255;
      canvasMask[i + 3] = 255;
      if (x < left || x >= left + w || y < top || y >= top + h) continue;
      const sx = Math.floor((x - left + 0.5) * opening.width / w);
      const sy = Math.floor((y - top + 0.5) * opening.height / h);
      const j = (sy * opening.width + sx) * 4;
      for (let c = 0; c < 4; c++) canvas[i + c] = opening.data[j + c];
      canvasMask[i + 3] = mask[j + 3];
    }
  }
  function composite(edit: Raster) {
    if (edit.width !== width || edit.height !== height) throw new Error("Localized edit returned unexpected canvas dimensions.");
    const output = new Uint8Array(opening.data);
    for (let y = 0; y < opening.height; y++) {
      for (let x = 0; x < opening.width; x++) {
        const i = (y * opening.width + x) * 4;
        if (mask[i + 3]) continue;
        const cx = left + Math.floor((x + 0.5) * w / opening.width);
        const cy = top + Math.floor((y + 0.5) * h / opening.height);
        const j = (cy * width + cx) * 4;
        for (let c = 0; c < 4; c++) output[i + c] = edit.data[j + c];
      }
    }
    return { width: opening.width, height: opening.height, data: output };
  }
  return { image: { width, height, data: canvas }, mask: { width, height, data: canvasMask }, composite };
}
