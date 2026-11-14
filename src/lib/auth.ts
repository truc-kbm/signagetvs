import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "./errors";

export const SESSION_COOKIE = "xlc_manage";
export const SESSION_SECONDS = 60 * 60 * 12;
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new AppError(503, "Chưa cấu hình SESSION_SECRET (ít nhất 32 ký tự).");
  return value;
}
export function sign(payload: object) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const hash = createHmac("sha256", secret()).update(data).digest("base64url");
  return `${data}.${hash}`;
}
export function verify<T extends { exp: number; scope: string }>(value: string | undefined, scope: string): T | null {
  if (!value || value.length > 4000) return null;
  const [data, signature, extra] = value.split(".");
  if (!data || !signature || extra) return null;
  const expected = createHmac("sha256", secret()).update(data).digest("base64url");
  if (!constantEqual(expected, signature)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString()) as T;
    return parsed.scope === scope && Number.isFinite(parsed.exp) && parsed.exp > Date.now() ? parsed : null;
  } catch { return null; }
}
export function constantEqual(a: string, b: string) {
  const aHash = createHmac("sha256", "pin-comparison").update(a).digest();
  const bHash = createHmac("sha256", "pin-comparison").update(b).digest();
  return timingSafeEqual(aHash, bHash);
}
export function configuredPin() {
  const pin = process.env.MANAGE_PIN;
  if (!pin || !/^\d{4,12}$/.test(pin)) throw new AppError(503, "Chưa cấu hình mã PIN quản lý.");
  return pin;
}
function sessionScope() { return `manage:XLC:${createHmac("sha256", secret()).update(configuredPin()).digest("hex")}`; }
export function createSession() { return sign({ scope: sessionScope(), exp: Date.now() + SESSION_SECONDS * 1000 }); }
export async function authenticated() { return Boolean(verify((await cookies()).get(SESSION_COOKIE)?.value, sessionScope())); }
export async function requireAuth() { if (!await authenticated()) throw new AppError(401, "Phiên đăng nhập đã hết. Vui lòng nhập lại PIN."); }
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const protocol = process.env.VERCEL ? "https:" : new URL(request.url).protocol;
  const host = request.headers.get("host");
  if (!origin || !host || origin !== `${protocol}//${host}`) throw new AppError(403, "Yêu cầu không hợp lệ.");
}
export function ipKey(request: Request) {
  // Vercel overwrites this header. Locally use one shared bucket, never trust arbitrary forwarding headers.
  const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for") || "unknown" : "local";
  return createHmac("sha256", secret()).update(ip).digest("hex").slice(0, 32);
}
