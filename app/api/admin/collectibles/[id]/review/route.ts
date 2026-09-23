import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicToken, hashValue } from "@/lib/collectibles";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { data: admin } = await supabase.from("app_admins").select("role").eq("user_id", authData.user.id).maybeSingle();
  if (!admin) return NextResponse.json({ error: "Acceso reservado para curadores." }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : "";
  if (!decision) return NextResponse.json({ error: "Decisión inválida." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (decision === "rejected" && !reason) return NextResponse.json({ error: "Explica brevemente el motivo del rechazo." }, { status: 400 });
  const token = decision === "approved" ? createPublicToken() : null;
  const { error } = await supabase.from("campaigns").update({
    review_status: decision,
    reviewed_at: new Date().toISOString(),
    reviewed_by: authData.user.id,
    rejection_reason: decision === "rejected" ? reason : null,
    qr_token: token,
    qr_token_hash: token ? hashValue(token) : null,
    status: decision === "approved" ? "scheduled" : "draft",
  }).eq("id", id);
  if (error) return NextResponse.json({ error: "No pudimos guardar la decisión." }, { status: 400 });
  return NextResponse.json({ reviewed: true, decision });
}
