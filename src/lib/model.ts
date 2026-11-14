import { z } from "zod";

export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_PIXELS = 16_000_000;
export const screenInput = z.object({
  name: z.string().trim().min(1, "Nhập tên TV").max(80),
  orientation: z.enum(["landscape", "portrait"]),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  fit: z.enum(["contain", "cover"]),
  items: z.array(z.object({ assetId: z.string().min(1).max(100), duration: z.number().int().min(5).max(300) })).max(20),
});
export type ScreenSettings = z.infer<typeof screenInput>;
export type Screen = ScreenSettings & { id: string; number: number; revision: number; updatedAt: string; archivedAt?: string };
export type Asset = { id: string; name: string; url: string; width: number; height: number; bytes: number; createdAt: string };
export type State = {
  schemaVersion: 1; restaurant: { slug: "XLC"; name: string }; nextScreenNumber: number;
  screens: Screen[]; assets: Asset[];
  loginAttempts: Record<string, { count: number; until: number }>;
};
export type ManageData = Pick<State, "restaurant" | "screens" | "assets"> & { storage: "local" | "blob" };
export type Manifest = Omit<Screen, "items"> & { items: (Asset & { duration: number })[] };
export function initialState(): State {
  return { schemaVersion: 1, restaurant: { slug: "XLC", name: "Xôi Lá Chuối" }, nextScreenNumber: 2,
    screens: [{ id: "xlc-screen-1", number: 1, name: "Màn hình chính", revision: 0,
      orientation: "landscape", rotation: 0, fit: "contain", items: [], updatedAt: new Date().toISOString() }],
    assets: [], loginAttempts: {} };
}
export function manifestFor(state: State, screen: Screen): Manifest {
  return { ...screen, items: screen.items.flatMap(item => {
    const asset = state.assets.find(a => a.id === item.assetId);
    return asset ? [{ ...asset, duration: item.duration }] : [];
  }) };
}
export function canvasSize(width: number, height: number, rotation: number) {
  return rotation === 90 || rotation === 270 ? { width: height, height: width } : { width, height };
}
