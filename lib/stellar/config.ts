export type StellarNetwork = "testnet" | "mainnet";

export type StellarConfig = {
  network: StellarNetwork;
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string | null;
  deploymentKey: string;
  explorerBaseUrl: string;
};

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

export function getStellarConfig(): StellarConfig {
  const network = process.env.STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const contractId = process.env.STELLAR_CONTRACT_ID?.trim() || null;

  return {
    network,
    rpcUrl:
      process.env.STELLAR_RPC_URL?.trim() ||
      (network === "testnet"
        ? "https://soroban-testnet.stellar.org"
        : "https://mainnet.sorobanrpc.com"),
    networkPassphrase:
      process.env.STELLAR_NETWORK_PASSPHRASE?.trim() ||
      (network === "testnet" ? TESTNET_PASSPHRASE : MAINNET_PASSPHRASE),
    contractId,
    deploymentKey:
      process.env.STELLAR_DEPLOYMENT_KEY?.trim() || "hackathon-testnet-v1",
    explorerBaseUrl:
      network === "testnet"
        ? "https://stellar.expert/explorer/testnet"
        : "https://stellar.expert/explorer/public",
  };
}

export function stellarTransactionUrl(hash: string) {
  return `${getStellarConfig().explorerBaseUrl}/tx/${encodeURIComponent(hash)}`;
}
