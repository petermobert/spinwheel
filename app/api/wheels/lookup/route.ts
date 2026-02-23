import { NextRequest, NextResponse } from "next/server";
import { fetchWheelBySlug } from "@/lib/wheelsServer";

export async function GET(request: NextRequest) {
  const wheelSlug = (request.nextUrl.searchParams.get("slug") || "").trim();
  const wheelLookup = await fetchWheelBySlug(wheelSlug);
  if ("error" in wheelLookup) {
    return NextResponse.json({ error: wheelLookup.error }, { status: wheelLookup.status });
  }

  if (!wheelLookup.wheel.is_active) {
    return NextResponse.json({ error: "Wheel is not active" }, { status: 404 });
  }

  return NextResponse.json({ wheel: wheelLookup.wheel });
}
