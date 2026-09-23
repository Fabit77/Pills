import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.rpc("review_collectible", { target_campaign_id: id, review_decision: decision, review_reason: reason || null });
  if (error) return NextResponse.json({ error: "No pudimos guardar la decisión." }, { status: 400 });
  return NextResponse.json({ reviewed: true, decision });
}
