import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createServiceClient() {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createAnonServerClient() {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function requireAdmin(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token) {
    return { error: "Missing bearer token", status: 401 as const };
  }

  const anon = createAnonServerClient();
  const { data: userData, error: userError } = await anon.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: "Invalid session", status: 401 as const };
  }

  const admin = createServiceClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return { error: "Failed to verify role", status: 500 as const };
  }

  if (!profile?.is_admin) {
    return { error: "Admin access required", status: 403 as const };
  }

  return { userId: userData.user.id, status: 200 as const };
}
