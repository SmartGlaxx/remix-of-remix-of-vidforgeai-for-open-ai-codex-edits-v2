import { expect, it } from "vitest";
import { maskedCanvas } from "../../supabase/functions/_shared/maskedCanvas";

it("keeps panoramic dimensions and protected pixels even if the provider repaints the entire canvas", () => {
  const data = Uint8Array.from({ length: 20 * 8 * 4 }, (_, i) => i % 251);
  const opening = { width: 20, height: 8, data };
  const canvas = maskedCanvas(opening, { x: 0.5, y: 0.5, width: 0.1, height: 0.25 }, 30, 20);
  expect(canvas.mask.data[3]).toBe(255); // Letterbox is locked.
  expect(canvas.mask.data[(10 * 30 + 15) * 4 + 3]).toBe(0);
  const result = canvas.composite({ ...canvas.image, data: new Uint8Array(30 * 20 * 4).fill(252) });
  expect([result.width, result.height]).toEqual([20, 8]);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 20; x++) {
    const i = (y * 20 + x) * 4;
    const inside = x >= 10 && x < 12 && y >= 4 && y < 6;
    expect(result.data.slice(i, i + 4)).toEqual(inside ? new Uint8Array(4).fill(252) : data.slice(i, i + 4));
  }
  expect(() => canvas.composite(opening)).toThrow("dimensions");
});
