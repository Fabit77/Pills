"use client";

import { ArrowLeft, ArrowRight, BarChart3, FolderHeart, Grid3X3, Mail, PencilRuler, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { PillsLogo } from "@/components/pills-logo";

type AuthStep = "email" | "code";
const fansCollectionUrl = `${process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social"}/collection`;
const fansHomeUrl = process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social";

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
    <main className="landing-shell creator-landing-v2">
      <nav className="creator-v2-nav">
        <a className="landing-brand" href="/login"><PillsLogo /></a>
        <div className="creator-v2-links"><a href={fansHomeUrl}>Explorar</a><a href="#studio">Creator Studio</a><a href="#como-funciona">Cómo funciona</a></div>
        <a className="creator-v2-start" href={signedProfile ? "/studio" : "#access"}>{signedProfile ? "Ir al Studio" : "Comenzar"}<ArrowRight /></a>
      </nav>

      <section className="creator-v2-hero">
        <div className="creator-v2-hero-copy"><h1>Tus<br />experiencias<br /><span>cuentan</span><br />tu historia.</h1><h2>Colecciona, organiza y revive<span>los momentos que te definen.</span></h2><a className="creator-v2-button" href={signedProfile ? "/studio" : "#access"}>{signedProfile ? "Crear una Pill" : "Comenzar"}<ArrowRight /></a></div>
        <div className="creator-phone-scene creator-hero-art" aria-label="Perfil de Pills rodeado de coleccionables">
          <Image className="creator-hero-orbit" src="/landing/pills-hero-orbit.png" alt="" width={1600} height={463} priority sizes="(max-width: 760px) 135vw, 75vw" aria-hidden="true" />
          <Image className="creator-hero-phone" src="/landing/pills-fans-hero-transparent.png" alt="Perfil de Roberto en Pills rodeado de sus coleccionables" width={1024} height={1536} priority sizes="(max-width: 760px) 100vw, 58vw" />
        </div>
      </section>

      <section className="creator-how" id="como-funciona"><div className="creator-how-grid"><article><small>01</small><h2>Crea</h2><p>Diseña una Pill para la experiencia que quieres extender.</p><PillImage src="/pills/aysen-futuro-final.webp" alt="Pill de concierto" /></article><article><small>02</small><h2>Distribuye</h2><p>Comparte por QR, enlace o una frase secreta.</p><PillImage src="/pills/campus-on-chain.webp" alt="Pill distribuida" /></article><article><small>03</small><h2>Construye comunidad</h2><p>Cada colección mantiene viva la relación con tu audiencia.</p><PillImage src="/pills/asadao-final.webp" alt="Pill de comunidad" /></article></div></section>

      <section className="creator-identity"><div><span className="creator-v2-eyebrow">UNA HISTORIA QUE CRECE</span><h2>Una colección de<br />lo que los define.</h2><p>Tus eventos. Sus recuerdos. Una identidad compartida que puede seguir creciendo mucho después del encuentro.</p><a className="creator-v2-button" href="#access">Comenzar <ArrowRight /></a></div><div className="creator-category-art"><Image src="/landing/pills-categories-transparent.png" alt="Categorías de Deportes, Cultura y Comunidad en Pills" width={598} height={800} sizes="(max-width: 760px) 100vw, 55vw" /></div></section>

      <section className="creator-moments"><div><span className="creator-v2-eyebrow">MOMENTOS COMPARTIDOS</span><h2>Lo vivido se<br />vuelve comunidad.</h2><p>Cada Pill conecta personas alrededor de una experiencia real.</p></div><div className="creator-moment-gallery"><PillImage src="/pills/aysen-futuro-final.webp" alt="Momento de evento" /><PillImage src="/pills/asadao-42.webp" alt="Momento compartido" /><PillImage src="/pills/campus-on-chain.webp" alt="Momento de comunidad" /><PillImage src="/pills/asadao-final.webp" alt="Momento coleccionable" /></div></section>

      <section className="creator-studio-showcase" id="studio"><div className="creator-studio-mock"><header><PillsLogo /><span>Creator Studio</span></header><div className="creator-studio-body"><aside><i /><i /><i /><i /></aside><div><span>Mis Pills</span><h3>Creator Studio</h3><div className="creator-studio-tools"><b><PencilRuler />Diseña</b><b><Grid3X3 />Organiza</b><b><BarChart3 />Mide</b></div><div className="creator-studio-pills"><i>+</i><PillImage src="/pills/aysen-futuro-final.webp" alt="Pill" /><PillImage src="/pills/asadao-final.webp" alt="Pill" /><PillImage src="/pills/campus-on-chain.webp" alt="Pill" /></div></div></div></div><div className="creator-studio-copy"><span className="creator-v2-eyebrow">PARA CREADORES</span><h2>Creator<br />Studio</h2><p>Crea, diseña y organiza tus propias Pills. Trabaja con tu equipo, publícalas y entiende cómo crece cada colección.</p><a href="#access">Conoce Creator Studio <ArrowRight /></a></div></section>

      <section className="creator-access" id="access"><div className="creator-access-intro"><span className="creator-v2-eyebrow">EMPIEZA A CREAR</span><h2>Convierte una experiencia en algo que se queda.</h2><p>Abre tu espacio de Creator Studio y crea tu primera Pill.</p><div className="creator-access-pills"><PillImage src="/pills/asadao-final.webp" alt="Pill" /><PillImage src="/pills/aysen-futuro-final.webp" alt="Pill" /></div></div>
          <article className="access-card creator-v2-access-card">
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
      </section>
      <footer className="creator-v2-footer"><PillsLogo inverse /><nav><a href={fansHomeUrl}>Explorar</a><a href="#studio">Creator Studio</a><a href="#como-funciona">Cómo funciona</a></nav><a href={fansCollectionUrl}><FolderHeart />Ver mi colección</a></footer>
    </main>
  );
}

function PillImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return <span className={`creator-pill-image ${className}`.trim()}><Image src={src} alt={alt} fill sizes="220px" unoptimized /></span>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.3Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.5L15.4 17c-.9.6-2 1-3.4 1a5.8 5.8 0 0 1-5.4-4H3.3v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.6 14a6 6 0 0 1 0-3.9V7.5H3.3A10 10 0 0 0 2 12c0 1.6.4 3.1 1.3 4.5L6.6 14Z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3.3 7.5l3.3 2.6A5.8 5.8 0 0 1 12 6Z"/></svg>;
}
