import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireAuth, requireSameOrigin } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { dataDir, mutateState, storageDriver } from "@/lib/store";
import { MAX_BYTES, type Asset } from "@/lib/model";
import { inspectImage, readBounded } from "@/lib/media";
import { AppError } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request); await requireAuth();
    if (storageDriver() !== "local") throw new AppError(400, "Sử dụng upload trực tiếp cho bản online.");
    if (!request.body) throw new AppError(400, "Chưa chọn file.");
    const raw = await readBounded(request.body, MAX_BYTES + 1024 * 1024);
    const form = await new Response(new Uint8Array(raw), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError(400, "Chưa chọn file ảnh.");
    const buffer = Buffer.from(await file.arrayBuffer()); const info = await inspectImage(buffer); const id = randomUUID();
    const filename = `${id}.${info.extension}`;
    await mkdir(path.join(dataDir(), "media"), { recursive: true });
    await writeFile(path.join(dataDir(), "media", filename), buffer, { flag: "wx" });
    const asset: Asset = { id, name: file.name.slice(0, 160), url: `/media/${filename}`, width: info.width, height: info.height,
      bytes: buffer.length, createdAt: new Date().toISOString() };
    await mutateState(state => { state.assets.push(asset); });
    return json(asset, 201);
  });
}
