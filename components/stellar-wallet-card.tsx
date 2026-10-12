"use client";

import { CheckCircle2, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type Wallet = {
  address: string;
  kind: "stellar_account";
  provider: "privy";
  status: "active";
  activatedAt: string;
  network: "testnet" | "mainnet";
};

function explorer(address: string) {
  return `https://stellar.expert/explorer/testnet/account/${address}`;
}

export function StellarWalletCard({ username }: { username?: string }) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/stellar/wallet", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No pudimos preparar tu wallet.");
        setWallet(result.wallet);
        setMessage(result.message || "");
      })
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : "No pudimos preparar tu wallet."))
      .finally(() => setLoading(false));
  }, []);

  async function sync() {
    setMessage("Sincronizando tus Pills con Stellar Testnet…");
    try {
      const response = await fetch("/api/stellar/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos sincronizar tus Pills.");
      setMessage(result.minted ? `${result.minted} Pill${result.minted === 1 ? "" : "s"} verificada${result.minted === 1 ? "" : "s"} en Stellar Testnet.` : "Tu colección ya está sincronizada con Stellar Testnet.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No pudimos sincronizar tus Pills.");
    }
  }

  return <section className="panel stellar-wallet-card">
    <div className="stellar-wallet-heading"><span><ShieldCheck /></span><div><small>STELLAR TESTNET</small><h3>Tu wallet de Pills</h3><p>Se crea automáticamente con tu cuenta. No necesitas instalar una aplicación, comprar XLM ni guardar una frase secreta.</p></div></div>
    {loading ? <div className="stellar-wallet-loading"><LoaderCircle />Preparando tu wallet…</div> : wallet ? <div className="stellar-wallet-active">
      <div><CheckCircle2 /><span><strong>Wallet integrada activa</strong><small>Protegida por Privy y vinculada a {username ? `@${username}` : "tu cuenta de Pills"}</small></span></div>
      <code>{wallet.address}</code>
      <div className="stellar-wallet-actions"><button type="button" onClick={() => void sync()}>Sincronizar Pills</button><a href={explorer(wallet.address)} target="_blank" rel="noreferrer">Ver en Stellar Expert <ExternalLink /></a></div>
    </div> : <div className="stellar-wallet-setup"><div><ShieldCheck /><p><strong>Tus Pills están guardadas.</strong> La wallet se creará automáticamente cuando la conexión de Privy esté disponible.</p></div></div>}
    {message && <p className="stellar-wallet-message" role="status">{message}</p>}
  </section>;
}
