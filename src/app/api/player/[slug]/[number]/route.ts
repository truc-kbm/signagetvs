import { handle, json } from "@/lib/http";
import { readState } from "@/lib/store";
import { manifestFor } from "@/lib/model";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ slug: string; number: string }> }) {
  return handle(async () => {
    const { slug, number } = await params;
    if (slug.toUpperCase() !== "XLC" || !/^[1-9]\d*$/.test(number)) throw new AppError(404, "Không tìm thấy TV.");
    const state = await readState(); const screen = state.screens.find(s => s.number === Number(number) && !s.archivedAt);
    if (!screen) throw new AppError(404, "TV không tồn tại hoặc đã ngừng sử dụng.");
    return json(manifestFor(state, screen));
  });
}
