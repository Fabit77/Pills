import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const slugPattern = /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const slug = new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() ?? "";
  if (!slugPattern.test(slug)) return NextResponse.json({ available: false, valid: false });

  const { data, error } = await supabase.rpc("is_campaign_slug_available", { candidate: slug });
  if (error) return NextResponse.json({ error: "No pudimos verificar el enlace." }, { status: 500 });
  return NextResponse.json({ available: Boolean(data), valid: true });
}
