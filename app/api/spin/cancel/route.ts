import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseServer";
import { fetchWheelBySlug } from "@/lib/wheelsServer";

export async function POST(request: NextRequest) {
  const wheelSlug = (request.nextUrl.searchParams.get("wheel") || "").trim();
  const wheelLookup = await fetchWheelBySlug(wheelSlug);
  if ("error" in wheelLookup) {
    return NextResponse.json({ error: wheelLookup.error }, { status: wheelLookup.status });
  }

  const body = await request.json().catch(() => null);
  const spinId = String(body?.spinId || "");

  if (!spinId) {
    return NextResponse.json({ error: "spinId is required" }, { status: 400 });
  }

  const admin = createServiceClient();
  const now = new Date().toISOString();

  const { data: spin, error: findError } = await admin
    .from("spins")
    .select("status")
    .eq("id", spinId)
    .eq("wheel_id", wheelLookup.wheel.id)
    .maybeSingle();
  if (findError || !spin) {
    return NextResponse.json({ error: "Spin not found" }, { status: 404 });
  }

  if (spin.status === "finalized") {
    return NextResponse.json({ error: "Cannot cancel a finalized spin" }, { status: 409 });
  }

  await admin
    .from("spins")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("id", spinId)
    .eq("wheel_id", wheelLookup.wheel.id)
    .neq("status", "cancelled");

  await admin.rpc("release_spin_lock", { p_wheel_id: wheelLookup.wheel.id, p_spin_id: spinId });

  return NextResponse.json({ ok: true });
}
