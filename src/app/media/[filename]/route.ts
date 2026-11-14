import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, storageDriver } from "@/lib/store";
export async function GET(_: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (storageDriver() !== "local" || !/^[0-9a-f-]{36}\.(jpg|png)$/.test(filename)) return new Response(null, { status: 404 });
  try {
    const buffer = await readFile(path.join(dataDir(), "media", filename));
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": filename.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch { return new Response(null, { status: 404 }); }
}
