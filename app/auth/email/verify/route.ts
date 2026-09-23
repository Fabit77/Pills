import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, token } = await request.json();
    if (typeof email !== "string" || typeof token !== "string" || !/^\d{6}$/.test(token)) {
      return NextResponse.json({ error: "Ingresa el código de 6 dígitos." }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: "email",
    });
    if (error || !data.user) {
      return NextResponse.json({ error: "El código no es válido o ya expiró." }, { status: 400 });
    }

    const { data: publicProfile } = await supabase
      .from("public_usernames")
      .select("username")
      .eq("user_id", data.user.id)
      .maybeSingle();

    return NextResponse.json({ authenticated: true, next: publicProfile?.username ? "/studio" : "/onboarding" });
  } catch {
    return NextResponse.json({ error: "No pudimos verificar el código." }, { status: 503 });
  }
}
