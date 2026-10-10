"use client";

import { CheckCircle2, ExternalLink, Fingerprint, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type Wallet = {
  address: string;
  status: string;
  deploymentTxHash: string | null;
  activatedAt: string | null;
  network: "testnet";
};

const explorer = (address: string) => `https://stellar.expert/explorer/testnet/contract/${address}`;

export function StellarWalletCard({ username }: { username: string }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/stellar/wallet", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No pudimos consultar tu wallet.");
        setWallet(result.wallet);
      })
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : "No pudimos consultar tu wallet."))
      .finally(() => setLoading(false));
  }, []);

  async function activate() {
    if (activating) return;
    setActivating(true);
    setMessage("");
    try {
      if (!window.PublicKeyCredential) throw new Error("Este dispositivo no admite passkeys.");
      const { IndexedDBStorage, SmartAccountKit } = await import("smart-account-kit");
      const accountWasmHash = process.env.NEXT_PUBLIC_STELLAR_ACCOUNT_WASM_HASH;
      const webauthnVerifierAddress = process.env.NEXT_PUBLIC_STELLAR_WEBAUTHN_VERIFIER;
      const relayerUrl = process.env.NEXT_PUBLIC_STELLAR_RELAYER_URL;
      if (!accountWasmHash || !webauthnVerifierAddress || !relayerUrl) {
        throw new Error("La wallet de Testnet no está configurada.");
      }
      const kit = new SmartAccountKit({
        rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
        networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
        accountWasmHash,
        webauthnVerifierAddress,
        relayerUrl,
        rpName: "Pills",
        storage: new IndexedDBStorage(),
      });
      const created = await kit.createWallet("Pills", `@${username}`, {
        autoSubmit: true,
        authenticatorSelection: { residentKey: "required" },
      });
      if (created.submitResult && !created.submitResult.success) {
        throw new Error(created.submitResult.error.message || "Stellar no pudo crear la wallet.");
      }
      const response = await fetch("/api/stellar/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: created.contractId,
          deploymentTxHash: created.submitResult?.success ? created.submitResult.hash : null,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos vincular la wallet.");
      setWallet(result.wallet);
      setMessage("Wallet activada. Sincronizando tus Pills con Testnet…");
      await sync();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No pudimos activar la wallet.");
    } finally {
      setActivating(false);
    }
  }

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/stellar/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos sincronizar tus Pills.");
      setMessage(result.minted ? `${result.minted} Pill${result.minted === 1 ? "" : "s"} verificada${result.minted === 1 ? "" : "s"} en Stellar Testnet.` : "Tu colección ya está sincronizada con Stellar Testnet.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No pudimos sincronizar tus Pills.");
    } finally {
      setSyncing(false);
    }
  }

  return <section className="panel stellar-wallet-card">
    <div className="stellar-wallet-heading"><span><Fingerprint /></span><div><small>STELLAR TESTNET</small><h3>Tu wallet de Pills</h3><p>Usa la seguridad del dispositivo. No necesitas instalar una wallet ni guardar una frase secreta.</p></div></div>
    {loading ? <div className="stellar-wallet-loading"><LoaderCircle />Consultando wallet…</div> : wallet ? <div className="stellar-wallet-active">
      <div><CheckCircle2 /><span><strong>Wallet activa</strong><small>Vinculada a tu cuenta de Pills</small></span></div>
      <code>{wallet.address}</code>
      <div className="stellar-wallet-actions"><button type="button" onClick={() => void sync()} disabled={syncing}>{syncing ? <><LoaderCircle className="spin" />Sincronizando…</> : "Sincronizar Pills"}</button><a href={explorer(wallet.address)} target="_blank" rel="noreferrer">Ver en Stellar Expert <ExternalLink /></a></div>
    </div> : <div className="stellar-wallet-setup"><div><ShieldCheck /><p><strong>Una wallet para todos tus accesos.</strong> Si vinculas Google u otro inicio de sesión a esta misma cuenta, seguirás usando esta wallet.</p></div><button className="primary-button" type="button" onClick={() => void activate()} disabled={activating}>{activating ? <><LoaderCircle className="spin" />Activando…</> : <><Fingerprint />Activar con passkey</>}</button></div>}
    {message && <p className="stellar-wallet-message" role="status">{message}</p>}
  </section>;
}
