import { clearAuthCookiesAtScopes } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export function getSessionCookieBase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : null;
  } catch {
    return null;
  }
}

function getSessionCookieNames(
  allCookies: Array<{ name: string }>,
  storageKey = getSessionCookieBase(),
) {
  if (!storageKey) return [];
  return allCookies
    .map(({ name }) => name)
    .filter((name) => name === storageKey || (name.startsWith(`${storageKey}.`) && /^\d+$/.test(name.slice(storageKey.length + 1))));
}

export async function clearHostOnlySupabaseSessionCookies() {
  const base = getSessionCookieBase();
  if (!base) return;

  const cookieStore = await cookies();
  for (const name of getSessionCookieNames(cookieStore.getAll(), base)) {
    cookieStore.set(name, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}

export async function clearSupabaseSessionCookies() {
  const base = getSessionCookieBase();
  if (!base) return;

  const cookieStore = await cookies();
  const headerStore = await headers();
  const hostname = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "")
    .split(",")[0]
    .trim()
    .split(":")[0];
  const sharedHost = hostname === "pills.social" || hostname.endsWith(".pills.social");

  await clearAuthCookiesAtScopes({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
    },
    storageKey: base,
    scopes: [sharedHost ? { path: "/", domain: ".pills.social" } : { path: "/" }],
  });
}
