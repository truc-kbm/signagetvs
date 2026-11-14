import { randomUUID } from "node:crypto";
import { requireAuth, requireSameOrigin } from "@/lib/auth";
import { handle, json } from "@/lib/http";
import { mutateState } from "@/lib/store";
import { AppError } from "@/lib/errors";
export async function POST(request: Request) {
  return handle(async () => {
    requireSameOrigin(request); await requireAuth(); const id = randomUUID();
    const screen = await mutateState(state => {
      if (state.screens.filter(s => !s.archivedAt).length >= 30) throw new AppError(422, "Tối đa 30 TV cho XLC.");
      const number = state.nextScreenNumber++;
      const screen = { id, number, name: `Màn hình ${number}`, revision: 0, updatedAt: new Date().toISOString(), orientation: "landscape" as const, rotation: 0 as const, fit: "contain" as const, items: [] };
      state.screens.push(screen); return screen;
    });
    return json(screen, 201);
  });
}
