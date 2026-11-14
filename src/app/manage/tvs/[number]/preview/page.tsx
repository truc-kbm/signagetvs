import { redirect } from "next/navigation";
import { authenticated } from "@/lib/auth";
import { PreviewPage } from "@/components/preview-page";
export const dynamic = "force-dynamic";
export default async function Preview({ params }: { params: Promise<{ number: string }> }) {
  if (!await authenticated()) redirect("/manage");
  return <PreviewPage number={(await params).number} />;
}
