import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { campaignJson } from "@/lib/collectibles";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 150) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1500) : "";
  if (!name || !description) return NextResponse.json({ error: "El título y la descripción son obligatorios." }, { status: 400 });

  const { data, error } = await supabase.from("campaigns").update({ name, description }).eq("id", id)
    .select("id,name,description,event_type,venue,starts_at,ends_at,supply,status,artwork_url,qr_enabled,qr_token,secret_word_hash,review_status,rejection_reason,claimed_count,first_claimed_at,created_at").single();
  if (error) {
    const locked = error.message.toLowerCase().includes("locked");
    return NextResponse.json({ error: locked ? "Ya se coleccionó la primera Pill; el contenido quedó bloqueado." : "No pudimos actualizar el coleccionable." }, { status: locked ? 409 : 400 });
  }
  return NextResponse.json({ collectible: campaignJson(data) });
}
