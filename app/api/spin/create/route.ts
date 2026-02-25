import crypto from "node:crypto";
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
  wheel_entries: { display_name: string }[] | { display_name: string } | null;
};

export async function POST(request: NextRequest) {
  const wheelSlug = (request.nextUrl.searchParams.get("wheel") || "").trim();
  const wheelLookup = await fetchWheelBySlug(wheelSlug);
  if ("error" in wheelLookup) {
    return NextResponse.json({ error: wheelLookup.error }, { status: wheelLookup.status });
  }

  const admin = createServiceClient();
  const spinId = crypto.randomUUID();

  const { data: lockOk, error: lockError } = await admin.rpc("acquire_spin_lock", {
    p_wheel_id: wheelLookup.wheel.id,
    p_held_by: null,
    p_spin_id: spinId,
    p_ttl_seconds: 120
  });

  if (lockError) {
    return NextResponse.json({ error: "Failed to acquire spin lock" }, { status: 500 });
  }

  if (!lockOk) {
    return NextResponse.json(
      { error: "Another spin is currently in progress. Please wait for lock expiry or completion." },
      { status: 409 }
    );
  }

  const { data: eligibleRows, error: eligibleError } = await admin
    .from("leads")
    .select("id, city, wheel_entry_id, wheel_entries!leads_wheel_entry_fk(display_name)")
    .eq("wheel_id", wheelLookup.wheel.id)
    .not("wheel_entry_id", "is", null)
    .eq("used", false)
    .eq("winner", false)
    .order("created_at", { ascending: true });

  if (eligibleError) {
    await admin.rpc("release_spin_lock", { p_wheel_id: wheelLookup.wheel.id, p_spin_id: spinId });
    return NextResponse.json({ error: "Failed to fetch eligible entries" }, { status: 500 });
  }

  const entriesSnapshot = ((eligibleRows || []) as EligibleRow[]).map((r) => {
    const entry = Array.isArray(r.wheel_entries) ? r.wheel_entries[0] : r.wheel_entries;
    return {
      wheel_entry_id: r.wheel_entry_id as string,
      display_name: withCity(entry?.display_name || "Entry", r.city || null),
      lead_id: r.id
    };
  });

  if (entriesSnapshot.length === 0) {
    await admin.rpc("release_spin_lock", { p_wheel_id: wheelLookup.wheel.id, p_spin_id: spinId });
    return NextResponse.json({ error: "No eligible entries to spin" }, { status: 400 });
  }

  const winnerIndex = crypto.randomInt(0, entriesSnapshot.length);
  const winner = entriesSnapshot[winnerIndex];

  const { error: spinInsertError } = await admin.from("spins").insert({
    id: spinId,
    wheel_id: wheelLookup.wheel.id,
    status: "pending",
    entries_snapshot: entriesSnapshot,
    winner_wheel_entry_id: winner.wheel_entry_id,
    winner_display_name: winner.display_name
  });

  if (spinInsertError) {
    await admin.rpc("release_spin_lock", { p_wheel_id: wheelLookup.wheel.id, p_spin_id: spinId });
    return NextResponse.json({ error: "Failed to create spin" }, { status: 500 });
  }

  return NextResponse.json({
    spinId,
    winnerWheelEntryId: winner.wheel_entry_id,
    winnerDisplayName: winner.display_name,
    winnerIndex,
    entriesSnapshot
  });
}
