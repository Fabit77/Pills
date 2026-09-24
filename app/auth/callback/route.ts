import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getSiteUrl(request);
  const code = searchParams.get("code");
  const next = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/studio";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const { data: publicProfile } = await supabase
        .from("public_usernames")
        .select("username")
        .eq("user_id", data.user.id)
        .maybeSingle();
      const destination = publicProfile?.username ? (next === "/onboarding" ? "/studio" : next) : "/onboarding";
      const response = NextResponse.redirect(`${origin}${destination}`);
      response.cookies.delete("pills_auth_surface");
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
