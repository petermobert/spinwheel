import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createServiceClient, requireAdmin } from "@/lib/supabaseServer";
import { fetchWheelBySlug } from "@/lib/wheelsServer";
import type { FilterMode, LeadRow } from "@/lib/types";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

function applyFilter(query: PostgrestFilterBuilder<unknown, unknown, unknown>, mode: FilterMode) {
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

function rowsToCsv(rows: LeadRow[]) {
  const headers = [
    "id",
    "first_name",
    "last_name",
    "street",
    "city",
    "zip_code",
    "phone_number",
    "email_address",
    "follow_up_requested",
    "source",
    "status",
    "used",
    "used_timestamp",
    "winner",
    "winner_timestamp",
    "spin_id",
    "created_at"
  ];

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = rows.map((r) =>
    [
      r.id,
      r.first_name,
      r.last_name,
      r.street,
      r.city,
      r.zip_code,
      r.phone_number,
      r.email_address,
      r.follow_up_requested,
      r.source,
      r.status,
      r.used,
      r.used_timestamp,
      r.winner,
      r.winner_timestamp,
      r.spin_id,
      r.created_at
    ]
      .map(escape)
      .join(",")
  );

  return [headers.join(","), ...lines].join("\n");
}

async function fetchRows(filterMode: FilterMode, search: string, wheelId: string) {
  const admin = createServiceClient();

  let query = admin
    .from("leads")
    .select(
      "id,wheel_id,first_name,last_name,street,city,zip_code,phone_number,email_address,follow_up_requested,created_at,source,status,wheel_entry_id,used,used_timestamp,winner,winner_timestamp,spin_id"
    )
    .eq("wheel_id", wheelId)
    .order("created_at", { ascending: false })
    .limit(10000);

  query = applyFilter(query, filterMode);

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email_address.ilike.%${search}%,phone_number.ilike.%${search}%,zip_code.ilike.%${search}%,city.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error("Failed to fetch export rows");
  }

  return (data || []) as LeadRow[];
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

  const format = (request.nextUrl.searchParams.get("format") || "csv") as "csv" | "xlsx";
  const filterMode = (request.nextUrl.searchParams.get("filterMode") || "ALL") as FilterMode;
  const search = (request.nextUrl.searchParams.get("search") || "").trim();

  try {
    const rows = await fetchRows(filterMode, search, wheelLookup.wheel.id);

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Leads");

      sheet.columns = [
        { header: "ID", key: "id", width: 38 },
        { header: "First Name", key: "first_name", width: 16 },
        { header: "Last Name", key: "last_name", width: 16 },
        { header: "Street", key: "street", width: 22 },
        { header: "City", key: "city", width: 16 },
        { header: "Zip", key: "zip_code", width: 12 },
        { header: "Phone", key: "phone_number", width: 16 },
        { header: "Email", key: "email_address", width: 24 },
        { header: "Follow Up", key: "follow_up_requested", width: 12 },
        { header: "Source", key: "source", width: 14 },
        { header: "Status", key: "status", width: 12 },
        { header: "Used", key: "used", width: 10 },
        { header: "Used Timestamp", key: "used_timestamp", width: 24 },
        { header: "Winner", key: "winner", width: 10 },
        { header: "Winner Timestamp", key: "winner_timestamp", width: 24 },
        { header: "Spin ID", key: "spin_id", width: 38 },
        { header: "Created", key: "created_at", width: 24 }
      ];

      rows.forEach((row) => sheet.addRow(row));

      const buf = await workbook.xlsx.writeBuffer();
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="sparkle-leads-${wheelLookup.wheel.slug}-${filterMode.toLowerCase()}.xlsx"`
        }
      });
    }

    const csv = rowsToCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="sparkle-leads-${wheelLookup.wheel.slug}-${filterMode.toLowerCase()}.csv"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
