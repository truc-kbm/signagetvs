"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, Copy, ExternalLink, Eye, ImagePlus, Images, Info, LayoutGrid, LogOut, Monitor, MonitorUp, MoreHorizontal, Plus, RotateCw, Save, Settings2, Smartphone, Trash2, Upload, X } from "lucide-react";
import { put } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { api, formatBytes } from "@/lib/client";
import { MAX_BYTES, type Asset, type ManageData, type Manifest, type Screen } from "@/lib/model";
import { Brand } from "./icons";
import { Renderer } from "./player";

function localUpload(file: File, onProgress: (n: number) => void): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open("POST", "/api/media");
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = () => reject(new Error("Mất kết nối khi upload ảnh."));
    xhr.onload = () => { try { const data = JSON.parse(xhr.responseText); if (xhr.status < 200 || xhr.status >= 300) { if (xhr.status === 401) window.location.assign("/manage"); reject(new Error(data.error)); } else resolve(data); } catch { reject(new Error("Không thể upload ảnh. Vui lòng thử lại.")); } };
    const form = new FormData(); form.set("file", file); xhr.send(form);
  });
}
function Uploader({ storage, onUploaded, compact = false }: { storage: "local" | "blob"; onUploaded: (asset: Asset) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [label, setLabel] = useState("");
  const [progress, setProgress] = useState(0); const [error, setError] = useState(""); const [dragging, setDragging] = useState(false);
  async function uploadFiles(files: FileList | null) {
    if (!files?.length || busy) return;
    setBusy(true); setError("");
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]; setLabel(`${i + 1}/${files.length} · ${file.name}`); setProgress(0);
        if (!["image/jpeg", "image/png"].includes(file.type)) throw new Error(`${file.name}: chỉ nhận JPG hoặc PNG.`);
        if (file.size > MAX_BYTES) throw new Error(`${file.name}: dung lượng vượt quá 25 MiB.`);
        let asset: Asset;
        if (storage === "blob") {
          const intent = await api<{ token: string; pathname: string; proof: string }>("/api/media/token", { method: "POST", body: JSON.stringify({ name: file.name, type: file.type, size: file.size }) });
          await put(intent.pathname, file, { access: "public", token: intent.token, contentType: file.type, multipart: file.size > 4 * 1024 * 1024, onUploadProgress: event => setProgress(Math.round(event.percentage)) });
          setLabel("Đang kiểm tra ảnh…");
          asset = await api<Asset>("/api/media/finalize", { method: "POST", body: JSON.stringify({ proof: intent.proof }) });
        } else asset = await localUpload(file, setProgress);
        onUploaded(asset);
      }
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  return <div className={`upload-wrap ${compact ? "compact" : ""}`}>
    <button type="button" className={`upload-zone ${dragging ? "dragging" : ""}`} disabled={busy} onClick={() => input.current?.click()}
      onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void uploadFiles(event.dataTransfer.files); }}>
      <span className="upload-icon"><Upload size={compact ? 19 : 24} /></span><span><strong>{busy ? "Đang tải hình ảnh" : "Tải ảnh lên"}</strong><small>{busy ? label : compact ? "Chọn hoặc kéo thả ảnh vào đây" : "Kéo thả hình ảnh vào đây, hoặc nhấn để chọn file"}</small></span>
      {!busy && !compact && <span className="upload-spec">JPG, PNG · Tối đa 25 MiB/ảnh · Hỗ trợ 4K</span>}
      {busy && <span className="upload-progress"><i style={{ width: `${progress}%` }} /></span>}
    </button><input ref={input} type="file" accept="image/jpeg,image/png" multiple hidden onChange={e => void uploadFiles(e.target.files)} />
    {error && <p className="error-message" role="alert">{error}</p>}
  </div>;
}

