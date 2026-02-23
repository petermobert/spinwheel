import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseServer";
import { fetchWheelBySlug } from "@/lib/wheelsServer";

export async function GET(request: NextRequest) {
  const wheelSlug = (request.nextUrl.searchParams.get("wheel") || "").trim();
  const wheelLookup = await fetchWheelBySlug(wheelSlug);
  if ("error" in wheelLookup) {
    return NextResponse.json({ error: wheelLookup.error }, { status: wheelLookup.status });
  }

  const admin = createServiceClient();
  const { data: lockRow } = await admin
    .from("locks")
    .select("held_by, spin_id, expires_at")
    .eq("wheel_id", wheelLookup.wheel.id)
    .eq("key", "spinLock")
    .maybeSingle();

  const lockHeld = !!lockRow && new Date(lockRow.expires_at).getTime() > Date.now();

  return NextResponse.json({ lockHeld, lock: lockHeld ? lockRow : null });
}
