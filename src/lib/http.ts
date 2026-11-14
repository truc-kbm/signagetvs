import { ZodError } from "zod";
import { AppError } from "./errors";
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}
export async function bodyJson(request: Request) {
  const text = await request.text();
  if (text.length > 64_000) throw new AppError(413, "Yêu cầu quá lớn.");
  try { return JSON.parse(text); } catch { throw new AppError(400, "Dữ liệu không hợp lệ."); }
}
export async function handle(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) return json({ error: error.issues[0]?.message || "Dữ liệu không hợp lệ." }, 422);
    console.error("Signage request failed:", error instanceof Error ? error.name : "UnknownError");
    return json({ error: "Không thể hoàn tất thao tác. Vui lòng thử lại." }, 500);
  }
}
