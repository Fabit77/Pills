import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;
  if (!url || !key) {
    if (path === "/" || path.startsWith("/studio")) {
      const target = request.nextUrl.clone();
      target.pathname = "/login";
      return NextResponse.redirect(target);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        if (headersToSet) Object.entries(headersToSet).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const signedIn = Boolean(claims);
  let hasUsername = false;
  if (signedIn && typeof claims?.sub === "string") {
    const { data: username } = await supabase
      .from("public_usernames")
      .select("username")
      .eq("user_id", claims.sub)
      .maybeSingle();
    hasUsername = Boolean(username?.username);
  }
  if (path === "/") {
    const target = request.nextUrl.clone();
    target.pathname = signedIn ? (hasUsername ? "/studio" : "/onboarding") : "/login";
    return NextResponse.redirect(target);
  }

  if (path.startsWith("/studio") && !signedIn) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.searchParams.set("next", path);
    return NextResponse.redirect(target);
  }

  if (path.startsWith("/studio") && signedIn && !hasUsername) {
    const target = request.nextUrl.clone();
    target.pathname = "/onboarding";
    return NextResponse.redirect(target);
  }

  if (path === "/onboarding" && !signedIn) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    return NextResponse.redirect(target);
  }

  if (path === "/onboarding" && hasUsername) {
    const target = request.nextUrl.clone();
    target.pathname = "/studio";
    return NextResponse.redirect(target);
  }

  if (path === "/login" && signedIn) {
    const target = request.nextUrl.clone();
    target.pathname = hasUsername ? "/studio" : "/onboarding";
    return NextResponse.redirect(target);
  }

  return response;
}
