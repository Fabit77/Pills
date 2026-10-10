import { NextResponse } from "next/server";
import { rpc, StrKey, xdr } from "@stellar/stellar-sdk";
import { serviceClient } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { getStellarConfig } from "@/lib/stellar/config";

type WalletBody = {
  address?: unknown;
  deploymentTxHash?: unknown;
};

async function authenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

function publicWallet(wallet: {
  wallet_address: string;
  wallet_kind: string;
  status: string;
  deployment_tx_hash: string | null;
  activated_at: string | null;
}) {
  return {
    address: wallet.wallet_address,
    kind: wallet.wallet_kind,
    status: wallet.status,
    deploymentTxHash: wallet.deployment_tx_hash,
    activatedAt: wallet.activated_at,
    network: "testnet",
  };
}

export async function GET() {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const config = getStellarConfig();
  const admin = serviceClient();
  const { data, error } = await admin
    .from("stellar_wallets")
    .select("wallet_address,wallet_kind,status,deployment_tx_hash,activated_at")
    .eq("user_id", user.id)
    .eq("network", config.network)
    .eq("deployment_key", config.deploymentKey)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "No pudimos consultar tu wallet." }, { status: 500 });
  return NextResponse.json({ wallet: data ? publicWallet(data) : null });
}

export async function POST(request: Request) {
  const user = await authenticatedUser();
  if (!user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as WalletBody | null;
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  const deploymentTxHash = typeof body?.deploymentTxHash === "string" ? body.deploymentTxHash.trim() : null;
  if (!StrKey.isValidContract(address)) {
    return NextResponse.json({ error: "La dirección de la wallet no es válida." }, { status: 400 });
  }
  if (deploymentTxHash && !/^[0-9a-f]{64}$/i.test(deploymentTxHash)) {
    return NextResponse.json({ error: "La transacción de despliegue no es válida." }, { status: 400 });
  }

  const config = getStellarConfig();
  if (config.network !== "testnet") {
    return NextResponse.json({ error: "La activación de wallets está limitada a Testnet." }, { status: 503 });
  }

  const expectedWasmHash = process.env.NEXT_PUBLIC_STELLAR_ACCOUNT_WASM_HASH?.trim().toLowerCase();
  if (!expectedWasmHash) {
    return NextResponse.json({ error: "La wallet de Testnet no está configurada." }, { status: 503 });
  }

  try {
    const server = new rpc.Server(config.rpcUrl);
    const instance = await server.getContractInstance(address);
    const executable = instance.executable();
    if (executable.switch() !== xdr.ContractExecutableType.contractExecutableWasm()) {
      throw new Error("The address is not a WASM smart account");
    }
    const onChainWasmHash = Buffer.from(executable.wasmHash()).toString("hex");
    if (onChainWasmHash !== expectedWasmHash) {
      return NextResponse.json({ error: "La wallet no corresponde al contrato autorizado por Pills." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "No pudimos verificar la wallet en Stellar Testnet." }, { status: 400 });
  }

  const admin = serviceClient();
  const now = new Date().toISOString();
  const { data: existing } = await admin
    .from("stellar_wallets")
    .select("wallet_address")
    .eq("user_id", user.id)
    .eq("network", config.network)
    .eq("deployment_key", config.deploymentKey)
    .maybeSingle();
  if (existing && existing.wallet_address !== address) {
    return NextResponse.json({ error: "Esta cuenta ya tiene una wallet de Testnet vinculada." }, { status: 409 });
  }

  const { data: wallet, error } = await admin
    .from("stellar_wallets")
    .upsert({
      user_id: user.id,
      network: config.network,
      deployment_key: config.deploymentKey,
      wallet_address: address,
      wallet_kind: "smart_wallet",
      status: "active",
      deployment_tx_hash: deploymentTxHash,
      activated_at: now,
    }, { onConflict: "user_id,network,deployment_key" })
    .select("wallet_address,wallet_kind,status,deployment_tx_hash,activated_at")
    .single();
  if (error || !wallet) {
    return NextResponse.json({ error: "No pudimos vincular la wallet a tu cuenta." }, { status: 500 });
  }

  await Promise.all([
    admin.from("collectible_claims").update({ mint_status: "pending", mint_error: null }).eq("collector_id", user.id).eq("mint_status", "waiting_for_wallet"),
    admin.from("blockchain_jobs").update({ status: "retry", available_at: now, last_error: null, updated_at: now }).eq("user_id", user.id).eq("job_type", "mint").in("status", ["retry", "failed"]),
  ]);

  return NextResponse.json({ wallet: publicWallet(wallet) });
}
