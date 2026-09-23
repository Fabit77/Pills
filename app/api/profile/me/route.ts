import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const [{ data: username }, { data: profile }] = await Promise.all([
    supabase.from("public_usernames").select("username").eq("user_id", authData.user.id).maybeSingle(),
    supabase.from("profiles").select("first_name,last_name,bio").eq("id", authData.user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    username: username?.username ?? "",
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    bio: profile?.bio ?? "",
  });
}
