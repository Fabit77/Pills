import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { normalizeWebsiteUrl } from "@/lib/website";

async function access(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null, admin: null, organization: null, role: null };
  const admin = serviceClient();
  const [{ data: organization }, { data: member }] = await Promise.all([
    admin.from("organizations").select("id,kind,verification_status").eq("id", id).eq("kind", "official").maybeSingle(),
    admin.from("organization_members").select("role").eq("organization_id", id).eq("user_id", data.user.id).maybeSingle(),
  ]);
  return { user: data.user, admin, organization, role: member?.role ?? null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const current = await access(id);
  if (!current.user || !current.admin) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  if (!current.organization || !current.role) return NextResponse.json({ error: "Organización no encontrada." }, { status: 404 });
  const body = await request.json(); const action = body.action;
  if (action === "update") {
    if (!['owner', 'admin'].includes(current.role)) return NextResponse.json({ error: "No tienes permiso para editar." }, { status: 403 });
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 600) : "";
    const rawWebsite = typeof body.website === "string" ? body.website.trim() : "";
    const websiteUrl = normalizeWebsiteUrl(rawWebsite);
    if (rawWebsite && !websiteUrl) return NextResponse.json({ error: "Escribe un sitio web válido." }, { status: 400 });
    const { error } = await current.admin.from("organizations").update({ description: description || null, website_url: websiteUrl, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: "No pudimos guardar los cambios." }, { status: 400 });
  } else if (action === "add_member") {
    if (!['owner', 'admin'].includes(current.role)) return NextResponse.json({ error: "No tienes permiso para agregar personas." }, { status: 403 });
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase().replace(/^@/, "") : "";
    const requestedRole = body.role === "admin" && current.role === "owner" ? "admin" : "editor";
    const { data: identity } = await current.admin.from("public_usernames").select("user_id").ilike("username", username).maybeSingle();
    if (!identity) return NextResponse.json({ error: "No encontramos ese @usuario." }, { status: 404 });
    const { error } = await current.admin.from("organization_members").upsert({ organization_id: id, user_id: identity.user_id, role: requestedRole });
    if (error) return NextResponse.json({ error: "No pudimos agregar a esa persona." }, { status: 400 });
  } else if (action === "remove_member") {
    if (!['owner', 'admin'].includes(current.role)) return NextResponse.json({ error: "No tienes permiso para retirar personas." }, { status: 403 });
    const { data: target } = await current.admin.from("organization_members").select("role").eq("organization_id", id).eq("user_id", body.userId).maybeSingle();
    if (!target || target.role === "owner") return NextResponse.json({ error: "No puedes retirar al propietario." }, { status: 400 });
    if (current.role !== "owner" && target.role === "admin") return NextResponse.json({ error: "Solo el propietario puede retirar administradores." }, { status: 403 });
    await current.admin.from("organization_members").delete().eq("organization_id", id).eq("user_id", body.userId);
  } else if (action === "resubmit") {
    if (current.role !== "owner" || current.organization.verification_status !== "rejected") return NextResponse.json({ error: "Esta solicitud no se puede reenviar." }, { status: 400 });
    const evidence = typeof body.evidence === "string" ? body.evidence.trim().slice(0, 1500) : "";
    if (evidence.length < 10) return NextResponse.json({ error: "Agrega antecedentes para verificar el vínculo." }, { status: 400 });
    await current.admin.from("organizations").update({ verification_evidence: evidence, verification_status: "pending", rejection_reason: null, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  } else return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  return NextResponse.json({ updated: true });
}
