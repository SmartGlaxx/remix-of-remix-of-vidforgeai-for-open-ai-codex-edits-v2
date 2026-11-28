export function requirePng(bytes: Uint8Array): void {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new Error("The character reference must be a PNG image for masked edits. Re-upload your JPG, PNG, or WebP image to convert it to PNG, then prepare the film again.");
  }
}