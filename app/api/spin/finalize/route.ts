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
  const confirmed = Boolean(body?.confirmed ?? true);

  if (!spinId) {
    return NextResponse.json({ error: "spinId is required" }, { status: 400 });
  }

  const admin = createServiceClient();

  const { data: spin, error: spinError } = await admin
    .from("spins")
    .select("id, status")
    .eq("id", spinId)
    .eq("wheel_id", wheelLookup.wheel.id)
    .maybeSingle();

  if (spinError || !spin) {
    return NextResponse.json({ error: "Spin not found" }, { status: 404 });
  }

  if (spin.status === "finalized") {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  if (spin.status === "cancelled") {
    return NextResponse.json({ error: "Spin is cancelled" }, { status: 409 });
  }

  const { data, error } = await admin.rpc("finalize_spin", {
    p_wheel_id: wheelLookup.wheel.id,
    p_spin_id: spinId,
    p_confirm_winner: confirmed
  });

  if (error) {
    return NextResponse.json({ error: "Failed to finalize spin" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
