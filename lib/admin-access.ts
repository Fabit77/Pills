import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type PlatformAdminRole = "super_admin" | "admin" | "curator";

export function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase service credentials");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requirePlatformAdmin(allowed: PlatformAdminRole[] = ["super_admin", "admin", "curator"]) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null, role: null, admin: null, error: NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 }) };
  const { data: roleRow } = await supabase.from("app_admins").select("role").eq("user_id", data.user.id).maybeSingle();
  const fallback = data.user.email?.toLowerCase() === "fabiobuscio97@gmail.com" ? "super_admin" : null;
  const role = (roleRow?.role ?? fallback) as PlatformAdminRole | null;
  if (!role || !allowed.includes(role)) return { user: data.user, role, admin: null, error: NextResponse.json({ error: "No tienes permisos para esta sección." }, { status: 403 }) };
  return { user: data.user, role, admin: serviceClient(), error: null };
}
