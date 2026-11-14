import { requireAuth } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { readState, storageDriver } from "@/lib/store";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => { await requireAuth(); const { restaurant, screens, assets } = await readState();
    return json({ restaurant, screens: screens.filter(s => !s.archivedAt), assets, storage: storageDriver() }); });
}
