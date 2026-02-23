import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireAdmin } from "@/lib/supabaseServer";
import { fetchWheelBySlug } from "@/lib/wheelsServer";
import type { FilterMode } from "@/lib/types";

function applyFilter(query: any, mode: FilterMode) {
  switch (mode) {
    case "ELIGIBLE":
      return query.eq("used", false).eq("winner", false);
    case "USED":
      return query.eq("used", true);
    case "WINNERS":
      return query.eq("winner", true);
    default:
      return query;
  }
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if ("error" in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const wheelSlug = (request.nextUrl.searchParams.get("wheel") || "").trim();
  const wheelLookup = await fetchWheelBySlug(wheelSlug);
  if ("error" in wheelLookup) {
    return NextResponse.json({ error: wheelLookup.error }, { status: wheelLookup.status });
  }

  const filterMode = (request.nextUrl.searchParams.get("filterMode") || "ALL") as FilterMode;
  const search = (request.nextUrl.searchParams.get("search") || "").trim();

  const admin = createServiceClient();

  let query = admin
    .from("leads")
    .select(
      "id,wheel_id,first_name,last_name,street,city,zip_code,phone_number,email_address,follow_up_requested,created_at,source,status,wheel_entry_id,used,used_timestamp,winner,winner_timestamp,spin_id,wheel_entries!leads_wheel_entry_fk(display_name)"
    )
    .eq("wheel_id", wheelLookup.wheel.id)
    .order("created_at", { ascending: false })
    .limit(1000);

  query = applyFilter(query, filterMode as FilterMode);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email_address.ilike.%${search}%,phone_number.ilike.%${search}%,zip_code.ilike.%${search}%,city.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    const detail =
      process.env.NODE_ENV === "development"
        ? `${error.message}${error.details ? ` | ${error.details}` : ""}`
        : "Failed to fetch entries";
    return NextResponse.json({ error: detail }, { status: 500 });
  }

  return NextResponse.json({ rows: data || [] });
}
