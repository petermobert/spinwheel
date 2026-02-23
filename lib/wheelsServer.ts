import { createServiceClient } from "@/lib/supabaseServer";
import type { WheelRow } from "@/lib/types";

export async function fetchWheelBySlug(slug: string) {
  const clean = slug.trim();
  if (!clean) {
    return { error: "Wheel slug is required", status: 400 as const };
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("wheels")
    .select("id, slug, name, created_at, is_active")
    .eq("slug", clean)
    .maybeSingle();

  if (error) {
    return { error: "Failed to load wheel", status: 500 as const };
  }

  if (!data) {
    return { error: "Wheel not found", status: 404 as const };
  }

  return { wheel: data as WheelRow, status: 200 as const };
}
