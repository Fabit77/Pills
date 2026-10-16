import { NextResponse } from "next/server";
import {
  clearHostOnlySupabaseSessionCookies,
  clearSupabaseSessionCookies,
} from "@/lib/supabase/clear-session-cookies";
import { getSiteUrl } from "@/lib/site-url";

function safeLocalPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/login";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const siteUrl = getSiteUrl(request);
  const next = safeLocalPath(url.searchParams.get("next"));

  if (url.searchParams.get("scope") !== "domain") {
    await clearHostOnlySupabaseSessionCookies();
    const domainResetUrl = new URL("/auth/session-reset", siteUrl);
    domainResetUrl.searchParams.set("scope", "domain");
    domainResetUrl.searchParams.set("next", next);
    const response = NextResponse.redirect(domainResetUrl);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  await clearSupabaseSessionCookies();
  const response = NextResponse.redirect(new URL(next, siteUrl));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
