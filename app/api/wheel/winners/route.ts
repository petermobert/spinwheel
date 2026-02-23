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
  const { data, error } = await admin
    .from("spins")
    .select("id, winner_display_name, finalized_at")
    .eq("wheel_id", wheelLookup.wheel.id)
    .eq("status", "finalized")
    .order("finalized_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "Failed to load winners" }, { status: 500 });
  }

  return NextResponse.json({ winners: data || [] });
}
