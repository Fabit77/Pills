import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicToken, hashValue } from "@/lib/collectibles";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;
  const { data, error } = await supabase.from("collectible_admin_links")
    .select("id,recipient_label,redeemed_at,created_at").eq("campaign_id", id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No pudimos cargar los enlaces individuales." }, { status: 400 });
  return NextResponse.json({ links: (data ?? []).map((item) => ({ id: item.id, recipientLabel: item.recipient_label ?? "Sin destinatario", redeemedAt: item.redeemed_at, createdAt: item.created_at })) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const recipientLabel = typeof body.recipientLabel === "string" ? body.recipientLabel.trim().slice(0, 120) : "";
  if (!recipientLabel) return NextResponse.json({ error: "Agrega una referencia para saber a quién entregaste el enlace." }, { status: 400 });
  const { data: campaign } = await supabase.from("campaigns").select("review_status").eq("id", id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "No encontramos el coleccionable." }, { status: 404 });
  if (campaign.review_status !== "approved") return NextResponse.json({ error: "Los enlaces individuales se habilitan después de la aprobación." }, { status: 409 });
  const token = createPublicToken();
  const { data, error } = await supabase.from("collectible_admin_links").insert({ campaign_id: id, token_hash: hashValue(token), recipient_label: recipientLabel, created_by: authData.user.id }).select("id,recipient_label,created_at").single();
  if (error) return NextResponse.json({ error: "No pudimos generar el enlace individual." }, { status: 400 });
  return NextResponse.json({ link: { id: data.id, recipientLabel: data.recipient_label, createdAt: data.created_at, redeemedAt: null }, token }, { status: 201 });
}