export function Dashboard() {
  const router = useRouter(); const [data, setData] = useState<ManageData | null>(null); const [error, setError] = useState("");
  const [tab, setTab] = useState<"screens" | "media">("screens"); const [editing, setEditing] = useState<Screen | null>(null);
  const [notice, setNotice] = useState(""); const [adding, setAdding] = useState(false); const [uploadOpen, setUploadOpen] = useState(false);
  const load = useCallback(async () => { try { setData(await api<ManageData>("/api/manage")); setError(""); } catch (error) { setError((error as Error).message); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 5000); return () => clearTimeout(timer); }, [notice]);
  function addAsset(asset: Asset) { setData(old => old ? { ...old, assets: old.assets.some(a => a.id === asset.id) ? old.assets : [...old.assets, asset] } : old); }
  async function addScreen() {
    setAdding(true); try { const screen = await api<Screen>("/api/screens", { method: "POST" }); await load(); setEditing(screen); } catch (e) { setError((e as Error).message); } finally { setAdding(false); }
  }
  async function logout() { try { await api("/api/session", { method: "DELETE" }); router.refresh(); } catch (e) { setError((e as Error).message); } }
  async function copyLink(number: number) {
    const link = `${location.origin}/XLC/${number}`;
    try { await navigator.clipboard.writeText(link); setNotice(`Đã sao chép link TV ${number}`); }
    catch { window.prompt("Sao chép đường dẫn TV:", link); }
  }
  return <div className="app-shell"><aside className="sidebar"><Brand /><div className="workspace-label">KHÔNG GIAN QUẢN LÝ</div><nav aria-label="Điều hướng"><button className={tab === "screens" ? "active" : ""} onClick={() => setTab("screens")}><LayoutGrid size={19} /> Màn hình <span>{data?.screens.length ?? "–"}</span></button><button className={tab === "media" ? "active" : ""} onClick={() => setTab("media")}><Images size={19} /> Thư viện ảnh</button></nav>
    <div className="sidebar-help"><div className="help-symbol"><MonitorUp size={22} /></div><strong>Thay menu thật dễ</strong><p>Chọn ảnh, lưu cấu hình.<br />Reload TV để bắt đầu phát.</p><button onClick={() => document.getElementById("quick-guide")?.scrollIntoView({ behavior: "smooth" })}>Xem hướng dẫn <ArrowRight size={15} /></button></div>
    <div className="sidebar-bottom"><div className="restaurant-avatar">XLC</div><div><strong>Xôi Lá Chuối</strong><small>Nhà hàng của bạn</small></div><button className="icon-button" onClick={logout} title="Đăng xuất" aria-label="Đăng xuất"><LogOut size={18} /></button></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><span>XLC</span><ChevronRight size={14} /><strong>{tab === "screens" ? "Màn hình" : "Thư viện ảnh"}</strong></div><div className="topbar-right"><span className="workspace-pill"><span /> Không gian XLC</span><button className="user-avatar" onClick={logout} title="Đăng xuất">XL</button></div></header>
    <main className="dashboard"><div className="page-heading"><div><span className="eyebrow muted">XÔI LÁ CHUỐI · SIGNAGE STUDIO</span><h1>{tab === "screens" ? "Màn hình của bạn" : "Thư viện hình ảnh"}</h1><p>{tab === "screens" ? "Một góc nhìn chung, chăm chút từng màn hình." : "Những hình ảnh sẵn sàng kể câu chuyện của nhà hàng."}</p></div><button className="button primary" disabled={adding} onClick={tab === "screens" ? addScreen : () => setUploadOpen(!uploadOpen)}>{tab === "screens" ? <Plus size={18} /> : <Upload size={18} />}{tab === "screens" ? (adding ? "Đang thêm…" : "Thêm màn hình") : "Tải hình ảnh"}</button></div>
      {error && <div className="error-message" role="alert">{error} <button onClick={load}>Thử lại</button></div>}
      {!data ? !error && <div className="loading-state">Đang mở không gian XLC…</div> : <>
      <div className="stats-row"><div className="stat"><span className="stat-icon sage"><Monitor size={21} /></span><div><strong>{data.screens.length.toString().padStart(2, "0")}</strong><span>Màn hình đã thiết lập</span></div></div><div className="stat"><span className="stat-icon peach"><Images size={21} /></span><div><strong>{data.assets.length.toString().padStart(2, "0")}</strong><span>Hình ảnh trong thư viện</span></div></div><div className="stat"><span className="stat-icon sand"><RotateCw size={21} /></span><div><strong className="stat-word">Khi reload</strong><span>Thời điểm TV nhận nội dung mới</span></div></div></div>
      <div className="info-banner"><Info size={18} /><p><strong>Lưu trên đây. Reload trên TV.</strong> Sau khi lưu, hãy tải lại browser trên TV để hiển thị nội dung mới.</p><span>NỘI DUNG ĐÃ LƯU</span></div>
      {tab === "screens" ? <><div className="section-heading"><h2>Tất cả màn hình <span>{data.screens.length}</span></h2><span>Nhấn vào màn hình để xem trước</span></div><div className="screen-grid">{data.screens.map(screen => {
        const first = data.assets.find(a => a.id === screen.items[0]?.assetId); const portrait = screen.orientation === "portrait";
        return <article className="screen-card" key={screen.id}><a className="card-preview" href={`/manage/tvs/${screen.number}/preview`} target="_blank" rel="noreferrer" aria-label={`Xem trước ${screen.name}`}><span className="screen-number">TV {String(screen.number).padStart(2, "0")}</span><span className="preview-hover"><Eye size={18} /> Xem trước</span><div className={`mini-monitor ${portrait ? "portrait" : ""}`}>{first ? <img src={first.url} alt={screen.name} loading="lazy" style={{ objectFit: screen.fit }} /> : <div className="mini-empty"><ImagePlus size={28} strokeWidth={1.2} /><span>Thêm nội dung của bạn</span></div>}</div></a>
        <div className="card-content"><div className="card-title-row"><h3>{screen.name}</h3><span className={`content-dot ${screen.items.length ? "ready" : ""}`} title={screen.items.length ? "Đã có nội dung lưu" : "Chưa có nội dung"} /></div><div className="card-meta">{portrait ? <Smartphone size={14} /> : <Monitor size={14} />}<span>{portrait ? "Dọc · 9:16" : "Ngang · 16:9"}</span><i>·</i><span>{screen.items.length} hình ảnh</span></div><div className="card-bottom"><button className="text-link" onClick={() => copyLink(screen.number)}><Copy size={14} /> /XLC/{screen.number}</button><button className="button small secondary" onClick={() => setEditing(screen)}><Settings2 size={14} /> Chỉnh sửa</button></div></div></article>;
      })}<button className="add-screen-card" onClick={addScreen} disabled={adding}><span><Plus size={27} strokeWidth={1.4} /></span><strong>Thêm một màn hình</strong><small>Mỗi TV, một nội dung riêng</small></button></div></> : <>
        {(uploadOpen || data.assets.length === 0) && <Uploader storage={data.storage} onUploaded={addAsset} />}
        <div className="section-heading"><h2>Tất cả hình ảnh <span>{data.assets.length}</span></h2><span>Ảnh gốc được giữ nguyên chất lượng</span></div>
        {data.assets.length ? <div className="media-grid">{[...data.assets].reverse().map(asset => <article className="media-card" key={asset.id}><a href={asset.url} target="_blank" rel="noreferrer"><img src={asset.url} alt={asset.name} loading="lazy" /><span><ExternalLink size={17} /></span></a><div><h3 title={asset.name}>{asset.name}</h3><p>{asset.width} × {asset.height}<span>{formatBytes(asset.bytes)}</span></p></div></article>)}</div> : <div className="empty-library"><Images size={28} /><h3>Thư viện đang chờ những hình ảnh đầu tiên</h3><p>Upload menu hoặc quảng cáo, rồi chọn ảnh cho từng TV.</p></div>}
      </>}
      <section className="quick-guide" id="quick-guide"><div><span className="eyebrow muted">CHỈ BA BƯỚC ĐƠN GIẢN</span><h2>Từ hình ảnh đến màn hình.</h2></div><div className="guide-step"><b>01</b><div><strong>Chọn nội dung</strong><p>Upload ảnh menu hoặc quảng cáo.</p></div></div><div className="guide-step"><b>02</b><div><strong>Thiết lập & lưu</strong><p>Chọn TV, hướng treo và cách phát.</p></div></div><div className="guide-step"><b>03</b><div><strong>Reload trên TV</strong><p>Mở lại trang để nhận nội dung mới.</p></div></div></section>
      </>}
      <footer className="dashboard-footer"><span>XLC Signage Studio</span><span>Chăm chút trải nghiệm, từ những điều nhỏ nhất.</span></footer>
    </main></div>
    {notice && <div className="toast" role="status"><Check size={18} />{notice}</div>}
    {editing && data && <ScreenEditor key={editing.id} screen={editing} data={data} onUploaded={addAsset} onClose={() => setEditing(null)} onSaved={screen => { setData(old => old ? { ...old, screens: old.screens.map(s => s.id === screen.id ? screen : s) } : old); setNotice("Đã lưu cấu hình. Reload browser trên TV để áp dụng."); }} onArchived={() => { setEditing(null); void load(); setNotice("Đã ngừng sử dụng TV. TV đang mở thay đổi sau lần reload."); }} />}
  </div>;
}

