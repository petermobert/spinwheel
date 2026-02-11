import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireAdmin } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if ("error" in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const admin = createServiceClient();
  const { data: lockRow } = await admin.from("locks").select("held_by, spin_id, expires_at").eq("key", "spinLock").maybeSingle();

  const lockHeld = !!lockRow && new Date(lockRow.expires_at).getTime() > Date.now();

  return NextResponse.json({ lockHeld, lock: lockHeld ? lockRow : null });
}
