import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ entities: [] });

  const { data, error } = await supabase.rpc("search_platform_entities", { search_term: query });
  if (error) return NextResponse.json({ error: "No pudimos buscar artistas u organizaciones." }, { status: 500 });
  return NextResponse.json({ entities: data ?? [] });
}

