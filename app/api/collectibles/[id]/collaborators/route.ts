import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase().replace(/^@/, "") : "";
  const role = body.role === "reader" ? "reader" : "admin";
  const { data: collaborator } = await supabase.from("public_usernames").select("user_id,username").eq("username", username).maybeSingle();
  if (!collaborator) return NextResponse.json({ error: "No encontramos ese nombre de usuario." }, { status: 404 });
  if (collaborator.user_id === authData.user.id) return NextResponse.json({ error: "Ya eres la persona creadora." }, { status: 400 });
  const { error } = await supabase.from("campaign_collaborators").insert({ campaign_id: id, user_id: collaborator.user_id, added_by: authData.user.id, role });
  if (error?.code === "23505") return NextResponse.json({ error: "Esta persona ya administra esta Pill." }, { status: 409 });
  if (error) return NextResponse.json({ error: "No pudimos agregar al administrador." }, { status: 400 });
  return NextResponse.json({ manager: { userId: collaborator.user_id, username: collaborator.username, role } }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params; const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId : ""; const role = body.role === "reader" ? "reader" : body.role === "admin" ? "admin" : "";
  if (!userId || !role) return NextResponse.json({ error: "Rol inválido." }, { status: 400 });
  const { error } = await supabase.from("campaign_collaborators").update({ role }).eq("campaign_id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "No pudimos cambiar el rol." }, { status: 400 });
  return NextResponse.json({ updated: true, role });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params; const body = await request.json(); const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "Administrador inválido." }, { status: 400 });
  const { error } = await supabase.from("campaign_collaborators").delete().eq("campaign_id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "No pudimos eliminar al administrador." }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
