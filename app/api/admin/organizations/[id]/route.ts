import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-access";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePlatformAdmin(["super_admin", "admin", "curator"]);
  if (access.error || !access.admin || !access.user) return access.error;
  const { id } = await params; const body = await request.json();
  const decision = body.decision === "approved" ? "approved" : body.decision === "rejected" ? "rejected" : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!decision) return NextResponse.json({ error: "Decisión inválida." }, { status: 400 });
  if (decision === "rejected" && !reason) return NextResponse.json({ error: "Explica el motivo del rechazo." }, { status: 400 });
  const { data: organization } = await access.admin.from("organizations").select("id").eq("id", id).eq("kind", "official").maybeSingle();
  if (!organization) return NextResponse.json({ error: "Organización no encontrada." }, { status: 404 });
  const { error } = await access.admin.from("organizations").update({
    verification_status: decision, verified_at: decision === "approved" ? new Date().toISOString() : null,
    rejection_reason: decision === "rejected" ? reason : null, reviewed_at: new Date().toISOString(),
    reviewed_by: access.user.id, updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return NextResponse.json({ error: "No pudimos guardar la decisión." }, { status: 400 });
  return NextResponse.json({ updated: true });
}
