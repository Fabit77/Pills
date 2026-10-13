"use client";

import Image from "next/image";
import Link from "next/link";
import { Activity, BadgeCheck, Mail, Send, Sparkles, Users, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { PillsLogo } from "@/components/pills-logo";

type CurationCreator = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  accountStatus: string;
  accountCreatedAt: string;
  emailVerified: boolean;
  hasEmail: boolean;
  providers: string[];
  createdCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  collectedCount: number;
  receivedCollections: number;
  pausedCount: number;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

export function CreatorCurationProfile({ creatorId, campaignId, campaignName }: { creatorId: string; campaignId?: string; campaignName?: string }) {
  const [creator, setCreator] = useState<CurationCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState(campaignName ? `Consulta sobre “${campaignName}”` : "Consulta de Curaduría Pills");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/creators/${creatorId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No pudimos cargar el perfil.");
        setCreator(payload.creator);
      })
      .catch((cause) => { if (cause?.name !== "AbortError") setError(cause?.message || "No pudimos cargar el perfil."); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [creatorId]);

  async function sendCreatorMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creator) return;
    setSending(true); setResult("");
    const response = await fetch(`/api/admin/creators/${creator.id}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaignId || null, subject, message }),
    });
    const payload = await response.json();
    setSending(false);
    if (!response.ok) { setResult(payload.error || "No pudimos enviar el mensaje."); return; }
    setMessage(""); setResult("Mensaje enviado al correo asociado a la cuenta.");
  }

  return <main className="curator-profile-page">
    <header className="curator-profile-nav">
      <Link href="/" aria-label="Volver a Pills"><PillsLogo context="CURATOR STUDIO" /></Link>
      <button type="button" className="secondary-button" onClick={() => window.close()}><X />Cerrar pestaña</button>
    </header>
    <section className="curator-profile-card">
      <div className="curator-profile-title"><span className="section-kicker"><span /> PERFIL PARA CURADURÍA</span><h1>{creator ? (creator.username ? `@${creator.username}` : creator.displayName) : "Perfil del creador"}</h1>{campaignName && <p>Revisión vinculada a la Pill <strong>{campaignName}</strong></p>}</div>
      {loading && <div className="creator-review-loading">Cargando antecedentes del creador…</div>}
      {error && <div className="curator-profile-error"><p>{error}</p><Link className="secondary-button" href="/">Volver a Curaduría</Link></div>}
      {creator && <div className="curator-profile-grid">
        <div className="curator-profile-details">
          <div className="creator-review-header">{creator.avatarUrl ? <Image src={creator.avatarUrl} alt="" width={74} height={74} unoptimized /> : <span>{(creator.username || creator.displayName).slice(0, 2).toUpperCase()}</span>}<div><h3>{creator.displayName}</h3><strong>{creator.username ? `@${creator.username}` : "Sin @usuario"}</strong><small className={`creator-account-state ${creator.accountStatus}`}>{creator.accountStatus === "active" ? "Cuenta activa" : creator.accountStatus === "paused" ? "Cuenta pausada" : "Cuenta bloqueada"}</small></div></div>
          {creator.bio && <p className="creator-review-bio">{creator.bio}</p>}
          <div className="creator-review-stats"><article><Sparkles /><span><strong>{creator.createdCount}</strong><small>Pills creadas</small></span></article><article><BadgeCheck /><span><strong>{creator.approvedCount}</strong><small>Aprobadas</small></span></article><article><Users /><span><strong>{creator.collectedCount}</strong><small>Coleccionadas</small></span></article><article><Activity /><span><strong>{creator.receivedCollections}</strong><small>Colecciones recibidas</small></span></article></div>
          <dl className="creator-review-facts"><div><dt>Cuenta creada</dt><dd>{formatDate(creator.accountCreatedAt)}</dd></div><div><dt>En revisión</dt><dd>{creator.pendingCount}</dd></div><div><dt>Rechazadas</dt><dd>{creator.rejectedCount}</dd></div><div><dt>Correo verificado</dt><dd>{creator.emailVerified ? "Sí" : "No"}</dd></div><div><dt>Métodos de acceso</dt><dd>{creator.providers.join(", ") || "Correo"}</dd></div><div><dt>Correo disponible</dt><dd>{creator.hasEmail ? "Sí, oculto por privacidad" : "No"}</dd></div></dl>
        </div>
        <form className="curation-message-form curator-profile-message" onSubmit={(event) => void sendCreatorMessage(event)}><div><Mail /><span><strong>Consultar al creador</strong><small>El mensaje llegará al correo asociado y quedará registrado.</small></span></div><label><span>Asunto</span><input required minLength={3} maxLength={140} value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label><span>Mensaje</span><textarea required minLength={10} maxLength={3000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Explica qué antecedente necesitas confirmar antes de tomar una decisión." /></label>{result && <p className={result.startsWith("Mensaje enviado") ? "curation-message-success" : "form-error"}>{result}</p>}<button className="primary-button" disabled={sending || !creator.hasEmail}><Send />{sending ? "Enviando…" : "Enviar consulta"}</button></form>
      </div>}
    </section>
  </main>;
}
