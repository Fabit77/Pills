import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { campaignJson, hashValue } from "@/lib/collectibles";
import { ArtworkError, optimizeArtwork } from "@/lib/artwork";
import { decryptPrivateValue, encryptPrivateValue } from "@/lib/private-values";
import { normalizeWebsiteUrl } from "@/lib/website";

const campaignColumns = "id,name,description,event_type,venue,starts_at,ends_at,event_url,supply,status,artwork_url,qr_enabled,qr_token,secret_word_hash,public_slug,review_status,submitted_at,rejection_reason,claimed_count,first_claimed_at,is_paused,created_by,created_at";
const MAX_ARTWORK_BYTES = 4 * 1024 * 1024;

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
  const collaboratorMap = new Map<string, Array<{ userId: string; username: string; role: "reader" }>>();
  const secretMap = new Map<string, string>();
  if (ids.length) {
    const { data: collaborators } = await supabase.from("campaign_collaborators").select("campaign_id,user_id,role").in("campaign_id", ids);
    const userIds = [...new Set((collaborators ?? []).map((item) => item.user_id))];
    const { data: usernames } = userIds.length ? await supabase.from("public_usernames").select("user_id,username").in("user_id", userIds) : { data: [] };
    const names = new Map((usernames ?? []).map((item) => [item.user_id, item.username]));
    for (const item of collaborators ?? []) collaboratorMap.set(item.campaign_id, [...(collaboratorMap.get(item.campaign_id) ?? []), { userId: item.user_id, username: names.get(item.user_id) ?? "usuario", role: "reader" }]);
    const { data: secrets } = await supabase.from("campaign_secrets").select("campaign_id,secret_word_encrypted").in("campaign_id", ids);
    for (const item of secrets ?? []) secretMap.set(item.campaign_id, decryptPrivateValue(item.secret_word_encrypted));
  }

  return NextResponse.json({ collectibles: (data ?? []).map((row) => {
    const managers = collaboratorMap.get(row.id) ?? [];
    const membership = managers.find((item) => item.userId === user.id);
    const access = row.created_by === user.id
      ? { role: "owner" as const, canManage: true }
      : membership
        ? { role: "reader" as const, canManage: false }
        : { role: "reader" as const, canManage: false };
    return campaignJson(row, managers, access, secretMap.get(row.id) ?? "");
  }) });
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
    const startsAtIso = String(form.get("startsAtIso") ?? "") || (startsAt ? `${startsAt}T${String(form.get("startTime") ?? "00:00")}:00Z` : "");
    const endsAtIso = String(form.get("endsAtIso") ?? "") || (endsAt ? `${endsAt}T${String(form.get("endTime") ?? "23:59")}:00Z` : "");
    const city = String(form.get("city") ?? "").trim().slice(0, 180);
    const intent = form.get("intent") === "submit" ? "submit" : "draft";
    console.info("[collectibles:create] request received", { intent });
    const secretWord = String(form.get("secretWord") ?? "").trim();
    const publicSlug = String(form.get("publicSlug") ?? "").trim().toLowerCase();
    const rawEventUrl = String(form.get("eventUrl") ?? "").trim().slice(0, 500);
    const eventUrl = normalizeWebsiteUrl(rawEventUrl);
    if (!name || !description || !startsAtIso || !city || !(artwork instanceof File) || !artwork.size) return NextResponse.json({ error: "Completa los campos obligatorios." }, { status: 400 });
    if (artwork.size > MAX_ARTWORK_BYTES) return NextResponse.json({ error: "La imagen o GIF debe pesar máximo 4 MB." }, { status: 413 });
    if (!/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/.test(publicSlug)) return NextResponse.json({ error: "El enlace debe tener exactamente tres palabras separadas por guiones." }, { status: 400 });
    if (rawEventUrl && !eventUrl) return NextResponse.json({ error: "Escribe un sitio web válido, por ejemplo asadao.io." }, { status: 400 });
    let optimizedArtwork: Buffer;
    try { optimizedArtwork = await optimizeArtwork(artwork); }
    catch (error) { return NextResponse.json({ error: error instanceof ArtworkError ? error.message : "No pudimos procesar la imagen." }, { status: 400 }); }
    if (Number.isNaN(new Date(startsAtIso).getTime()) || (endsAtIso && Number.isNaN(new Date(endsAtIso).getTime()))) return NextResponse.json({ error: "Revisa la fecha y la hora." }, { status: 400 });
    if (endsAtIso && new Date(endsAtIso) <= new Date(startsAtIso)) return NextResponse.json({ error: "La fecha y hora de término deben ser posteriores al inicio." }, { status: 400 });

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
      event_type: "Experiencia",
      venue: city,
      starts_at: startsAtIso,
      ends_at: endsAtIso || null,
      event_url: eventUrl || null,
      tags: [],
      supply: Math.max(1, Math.min(Number(form.get("supply")) || 100, 100)),
      audience: "Cualquier persona",
      status: "draft",
      artwork_url: publicArtwork.publicUrl,
      qr_enabled: form.get("distributionQr") === "on",
      secret_word_hash: secretWord ? hashValue(secretWord) : null,
      public_slug: publicSlug,
      review_status: "pending",
      submitted_at: intent === "submit" ? new Date().toISOString() : null,
      created_by: user.id,
    }).select(campaignColumns).single();

    if (error) {
      console.error("[collectibles:create] campaign insert failed", { code: error.code, message: error.message });
      await supabase.storage.from("collectible-artwork").remove([filePath]);
      if (error.code === "23505") return NextResponse.json({ error: "Este enlace ya está en uso. Elige otras tres palabras." }, { status: 409 });
      return NextResponse.json({ error: "No pudimos guardar el coleccionable." }, { status: 500 });
    }

    const rawEntities = String(form.get("entities") ?? "[]");
    let selectedEntities: Array<{ entity_type: "artist" | "organization"; entity_id: string; display_name: string }> = [];
    try {
      const parsed = JSON.parse(rawEntities);
      if (Array.isArray(parsed)) selectedEntities = parsed.filter((item) =>
        (item?.entity_type === "artist" || item?.entity_type === "organization") &&
        typeof item?.entity_id === "string" && typeof item?.display_name === "string"
      ).slice(0, 20);
    } catch { /* Invalid optional attribution input is ignored. */ }
    if (selectedEntities.length) {
      const { error: attributionError } = await supabase.rpc("add_campaign_attributions", { target_campaign_id: campaign.id, requested_entities: selectedEntities });
      if (attributionError) {
        console.error("[collectibles:create] attribution insert failed", { code: attributionError.code, message: attributionError.message });
        await supabase.rpc("delete_own_draft_collectible", { target_campaign_id: campaign.id });
        await supabase.storage.from("collectible-artwork").remove([filePath]);
        return NextResponse.json({ error: "No pudimos asociar los artistas u organizaciones." }, { status: 500 });
      }
    }

    if (secretWord) {
      const { error: privateSecretError } = await supabase.from("campaign_secrets").insert({ campaign_id: campaign.id, secret_word_encrypted: encryptPrivateValue(secretWord.slice(0, 60)) });
      if (privateSecretError) {
        console.error("[collectibles:create] private secret insert failed", { code: privateSecretError.code, message: privateSecretError.message });
        await supabase.rpc("delete_own_draft_collectible", { target_campaign_id: campaign.id });
        await supabase.storage.from("collectible-artwork").remove([filePath]);
        return NextResponse.json({ error: "No pudimos guardar la frase secreta de forma privada." }, { status: 500 });
      }
    }

    console.info("[collectibles:create] completed", { campaignId: campaign.id, intent });
    return NextResponse.json({ collectible: campaignJson(campaign, [], { role: "owner", canManage: true }, secretWord) }, { status: 201 });
  } catch (error) {
    console.error("[collectibles:create] unexpected failure", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "No pudimos guardar el coleccionable." }, { status: 500 });
  }
}
