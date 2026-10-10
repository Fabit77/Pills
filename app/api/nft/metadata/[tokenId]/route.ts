import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-access";
import { getStellarConfig, stellarTransactionUrl } from "@/lib/stellar/config";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId: rawTokenId } = await params;
  const tokenId = Number(rawTokenId);
  if (!Number.isSafeInteger(tokenId) || tokenId < 1 || tokenId > 4_294_967_295) {
    return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
  }

  const service = serviceClient();
  const { data: claim, error: claimError } = await service
    .from("collectible_claims")
    .select(
      "id,campaign_id,edition_number,token_id,network,contract_address,mint_status,mint_tx_hash,minted_at,burned_at,visibility",
    )
    .eq("token_id", tokenId)
    .maybeSingle();

  if (claimError || !claim) {
    return NextResponse.json({ error: "NFT metadata not found" }, { status: 404 });
  }

  const { data: campaign } = await service
    .from("campaigns")
    .select(
      "id,name,description,artwork_url,artwork_removed_at,venue,starts_at,supply,created_by,content_hash",
    )
    .eq("id", claim.campaign_id)
    .maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: "Pill not found" }, { status: 404 });
  }

  const { data: creator } = await service
    .from("public_usernames")
    .select("username")
    .eq("user_id", campaign.created_by)
    .maybeSingle();

  const state = claim.burned_at
    ? "burned"
    : claim.visibility === "hidden"
      ? "hidden"
      : campaign.artwork_removed_at
        ? "image_removed"
        : "active";
  const image = state === "active" ? campaign.artwork_url : null;
  const config = getStellarConfig();

  return NextResponse.json(
    {
      name: campaign.name,
      description: campaign.description,
      image,
      external_url: `${process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social"}/collection/${claim.id}`,
      attributes: [
        { trait_type: "Edition", value: claim.edition_number },
        { trait_type: "Maximum supply", value: campaign.supply },
        { trait_type: "Creator", value: creator?.username ? `@${creator.username}` : null },
        { trait_type: "Location", value: campaign.venue },
        { trait_type: "Experience date", value: campaign.starts_at },
        { trait_type: "State", value: state },
      ].filter((attribute) => attribute.value !== null),
      pills: {
        state,
        token_id: claim.token_id,
        edition_number: claim.edition_number,
        content_hash: campaign.content_hash,
        network: claim.network || config.network,
        contract_id: claim.contract_address || config.contractId,
        mint_status: claim.mint_status,
        mint_transaction: claim.mint_tx_hash
          ? {
              hash: claim.mint_tx_hash,
              explorer_url: stellarTransactionUrl(claim.mint_tx_hash),
            }
          : null,
        minted_at: claim.minted_at,
        burned_at: claim.burned_at,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
