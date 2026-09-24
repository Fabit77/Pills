import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { campaignJson } from "@/lib/collectibles";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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
    .select("id,name,description,event_type,venue,starts_at,ends_at,supply,status,artwork_url,qr_enabled,qr_token,secret_word_hash,review_status,rejection_reason,claimed_count,first_claimed_at,is_paused,created_at").single();
  if (error) {
    const locked = error.message.toLowerCase().includes("locked");
    return NextResponse.json({ error: locked ? "Ya se coleccionó la primera Pill; el contenido quedó bloqueado." : "No pudimos actualizar el coleccionable." }, { status: locked ? 409 : 400 });
  }
  return NextResponse.json({ collectible: campaignJson(data) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;
  const { data: artworkUrl, error } = await supabase.rpc("delete_own_draft_collectible", { target_campaign_id: id });
  if (error) return NextResponse.json({ error: "Solo puedes eliminar una Pill propia mientras siga como borrador y no tenga colecciones." }, { status: 409 });
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (supabaseUrl && serviceKey && typeof artworkUrl === "string") {
    const marker = "/storage/v1/object/public/collectible-artwork/"; const markerIndex = artworkUrl.indexOf(marker);
    if (markerIndex >= 0) {
      const path = decodeURIComponent(artworkUrl.slice(markerIndex + marker.length));
      const adminClient = createAdminClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      await adminClient.storage.from("collectible-artwork").remove([path]);
    }
  }
  return NextResponse.json({ deleted: true });
}
