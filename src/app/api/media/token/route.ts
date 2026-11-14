import { randomUUID } from "node:crypto";
import { z } from "zod";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { requireAuth, requireSameOrigin, sign } from "@/lib/auth";
import { bodyJson, handle, json } from "@/lib/http";
import { storageDriver } from "@/lib/store";
import { MAX_BYTES } from "@/lib/model";
import { AppError } from "@/lib/errors";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request); await requireAuth();
    if (storageDriver() !== "blob") throw new AppError(400, "Chế độ upload không phù hợp.");
    const input = z.object({ name: z.string().min(1).max(160), type: z.enum(["image/png", "image/jpeg"]), size: z.number().int().positive().max(MAX_BYTES) }).parse(await bodyJson(request));
    const id = randomUUID(); const pathname = `xlc/media/${id}.${input.type === "image/png" ? "png" : "jpg"}`;
    const exp = Date.now() + 30 * 60_000;
    const token = await generateClientTokenFromReadWriteToken({ pathname, token: process.env.MEDIA_BLOB_READ_WRITE_TOKEN,
      maximumSizeInBytes: input.size, allowedContentTypes: [input.type], validUntil: exp, addRandomSuffix: false, allowOverwrite: false });
    return json({ token, pathname, proof: sign({ scope: "upload:XLC", id, pathname, name: input.name, type: input.type, size: input.size, exp }) });
  });
}
