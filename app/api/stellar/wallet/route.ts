import { NextResponse } from "next/server";
import { ensurePrivyWallet, isPrivyConfigured } from "@/lib/privy/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  try {
    const wallet = await ensurePrivyWallet(data.user);
    if (!wallet) {
      return NextResponse.json({
        wallet: null,
        configured: false,
        message: "La creación automática de wallets se habilitará al conectar Privy.",
      });
    }
    return NextResponse.json({ wallet, configured: true });
  } catch (walletError) {
    console.error("Privy wallet provisioning failed", walletError);
    return NextResponse.json({
      wallet: null,
      configured: isPrivyConfigured(),
      error: "No pudimos preparar tu wallet de Stellar. Tus Pills siguen guardadas y volveremos a intentarlo.",
    }, { status: 503 });
  }
}
