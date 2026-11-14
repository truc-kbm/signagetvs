"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Maximize, Pause, Play } from "lucide-react";
import { api } from "@/lib/client";
import type { Manifest } from "@/lib/model";
import { Renderer } from "./player";
export function PreviewPage({ number }: { number: string }) {
  const [manifest, setManifest] = useState<Manifest | null>(null); const [error, setError] = useState("");
  const [paused, setPaused] = useState(false); const [browser, setBrowser] = useState(false); const [selected, setSelected] = useState<number | undefined>();
  useEffect(() => { api<Manifest>(`/api/player/XLC/${number}`).then(setManifest).catch(e => setError(e.message)); }, [number]);
  const portrait = manifest?.orientation === "portrait";
  const swapped = browser && (manifest?.rotation === 90 || manifest?.rotation === 270);
  return <main className="preview-page"><header className="preview-header"><a href="/manage" className="text-link"><ArrowLeft size={18} /> Quản lý màn hình</a><div><strong>{manifest?.name || `TV ${number}`}</strong><span>Nội dung đã lưu {manifest ? `· Phiên bản ${manifest.revision}` : ""}</span></div><a href={`/XLC/${number}`} target="_blank" className="button secondary"><Maximize size={16} /> Mở player</a></header>
    <div className="preview-toolbar"><div className="segmented"><button className={!browser ? "active" : ""} onClick={() => setBrowser(false)}>Hướng treo</button><button className={browser ? "active" : ""} onClick={() => setBrowser(true)}>Đầu ra browser</button></div><button className="button secondary" onClick={() => { setPaused(!paused); setSelected(undefined); }}>{paused ? <Play size={16} /> : <Pause size={16} />}{paused ? "Phát tiếp" : "Tạm dừng"}</button></div>
    <div className="preview-stage">{manifest ? <div className={`preview-monitor ${(portrait !== swapped) ? "portrait" : ""}`}><Renderer manifest={manifest} paused={paused} natural={!browser} selectedIndex={selected} /></div> : <p role="alert">{error || "Đang tải…"}</p>}</div>
    {manifest && manifest.items.length > 1 && <div className="preview-slides">{manifest.items.map((item, i) => <button key={`${item.id}-${i}`} className={selected === i ? "selected" : ""} onClick={() => { setSelected(i); setPaused(true); }} aria-label={`Xem ảnh ${i + 1}`}><img src={item.url} alt={item.name} /><span>{i + 1}</span></button>)}</div>}
    <p className="preview-note">Đây là bản xem trước cấu hình đã lưu. TV thật nhận nội dung này khi reload browser.</p>
  </main>;
}
