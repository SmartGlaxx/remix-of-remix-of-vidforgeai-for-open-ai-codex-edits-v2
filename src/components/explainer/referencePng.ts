/** Normalize accepted uploads and host artwork without changing their dimensions. */
export async function referencePng(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not convert this image to PNG.");
    context.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob || blob.type !== "image/png") reject(new Error("Could not convert this image to PNG."));
        else resolve(blob);
      }, "image/png");
    });
  } finally {
    bitmap.close();
  }
}