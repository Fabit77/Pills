import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (typeof email !== "string" || !email.includes("@") || email.length > 254) {
      return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });

    if (error) {
      const rateLimited = error.status === 429 || error.message.toLowerCase().includes("rate limit");
      return NextResponse.json(
        rateLimited
          ? { error: "Alcanzamos el límite temporal de correos. Espera antes de solicitar otro código.", code: "email_rate_limit" }
          : { error: "No pudimos enviar el código. Revisa el correo e inténtalo nuevamente." },
        { status: rateLimited ? 429 : 400 },
      );
    }
    return NextResponse.json({ sent: true, email: normalizedEmail });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("Missing Supabase")
      ? "Supabase todavía no está conectado a este entorno."
      : "No pudimos enviar el código. Inténtalo nuevamente.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
