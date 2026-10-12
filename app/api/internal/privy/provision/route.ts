import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-access";
import { ensurePrivyWallet, isPrivyConfigured } from "@/lib/privy/server";

function authorized(request: Request) {
  const expected = (process.env.CRON_SECRET ?? process.env.STELLAR_WORKER_SECRET)?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(expected && supplied && supplied === expected);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!isPrivyConfigured()) return NextResponse.json({ error: "Privy no está configurado." }, { status: 503 });

  const admin = serviceClient();
  const { data: wallets, error: walletsError } = await admin
    .from("stellar_wallets")
    .select("user_id")
    .eq("wallet_provider", "privy")
    .eq("status", "active");
  if (walletsError) return NextResponse.json({ error: "No pudimos consultar las wallets." }, { status: 500 });
  const provisioned = new Set((wallets ?? []).map((wallet) => wallet.user_id));

  const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return NextResponse.json({ error: "No pudimos consultar los usuarios." }, { status: 500 });
  const pending = usersPage.users.filter((user) => user.email && !provisioned.has(user.id)).slice(0, 20);

  const results = [] as Array<{ userId: string; address?: string; error?: string }>;
  for (const user of pending) {
    try {
      const wallet = await ensurePrivyWallet(user);
      results.push({ userId: user.id, address: wallet?.address });
    } catch (error) {
      results.push({ userId: user.id, error: error instanceof Error ? error.message : "Unknown provisioning error" });
    }
  }

  return NextResponse.json({ processed: pending.length, remaining: Math.max(0, usersPage.users.length - provisioned.size - pending.length), results });
}
