import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireAdmin } from "@/lib/supabaseServer";

function withCity(baseName: string, city: string | null) {
  const cleanCity = (city || "").trim();
  return cleanCity ? `${baseName} (${cleanCity})` : baseName;
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if ("error" in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const admin = createServiceClient();

  const { data: rows, error } = await admin
    .from("leads")
    .select("id, city, wheel_entry_id, wheel_entries!leads_wheel_entry_fk(display_name)")
    .eq("used", false)
    .eq("winner", false)
    .not("wheel_entry_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load eligible entries" }, { status: 500 });
  }

  const { data: lockRow } = await admin.from("locks").select("expires_at").eq("key", "spinLock").maybeSingle();
  const lockHeld = !!lockRow && new Date(lockRow.expires_at).getTime() > Date.now();

  const entries = (rows || []).map((r: any) => ({
    wheel_entry_id: r.wheel_entry_id as string,
    display_name: withCity(r.wheel_entries?.display_name || "Entry", r.city || null),
    lead_id: r.id as string
  }));

  return NextResponse.json({ entries, lockHeld });
}
