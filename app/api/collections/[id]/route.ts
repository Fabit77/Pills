import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";

async function context(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { user: null, admin: null, collection: null, contributor: false };
  const admin = serviceClient();
  const [{ data: collection }, { data: contribution }] = await Promise.all([
    admin.from("collections").select("id,created_by").eq("id", id).maybeSingle(),
    admin.from("collection_contributors").select("user_id").eq("collection_id", id).eq("user_id", data.user.id).maybeSingle(),
  ]);
  return { user: data.user, admin, collection, contributor: Boolean(contribution) };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const current = await context(id);
  if (!current.user || !current.admin) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  if (!current.collection) return NextResponse.json({ error: "Colección no encontrada." }, { status: 404 });
  const owner = current.collection.created_by === current.user.id;
  const body = await request.json(); const action = body.action;
  if (action === "update") {
    if (!owner) return NextResponse.json({ error: "Solo el creador puede editar la colección." }, { status: 403 });
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 600) : "";
    if (!name) return NextResponse.json({ error: "El nombre es obligatorio." }, { status: 400 });
    const { error } = await current.admin.from("collections").update({ name, description: description || null, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: "No pudimos guardar la colección." }, { status: 400 });
  } else if (action === "add_pill") {
    if (!owner && !current.contributor) return NextResponse.json({ error: "No tienes permiso para agregar Pills." }, { status: 403 });
    const { data: pill } = await current.admin.from("campaigns").select("id,created_by,collection_id").eq("id", body.pillId).maybeSingle();
    if (!pill || pill.created_by !== current.user.id) return NextResponse.json({ error: "Solo puedes agregar una Pill creada por ti." }, { status: 403 });
    if (pill.collection_id && pill.collection_id !== id) return NextResponse.json({ error: "Esta Pill ya pertenece a otra colección." }, { status: 409 });
    const { error } = await current.admin.from("campaigns").update({ collection_id: id }).eq("id", pill.id);
    if (error) return NextResponse.json({ error: "No pudimos agregar la Pill." }, { status: 400 });
  } else if (action === "remove_pill") {
    const { data: pill } = await current.admin.from("campaigns").select("id,created_by,collection_id").eq("id", body.pillId).maybeSingle();
    if (!pill || pill.collection_id !== id || (!owner && pill.created_by !== current.user.id)) return NextResponse.json({ error: "No puedes quitar esta Pill." }, { status: 403 });
    const { error } = await current.admin.from("campaigns").update({ collection_id: null }).eq("id", pill.id);
    if (error) return NextResponse.json({ error: "No pudimos quitar la Pill." }, { status: 400 });
  } else if (action === "add_contributor") {
    if (!owner) return NextResponse.json({ error: "Solo el creador puede invitar colaboradores." }, { status: 403 });
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase().replace(/^@/, "") : "";
    const { data: identity } = await current.admin.from("public_usernames").select("user_id").ilike("username", username).maybeSingle();
    if (!identity || identity.user_id === current.user.id) return NextResponse.json({ error: "No encontramos ese creador." }, { status: 404 });
    const { error } = await current.admin.from("collection_contributors").upsert({ collection_id: id, user_id: identity.user_id, role: "contributor", added_by: current.user.id });
    if (error) return NextResponse.json({ error: "No pudimos dar acceso." }, { status: 400 });
  } else if (action === "remove_contributor") {
    if (!owner) return NextResponse.json({ error: "Solo el creador puede retirar accesos." }, { status: 403 });
    await current.admin.from("collection_contributors").delete().eq("collection_id", id).eq("user_id", body.userId);
  } else return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  await current.admin.from("collections").update({ updated_at: new Date().toISOString() }).eq("id", id);
  return NextResponse.json({ updated: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const current = await context(id);
  if (!current.user || !current.admin) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  if (!current.collection || current.collection.created_by !== current.user.id) return NextResponse.json({ error: "Solo el creador puede eliminar la colección." }, { status: 403 });
  await current.admin.from("campaigns").update({ collection_id: null }).eq("collection_id", id);
  const { error } = await current.admin.from("collections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "No pudimos eliminar la colección." }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
