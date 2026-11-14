import { requireAuth, requireSameOrigin } from "@/lib/auth";
import { bodyJson, handle, json } from "@/lib/http";
import { mutateState } from "@/lib/store";
import { screenInput } from "@/lib/model";
import { AppError } from "@/lib/errors";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return handle(async () => {
    requireSameOrigin(request); await requireAuth(); const { id } = await params;
    const body = await bodyJson(request); const settings = screenInput.parse(body);
    const result = await mutateState(state => {
      const screen = state.screens.find(s => s.id === id && !s.archivedAt);
      if (!screen) throw new AppError(404, "Không tìm thấy TV.");
      if (body.baseRevision !== screen.revision) throw new AppError(409, "TV đã được sửa ở một cửa sổ khác. Đóng phần chỉnh sửa và tải lại trang để lấy bản mới.");
      if (settings.items.some(item => !state.assets.some(a => a.id === item.assetId))) throw new AppError(422, "Ảnh chưa có trong thư viện XLC.");
      Object.assign(screen, settings, { revision: screen.revision + 1, updatedAt: new Date().toISOString() });
      return screen;
    });
    return json(result);
  });
}
export async function DELETE(request: Request, { params }: Context) {
  return handle(async () => { requireSameOrigin(request); await requireAuth(); const { id } = await params;
    await mutateState(state => { const screen = state.screens.find(s => s.id === id && !s.archivedAt);
      if (!screen) throw new AppError(404, "Không tìm thấy TV."); screen.archivedAt = new Date().toISOString(); });
    return json({ ok: true });
  });
}
