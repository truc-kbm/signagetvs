import type { Manifest } from "./model";
import { PLAYER_SCRIPT } from "./player-script";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function playerDocument(manifest: Manifest | null, error?: string): string {
  const first = manifest?.items[0];
  const rotation = manifest?.rotation || 0;
  const swapped = rotation % 180 !== 0;
  const snapshot = JSON.stringify(manifest).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="same-origin"><link rel="icon" href="data:,"><title>${escapeHtml(manifest?.name || "XLC TV")}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;font-family:Arial,sans-serif}
#tv-frame{position:absolute;top:50%;left:50%;width:${swapped ? "100vh" : "100vw"};height:${swapped ? "100vw" : "100vh"};transform:translate(-50%,-50%) rotate(${rotation}deg)}
#tv-image{display:block;width:100%;height:100%;object-fit:${manifest?.fit === "cover" ? "cover" : "contain"}}
#tv-status{position:fixed;right:16px;bottom:16px;max-width:calc(100vw - 32px);padding:9px 13px;border-radius:8px;background:rgba(16,24,20,.85);color:#eef4e9;font-size:12px;line-height:1.5;pointer-events:none}
.empty{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:24px;text-align:center;color:#9aa995;background:#18221c;gap:12px}.empty p{margin:0}noscript{position:fixed;left:16px;bottom:16px;color:white;background:#18221c;padding:12px}
</style></head><body>
${first ? `<main id="tv-frame"><img id="tv-image" src="${escapeHtml(first.url)}" alt="" draggable="false"></main>
<div id="tv-status" role="status">Đang tải ảnh để giữ trên TV…</div>
<noscript>Bật JavaScript để tải playlist và giữ nội dung khi tắt server.</noscript>
<script id="tv-snapshot" type="application/json">${snapshot}</script><script>${PLAYER_SCRIPT}</script>`
    : `<main class="empty"><strong>${escapeHtml(error || "Chưa có nội dung")}</strong>${error ? "" : "<p>Chọn ảnh, lưu cấu hình rồi reload TV.</p>"}</main>`}
</body></html>`;
}
