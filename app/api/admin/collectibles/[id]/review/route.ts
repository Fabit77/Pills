import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/admin-access";
import { sendCollectibleApprovedEmail } from "@/lib/approval-email";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { data: admin } = await supabase.from("app_admins").select("role").eq("user_id", authData.user.id).maybeSingle();
  if (!admin || !["super_admin", "curator", "admin"].includes(admin.role)) return NextResponse.json({ error: "Acceso reservado para curadores." }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : "";
  if (!decision) return NextResponse.json({ error: "Decisión inválida." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (decision === "rejected" && !reason) return NextResponse.json({ error: "Explica brevemente el motivo del rechazo." }, { status: 400 });
  const service = serviceClient();
  const { data: campaign } = await service.from("campaigns").select("id,name,public_slug,created_by,review_status,approval_email_sent_at").eq("id", id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "No encontramos esta Pill." }, { status: 404 });
  const { error } = await supabase.rpc("review_collectible", { target_campaign_id: id, review_decision: decision, review_reason: reason || null });
  if (error) return NextResponse.json({ error: "No pudimos guardar la decisión." }, { status: 400 });
  let emailSent = false; let emailWarning = "";
  if (decision === "approved" && campaign.review_status !== "approved" && !campaign.approval_email_sent_at) {
    const [{ data: authUser }, { data: profile }, { data: publicName }] = await Promise.all([
      service.auth.admin.getUserById(campaign.created_by),
      service.from("profiles").select("first_name,full_name").eq("id", campaign.created_by).maybeSingle(),
      service.from("public_usernames").select("username").eq("user_id", campaign.created_by).maybeSingle(),
    ]);
    const email = authUser.user?.email;
    if (email) {
      const fansUrl = process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social";
      const result = await sendCollectibleApprovedEmail({ campaignId: campaign.id, to: email, campaignName: campaign.name, creatorName: profile?.first_name || profile?.full_name || publicName?.username || "creador", collectUrl: `${fansUrl}/collect/${campaign.public_slug}` });
      emailSent = result.sent;
      if (result.sent) await service.from("campaigns").update({ approval_email_sent_at: new Date().toISOString(), approval_email_id: result.id }).eq("id", id);
      else emailWarning = result.reason === "missing_configuration" ? "Falta conectar RESEND_API_KEY en Creator Studio." : "Resend no pudo entregar el aviso.";
    } else emailWarning = "El creador no tiene un correo disponible.";
  }
  return NextResponse.json({ reviewed: true, decision, emailSent, emailWarning });
}
