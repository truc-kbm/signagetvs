export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: "no-store", headers: { ...(options?.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options?.headers } });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && !url.endsWith("/session")) window.location.assign("/manage");
    throw new Error(data.error || "Thao tác chưa thành công. Vui lòng thử lại.");
  }
  return data;
}
export function formatBytes(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
