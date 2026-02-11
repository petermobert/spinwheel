import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireAdmin } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if ("error" in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const body = await request.json().catch(() => null);
  const spinId = String(body?.spinId || "");

  if (!spinId) {
    return NextResponse.json({ error: "spinId is required" }, { status: 400 });
  }

  const admin = createServiceClient();
  const now = new Date().toISOString();

  const { data: spin, error: findError } = await admin.from("spins").select("status").eq("id", spinId).maybeSingle();
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
    .neq("status", "cancelled");

  await admin.rpc("release_spin_lock", { p_spin_id: spinId });

  return NextResponse.json({ ok: true });
}
