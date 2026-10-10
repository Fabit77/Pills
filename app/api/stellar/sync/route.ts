import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { processNextBlockchainJobForUser } from "@/lib/stellar/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const admin = serviceClient();
  const { data: wallet } = await admin
    .from("stellar_wallets")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("network", "testnet")
    .eq("status", "active")
    .maybeSingle();
  if (!wallet) return NextResponse.json({ error: "Activa tu wallet antes de sincronizar." }, { status: 409 });

  const results = [];
  for (let index = 0; index < 3; index += 1) {
    const result = await processNextBlockchainJobForUser(admin, data.user.id);
    results.push(result);
    if (!result.processed) break;
  }
  const minted = results.filter((result) => result.processed && "transaction" in result && result.transaction).length;
  const errors = results.filter((result) => result.processed && "error" in result && result.error).length;
  return NextResponse.json({ ok: errors === 0, minted, errors, pending: results.at(-1)?.processed !== false });
}
