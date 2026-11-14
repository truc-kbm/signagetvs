import { Leaf } from "lucide-react";
export function Brand({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? "brand-light" : ""}`}><span className="brand-mark"><Leaf size={24} strokeWidth={1.7} /></span><span><strong>Xôi Lá Chuối</strong><small>SIGNAGE STUDIO</small></span></div>;
}
