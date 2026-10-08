import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, Check, FolderHeart, Link2, LockKeyhole, Palette, QrCode, Sparkles, Users } from "lucide-react";
import { PillsLogo } from "@/components/pills-logo";

const fansHomeUrl = process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social";

export const metadata: Metadata = {
  title: "Cómo funciona — Pills",
  description: "Aprende a crear, publicar, compartir y coleccionar una Pill.",
};

const steps = [
  {
    number: "01",
    icon: Palette,
    title: "Crea tu Pill",
    description: "Sube una imagen, agrega el nombre de la experiencia y define la información que quieres conservar.",
  },
  {
    number: "02",
    icon: Sparkles,
    title: "Configura la experiencia",
    description: "Elige su disponibilidad, fecha y forma de acceso. La frase secreta es opcional.",
  },
  {
    number: "03",
    icon: QrCode,
    title: "Publícala y compártela",
    description: "Distribuye la Pill con un enlace, un código QR o una frase secreta cuando quieras limitar el acceso.",
  },
  {
    number: "04",
    icon: FolderHeart,
    title: "Haz crecer la colección",
    description: "Las personas guardan la Pill en su perfil y construyen una colección con las experiencias que las definen.",
  },
];

export default function HowItWorksPage() {
  return <main className="how-page">
    <nav className="how-nav">
      <a className="landing-brand" href="/login"><PillsLogo /></a>
      <div><a href={`${fansHomeUrl}/explore`}>Explorar</a><a href="/collection">Ver colección</a><a className="how-nav-cta" href="/login?access=creator">Crear una Pill <ArrowRight /></a></div>
    </nav>

    <header className="how-hero">
      <div><span className="how-eyebrow">CÓMO FUNCIONA</span><h1>De una experiencia<br />a una Pill.</h1><p>Crea un recuerdo digital, compártelo con tu comunidad y permite que cada persona lo guarde en su propia colección.</p><a className="how-primary" href="/login?access=creator">Crear mi primera Pill <ArrowRight /></a></div>
      <div className="how-hero-art" aria-hidden="true"><Image src="/landing/pills-fans-hero-transparent.png" alt="" width={1024} height={1536} priority /></div>
    </header>

    <section className="how-steps" aria-labelledby="how-steps-title">
      <div className="how-section-heading"><span className="how-eyebrow">PASO A PASO</span><h2 id="how-steps-title">Crear una Pill es simple.</h2></div>
      <div className="how-step-grid">{steps.map((step) => <article key={step.number}><small>{step.number}</small><span><step.icon /></span><h3>{step.title}</h3><p>{step.description}</p></article>)}</div>
    </section>

    <section className="how-paths">
      <article className="how-path how-path-dark"><span><Users /></span><small>PARA CREADORES</small><h2>Convierte una experiencia en comunidad.</h2><ul><li><Check />Crea y administra tus Pills.</li><li><Check />Comparte por enlace, QR o frase secreta.</li><li><Check />Conoce cuántas personas las coleccionaron.</li></ul><a href="/login?access=creator">Comenzar a crear <ArrowRight /></a></article>
      <article className="how-path"><span><FolderHeart /></span><small>PARA COLECCIONISTAS</small><h2>Guarda lo que viviste.</h2><ul><li><Check />Colecciona Pills públicas o privadas.</li><li><Check />Organiza tus recuerdos en un solo lugar.</li><li><Check />Gestiona tu perfil y tu colección.</li></ul><a href="/collection">Ver mi colección <ArrowRight /></a></article>
    </section>

    <section className="how-privacy">
      <div><span><LockKeyhole /></span><h2>Tu colección también protege tu privacidad.</h2></div>
      <p>En Explorar se puede ver quién creó una Pill, cuándo fue creada y cuántas personas la coleccionaron. Solo quienes poseen esa Pill pueden ver a los demás coleccionistas.</p>
    </section>

    <section className="how-distribution">
      <div><span className="how-eyebrow">TÚ ELIGES CÓMO COMPARTIRLA</span><h2>Una Pill para cada tipo de experiencia.</h2></div>
      <div className="how-distribution-grid"><article><Link2 /><h3>Enlace directo</h3><p>Ideal para compartir en redes, mensajes o una comunidad online.</p></article><article><QrCode /><h3>Código QR</h3><p>Perfecto para eventos y espacios físicos donde las personas están presentes.</p></article><article><LockKeyhole /><h3>Frase secreta</h3><p>Una capa opcional para experiencias que quieres compartir con un grupo específico.</p></article></div>
    </section>

    <section className="how-final"><PillsLogo inverse /><h2>Tu próxima experiencia puede convertirse en una Pill.</h2><a href="/login?access=creator">Crear una Pill <ArrowRight /></a></section>
  </main>;
}
