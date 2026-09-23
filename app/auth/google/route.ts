import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration");

    const settingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseKey },
      cache: "no-store",
    });
    const settings = await settingsResponse.json();
    if (!settings?.external?.google) {
      return NextResponse.redirect(new URL("/login?error=google_unavailable", request.url));
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/onboarding`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error || !data.url) throw error ?? new Error("No OAuth URL");
    return NextResponse.redirect(data.url);
  } catch {
    return NextResponse.redirect(new URL("/login?error=google_unavailable", request.url));
  }
}
