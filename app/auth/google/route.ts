import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
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
