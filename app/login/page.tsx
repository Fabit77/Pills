"use client";

import { ArrowRight, BadgeCheck, Building2, Check, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");

    try {
      const response = await fetch("/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos enviar el acceso.");
      setState("sent");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos enviar el acceso. Inténtalo nuevamente.");
      setState("error");
    }
  }

  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <a className="landing-brand" href="/login"><span className="brand-mark"><span /></span><strong>Pills</strong><em>Creator Studio</em></a>
        <a className="nav-login" href="#access">Ingresar <ArrowRight size={15} /></a>
      </nav>

      <section className="landing-hero">
        <div className="landing-copy">
          <span className="section-kicker"><span /> CREATOR STUDIO</span>
          <h1>Haz que tu evento<br />se quede con ellos.</h1>
          <p>Crea recuerdos digitales coleccionables para conciertos, partidos y experiencias de marca. Una nueva forma de extender la relación con tus fans.</p>

          <div className="landing-benefits">
            <span><Check />Crea y publica campañas</span>
            <span><Check />Invita colaboradores</span>
            <span><Check />Mide colección y recurrencia</span>
          </div>

          <div className="trust-row"><div className="trust-avatars"><i>LN</i><i>AF</i><i>H</i></div><span>Experiencias creadas por artistas,<br />clubes y equipos de marketing.</span></div>
        </div>

        <div className="access-stage" id="access">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="floating-pill floating-pill-one"><small>PILLS® / 2026</small><Sparkles /><strong>H26</strong><span>FESTIVAL</span></div>
          <div className="floating-pill floating-pill-two"><small>PILLS® / 2026</small><Building2 /><strong>LN</strong><span>CONCIERTO</span></div>

          <article className="access-card">
            <span className="access-icon"><Mail /></span>
            {state === "sent" ? (
              <div className="sent-state">
                <span className="sent-check"><Check /></span>
                <h2>Revisa tu correo</h2>
                <p>Enviamos un enlace de acceso a <strong>{email}</strong>. Úsalo para entrar al Creator Studio.</p>
                <button className="text-button" onClick={() => setState("idle")}>Usar otro correo</button>
              </div>
            ) : (
              <>
                <span className="eyebrow">ACCESO PARA CREADORES</span>
                <h2>Entra a tu espacio.</h2>
                <p>Usa tu correo de trabajo. Te enviaremos un enlace seguro, sin contraseñas.</p>
                <form onSubmit={signIn}>
                  <label htmlFor="email">Correo electrónico</label>
                  <div className="email-field"><Mail size={17} /><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@organización.com" autoComplete="email" /></div>
                  {state === "error" && <p className="form-error">{message}</p>}
                  <button className="primary-button login-submit" disabled={state === "loading"}>{state === "loading" ? "Enviando…" : <>Continuar con correo <ArrowRight size={17} /></>}</button>
                </form>
                <div className="security-note"><ShieldCheck /><span>Acceso protegido por enlace de un solo uso.</span></div>
              </>
            )}
          </article>
        </div>
      </section>

      <section className="landing-strip">
        <div><BadgeCheck /><span><strong>Identidad verificada</strong>Las personas reconocen al creador oficial.</span></div>
        <div><Users /><span><strong>Equipos y colaboradores</strong>Crea junto a artistas, marcas y partners.</span></div>
        <div><Sparkles /><span><strong>Una historia que continúa</strong>Cada experiencia pasa a formar parte de una colección.</span></div>
      </section>
    </main>
  );
}
