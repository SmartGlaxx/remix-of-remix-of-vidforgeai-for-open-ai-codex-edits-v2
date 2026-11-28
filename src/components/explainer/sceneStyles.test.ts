import { afterEach, expect, it, vi } from "vitest";
import { boardStrokes } from "./sceneStyles";

afterEach(() => vi.restoreAllMocks());

it("samples bright colored ink, excludes white paper, and records the average stroke color", () => {
  const pixels = new Uint8ClampedArray(384 * 216 * 4).fill(255);
  pixels.set([255, 220, 0, 255], 0);
  pixels.set([255, 200, 20, 255], 4);
  pixels.set([245, 245, 245, 255], 8);
  pixels.set([20, 160, 240, 255], 400 * 4);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: vi.fn(), drawImage: vi.fn(), getImageData: () => ({ data: pixels }),
  } as unknown as CanvasRenderingContext2D);

  expect(boardStrokes(new Image())).toEqual([
    { points: [0, 1], color: "rgb(255,210,10)" },
    { points: [400], color: "rgb(20,160,240)" },
  ]);
});