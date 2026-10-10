import {
  BASE_FEE,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { getStellarConfig } from "@/lib/stellar/config";

export type ConfirmedStellarTransaction = {
  hash: string;
  ledger: number;
};

function bytes32(hex: string) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Expected a 32-byte hex value");
  return xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));
}

function requireSigner() {
  const secret = process.env.STELLAR_MINTER_SECRET?.trim();
  if (!secret) throw new Error("STELLAR_MINTER_SECRET is not configured");
  const signer = Keypair.fromSecret(secret);
  const expected = process.env.STELLAR_MINTER_PUBLIC_KEY?.trim();
  if (expected && signer.publicKey() !== expected) {
    throw new Error("STELLAR_MINTER_SECRET does not match STELLAR_MINTER_PUBLIC_KEY");
  }
  return signer;
}

async function invoke(functionName: string, ...args: xdr.ScVal[]) {
  const config = getStellarConfig();
  if (config.network !== "testnet") {
    throw new Error("The current worker is intentionally locked to Testnet");
  }
  if (!config.contractId) throw new Error("STELLAR_CONTRACT_ID is not configured");

  const signer = requireSigner();
  const server = new rpc.Server(config.rpcUrl);
  const account = await server.getAccount(signer.publicKey());
  const contract = new Contract(config.contractId);
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(transaction);
  prepared.sign(signer);
  const submitted = await server.sendTransaction(prepared);
  if (submitted.status === "ERROR") {
    throw new Error(`Stellar rejected ${functionName}: ${submitted.status}`);
  }

  const result = await server.pollTransaction(submitted.hash, { attempts: 20 });
  if (result.status !== "SUCCESS") {
    throw new Error(`Stellar transaction ${submitted.hash} finished as ${result.status}`);
  }
  return { hash: submitted.hash, ledger: result.ledger } satisfies ConfirmedStellarTransaction;
}

export function registerCampaignOnStellar(input: {
  campaignRef: string;
  contentHash: string;
  maxSupply: number;
}) {
  const signer = requireSigner();
  return invoke(
    "register_campaign",
    nativeToScVal(signer.publicKey(), { type: "address" }),
    bytes32(input.campaignRef),
    bytes32(input.contentHash),
    nativeToScVal(input.maxSupply, { type: "u32" }),
  );
}

export function mintPillOnStellar(input: {
  recipient: string;
  tokenId: number;
  campaignRef: string;
}) {
  const signer = requireSigner();
  return invoke(
    "mint",
    nativeToScVal(signer.publicKey(), { type: "address" }),
    nativeToScVal(input.recipient, { type: "address" }),
    nativeToScVal(input.tokenId, { type: "u32" }),
    bytes32(input.campaignRef),
  );
}
