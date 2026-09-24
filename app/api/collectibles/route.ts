import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { campaignJson, hashValue } from "@/lib/collectibles";
import { ArtworkError, optimizeArtwork } from "@/lib/artwork";

const campaignColumns = "id,name,description,event_type,venue,starts_at,ends_at,supply,status,artwork_url,qr_enabled,qr_token,secret_word_hash,review_status,rejection_reason,claimed_count,first_claimed_at,created_at";

async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const { data, error } = await supabase.from("campaigns").select(campaignColumns).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No pudimos cargar tus coleccionables." }, { status: 500 });

  const ids = (data ?? []).map((row) => row.id);
  const collaboratorMap = new Map<string, string[]>();
  if (ids.length) {
    const { data: collaborators } = await supabase.from("campaign_collaborators").select("campaign_id,user_id").in("campaign_id", ids);
    const userIds = [...new Set((collaborators ?? []).map((item) => item.user_id))];
    const { data: usernames } = userIds.length ? await supabase.from("public_usernames").select("user_id,username").in("user_id", userIds) : { data: [] };
    const names = new Map((usernames ?? []).map((item) => [item.user_id, item.username]));
    for (const item of collaborators ?? []) collaboratorMap.set(item.campaign_id, [...(collaboratorMap.get(item.campaign_id) ?? []), names.get(item.user_id) ?? "colaborador"]);
  }

  return NextResponse.json({ collectibles: (data ?? []).map((row) => campaignJson(row, collaboratorMap.get(row.id) ?? [])) });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  try {
    const form = await request.formData();
    const artwork = form.get("artwork");
    const name = String(form.get("name") ?? "").trim().slice(0, 150);
    const description = String(form.get("description") ?? "").trim().slice(0, 1500);
    const startsAt = String(form.get("date") ?? "");
    const endsAt = String(form.get("endDate") ?? "");
    const secretWord = String(form.get("secretWord") ?? "").trim();
    if (!name || !description || !startsAt || !endsAt || !(artwork instanceof File) || !artwork.size) return NextResponse.json({ error: "Completa los campos obligatorios." }, { status: 400 });
    let optimizedArtwork: Buffer;
    try { optimizedArtwork = await optimizeArtwork(artwork); }
    catch (error) { return NextResponse.json({ error: error instanceof ArtworkError ? error.message : "No pudimos procesar la imagen." }, { status: 400 }); }
    if (new Date(endsAt) <= new Date(startsAt)) return NextResponse.json({ error: "La fecha de término debe ser posterior." }, { status: 400 });

    let { data: membership } = await supabase.from("organization_members").select("organization_id").eq("user_id", user.id).limit(1).maybeSingle();
    if (!membership) {
      const { data: publicName } = await supabase.from("public_usernames").select("username").eq("user_id", user.id).single();
      const slug = `${publicName?.username ?? "creator"}-${user.id.slice(0, 8)}`;
      const { data: organizationId, error: organizationError } = await supabase.rpc("create_organization", { organization_name: `Espacio de @${publicName?.username ?? "creator"}`, organization_slug: slug });
      if (organizationError || !organizationId) return NextResponse.json({ error: "No pudimos preparar tu espacio de creador." }, { status: 500 });
      membership = { organization_id: organizationId };
    }

    const filePath = `${user.id}/${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage.from("collectible-artwork").upload(filePath, optimizedArtwork, { contentType: "image/webp", upsert: false });
    if (uploadError) return NextResponse.json({ error: "No pudimos almacenar el arte." }, { status: 500 });
    const { data: publicArtwork } = supabase.storage.from("collectible-artwork").getPublicUrl(filePath);

    const { data: campaign, error } = await supabase.from("campaigns").insert({
      organization_id: membership.organization_id,
      name,
      description,
      event_type: String(form.get("type") ?? "Evento").slice(0, 80),
      venue: String(form.get("location") ?? "").trim().slice(0, 180) || null,
      starts_at: `${startsAt}T00:00:00`,
      ends_at: `${endsAt}T23:59:59`,
      event_url: String(form.get("eventUrl") ?? "").trim().slice(0, 500) || null,
      tags: String(form.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 12),
      supply: Math.max(1, Math.min(Number(form.get("supply") ?? 5000), 1000000)),
      audience: String(form.get("audience") ?? "Asistentes").slice(0, 80),
      status: "draft",
      artwork_url: publicArtwork.publicUrl,
      qr_enabled: form.get("distributionQr") === "on",
      secret_word_hash: secretWord ? hashValue(secretWord) : null,
      review_status: "pending",
      submitted_at: new Date().toISOString(),
      created_by: user.id,
    }).select(campaignColumns).single();

    if (error) {
      await supabase.storage.from("collectible-artwork").remove([filePath]);
      return NextResponse.json({ error: "No pudimos guardar el coleccionable." }, { status: 500 });
    }

    const collaboratorUsername = String(form.get("collaborator") ?? "").trim().toLowerCase().replace(/^@/, "");
    if (collaboratorUsername) {
      const { data: collaborator } = await supabase.from("public_usernames").select("user_id").eq("username", collaboratorUsername).maybeSingle();
      if (collaborator?.user_id && collaborator.user_id !== user.id) await supabase.from("campaign_collaborators").insert({ campaign_id: campaign.id, user_id: collaborator.user_id, added_by: user.id });
    }

    return NextResponse.json({ collectible: campaignJson(campaign, collaboratorUsername ? [collaboratorUsername] : []) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No pudimos guardar el coleccionable." }, { status: 500 });
  }
}
