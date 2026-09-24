import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase().replace(/^@/, "") : "";
  const { data: collaborator } = await supabase.from("public_usernames").select("user_id,username").eq("username", username).maybeSingle();
  if (!collaborator) return NextResponse.json({ error: "No encontramos ese nombre de usuario." }, { status: 404 });
  if (collaborator.user_id === authData.user.id) return NextResponse.json({ error: "Ya eres la persona creadora." }, { status: 400 });
  const { error } = await supabase.from("campaign_collaborators").insert({ campaign_id: id, user_id: collaborator.user_id, added_by: authData.user.id, role: "reader" });
  if (error?.code === "23505") return NextResponse.json({ error: "Esta persona ya tiene acceso a la Pill." }, { status: 409 });
  if (error) return NextResponse.json({ error: "No pudimos agregar a la persona con acceso." }, { status: 400 });
  return NextResponse.json({ manager: { userId: collaborator.user_id, username: collaborator.username, role: "reader" } }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient(); const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const { id } = await params; const body = await request.json(); const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return NextResponse.json({ error: "Lector inválido." }, { status: 400 });
  const { error } = await supabase.from("campaign_collaborators").delete().eq("campaign_id", id).eq("user_id", userId);
  if (error) return NextResponse.json({ error: "No pudimos retirar el acceso." }, { status: 400 });
  return NextResponse.json({ deleted: true });
}
