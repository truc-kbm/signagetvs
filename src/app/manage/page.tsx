import { authenticated } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard";
import { PinGate } from "@/components/pin-gate";
export const dynamic = "force-dynamic";
export default async function ManagePage() { return await authenticated() ? <Dashboard /> : <PinGate />; }
