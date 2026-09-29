import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-access";

const allowedActions = ["pause", "resume", "block", "unblock", "make_admin", "remove_admin"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePlatformAdmin(["super_admin", "admin"]);
  if (access.error || !access.admin || !access.user) return access.error;
  const { id } = await params;
  const body = await request.json();
  const action = allowedActions.includes(body.action) ? body.action as typeof allowedActions[number] : null;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!action) return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  if (id === access.user.id && action !== "resume" && action !== "unblock") return NextResponse.json({ error: "No puedes restringir ni cambiar tu propio rol." }, { status: 400 });

  const { data: targetRole } = await access.admin.from("app_admins").select("role").eq("user_id", id).maybeSingle();
  if (targetRole?.role === "super_admin" && access.role !== "super_admin") return NextResponse.json({ error: "Un admin no puede modificar a un Super Admin." }, { status: 403 });

  if (action === "pause" || action === "resume") {
    const status = action === "pause" ? "paused" : "active";
    const { error } = await access.admin.from("profiles").update({ account_status: status, moderation_reason: action === "pause" ? reason || "Pausado por administración" : null, moderated_at: new Date().toISOString(), moderated_by: access.user.id }).eq("id", id);
    if (error) return NextResponse.json({ error: "No pudimos actualizar el perfil." }, { status: 400 });
    await access.admin.auth.admin.updateUserById(id, { ban_duration: action === "pause" ? "876000h" : "none" });
  } else {
    if (access.role !== "super_admin") return NextResponse.json({ error: "Esta acción requiere Super Admin." }, { status: 403 });
    if (action === "block" || action === "unblock") {
      const status = action === "block" ? "blocked" : "active";
      const { error } = await access.admin.from("profiles").update({ account_status: status, moderation_reason: action === "block" ? reason || "Correo bloqueado" : null, moderated_at: new Date().toISOString(), moderated_by: access.user.id }).eq("id", id);
      if (error) return NextResponse.json({ error: "No pudimos actualizar el bloqueo." }, { status: 400 });
      await access.admin.auth.admin.updateUserById(id, { ban_duration: action === "block" ? "876000h" : "none" });
    }
    if (action === "make_admin") {
      const { error } = await access.admin.from("app_admins").upsert({ user_id: id, role: "admin" }, { onConflict: "user_id" });
      if (error) return NextResponse.json({ error: "No pudimos asignar el rol Admin." }, { status: 400 });
    }
    if (action === "remove_admin") {
      if (targetRole?.role === "super_admin") return NextResponse.json({ error: "No puedes retirar el rol de otro Super Admin desde aquí." }, { status: 400 });
      const { error } = await access.admin.from("app_admins").delete().eq("user_id", id);
      if (error) return NextResponse.json({ error: "No pudimos retirar el rol." }, { status: 400 });
    }
  }
  return NextResponse.json({ updated: true, action });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePlatformAdmin(["super_admin"]);
  if (access.error || !access.admin || !access.user) return access.error;
  const { id } = await params;
  if (id === access.user.id) return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });
  const { data: targetRole } = await access.admin.from("app_admins").select("role").eq("user_id", id).maybeSingle();
  if (targetRole?.role === "super_admin") return NextResponse.json({ error: "No puedes eliminar otro Super Admin desde este panel." }, { status: 400 });

  await access.admin.from("campaigns").update({ reviewed_by: null, paused_by: null }).or(`reviewed_by.eq.${id},paused_by.eq.${id}`);
  await access.admin.from("collectible_admin_links").update({ redeemed_by: null }).eq("redeemed_by", id);
  await access.admin.from("campaign_attributions").delete().eq("added_by", id);
  await access.admin.from("campaign_collaborators").delete().or(`user_id.eq.${id},added_by.eq.${id}`);
  await access.admin.from("collectible_admin_links").delete().eq("created_by", id);
  await access.admin.from("campaigns").delete().eq("created_by", id);
  await access.admin.from("collections").delete().eq("created_by", id);
  await access.admin.from("organizations").delete().eq("created_by", id);
  const { error } = await access.admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: "No pudimos eliminar la cuenta completa." }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
