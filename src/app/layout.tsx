import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "XLC · Quản lý màn hình", description: "Không gian quản lý màn hình Xôi Lá Chuối", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body>{children}</body></html>;
}