function ScreenEditor({ screen, data, onUploaded, onClose, onSaved, onArchived }: { screen: Screen; data: ManageData; onUploaded: (asset: Asset) => void; onClose: () => void; onSaved: (screen: Screen) => void; onArchived: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const [draft, setDraft] = useState(screen); const [saved, setSaved] = useState(screen);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [browser, setBrowser] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const close = () => { if (!dirty || window.confirm("Bạn có thay đổi chưa lưu. Đóng và bỏ các thay đổi này?")) onClose(); };
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);
  const manifest: Manifest = { ...draft, items: draft.items.flatMap(item => { const asset = data.assets.find(a => a.id === item.assetId); return asset ? [{ ...asset, duration: item.duration }] : []; }) };
  const portrait = draft.orientation === "portrait"; const swapped = browser && (draft.rotation === 90 || draft.rotation === 270);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { const result = await api<Screen>(`/api/screens/${draft.id}`, { method: "PATCH", body: JSON.stringify({ ...draft, baseRevision: saved.revision }) }); setDraft(result); setSaved(result); onSaved(result); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function archive() { if (!confirm(`Ngừng sử dụng “${screen.name}”? TV đang mở vẫn giữ nội dung đến khi reload.`)) return;
    setBusy(true); try { await api(`/api/screens/${screen.id}`, { method: "DELETE" }); onArchived(); } catch (e) { setError((e as Error).message); setBusy(false); }
  }
  function selectAsset(asset: Asset) { setDraft(old => old.items.length >= 20 ? old : { ...old, items: [...old.items, { assetId: asset.id, duration: 15 }] }); }
  function moveItem(index: number, offset: number) { setDraft(old => { const items = [...old.items]; [items[index], items[index + offset]] = [items[index + offset], items[index]]; return { ...old, items }; }); }
  return <dialog className="editor-dialog" ref={dialog} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}><form onSubmit={save} className="editor-form"><header className="editor-header"><div><span className="eyebrow muted">THIẾT LẬP MÀN HÌNH · TV {String(screen.number).padStart(2, "0")}</span><h2>{draft.name || "Màn hình chưa đặt tên"}</h2></div><button type="button" className="icon-button" onClick={close} aria-label="Đóng chỉnh sửa"><X size={22} /></button></header>
    <div className="editor-body"><section className="editor-preview"><div className="editor-preview-heading"><span className="draft-badge">{dirty ? "BẢN NHÁP" : "ĐÃ LƯU"}</span><a href={`/manage/tvs/${screen.number}/preview`} target="_blank" className="text-link">Preview đã lưu <ExternalLink size={14} /></a></div>
      <div className="editor-stage"><div className={`editor-monitor ${(portrait !== swapped) ? "portrait" : ""}`}><Renderer manifest={manifest} natural={!browser} /></div></div>
      <div className="segmented preview-switch"><button type="button" className={!browser ? "active" : ""} onClick={() => setBrowser(false)}>Hướng treo</button><button type="button" className={browser ? "active" : ""} onClick={() => setBrowser(true)}>Đầu ra browser</button></div><p className="editor-hint">{browser ? `Mô phỏng đầu ra browser với góc xoay ${draft.rotation}°.` : "Mô phỏng nội dung khi đứng trước TV. Kiểm tra góc xoay bằng chế độ Đầu ra browser."}</p>
      <div className="player-link-box"><Monitor size={19} /><div><small>LINK PHÁT TRÊN TV</small><a href={`/XLC/${screen.number}`} target="_blank">/XLC/{screen.number}<ExternalLink size={13} /></a></div><span>Giữ nguyên khi đổi tên</span></div>
    </section><section className="editor-settings"><div className="field"><label htmlFor="screen-name">Tên màn hình</label><input id="screen-name" value={draft.name} maxLength={80} required onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Ví dụ: Menu chính · Quầy trước" /></div>
      <div className="field"><label>Hướng treo TV</label><div className="orientation-options"><button type="button" className={!portrait ? "selected" : ""} onClick={() => setDraft({ ...draft, orientation: "landscape" })}><Monitor size={24} /><span>Ngang <small>16:9</small></span>{!portrait && <Check size={16} />}</button><button type="button" className={portrait ? "selected" : ""} onClick={() => setDraft({ ...draft, orientation: "portrait" })}><Smartphone size={24} /><span>Dọc <small>9:16</small></span>{portrait && <Check size={16} />}</button></div></div>
      <div className="settings-row"><div className="field"><label htmlFor="rotation">Xoay nội dung</label><select id="rotation" value={draft.rotation} onChange={e => setDraft({ ...draft, rotation: Number(e.target.value) as Screen["rotation"] })}><option value={0}>0° · Không xoay</option><option value={90}>90° · Sang phải</option><option value={180}>180° · Lật ngược</option><option value={270}>270° · Sang trái</option></select></div><div className="field"><label htmlFor="fit">Cách hiển thị ảnh</label><select id="fit" value={draft.fit} onChange={e => setDraft({ ...draft, fit: e.target.value as Screen["fit"] })}><option value="contain">Hiện trọn ảnh</option><option value="cover">Lấp đầy khung</option></select></div></div>
      <p className="field-note">{draft.fit === "cover" ? "Lấp đầy khung có thể cắt mép ảnh. Kiểm tra chữ menu trước khi lưu." : "Ảnh giữ nguyên tỷ lệ, có thể có viền đen."} TV treo dọc có thể cần xoay 90° hoặc 270°.</p>
      <div className="playlist-heading"><h3>Nội dung trình chiếu</h3><span>{draft.items.length}/20 ảnh</span></div>
      {draft.items.length ? <ol className="playlist">{draft.items.map((item, index) => { const asset = data.assets.find(a => a.id === item.assetId); return <li key={`${item.assetId}-${index}`}><span className="playlist-index">{index + 1}</span><img src={asset?.url} alt="" /><div className="playlist-info"><strong>{asset?.name}</strong><label><input aria-label={`Thời lượng ảnh ${index + 1}`} type="number" min={5} max={300} value={item.duration} onChange={e => setDraft({ ...draft, items: draft.items.map((it, i) => i === index ? { ...it, duration: Number(e.target.value) } : it) })} /> giây</label></div><div className="playlist-actions"><button type="button" className="icon-button" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={`Đưa ảnh ${index + 1} lên`}><ArrowUp size={14} /></button><button type="button" className="icon-button" disabled={index === draft.items.length - 1} onClick={() => moveItem(index, 1)} aria-label={`Đưa ảnh ${index + 1} xuống`}><ArrowDown size={14} /></button><button type="button" className="icon-button" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) })} aria-label={`Bỏ ảnh ${index + 1}`}><X size={15} /></button></div></li>; })}</ol> : <div className="playlist-empty"><Images size={22} /><span>Chọn ảnh bên dưới để bắt đầu</span></div>}
      <Uploader compact storage={data.storage} onUploaded={asset => { onUploaded(asset); selectAsset(asset); }} />
      {data.assets.length > 0 && <><div className="library-picker-title">CHỌN TỪ THƯ VIỆN <span>Nhấn ảnh để thêm</span></div><div className="library-picker">{[...data.assets].reverse().map(asset => <button type="button" key={asset.id} disabled={draft.items.length >= 20} onClick={() => selectAsset(asset)} title={asset.name} aria-label={`Thêm ${asset.name}`}><img src={asset.url} alt={asset.name} loading="lazy" />{draft.items.some(item => item.assetId === asset.id) && <span><Check size={12} /></span>}</button>)}</div></>}
    </section></div><footer className="editor-footer"><div>{error ? <p className="error-message" role="alert">{error}</p> : <p><Info size={15} /> Lưu xong, reload browser trên TV để áp dụng.</p>}</div><div><button type="button" className="icon-button danger" title="Ngừng sử dụng TV" aria-label="Ngừng sử dụng TV" onClick={archive} disabled={busy}><Trash2 size={18} /></button><button type="button" className="button secondary" onClick={close}>Đóng</button><button className="button primary" disabled={busy || !dirty}><Save size={16} />{busy ? "Đang lưu…" : "Lưu cấu hình"}</button></div></footer>
  </form></dialog>;
}
