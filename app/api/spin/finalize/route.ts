import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireAdmin } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if ("error" in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const body = await request.json().catch(() => null);
  const spinId = String(body?.spinId || "");
  const confirmed = Boolean(body?.confirmed ?? true);

  if (!spinId) {
    return NextResponse.json({ error: "spinId is required" }, { status: 400 });
  }

  const admin = createServiceClient();

  const { data: spin, error: spinError } = await admin.from("spins").select("id, status").eq("id", spinId).maybeSingle();

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
    p_spin_id: spinId,
    p_confirm_winner: confirmed
  });

  if (error) {
    return NextResponse.json({ error: "Failed to finalize spin" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
