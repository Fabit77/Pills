import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-access";
import { sendCurationMessage } from "@/lib/curation-email";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePlatformAdmin();
  if (access.error || !access.admin || !access.user) return access.error;
  const { id } = await params;
  const body = await request.json();
  const campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
  const subject = typeof body.subject === "string" ? body.subject.trim().slice(0, 140) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 3000) : "";
  if (subject.length < 3 || message.length < 10) return NextResponse.json({ error: "Agrega un asunto y un mensaje de al menos 10 caracteres." }, { status: 400 });

  const [{ data: recipient }, { data: profile }, { data: publicName }, { data: campaign }, { data: curatorProfile }, { data: curatorName }] = await Promise.all([
    access.admin.auth.admin.getUserById(id),
    access.admin.from("profiles").select("full_name,first_name").eq("id", id).maybeSingle(),
    access.admin.from("public_usernames").select("username").eq("user_id", id).maybeSingle(),
    campaignId ? access.admin.from("campaigns").select("id,name,created_by").eq("id", campaignId).maybeSingle() : Promise.resolve({ data: null }),
    access.admin.from("profiles").select("full_name,first_name").eq("id", access.user.id).maybeSingle(),
    access.admin.from("public_usernames").select("username").eq("user_id", access.user.id).maybeSingle(),
  ]);
  if (!recipient.user?.email) return NextResponse.json({ error: "Este creador no tiene un correo disponible." }, { status: 409 });
  if (campaignId && (!campaign || campaign.created_by !== id)) return NextResponse.json({ error: "La Pill no pertenece a este creador." }, { status: 400 });

  const { data: log, error: logError } = await access.admin.from("curation_messages").insert({
    campaign_id: campaignId,
    sender_id: access.user.id,
    recipient_id: id,
    subject,
    message,
  }).select("id").single();
  if (logError || !log) return NextResponse.json({ error: "No pudimos registrar el mensaje." }, { status: 500 });

  const result = await sendCurationMessage({
    to: recipient.user.email,
    creatorName: profile?.first_name || profile?.full_name || publicName?.username || "creador",
    curatorName: curatorProfile?.first_name || curatorProfile?.full_name || curatorName?.username || "Curaduría Pills",
    campaignName: campaign?.name || "tu cuenta de Pills",
    subject,
    message,
  });
  await access.admin.from("curation_messages").update(result.sent ? {
    delivery_status: "sent", provider_message_id: result.id, sent_at: new Date().toISOString(), delivery_error: null,
  } : {
    delivery_status: "failed", delivery_error: result.reason === "missing_configuration" ? "missing_configuration" : result.detail?.slice(0, 1000) || "provider_error",
  }).eq("id", log.id);

  if (!result.sent) return NextResponse.json({ error: result.reason === "missing_configuration" ? "Falta configurar RESEND_API_KEY." : "El proveedor de correo no pudo enviar el mensaje." }, { status: 502 });
  return NextResponse.json({ sent: true });
}
