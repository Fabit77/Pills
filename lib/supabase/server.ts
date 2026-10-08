import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const hostname = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").split(",")[0].trim().split(":")[0];
  const sharedDomain = hostname === "pills.social" || hostname.endsWith(".pills.social") ? ".pills.social" : undefined;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");

  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, {
            ...options,
            ...(sharedDomain ? { domain: sharedDomain } : {}),
            maxAge: options.maxAge ?? 60 * 60 * 24 * 10,
          }));
        }
        catch { /* Server Components cannot write cookies; proxy refreshes them. */ }
      },
    },
  });
}
