import { afterEach, expect, it, vi } from "vitest";
import { encode, decode } from "fast-png";
import { referencePng } from "./referencePng";
import { requirePng } from "../../../supabase/functions/_shared/pngSignature";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(["image/jpeg", "image/webp", "image/png"])("draws %s at its original dimensions and exports PNG", async type => {
  const bitmap = { width: 17, height: 9, close: vi.fn() };
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  const toBlob = vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (callback, mime) {
    expect(this.width).toBe(17); expect(this.height).toBe(9);
    callback(new Blob(["encoded PNG"], { type: mime }));
  });
  const result = await referencePng(new Blob(["source"], { type }));
  expect(result.type).toBe("image/png");
  expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
  expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/png");
  expect(bitmap.close).toHaveBeenCalledOnce();
});

it("rejects a failed canvas export and releases the bitmap", async () => {
  const bitmap = { width: 1, height: 1, close: vi.fn() };
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(callback => callback(null));
  await expect(referencePng(new Blob())).rejects.toThrow("Could not convert");
  expect(bitmap.close).toHaveBeenCalledOnce();
});

it("accepts real PNG bytes for masked decoding", () => {
  const png = encode({ width: 1, height: 1, channels: 4, data: new Uint8Array([10, 20, 30, 255]) });
  expect(() => requirePng(png)).not.toThrow();
  expect(decode(png).width).toBe(1);
});

it.each([
  { bytes: [255, 216, 255, 224] },
  { bytes: [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80] },
  { bytes: [137, 80, 78, 71] },
])("rejects non-PNG or truncated reference bytes before decoding: $bytes", ({ bytes }) => {
  expect(() => requirePng(new Uint8Array(bytes))).toThrow("Re-upload");
});