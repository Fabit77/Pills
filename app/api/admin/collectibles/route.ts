import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { campaignJson } from "@/lib/collectibles";

export async function GET() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { data: admin } = await supabase.from("app_admins").select("role").eq("user_id", authData.user.id).maybeSingle();
  if (!admin || !["super_admin", "curator", "admin"].includes(admin.role)) return NextResponse.json({ error: "Acceso reservado para curadores." }, { status: 403 });
  const { data, error } = await supabase.from("campaigns").select("id,name,description,event_type,venue,starts_at,ends_at,supply,status,artwork_url,qr_enabled,qr_token,secret_word_hash,review_status,rejection_reason,claimed_count,first_claimed_at,is_paused,created_at").order("submitted_at", { ascending: true });
  if (error) return NextResponse.json({ error: "No pudimos cargar la cola de revisión." }, { status: 500 });
  return NextResponse.json({ collectibles: (data ?? []).map((row) => campaignJson(row)) });
}
