import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import { initialState, type State } from "./model";
import { AppError } from "./errors";

export const dataDir = () => process.env.SIGNAGE_DATA_DIR || path.join(process.cwd(), ".signage-data");
export function storageDriver(): "local" | "blob" {
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver !== "local" && driver !== "blob") throw new Error("STORAGE_DRIVER must be local or blob");
  if (process.env.VERCEL && driver !== "blob") throw new AppError(503, "Cần cấu hình Vercel Blob trước khi sử dụng bản online.");
  if (driver === "blob" && (!process.env.CONFIG_BLOB_READ_WRITE_TOKEN || !process.env.MEDIA_BLOB_READ_WRITE_TOKEN))
    throw new AppError(503, "Chưa cấu hình đủ hai Blob store cho dữ liệu và ảnh.");
  return driver;
}
const configPath = "xlc/settings.json";
function parseState(raw: string): State {
  const state = JSON.parse(raw) as State;
  if (state.schemaVersion !== 1 || state.restaurant?.slug !== "XLC" || !Array.isArray(state.screens) || !Array.isArray(state.assets))
    throw new Error("Invalid signage state; restore the data backup.");
  return state;
}
async function readSnapshot(requireStrongEtag = false): Promise<{ state: State; etag?: string }> {
  if (storageDriver() === "blob") {
    const result = await get(configPath, { access: "private", token: process.env.CONFIG_BLOB_READ_WRITE_TOKEN, useCache: false,
      // Conditional writes need the original object's strong ETag. Compression
      // can turn a response ETag into a weak validator that cannot match a PUT.
      headers: { "Accept-Encoding": "identity", "Cache-Control": "no-cache" } });
    if (!result) return { state: initialState() };
    if (!result.stream) throw new Error("Missing config content");
    const etag = result.blob.etag;
    if (requireStrongEtag && (!etag || etag.startsWith("W/"))) {
      await result.stream.cancel();
      console.error("Signage config invalid ETag", { kind: etag ? "weak" : "missing",
        encoding: result.headers.get("content-encoding") });
      throw new AppError(503, "Không đọc được phiên bản cấu hình hợp lệ từ kho lưu trữ. Vui lòng thử lại sau.");
    }
    return { state: parseState(await new Response(result.stream).text()), etag };
  }
  try { return { state: parseState(await readFile(path.join(dataDir(), "settings.json"), "utf8")) }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { state: initialState() }; throw error; }
}
export async function readState() { return (await readSnapshot()).state; }
const locks = globalThis as typeof globalThis & { signageWriteQueue?: Promise<unknown> };
export async function mutateState<T>(change: (state: State) => T): Promise<T> {
  if (storageDriver() === "blob") {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { state, etag } = await readSnapshot(true);
      const result = change(state);
      try {
        await put(configPath, JSON.stringify(state), { access: "private", token: process.env.CONFIG_BLOB_READ_WRITE_TOKEN,
          contentType: "application/json", addRandomSuffix: false, allowOverwrite: Boolean(etag), ifMatch: etag });
        return result;
      } catch (error) {
        // A competing first write or conditional write must be reread before retrying.
        if (error instanceof BlobPreconditionFailedError || (!etag && /already exists/i.test(String(error)))) {
          console.warn("Signage config write conflict", { attempt: attempt + 1, existing: Boolean(etag),
            reason: error instanceof BlobPreconditionFailedError ? "etag_mismatch" : "already_exists" });
          continue;
        }
        throw error;
      }
    }
    throw new AppError(409, "Kho cấu hình liên tục báo xung đột phiên bản. Thay đổi chưa được lưu; vui lòng thử lại hoặc kiểm tra log hệ thống.");
  }
  const run = (locks.signageWriteQueue || Promise.resolve()).catch(() => {}).then(async () => {
    const { state } = await readSnapshot();
    const result = change(state);
    await mkdir(dataDir(), { recursive: true });
    const temporary = path.join(dataDir(), `${randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    await rename(temporary, path.join(dataDir(), "settings.json"));
    return result;
  });
  locks.signageWriteQueue = run;
  return run;
}
