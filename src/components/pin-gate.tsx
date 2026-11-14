"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Monitor, Leaf, ShieldCheck } from "lucide-react";
import { Brand } from "./icons";
import { api } from "@/lib/client";
export function PinGate() {
  const router = useRouter(); const [pin, setPin] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function login(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/api/session", { method: "POST", body: JSON.stringify({ pin }) }); router.refresh(); }
    catch (error) { setError((error as Error).message); setPin(""); }
    finally { setBusy(false); }
  }
  return <main className="login-page">
    <section className="login-story"><Brand light /><div className="story-center"><span className="eyebrow">MỘT KHÔNG GIAN. MỌI MÀN HÌNH.</span><h1>Thực đơn đẹp.<br />Trọn vị mỗi ngày.</h1><p>Chăm chút từng màn hình của Xôi Lá Chuối,<br className="desktop-only" /> từ một nơi thật đơn giản.</p>
      <div className="screen-art" aria-hidden="true"><div className="art-screen"><div className="art-menu"><Leaf size={28} /><span>XÔI LÁ CHUỐI</span><div className="rice-shape"><i /><i /><i /></div><b>Gói trọn vị nhà.</b><small>THƠM NẾP · ĐẬM TÌNH</small></div></div><div className="art-portrait"><Leaf size={22} /><span>Mỗi ngày<br />một chút ngon.</span><div className="art-lines" /></div></div>
    </div><footer><span className="tiny-dot" /> Không gian dành riêng cho XLC</footer></section>
    <section className="login-panel"><div className="login-mobile-brand"><Brand /></div><form className="pin-form" onSubmit={login}><div className="lock-icon"><LockKeyhole size={26} /></div><span className="eyebrow muted">CHÀO MỪNG TRỞ LẠI</span><h2>Quản lý màn hình</h2><p>Nhập mã PIN để cập nhật nội dung<br />và thiết lập TV của nhà hàng.</p>
      <label htmlFor="pin">Mã PIN quản lý</label><input id="pin" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,12}" autoComplete="current-password" placeholder="• • • •" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))} autoFocus required minLength={4} maxLength={12} aria-describedby={error ? "pin-error" : undefined} />
      {error && <div className="error-message" role="alert" id="pin-error">{error}</div>}<button className="button primary login-submit" disabled={busy || pin.length < 4}>{busy ? "Đang mở…" : "Vào trang quản lý"}<ArrowRight size={18} /></button>
      <div className="login-assurance"><ShieldCheck size={16} /> Phiên quản lý được bảo vệ bằng mã PIN</div></form><div className="login-foot"><Monitor size={15} /> XLC · Hệ thống màn hình nhà hàng</div></section>
  </main>;
}
