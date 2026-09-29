"use client";

import { ArrowRight, AtSign, Check, LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PillsLogo } from "@/components/pills-logo";

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState(""); const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState(""); const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/profile/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, firstName, lastName, bio }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos guardar tu perfil.");
      router.replace("/studio"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No pudimos guardar tu perfil."); setLoading(false); }
  }

  return <main className="onboarding-shell">
    <a className="landing-brand onboarding-brand" href="/login"><PillsLogo context="Creator Studio" /></a>
    <section className="onboarding-card">
      <div className="onboarding-intro">
        <span className="onboarding-icon"><Sparkles /></span><span className="eyebrow">TU IDENTIDAD EN PILLS</span>
        <h1>Elige cómo te verá la comunidad.</h1>
        <p>Tu nombre de usuario acompañará cada Pill que crees. Tu correo nunca será visible para otras personas.</p>
        <div className="privacy-points"><span><Check />Nombre de usuario público</span><span><LockKeyhole />Correo y datos personales privados</span></div>
      </div>
      <form onSubmit={saveProfile} className="profile-form">
        <label htmlFor="username">Nombre de usuario <strong>Obligatorio</strong></label>
        <div className="username-field"><AtSign /><input id="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9._]+" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))} placeholder="tunombre" autoComplete="username" /></div>
        <small>3–24 caracteres. Puedes usar letras, números, punto y guion bajo.</small>
        <div className="optional-label"><span>Personaliza tu perfil</span><em>Opcional</em></div>
        <div className="profile-grid">
          <label><span>Nombre</span><div><UserRound /><input value={firstName} onChange={(event) => setFirstName(event.target.value)} maxLength={60} placeholder="Tu nombre" /></div></label>
          <label><span>Apellido</span><div><UserRound /><input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={60} placeholder="Tu apellido" /></div></label>
        </div>
        <label htmlFor="bio" className="bio-label">Descripción breve</label>
        <textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={180} placeholder="Cuéntale a la comunidad qué tipo de experiencias creas." />
        <span className="character-count">{bio.length}/180</span>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button onboarding-submit" disabled={loading}>{loading ? "Guardando…" : <>Crear mi perfil <ArrowRight /></>}</button>
      </form>
    </section>
  </main>;
}
