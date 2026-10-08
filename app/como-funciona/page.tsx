import type { Metadata } from "next";
import { ArrowRight, Check, FolderHeart, ImagePlus, LogIn, MapPin, QrCode, Send, TicketCheck } from "lucide-react";
import { PillsLogo } from "@/components/pills-logo";

const fansHomeUrl = process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://fans.pills.social";

export const metadata: Metadata = {
  title: "Cómo crear una Pill — Pills",
  description: "Guía paso a paso para crear, enviar y publicar tu primera Pill.",
};

const steps = [
  { number: "01", icon: LogIn, title: "Entra a tu cuenta", intro: <>Presiona <strong>Crear una Pill</strong> e inicia sesión con Google o con tu correo.</>, items: ["Si ya tienes una sesión activa, entrarás directamente al Creator Studio.", "Si es tu primera vez, completa tu nombre de usuario."] },
  { number: "02", icon: ImagePlus, title: "Completa Detalles", intro: <>En el Creator Studio, selecciona <strong>Nueva Pill</strong> y completa la primera etapa.</>, items: ["Sube una imagen PNG, JPG, WEBP o GIF de hasta 4 MB.", "Escribe el nombre y la descripción.", "Indica fecha y hora de inicio; el término es opcional."] },
  { number: "03", icon: MapPin, title: "Agrega Propiedades", intro: <>Indica dónde ocurrió la experiencia y, si corresponde, quién participó.</>, items: ["Selecciona una ciudad; este campo es obligatorio.", "Artistas, organizaciones y sitio web son opcionales.", "Los créditos no entregan permisos de administración."] },
  { number: "04", icon: TicketCheck, title: "Define la Emisión", intro: <>Elige cuántas personas podrán coleccionar esta Pill.</>, items: ["Puedes crear entre 1 y 100 unidades.", "El arte, las fechas y la emisión quedan fijos al enviar.", "El título y la descripción se bloquean después de la primera colección."] },
  { number: "05", icon: QrCode, title: "Configura la Distribución", intro: <>Elige cómo podrán acceder las personas a la Pill.</>, items: ["Mantén activo el código QR o agrega una frase secreta.", "La frase secreta es opcional; no la necesitas para publicar.", "Crea un enlace usando exactamente tres palabras separadas por guiones."] },
  { number: "06", icon: Send, title: "Guarda o envía", intro: <>Revisa la información y elige qué hacer con tu Pill.</>, items: ["Guardar borrador: podrás continuar editándola después.", "Enviar a Curaduría: quedará pendiente de revisión.", "Cuando sea aprobada, podrás compartir el enlace y descargar el QR."] },
];

export default function HowItWorksPage() {
  return <main className="guide-page">
    <nav className="how-nav"><a className="landing-brand" href="/login"><PillsLogo /></a><div><a href={`${fansHomeUrl}/explore`}>Explorar</a><a href="/collection">Ver colección</a><a className="how-nav-cta" href="/login?access=creator">Crear una Pill <ArrowRight /></a></div></nav>
    <header className="guide-hero"><span>GUÍA PASO A PASO</span><h1>Cómo crear tu<br />primera Pill.</h1><p>Sigue estos pasos en orden. Puedes guardar un borrador en cualquier momento antes de enviarlo a Curaduría.</p><a href="/login?access=creator">Abrir Creator Studio <ArrowRight /></a></header>
    <section className="guide-steps" aria-label="Pasos para crear una Pill">{steps.map((step) => <article key={step.number}><div className="guide-step-number">{step.number}</div><div className="guide-step-icon"><step.icon /></div><div className="guide-step-copy"><h2>{step.title}</h2><p>{step.intro}</p><ul>{step.items.map((item) => <li key={item}><Check />{item}</li>)}</ul></div></article>)}</section>
    <section className="guide-result"><div><span>DESPUÉS DE LA APROBACIÓN</span><h2>Tu Pill queda lista para coleccionar.</h2></div><ol><li><b>1</b><span><strong>Comparte</strong>Envía el enlace o muestra el código QR.</span></li><li><b>2</b><span><strong>Colecciona</strong>La persona inicia sesión y agrega la Pill a su colección.</span></li><li><b>3</b><span><strong>Gestiona</strong>Revisa cuántas personas la coleccionaron desde Creator Studio.</span></li></ol></section>
    <section className="guide-note"><QrCode /><div><strong>Importante</strong><p>El enlace y el QR se habilitan en la fecha y hora de inicio y dejan de aceptar nuevas colecciones al terminar la experiencia. Si no agregaste fecha de término, seguirá disponible.</p></div></section>
    <footer className="guide-footer"><PillsLogo className="guide-footer-logo" /><span>¿Listo para comenzar?</span><div><a href="/collection"><FolderHeart />Ver colección</a><a href="/login?access=creator">Crear una Pill <ArrowRight /></a></div></footer>
  </main>;
}
