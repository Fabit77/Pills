"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, Check, FolderHeart, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { PillsLogo } from "@/components/pills-logo";

type AuthStep = "email" | "code";
const fansCollectionUrl = `${process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social"}/collection`;

export default function LoginPage() {
  return <Suspense fallback={<main className="landing-shell" />}><LoginContent /></Suspense>;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<AuthStep>("email");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [signedProfile, setSignedProfile] = useState<{ username: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile/me").then(async (response) => response.ok ? response.json() : null).then((data) => {
      if (data?.username) setSignedProfile({ username: data.username });
    }).catch(() => undefined);
  }, []);

  const visibleMessage = message || (step === "email" && searchParams.get("error") === "google_unavailable"
    ? "El acceso con Google todavía no está habilitado. Puedes ingresar con tu correo."
    : "");

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      const response = await fetch("/auth/email/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos enviar el código.");
      setEmail(result.email); setStep("code");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos enviar el código."); }
    finally { setLoading(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      const response = await fetch("/auth/email/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, token: code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos verificar el código.");
      router.replace(result.next); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos verificar el código."); setLoading(false); }
  }

  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <a className="landing-brand" href="/login"><PillsLogo context="Creator Studio" /></a>
        <div className="landing-nav-actions"><a className="nav-collection" href={fansCollectionUrl}><FolderHeart size={15} />Mi colección</a><a className="nav-login" href={signedProfile ? "/studio" : "#access"}>{signedProfile ? "Crear coleccionable" : "Iniciar sesión o crear cuenta"} <ArrowRight size={15} /></a></div>
      </nav>
      <section className="landing-hero">
        <div className="landing-copy">
          <span className="section-kicker"><span /> CREATOR STUDIO</span>
          <h1>Haz que tu evento<br />se quede con ellos.</h1>
          <p>Crea recuerdos digitales coleccionables para conciertos, partidos y experiencias de marca. Una nueva forma de extender la relación con tus fans.</p>
          <div className="landing-benefits"><span><Check />Crea y publica coleccionables</span><span><Check />Invita colaboradores</span><span><Check />Mide colección y recurrencia</span></div>
          <div className="trust-row"><div className="trust-avatars"><i>LN</i><i>AF</i><i>H</i></div><span>Experiencias creadas por artistas,<br />clubes y equipos de marketing.</span></div>
        </div>
        <div className="access-stage" id="access">
          <div className="orbit orbit-one orbit-track orbit-track-one">
            <span className="orbital-art"><Image src="/pills/aysen-futuro-final.webp" alt="Pill Aysén Futuro" fill sizes="120px" loading="eager" unoptimized /></span>
          </div>
          <div className="orbit orbit-two orbit-track orbit-track-two">
            <span className="orbital-art"><Image src="/pills/asadao-final.webp" alt="Pill AsaDAO" fill sizes="120px" loading="eager" unoptimized /></span>
          </div>
          <div className="orbit orbit-track orbit-track-three">
            <span className="orbital-art"><Image src="/pills/campus-on-chain.webp" alt="Pill Campus on Chain" fill sizes="120px" unoptimized /></span>
          </div>
          <div className="orbit orbit-track orbit-track-four">
            <span className="orbital-art"><Image src="/pills/asadao-42.webp" alt="Pill AsaDAO 42" fill sizes="120px" unoptimized /></span>
          </div>
          <article className="access-card">
            {signedProfile ? <>
              <span className="access-icon"><Sparkles /></span><span className="eyebrow">TU CUENTA DE CREADOR</span>
              <h2>Hola, @{signedProfile.username}.</h2>
              <p>Tu sesión está activa. Continúa creando recuerdos para las experiencias que importan.</p>
              <a className="primary-button login-submit" href="/studio">Crear coleccionable <ArrowRight size={17} /></a>
              <a className="back-button" href="/studio">Ir al Creator Studio</a>
            </> : <><span className="access-icon"><Mail /></span><span className="eyebrow">ACCESO PARA CREADORES</span>
            <h2>{step === "email" ? "Inicia sesión o crea tu cuenta." : "Revisa tu correo."}</h2>
            <p>{step === "email" ? "Entra con Google o recibe un código de acceso. No necesitas crear una contraseña." : <>Enviamos un código de acceso a <strong>{email}</strong>.</>}</p>
            {step === "email" ? <>
              <a className="google-button" href="/auth/google"><GoogleMark />Continuar con Google</a>
              <div className="auth-divider"><span>o continúa con correo</span></div>
              <form onSubmit={requestCode}>
                <label htmlFor="email">Correo electrónico</label>
                <div className="email-field"><Mail size={17} /><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@organización.com" autoComplete="email" /></div>
                {visibleMessage && <p className="form-error">{visibleMessage}</p>}
                <button className="primary-button login-submit" disabled={loading}>{loading ? "Enviando…" : <>Enviar código <ArrowRight size={17} /></>}</button>
              </form>
            </> : <form onSubmit={verifyCode} className="code-form">
              <label htmlFor="code">Código de verificación</label>
              <input className="code-input" id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" autoFocus />
              {visibleMessage && <p className="form-error">{visibleMessage}</p>}
              <button className="primary-button login-submit" disabled={loading || code.length < 6}>{loading ? "Verificando…" : <>Verificar y continuar <ArrowRight size={17} /></>}</button>
              <button type="button" className="back-button" onClick={() => { setStep("email"); setCode(""); setMessage(""); }}><ArrowLeft size={14} />Cambiar correo</button>
            </form>}
            </>}
            <div className="security-note"><ShieldCheck /><span>Tu correo siempre es privado. Solo tu nombre de usuario será público.</span></div>
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

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.4-4H3.3v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.6 14a6 6 0 0 1 0-3.9V7.5H3.3A10 10 0 0 0 2 12c0 1.6.4 3.1 1.3 4.5L6.6 14Z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.3 7.5l3.3 2.6A5.8 5.8 0 0 1 12 6Z"/></svg>;
}
