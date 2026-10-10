import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStellarConfig } from "@/lib/stellar/config";
import { mintPillOnStellar, registerCampaignOnStellar } from "@/lib/stellar/contract";

type BlockchainJob = {
  id: string;
  job_type: "register_campaign" | "mint";
  campaign_id: string | null;
  claim_id: string | null;
  attempts: number;
};

const digest = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

async function artworkHash(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Artwork download failed with ${response.status}`);
  return digest(Buffer.from(await response.arrayBuffer()));
}

async function processCampaign(admin: SupabaseClient, job: BlockchainJob) {
  if (!job.campaign_id) throw new Error("Campaign job has no campaign_id");
  const { data: campaign, error } = await admin
    .from("campaigns")
    .select("id,artwork_url,content_hash,supply,blockchain_status")
    .eq("id", job.campaign_id)
    .single();
  if (error || !campaign) throw new Error("Campaign not found");
  if (!campaign.artwork_url) throw new Error("Approved campaign has no artwork");

  const contentHash = campaign.content_hash || (await artworkHash(campaign.artwork_url));
  const campaignRef = digest(campaign.id);
  const config = getStellarConfig();
  const transaction = await registerCampaignOnStellar({
    campaignRef,
    contentHash,
    maxSupply: campaign.supply,
  });

  const { error: updateError } = await admin
    .from("campaigns")
    .update({
      content_hash: contentHash,
      artwork_frozen_at: new Date().toISOString(),
      blockchain_status: "ready",
      blockchain_network: config.network,
      blockchain_contract_address: config.contractId,
      blockchain_tx_hash: transaction.hash,
      blockchain_ledger: transaction.ledger,
      blockchain_error: null,
    })
    .eq("id", campaign.id);
  if (updateError) throw updateError;
  return transaction;
}

async function processMint(admin: SupabaseClient, job: BlockchainJob) {
  if (!job.claim_id || !job.campaign_id) throw new Error("Mint job is incomplete");
  const [{ data: claim }, { data: campaign }] = await Promise.all([
    admin
      .from("collectible_claims")
      .select("id,collector_id,token_id,mint_status")
      .eq("id", job.claim_id)
      .single(),
    admin
      .from("campaigns")
      .select("id,blockchain_status")
      .eq("id", job.campaign_id)
      .single(),
  ]);
  if (!claim || !campaign) throw new Error("Claim or campaign not found");
  if (claim.mint_status === "minted") return null;
  if (campaign.blockchain_status !== "ready") {
    throw new Error("Campaign is not registered on Stellar yet");
  }

  const config = getStellarConfig();
  const { data: wallet } = await admin
    .from("stellar_wallets")
    .select("wallet_address,status")
    .eq("user_id", claim.collector_id)
    .eq("network", config.network)
    .eq("deployment_key", config.deploymentKey)
    .eq("status", "active")
    .maybeSingle();
  if (!wallet) {
    await admin
      .from("collectible_claims")
      .update({ mint_status: "waiting_for_wallet" })
      .eq("id", claim.id);
    throw new Error("Collector wallet is not active yet");
  }

  const tokenId = Number(claim.token_id);
  if (!Number.isSafeInteger(tokenId) || tokenId < 1 || tokenId > 4_294_967_295) {
    throw new Error("Claim token_id is outside the contract range");
  }
  const transaction = await mintPillOnStellar({
    recipient: wallet.wallet_address,
    tokenId,
    campaignRef: digest(campaign.id),
  });
  const { error: updateError } = await admin
    .from("collectible_claims")
    .update({
      network: config.network,
      contract_address: config.contractId,
      mint_status: "minted",
      mint_tx_hash: transaction.hash,
      mint_ledger: transaction.ledger,
      minted_at: new Date().toISOString(),
      mint_error: null,
    })
    .eq("id", claim.id);
  if (updateError) throw updateError;
  return transaction;
}

async function processClaimedJob(admin: SupabaseClient, job: BlockchainJob | null) {
  if (!job) return { processed: false as const };

  try {
    const transaction =
      job.job_type === "register_campaign"
        ? await processCampaign(admin, job)
        : job.job_type === "mint"
          ? await processMint(admin, job)
          : null;
    await admin
      .from("blockchain_jobs")
      .update({
        status: "completed",
        transaction_hash: transaction?.hash ?? null,
        ledger: transaction?.ledger ?? null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", job.id);
    return { processed: true as const, jobId: job.id, transaction };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message.slice(0, 1000) : "Unknown worker error";
    const retryable = job.attempts < 8;
    const delayMinutes = Math.min(60, 2 ** Math.min(job.attempts, 6));
    await admin
      .from("blockchain_jobs")
      .update({
        status: retryable ? "retry" : "failed",
        available_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
        last_error: message,
      })
      .eq("id", job.id);
    return { processed: true as const, jobId: job.id, error: message, retryable };
  }
}

export async function processNextBlockchainJob(admin: SupabaseClient) {
  const workerId = `pills-${randomUUID()}`;
  const config = getStellarConfig();
  const { data, error } = await admin.rpc("claim_next_blockchain_job", {
    worker_id: workerId,
    target_network: config.network,
  });
  if (error) throw error;
  return processClaimedJob(admin, data as BlockchainJob | null);
}

export async function processNextBlockchainJobForUser(admin: SupabaseClient, userId: string) {
  const workerId = `pills-user-${randomUUID()}`;
  const config = getStellarConfig();
  const { data, error } = await admin.rpc("claim_next_blockchain_job_for_user", {
    worker_id: workerId,
    target_user: userId,
    target_network: config.network,
  });
  if (error) throw error;
  return processClaimedJob(admin, data as BlockchainJob | null);
}
