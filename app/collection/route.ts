import { NextResponse, type NextRequest } from "next/server";

const SESSION_MAX_AGE = 60 * 60 * 24 * 10;

export function GET(request: NextRequest) {
  const fansUrl = process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social";
  const response = NextResponse.redirect(new URL("/collection", fansUrl));
  const hostname = request.nextUrl.hostname;
  const sharedDomain = hostname === "pills.social" || hostname.endsWith(".pills.social") ? ".pills.social" : undefined;

  if (sharedDomain) {
    request.cookies.getAll()
      .filter(({ name }) => name.startsWith("sb-"))
      .forEach(({ name, value }) => {
        response.cookies.set(name, "", { path: "/", maxAge: 0 });
        response.cookies.set(name, value, {
          domain: sharedDomain,
          path: "/",
          sameSite: "lax",
          secure: true,
          maxAge: SESSION_MAX_AGE,
        });
      });
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}
