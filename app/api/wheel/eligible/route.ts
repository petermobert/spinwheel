import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseServer";
import { fetchWheelBySlug } from "@/lib/wheelsServer";

function withCity(baseName: string, city: string | null) {
  const cleanCity = (city || "").trim();
  return cleanCity ? `${baseName} (${cleanCity})` : baseName;
}

type EligibleRow = {
  id: string;
  city: string | null;
  wheel_entry_id: string | null;
  wheel_entries: { display_name: string } | null;
};

export async function GET(request: NextRequest) {
  const wheelSlug = (request.nextUrl.searchParams.get("wheel") || "").trim();
  const wheelLookup = await fetchWheelBySlug(wheelSlug);
  if ("error" in wheelLookup) {
    return NextResponse.json({ error: wheelLookup.error }, { status: wheelLookup.status });
  }

  const admin = createServiceClient();

  const { data: rows, error } = await admin
    .from("leads")
    .select("id, city, wheel_entry_id, wheel_entries!leads_wheel_entry_fk(display_name)")
    .eq("wheel_id", wheelLookup.wheel.id)
    .eq("used", false)
    .eq("winner", false)
    .not("wheel_entry_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to load eligible entries" }, { status: 500 });
  }

  const { data: lockRow } = await admin
    .from("locks")
    .select("expires_at")
    .eq("wheel_id", wheelLookup.wheel.id)
    .eq("key", "spinLock")
    .maybeSingle();
  const lockHeld = !!lockRow && new Date(lockRow.expires_at).getTime() > Date.now();

  const entries = ((rows || []) as EligibleRow[]).map((r) => ({
    wheel_entry_id: r.wheel_entry_id as string,
    display_name: withCity(r.wheel_entries?.display_name || "Entry", r.city || null),
    lead_id: r.id
  }));

  return NextResponse.json({ entries, lockHeld });
}
