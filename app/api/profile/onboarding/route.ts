import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const usernamePattern = /^[a-z0-9._]{3,24}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const firstName = typeof body.firstName === "string" ? body.firstName.trim().slice(0, 60) : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim().slice(0, 60) : "";
    const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 180) : "";

    if (!usernamePattern.test(username)) {
      return NextResponse.json({ error: "Usa entre 3 y 24 caracteres: letras, números, punto o guion bajo." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return NextResponse.json({ error: "Tu sesión expiró. Vuelve a ingresar." }, { status: 401 });

    const { error } = await supabase.rpc("complete_creator_profile", {
      requested_username: username,
      requested_first_name: firstName || null,
      requested_last_name: lastName || null,
      requested_bio: bio || null,
    });

    if (error?.code === "23505") return NextResponse.json({ error: "Ese nombre de usuario ya está ocupado." }, { status: 409 });
    if (error) return NextResponse.json({ error: "No pudimos guardar tu perfil." }, { status: 400 });
    return NextResponse.json({ saved: true, username });
  } catch {
    return NextResponse.json({ error: "No pudimos guardar tu perfil." }, { status: 503 });
  }
}
