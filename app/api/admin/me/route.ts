import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);

  if ("error" in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  return NextResponse.json({ isAdmin: true, userId: adminCheck.userId });
}
