import "server-only";

import { PrivyClient, type Wallet } from "@privy-io/node";
import type { User } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/admin-access";
import { getStellarConfig } from "@/lib/stellar/config";

type PrivyUser = { id: string };

export type ProvisionedWallet = {
  address: string;
  kind: "stellar_account";
  provider: "privy";
  providerUserId: string;
  providerWalletId: string;
  status: "active";
  activatedAt: string;
  network: "testnet" | "mainnet";
};

function credentials() {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

export function isPrivyConfigured() {
  return credentials() !== null;
}

function privyHeaders(appId: string, appSecret: string) {
  return {
    Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
    "Content-Type": "application/json",
    "privy-app-id": appId,
  };
}

async function findOrCreatePrivyUser(appId: string, appSecret: string, user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) throw new Error("The Pills account does not have a verified email");

  const headers = privyHeaders(appId, appSecret);
  const lookup = await fetch("https://api.privy.io/v1/users/email/address", {
    method: "POST",
    headers,
    body: JSON.stringify({ address: email }),
    cache: "no-store",
  });
  if (lookup.ok) return (await lookup.json()) as PrivyUser;
  if (lookup.status !== 404) throw new Error(`Privy user lookup failed (${lookup.status})`);

  const created = await fetch("https://api.privy.io/v1/users", {
    method: "POST",
    headers,
    body: JSON.stringify({
      linked_accounts: [{ type: "email", address: email }],
      custom_metadata: { pills_user_id: user.id },
    }),
    cache: "no-store",
  });
  if (!created.ok) throw new Error(`Privy user creation failed (${created.status})`);
  return (await created.json()) as PrivyUser;
}

function externalWalletId(userId: string, network: string) {
  return `pills_${network}_${userId.replaceAll("-", "")}`.slice(0, 64);
}

async function findWallet(client: PrivyClient, externalId: string) {
  for await (const wallet of client.wallets().list({ chain_type: "stellar", external_id: externalId })) {
    return wallet;
  }
  return null;
}

async function findOrCreateWallet(client: PrivyClient, privyUserId: string, userId: string, network: string) {
  const externalId = externalWalletId(userId, network);
  const existing = await findWallet(client, externalId);
  if (existing) return existing;

  try {
    return await client.wallets().create({
      chain_type: "stellar",
      display_name: `Pills ${network}`,
      external_id: externalId,
      owner: { user_id: privyUserId },
      idempotency_key: `wallet-${externalId}`,
    });
  } catch (error) {
    const raced = await findWallet(client, externalId);
    if (raced) return raced;
    throw error;
  }
}

async function activateTestnetWallet(address: string) {
  const account = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`, { cache: "no-store" });
  if (account.ok) return null;
  if (account.status !== 404) throw new Error(`Stellar account lookup failed (${account.status})`);

  const funded = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(address)}`, { cache: "no-store" });
  if (!funded.ok) throw new Error(`Friendbot activation failed (${funded.status})`);
  const result = await funded.json() as { successful_transaction_hash?: string; hash?: string };
  return result.successful_transaction_hash ?? result.hash ?? null;
}

function publicWallet(wallet: {
  wallet_address: string;
  wallet_kind: string;
  wallet_provider: string;
  provider_user_id: string | null;
  provider_wallet_id: string | null;
  status: string;
  activated_at: string | null;
  network: string;
}): ProvisionedWallet {
  return {
    address: wallet.wallet_address,
    kind: "stellar_account",
    provider: "privy",
    providerUserId: wallet.provider_user_id ?? "",
    providerWalletId: wallet.provider_wallet_id ?? "",
    status: "active",
    activatedAt: wallet.activated_at ?? new Date().toISOString(),
    network: wallet.network === "mainnet" ? "mainnet" : "testnet",
  };
}

export async function ensurePrivyWallet(user: User): Promise<ProvisionedWallet | null> {
  const config = getStellarConfig();
  const admin = serviceClient();
  const { data: existing, error: existingError } = await admin
    .from("stellar_wallets")
    .select("wallet_address,wallet_kind,wallet_provider,provider_user_id,provider_wallet_id,status,activated_at,network")
    .eq("user_id", user.id)
    .eq("network", config.network)
    .eq("deployment_key", config.deploymentKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "active" && existing.wallet_provider === "privy") return publicWallet(existing);

  const auth = credentials();
  if (!auth) return null;

  const privyUser = await findOrCreatePrivyUser(auth.appId, auth.appSecret, user);
  const client = new PrivyClient({ appId: auth.appId, appSecret: auth.appSecret });
  const wallet: Wallet = await findOrCreateWallet(client, privyUser.id, user.id, config.network);
  const activationTxHash = config.network === "testnet" ? await activateTestnetWallet(wallet.address) : null;
  const now = new Date().toISOString();
  const { data: saved, error: saveError } = await admin
    .from("stellar_wallets")
    .upsert({
      user_id: user.id,
      network: config.network,
      deployment_key: config.deploymentKey,
      wallet_address: wallet.address,
      wallet_kind: "stellar_account",
      wallet_provider: "privy",
      provider_user_id: privyUser.id,
      provider_wallet_id: wallet.id,
      status: "active",
      deployment_tx_hash: activationTxHash,
      activated_at: now,
    }, { onConflict: "user_id,network,deployment_key" })
    .select("wallet_address,wallet_kind,wallet_provider,provider_user_id,provider_wallet_id,status,activated_at,network")
    .single();
  if (saveError || !saved) throw saveError ?? new Error("Could not save the Privy wallet");

  await Promise.all([
    admin.from("collectible_claims").update({ mint_status: "pending", mint_error: null }).eq("collector_id", user.id).eq("mint_status", "waiting_for_wallet"),
    admin.from("blockchain_jobs").update({ status: "retry", available_at: now, last_error: null, updated_at: now }).eq("user_id", user.id).eq("job_type", "mint").in("status", ["retry", "failed"]),
  ]);

  return publicWallet(saved);
}
