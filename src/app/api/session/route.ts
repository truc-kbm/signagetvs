import { cookies } from "next/headers";
import { constantEqual, configuredPin, createSession, ipKey, requireSameOrigin, SESSION_COOKIE, SESSION_SECONDS } from "@/lib/auth";
import { bodyJson, handle, json } from "@/lib/http";
import { mutateState } from "@/lib/store";
import { AppError } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request);
    const { pin } = await bodyJson(request);
    const expectedPin = configuredPin();
    const key = ipKey(request);
    const valid = typeof pin === "string" && pin.length <= 12 && constantEqual(pin, expectedPin);
    const allowed = await mutateState(state => {
      const now = Date.now();
      for (const [key, item] of Object.entries(state.loginAttempts)) if (item.until < now) delete state.loginAttempts[key];
      const entry = state.loginAttempts[key] || { count: 0, until: now + 15 * 60_000 };
      const total = state.loginAttempts.global || { count: 0, until: now + 15 * 60_000 };
      if (entry.count >= 5 || total.count >= 60) return false;
      if (valid) delete state.loginAttempts[key];
      else { entry.count++; total.count++; state.loginAttempts[key] = entry; state.loginAttempts.global = total; }
      return true;
    });
    if (!allowed) throw new AppError(429, "Đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.");
    if (!valid) throw new AppError(401, "Mã PIN chưa đúng. Anh/chị vui lòng thử lại.");
    (await cookies()).set(SESSION_COOKIE, createSession(), { httpOnly: true, secure: new URL(request.url).protocol === "https:", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
    return json({ ok: true });
  });
}
export async function DELETE(request: Request) {
  return handle(async () => { requireSameOrigin(request); (await cookies()).delete(SESSION_COOKIE); return json({ ok: true }); });
}
