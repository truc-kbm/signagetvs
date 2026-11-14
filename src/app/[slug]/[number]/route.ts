import { readState } from "@/lib/store";
import { manifestFor } from "@/lib/model";
import { playerDocument } from "@/lib/player-document";

export const dynamic = "force-dynamic";

function html(document: string, status = 200) {
  return new Response(document, { status, headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
  } });
}

export async function GET(_: Request, { params }: { params: Promise<{ slug: string; number: string }> }) {
  const { slug, number } = await params;
  if (slug.toUpperCase() !== "XLC" || !/^[1-9]\d*$/.test(number))
    return html(playerDocument(null, "Không tìm thấy TV."), 404);
  try {
    const state = await readState();
    const screen = state.screens.find(s => s.number === Number(number) && !s.archivedAt);
    if (!screen) return html(playerDocument(null, "TV không tồn tại hoặc đã ngừng sử dụng."), 404);
    // A complete snapshot in plain HTML: no Next client, dev socket, or auto refresh.
    return html(playerDocument(manifestFor(state, screen)));
  } catch {
    return html(playerDocument(null, "Không đọc được nội dung TV. Vui lòng tải lại khi server hoạt động."), 503);
  }
}
