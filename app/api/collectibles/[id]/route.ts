import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { campaignJson, hashValue } from "@/lib/collectibles";
import { ArtworkError, optimizeArtwork } from "@/lib/artwork";
import { encryptPrivateValue } from "@/lib/private-values";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const columns = "id,name,description,event_type,venue,starts_at,ends_at,event_url,supply,status,artwork_url,qr_enabled,qr_token,secret_word_hash,review_status,submitted_at,rejection_reason,claimed_count,first_claimed_at,is_paused,created_by,created_at";

async function removeArtwork(artworkUrl: string) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) return;
  const marker = "/storage/v1/object/public/collectible-artwork/";
  const markerIndex = artworkUrl.indexOf(marker);
  if (markerIndex < 0) return;
  const path = decodeURIComponent(artworkUrl.slice(markerIndex + marker.length));
  const adminClient = createAdminClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  await adminClient.storage.from("collectible-artwork").remove([path]);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const { data: current } = await supabase.from("campaigns").select(columns).eq("id", id).maybeSingle();
  if (!current || current.created_by !== authData.user.id) return NextResponse.json({ error: "Solo la persona propietaria puede modificar esta Pill." }, { status: 403 });

  if (body.action === "submit" || body.action === "withdraw") {
    const rpc = body.action === "submit" ? "submit_own_collectible" : "withdraw_own_collectible";
    const { error } = await supabase.rpc(rpc, { target_campaign_id: id });
    if (error) return NextResponse.json({ error: body.action === "submit" ? "No pudimos enviar la Pill a Curaduría." : "No pudimos devolver la Pill a borrador." }, { status: 409 });
    const { data } = await supabase.from("campaigns").select(columns).eq("id", id).single();
    if (!data) return NextResponse.json({ error: "No pudimos recargar la Pill." }, { status: 500 });
    return NextResponse.json({ collectible: campaignJson(data) });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 150) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1500) : "";
  if (!name || !description) return NextResponse.json({ error: "El título y la descripción son obligatorios." }, { status: 400 });
  if (current.claimed_count > 0 || current.first_claimed_at) return NextResponse.json({ error: "La primera Pill ya fue coleccionada; el contenido quedó bloqueado." }, { status: 409 });
  if (current.review_status === "rejected") return NextResponse.json({ error: "Devuelve la Pill a borrador antes de editarla." }, { status: 409 });

  if (current.review_status === "approved") {
    const { error } = await supabase.rpc("revise_own_approved_collectible", { target_campaign_id: id, new_name: name, new_description: description });
    if (error) return NextResponse.json({ error: "No pudimos enviar los cambios nuevamente a Curaduría." }, { status: 400 });
  } else {
    const { error } = await supabase.from("campaigns").update({ name, description }).eq("id", id);
    if (error) return NextResponse.json({ error: "No pudimos actualizar la Pill." }, { status: 400 });
  }
  const { data } = await supabase.from("campaigns").select(columns).eq("id", id).single();
  if (!data) return NextResponse.json({ error: "No pudimos recargar la Pill." }, { status: 500 });
  return NextResponse.json({ collectible: campaignJson(data) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;
  const { data: current } = await supabase.from("campaigns").select(columns).eq("id", id).maybeSingle();
  if (!current || current.created_by !== authData.user.id) return NextResponse.json({ error: "Solo la persona propietaria puede editar el borrador." }, { status: 403 });
  if (current.submitted_at || current.claimed_count > 0 || current.first_claimed_at) return NextResponse.json({ error: "Solo puedes editar todos los campos mientras la Pill siga como borrador." }, { status: 409 });

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim().slice(0, 150);
  const description = String(form.get("description") ?? "").trim().slice(0, 1500);
  const startsAt = String(form.get("date") ?? "");
  const endsAt = String(form.get("endDate") ?? "");
  const startsAtIso = String(form.get("startsAtIso") ?? "") || (startsAt ? `${startsAt}T${String(form.get("startTime") ?? "00:00")}:00Z` : "");
  const endsAtIso = String(form.get("endsAtIso") ?? "") || (endsAt ? `${endsAt}T${String(form.get("endTime") ?? "23:59")}:00Z` : "");
  const city = String(form.get("city") ?? "").trim().slice(0, 180);
  const eventUrl = String(form.get("eventUrl") ?? "").trim().slice(0, 500);
  const supply = Math.max(1, Math.min(Number(form.get("supply")) || 100, 100));
  const qrEnabled = form.get("distributionQr") === "on";
  const secretEnabled = form.get("distributionSecret") === "on";
  const secretWord = String(form.get("secretWord") ?? "").trim().slice(0, 60);
  if (!name || !description || !startsAtIso || !city) return NextResponse.json({ error: "Completa los campos obligatorios." }, { status: 400 });
  if (Number.isNaN(new Date(startsAtIso).getTime()) || (endsAtIso && Number.isNaN(new Date(endsAtIso).getTime()))) return NextResponse.json({ error: "Revisa la fecha y la hora." }, { status: 400 });
  if (endsAtIso && new Date(endsAtIso) <= new Date(startsAtIso)) return NextResponse.json({ error: "La fecha y hora de término deben ser posteriores al inicio." }, { status: 400 });
  if (!qrEnabled && !secretEnabled) return NextResponse.json({ error: "Selecciona al menos un método de distribución." }, { status: 400 });
  if (secretEnabled && !secretWord) return NextResponse.json({ error: "Escribe la palabra secreta." }, { status: 400 });

  let artworkUrl = String(current.artwork_url ?? "");
  let newArtworkUrl = "";
  const artwork = form.get("artwork");
  if (artwork instanceof File && artwork.size) {
    let optimizedArtwork: Buffer;
    try { optimizedArtwork = await optimizeArtwork(artwork); }
    catch (error) { return NextResponse.json({ error: error instanceof ArtworkError ? error.message : "No pudimos procesar la imagen." }, { status: 400 }); }
    const filePath = `${authData.user.id}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage.from("collectible-artwork").upload(filePath, optimizedArtwork, { contentType: "image/webp", upsert: false });
    if (uploadError) return NextResponse.json({ error: "No pudimos almacenar el arte." }, { status: 500 });
    newArtworkUrl = supabase.storage.from("collectible-artwork").getPublicUrl(filePath).data.publicUrl;
    artworkUrl = newArtworkUrl;
  }

  const { error } = await supabase.from("campaigns").update({
    name, description, venue: city, starts_at: startsAtIso, ends_at: endsAtIso || null,
    event_url: eventUrl || null, supply, qr_enabled: qrEnabled, secret_word_hash: secretEnabled ? hashValue(secretWord) : null, artwork_url: artworkUrl,
  }).eq("id", id);
  if (error) {
    if (newArtworkUrl) await removeArtwork(newArtworkUrl);
    return NextResponse.json({ error: "No pudimos guardar el borrador." }, { status: 400 });
  }

  if (secretEnabled) await supabase.from("campaign_secrets").upsert({ campaign_id: id, secret_word_encrypted: encryptPrivateValue(secretWord) });
  else await supabase.from("campaign_secrets").delete().eq("campaign_id", id);
  if (newArtworkUrl && current.artwork_url) await removeArtwork(String(current.artwork_url));
  const { data } = await supabase.from("campaigns").select(columns).eq("id", id).single();
  if (!data) return NextResponse.json({ error: "El borrador se guardó, pero no pudimos recargarlo." }, { status: 500 });
  return NextResponse.json({ collectible: campaignJson(data, [], { role: "owner", canManage: true }, secretEnabled ? secretWord : "") });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;
  const { data: artworkUrl, error } = await supabase.rpc("delete_own_draft_collectible", { target_campaign_id: id });
  if (error) return NextResponse.json({ error: "Solo puedes eliminar una Pill propia mientras siga como borrador privado." }, { status: 409 });
  if (typeof artworkUrl === "string") await removeArtwork(artworkUrl);
  return NextResponse.json({ deleted: true });
}
