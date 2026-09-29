import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const [{ data: username }, { data: profile }, { data: admin }] = await Promise.all([
    supabase.from("public_usernames").select("username").eq("user_id", authData.user.id).maybeSingle(),
    supabase.from("profiles").select("first_name,last_name,bio,account_status").eq("id", authData.user.id).maybeSingle(),
    supabase.from("app_admins").select("role").eq("user_id", authData.user.id).maybeSingle(),
  ]);

  const adminRole = admin?.role === "super_admin" || admin?.role === "curator" || admin?.role === "admin" ? admin.role : null;
  const fallbackSuperAdmin = authData.user.email?.toLowerCase() === "fabiobuscio97@gmail.com" || username?.username?.toLowerCase() === "fabit";
  return NextResponse.json({
    username: username?.username ?? "",
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    bio: profile?.bio ?? "",
    accountStatus: profile?.account_status ?? "active",
    adminRole: adminRole ?? (fallbackSuperAdmin ? "super_admin" : null),
    canModerate: Boolean(adminRole) || fallbackSuperAdmin,
    isSuperAdmin: adminRole === "super_admin" || fallbackSuperAdmin,
  });
}
