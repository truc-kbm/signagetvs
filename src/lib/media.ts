import sharp from "sharp";
import { MAX_BYTES, MAX_PIXELS } from "./model";
import { AppError } from "./errors";
export async function readBounded(stream: ReadableStream<Uint8Array>, limit = MAX_BYTES) {
  const reader = stream.getReader(); const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new AppError(413, "Ảnh vượt quá 25 MiB."); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(parts);
}
export async function inspectImage(buffer: Buffer) {
  if (buffer.length > MAX_BYTES || !buffer.length) throw new AppError(422, "Ảnh trống hoặc vượt quá 25 MiB.");
  try {
    const decoder = sharp(buffer, { limitInputPixels: MAX_PIXELS, failOn: "error" });
    const meta = await decoder.metadata();
    if (!meta.width || !meta.height || !["jpeg", "png"].includes(meta.format || "") || (meta.pages || 1) > 1)
      throw new Error("Unsupported image");
    await decoder.stats();
    const swapped = (meta.orientation || 0) >= 5;
    return { width: swapped ? meta.height : meta.width, height: swapped ? meta.width : meta.height,
      extension: meta.format === "jpeg" ? "jpg" : "png", contentType: meta.format === "jpeg" ? "image/jpeg" : "image/png" };
  } catch { throw new AppError(422, "Chỉ nhận ảnh JPG/PNG hợp lệ, tối đa 16 megapixel (hỗ trợ 4K)."); }
}
