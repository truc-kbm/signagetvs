"use client";
import { useEffect, useRef, useState } from "react";
import { Monitor } from "lucide-react";
import { canvasSize, type Manifest } from "@/lib/model";

export function Renderer({ manifest, paused = false, natural = false, selectedIndex }: { manifest: Manifest; paused?: boolean; natural?: boolean; selectedIndex?: number }) {
  const root = useRef<HTMLDivElement>(null); const [size, setSize] = useState({ width: 0, height: 0 });
  const [index, setIndex] = useState(0); const [displayed, setDisplayed] = useState<string | null>(manifest.items[selectedIndex ?? 0]?.url ?? null); const [failed, setFailed] = useState<number[]>([]);
  const [hasDisplayed, setHasDisplayed] = useState(false);
  const items = manifest.items; const activeIndex = selectedIndex ?? index; const item = items[activeIndex % (items.length || 1)];
  const playlistKey = items.map(i => i.id).join(",");
  const sourceKey = items.map(i => i.url).join(",");
  useEffect(() => { setIndex(0); setFailed([]); setHasDisplayed(false); setDisplayed(items[selectedIndex ?? 0]?.url ?? null); }, [playlistKey]);
  useEffect(() => { setFailed([]); }, [sourceKey]);
  useEffect(() => { const node = root.current; if (!node) return;
    const update = () => setSize({ width: node.clientWidth, height: node.clientHeight }); update();
    const observer = new ResizeObserver(update); observer.observe(node); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!item) return;
    let disposed = false; const image = new Image(); image.decoding = "async";
    image.onload = () => { if (!disposed) { setDisplayed(item.url); setHasDisplayed(true); setFailed(old => old.includes(activeIndex) ? old.filter(i => i !== activeIndex) : old); } };
    image.onerror = () => { if (!disposed) setFailed(old => old.includes(activeIndex) ? old : [...old, activeIndex]); };
    image.src = item.url;
    return () => { disposed = true; image.onload = null; image.onerror = null; };
  }, [item?.url, activeIndex]);
  useEffect(() => {
    if (!item || paused || selectedIndex !== undefined || items.length < 2 || failed.length >= items.length) return;
    const timer = setTimeout(() => {
      let next = (index + 1) % items.length;
      for (let i = 0; i < items.length && failed.includes(next); i++) next = (next + 1) % items.length;
      setIndex(next);
    }, failed.includes(index) ? 100 : item.duration * 1000);
    return () => clearTimeout(timer);
  }, [item, index, items.length, paused, selectedIndex, failed]);
  useEffect(() => {
    if (items.length < 2 || !displayed) return;
    const next = (activeIndex + 1) % items.length;
    if (failed.includes(next)) return;
    const preload = new Image(); preload.src = items[next].url;
    return () => { preload.onload = null; preload.onerror = null; };
  }, [activeIndex, items, displayed, failed]);
  const rotation = natural ? 0 : manifest.rotation;
  const canvas = canvasSize(size.width, size.height, rotation);
  return <div className="renderer" ref={root}>
    {!items.length ? <div className="player-empty"><Monitor size={34} strokeWidth={1.3} /><strong>Chưa có nội dung</strong><span>Chọn ảnh và lưu cấu hình cho TV này</span></div> : <>
      {displayed && <div className="render-canvas" style={{ width: size.width ? canvas.width : (rotation % 180 ? "100vh" : "100%"), height: size.height ? canvas.height : (rotation % 180 ? "100vw" : "100%"), transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}><img src={displayed} alt="" draggable={false} style={{ objectFit: manifest.fit }} /></div>}
      {!displayed && failed.length < items.length && <div className="player-empty"><span>Đang tải hình ảnh…</span></div>}
      {!hasDisplayed && failed.length >= items.length && <div className="player-empty"><strong>Không tải được hình ảnh</strong><span>Kiểm tra mạng và reload browser để thử lại.</span></div>}
    </>}
  </div>;
}
