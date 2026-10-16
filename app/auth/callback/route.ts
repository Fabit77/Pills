import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { ensurePrivyWallet } from "@/lib/privy/server";
import { clearSupabaseSessionCookies } from "@/lib/supabase/clear-session-cookies";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getSiteUrl(request);
  const code = searchParams.get("code");
  const next = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/studio";
  const providerError = searchParams.get("error");

  if (providerError) {
    console.warn("Google OAuth provider returned an error", providerError);
  }

  if (code) {
    await clearSupabaseSessionCookies();
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        await ensurePrivyWallet(data.user);
      } catch (walletError) {
        console.error("Privy wallet provisioning failed after OAuth login", walletError);
      }
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
    console.error("Google OAuth callback exchange failed", error?.message ?? "No user returned");
  }

  const response = NextResponse.redirect(`${origin}/login?error=auth_callback`);
  response.cookies.delete("pills_auth_surface");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
