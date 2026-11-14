import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
const config: NextConfig = {
  poweredByHeader: false,
  // TVs use this machine's LAN address. Next's dev resource and WebSocket
  // checks otherwise reject that origin even though the page HTML is public.
  // Allow only this machine's actual addresses, never arbitrary origins.
  allowedDevOrigins: Object.values(networkInterfaces()).flatMap(addresses =>
    (addresses || []).filter(address => address.family === "IPv4" && !address.internal).map(address => address.address)),
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" }
    ] }];
  }
};
export default config;
