import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireAdmin } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if ("error" in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("spins")
    .select("id, winner_display_name, finalized_at")
    .eq("status", "finalized")
    .order("finalized_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: "Failed to load winners" }, { status: 500 });
  }

  return NextResponse.json({ winners: data || [] });
}
