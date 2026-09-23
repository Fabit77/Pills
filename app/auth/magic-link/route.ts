import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (typeof email !== "string" || !email.includes("@") || email.length > 254) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
    }

    const supabase = await createClient();
    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=/studio`,
        shouldCreateUser: true,
      },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ sent: true });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Missing Supabase")
      ? "Supabase todavía no está conectado a este entorno."
      : "No pudimos enviar el acceso. Inténtalo nuevamente.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
