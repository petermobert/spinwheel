import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, requireAdmin } from "@/lib/supabaseServer";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if ("error" in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("wheels")
    .select("id, slug, name, created_at, is_active")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to load wheels" }, { status: 500 });
  }

  return NextResponse.json({ wheels: data || [] });
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if ("error" in adminCheck) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const body = await request.json().catch(() => null);
  const name = String(body?.name || "").trim();
  const slug = normalizeSlug(String(body?.slug || ""));

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!slug || slug.length < 3) {
    return NextResponse.json({ error: "Slug must be at least 3 characters" }, { status: 400 });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Slug may only contain lowercase letters, numbers, and hyphens" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data, error } = await admin
    .from("wheels")
    .insert({ name, slug })
    .select("id, slug, name, created_at, is_active")
    .maybeSingle();

  if (error) {
    const message = error.message?.toLowerCase().includes("duplicate") || error.code === "23505"
      ? "Slug already exists"
      : "Failed to create wheel";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ wheel: data }, { status: 201 });
}
