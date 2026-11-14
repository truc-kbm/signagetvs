import { get } from "@vercel/blob";
import { requireAuth, requireSameOrigin, verify } from "@/lib/auth";
import { bodyJson, handle, json } from "@/lib/http";
import { mutateState, readState, storageDriver } from "@/lib/store";
import { inspectImage, readBounded } from "@/lib/media";
import { AppError } from "@/lib/errors";
import type { Asset } from "@/lib/model";
export const maxDuration = 60;
type Proof = { scope: string; exp: number; id: string; pathname: string; name: string; type: string; size: number };
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request); await requireAuth();
    if (storageDriver() !== "blob") throw new AppError(400, "Chế độ upload không phù hợp.");
    const { proof: value } = await bodyJson(request);
    const proof = typeof value === "string" ? verify<Proof>(value, "upload:XLC") : null;
    if (!proof) throw new AppError(400, "Phiên upload đã hết hạn. Vui lòng chọn lại ảnh.");
    const existing = (await readState()).assets.find(a => a.id === proof.id);
    if (existing) return json(existing);
    const object = await get(proof.pathname, { access: "public", token: process.env.MEDIA_BLOB_READ_WRITE_TOKEN });
    if (!object?.stream) throw new AppError(422, "Chưa nhận được file upload.");
    const buffer = await readBounded(object.stream); const info = await inspectImage(buffer);
    if (buffer.length !== proof.size || info.contentType !== proof.type) throw new AppError(422, "File không khớp với phiên upload.");
    const asset: Asset = { id: proof.id, name: proof.name, url: object.blob.url, width: info.width, height: info.height,
      bytes: buffer.length, createdAt: new Date().toISOString() };
    await mutateState(state => { if (!state.assets.some(a => a.id === asset.id)) state.assets.push(asset); });
    return json(asset, 201);
  });
}
