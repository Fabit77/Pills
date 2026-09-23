"use client";

import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  FolderHeart,
  Gauge,
  Menu,
  MoreHorizontal,
  ImagePlus,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type View = "overview" | "campaigns" | "collections" | "verification" | "profile";
type CreatorProfile = { username: string; firstName: string; lastName: string; bio: string };
type CampaignStatus = "Activa" | "Borrador" | "Programada";

type Campaign = {
  id: number;
  name: string;
  event: string;
  date: string;
  endDate?: string;
  distribution?: string[];
  status: CampaignStatus;
  claimed: number;
  total: number;
  color: string;
  accent: string;
  initials: string;
  imageUrl?: string;
};

const initialCampaigns: Campaign[] = [];

const navItems: { id: View; label: string; icon: typeof Gauge }[] = [
  { id: "overview", label: "Inicio", icon: Gauge },
  { id: "campaigns", label: "Coleccionables", icon: Zap },
  { id: "collections", label: "Colecciones", icon: FolderHeart },
  { id: "verification", label: "Verificación", icon: ShieldCheck },
  { id: "profile", label: "Mi perfil", icon: Users },
];

const formatNumber = (value: number) => new Intl.NumberFormat("es-CL").format(value);

function PillArtwork({ campaign, large = false }: { campaign: Campaign; large?: boolean }) {
  return (
    <div className={`pill-art ${large ? "pill-art-large" : ""} ${campaign.imageUrl ? "pill-art-uploaded" : ""}`} style={{ "--pill": campaign.color, "--pill-soft": campaign.accent } as React.CSSProperties}>
      {campaign.imageUrl && <span className="pill-uploaded-art" style={{ backgroundImage: `url(${campaign.imageUrl})` }} />}
      <div className="pill-cut pill-cut-top" />
      <div className="pill-cut pill-cut-bottom" />
      <span className="pill-year">PILLS® / {campaign.date.slice(-4)}</span>
      <div className="pill-core"><Sparkles size={large ? 25 : 18} /><strong>{campaign.initials}</strong></div>
      <span className="pill-caption">{campaign.event.split(" · ")[0]}</span>
    </div>
  );
}

export default function CreatorStudio() {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showCreate, setShowCreate] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [profile, setProfile] = useState<CreatorProfile | null>(null);

  const filtered = useMemo(() => campaigns.filter((campaign) => `${campaign.name} ${campaign.event}`.toLowerCase().includes(search.toLowerCase())), [campaigns, search]);

  useEffect(() => {
    fetch("/api/profile/me").then(async (response) => {
      if (response.status === 401) { router.replace("/login"); return null; }
      const data = await response.json();
      if (!data.username) { router.replace("/onboarding"); return null; }
      setProfile(data);
    }).catch(() => setToast("No pudimos cargar tu perfil"));
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: "list_creator_campaigns",
        title: "List creator campaigns",
        description: "Returns the campaigns currently visible in Pills Creator Studio.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: () => campaigns.map(({ name, event, status, claimed, total }) => ({ name, event, status, claimed, total })),
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: "start_campaign_creation",
        title: "Start campaign creation",
        description: "Opens the campaign creation form in Pills Creator Studio.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: () => { setShowCreate(true); return { status: "form_opened" }; },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [campaigns]);

  function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "Nueva experiencia");
    const eventType = String(data.get("type") || "Evento");
    const location = String(data.get("location") || "Por confirmar");
    const supply = Number(data.get("supply") || 1000);
    const dateValue = String(data.get("date") || "");
    const endDateValue = String(data.get("endDate") || "");
    const artwork = data.get("artwork");
    const imageUrl = artwork instanceof File && artwork.size ? URL.createObjectURL(artwork) : undefined;
    const date = dateValue ? new Date(`${dateValue}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "SIN FECHA";
    const endDate = endDateValue ? new Date(`${endDateValue}T23:59:59`).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : undefined;
    const distribution = [data.get("distributionQr") ? "QR" : "", data.get("distributionSecret") ? "Palabra secreta" : ""].filter(Boolean);
    const next: Campaign = { id: Date.now(), name, event: `${eventType} · ${location}`, date, endDate, distribution, status: "Borrador", claimed: 0, total: supply, color: "#1f6f78", accent: "#c6eff1", initials: name.split(" ").map((word) => word[0]).join("").slice(0, 3).toUpperCase(), imageUrl };
    setCampaigns((current) => [next, ...current]);
    setShowCreate(false);
    setView("campaigns");
    setToast("Coleccionable guardado como borrador");
  }

  const title = navItems.find((item) => item.id === view)?.label ?? "Inicio";

  return (
    <main className="app-shell">
      <aside className={`sidebar ${showMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><span /></span><strong>Pills</strong><em>Creator Studio</em></div>
        <button className="workspace-switch" onClick={() => setView("profile")}><span className="avatar avatar-orange">{profile?.username?.slice(0, 2).toUpperCase() || "…"}</span><span><strong>{profile?.username ? `@${profile.username}` : "Cargando perfil"}</strong><small>Cuenta personal</small></span><ChevronDown size={15} /></button>
        <nav>
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => <button key={item.id} className={view === item.id ? "nav-active" : ""} onClick={() => { setView(item.id); setShowMenu(false); }}><item.icon size={18} />{item.label}{item.id === "verification" && <span className="nav-dot" />}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button><CircleHelp size={18} />Centro de ayuda</button>
          <button onClick={() => setView("profile")}><Settings size={18} />Configuración del perfil</button>
          <div className="plan-card"><span>PLAN INICIAL</span><strong>{campaigns.length} coleccionables</strong><small>Tu espacio de creación</small><div><i style={{ width: "0%" }} /></div></div>
          <button className="user-row" onClick={async () => { await fetch("/auth/signout", { method: "POST" }); router.replace("/login"); router.refresh(); }}><span className="avatar">{profile?.username?.slice(0, 2).toUpperCase() || "…"}</span><span><strong>{profile ? (profile.firstName || `@${profile.username}`) : "Cargando"}</strong><small>Cerrar sesión</small></span><MoreHorizontal size={17} /></button>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setShowMenu((value) => !value)}>{showMenu ? <X /> : <Menu />}</button>
          <div><span className="eyebrow">Creator Studio</span><h1>{title}</h1></div>
          <div className="top-actions"><label className="global-search"><Search size={17} /><input aria-label="Buscar coleccionables" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" /></label><button className="icon-button" aria-label="Notificaciones"><Bell size={19} /></button><button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={18} />Nuevo coleccionable</button></div>
        </header>

        <div className="content">
          {view === "overview" && <Overview campaigns={campaigns} onCreate={() => setShowCreate(true)} onNavigate={setView} />}
          {view === "campaigns" && <Campaigns campaigns={filtered} onCreate={() => setShowCreate(true)} />}
          {view === "collections" && <Collections campaigns={campaigns} />}
          {view === "verification" && <Verification />}
          {view === "profile" && profile && <Profile profile={profile} onSaved={setProfile} />}
        </div>
      </section>

      {showCreate && <CreateCampaign onClose={() => setShowCreate(false)} onSubmit={createCampaign} />}
      {toast && <div className="toast"><span><Check size={16} /></span>{toast}</div>}
      {showMenu && <button className="scrim" aria-label="Cerrar menú" onClick={() => setShowMenu(false)} />}
    </main>
  );
}

function Overview({ campaigns, onCreate, onNavigate }: { campaigns: Campaign[]; onCreate: () => void; onNavigate: (view: View) => void }) {
  const active = campaigns.find((campaign) => campaign.status === "Activa") ?? campaigns[0];
  return <>
    <section className="welcome"><div><span className="section-kicker"><span /> TU ESPACIO DE CREACIÓN</span><h2>Convierte cada evento<br />en una colección.</h2><p>Diseña recuerdos digitales que tus fans van a querer guardar.</p></div><button className="primary-button primary-large" onClick={onCreate}>Crear coleccionable <ArrowRight size={19} /></button></section>
    <section className="metrics-grid">
      <article><div className="metric-icon"><TicketCheck /></div><span>Pills coleccionadas</span><strong>0</strong><small><em>Aún no hay actividad</em></small></article>
      <article><div className="metric-icon purple"><Users /></div><span>Coleccionistas únicos</span><strong>0</strong><small><em>Aún no hay actividad</em></small></article>
      <article><div className="metric-icon green"><Activity /></div><span>Tasa de colección</span><strong>0%</strong><small><em>Aún no hay actividad</em></small></article>
      <article><div className="metric-icon gold"><FolderHeart /></div><span>Coleccionables activos</span><strong>0</strong><small><em>de {campaigns.length} creados</em></small></article>
    </section>
    {active ? <section className="panel recent-panel"><div className="panel-head"><div><span className="eyebrow">Tus coleccionables</span><h3>Actividad reciente</h3></div><button className="ghost-button" onClick={() => onNavigate("campaigns")}>Ver todos <ArrowRight size={15} /></button></div><CampaignTable campaigns={campaigns.slice(0, 3)} /></section> : <section className="panel empty-state"><Sparkles /><h3>Crea tu primer coleccionable</h3><p>Define la experiencia, diseña su Pill y decide quién podrá coleccionarla.</p><button className="primary-button" onClick={onCreate}>Crear coleccionable <ArrowRight size={17} /></button></section>}
  </>;
}

function Campaigns({ campaigns, onCreate }: { campaigns: Campaign[]; onCreate: () => void }) {
  return <section><div className="page-intro"><div><span className="section-kicker"><span /> COLECCIONABLES</span><h2>Crea experiencias<br />que continúan.</h2><p>Cada coleccionable guarda un evento y conecta a las personas que lo vivieron.</p></div><button className="primary-button primary-large" onClick={onCreate}><Plus size={18} />Crear coleccionable</button></div><div className="filter-row"><button className="filter-active">Todos <span>{campaigns.length}</span></button><button>Activos</button><button>Programados</button><button>Borradores</button></div>{campaigns.length ? <div className="campaign-card-grid">{campaigns.map((campaign) => <article className="campaign-card" key={campaign.id}><div className="campaign-art-wrap"><PillArtwork campaign={campaign} /><span className={`status ${campaign.status.toLowerCase()}`}><i />{campaign.status}</span></div><div className="campaign-card-copy"><span>{campaign.event}</span><h3>{campaign.name}</h3><small><CalendarDays size={14} />{campaign.date}{campaign.endDate ? ` — ${campaign.endDate}` : ""}</small>{campaign.distribution?.length ? <small>Distribución: {campaign.distribution.join(" + ")}</small> : null}<div><span><strong>{formatNumber(campaign.claimed)}</strong> coleccionadas</span><span><strong>{campaign.total ? Math.round((campaign.claimed / campaign.total) * 100) : 0}%</strong> conversión</span></div><button>Gestionar coleccionable <ArrowRight size={16} /></button></div></article>)}</div> : <div className="empty-state"><Sparkles /><h3>Aún no tienes coleccionables</h3><p>Crea el primero para comenzar tu historia.</p><button className="primary-button" onClick={onCreate}>Crear coleccionable</button></div>}</section>;
}

function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  return <div className="campaign-table">{campaigns.map((campaign) => <div className="campaign-row" key={campaign.id}><PillArtwork campaign={campaign} /><div className="campaign-name"><strong>{campaign.name}</strong><span>{campaign.event}</span></div><div className="table-stat"><span>Estado</span><strong className={`status ${campaign.status.toLowerCase()}`}><i />{campaign.status}</strong></div><div className="table-stat"><span>Coleccionadas</span><strong>{formatNumber(campaign.claimed)} <small>/ {formatNumber(campaign.total)}</small></strong></div><div className="mini-progress"><i style={{ width: `${(campaign.claimed / campaign.total) * 100}%` }} /></div><button className="icon-button"><MoreHorizontal size={18} /></button></div>)}</div>;
}

function Collections({ campaigns }: { campaigns: Campaign[] }) {
  return <section><div className="page-intro"><div><span className="section-kicker"><span /> COLECCIONES</span><h2>Una historia puede tener<br />muchas Pills.</h2><p>Agrupa tus coleccionables en listas que tengan sentido para ti y tu comunidad.</p></div><button className="primary-button primary-large"><Plus size={18} />Nueva colección</button></div>{campaigns.length ? <div className="collection-grid"><article className="new-collection"><span><Plus /></span><h3>Crea una nueva colección</h3><p>Reúne tus coleccionables bajo una misma historia.</p><button>Comenzar</button></article></div> : <div className="empty-state"><FolderHeart /><h3>Aún no tienes colecciones</h3><p>Primero crea un coleccionable; después podrás agruparlo con otros.</p></div>}</section>;
}

function Verification() {
  return <section><div className="page-intro"><div><span className="section-kicker"><span /> CONFIANZA</span><h2>Tu identidad,<br />reconocida.</h2><p>Más adelante podrás solicitar verificación como creador, marca, artista o equipo.</p></div></div><div className="verification-grid"><article className="panel verify-card"><div className="verify-hero"><span className="avatar avatar-orange">P</span></div><span className="status"><i />Sin verificar</span><h3>Cuenta personal</h3><p>No has solicitado verificación ni creado una organización.</p></article><article className="panel verify-info"><span className="eyebrow">PRÓXIMAMENTE</span><h3>Verificación para creadores y organizaciones</h3><div><span><BadgeCheck /></span><p><strong>Creador verificado</strong>Permitirá reconocer la identidad pública detrás de una cuenta.</p></div><div><span><TicketCheck /></span><p><strong>Experiencia oficial</strong>Identificará coleccionables vinculados oficialmente a un evento.</p></div></article></div></section>;
}

function Profile({ profile, onSaved }: { profile: CreatorProfile; onSaved: (profile: CreatorProfile) => void }) {
  const [form, setForm] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const response = await fetch("/api/profile/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.username, firstName: form.firstName, lastName: form.lastName, bio: form.bio }) });
    const result = await response.json();
    if (response.ok) { onSaved(form); setMessage("Perfil actualizado"); } else setMessage(result.error || "No pudimos guardar tu perfil");
    setSaving(false);
  }
  return <section><div className="page-intro"><div><span className="section-kicker"><span /> MI PERFIL</span><h2>Así te verá<br />la comunidad.</h2><p>Tu correo permanece privado. Solo se muestran los datos que agregues aquí.</p></div></div><form className="panel profile-form" onSubmit={save}><label htmlFor="profile-username">Nombre de usuario <strong>Obligatorio</strong></label><div className="username-field"><span>@</span><input id="profile-username" required minLength={3} maxLength={24} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") })} /></div><div className="optional-label"><span>Información personal</span><em>Opcional</em></div><div className="profile-grid"><label><span>Nombre</span><div><input value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></div></label><label><span>Apellido</span><div><input value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></div></label></div><label className="bio-label">Descripción breve</label><textarea maxLength={180} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />{message && <p>{message}</p>}<button className="primary-button onboarding-submit" disabled={saving}>{saving ? "Guardando…" : "Guardar perfil"}</button></form></section>;
}

function CreateCampaign({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [preview, setPreview] = useState("");
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function selectArtwork(file?: File) {
    if (preview) URL.revokeObjectURL(preview);
    setError(""); setPreview("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("La imagen debe pesar menos de 5 MB."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const square = bitmap.width === bitmap.height;
      bitmap.close();
      if (!square) { setError("El arte debe ser cuadrado, con proporción 1:1."); return; }
    } catch { setError("No pudimos leer esta imagen. Prueba con otro archivo."); return; }
    setPreview(URL.createObjectURL(file));
  }
  function goNext() {
    const data = new FormData(formRef.current!); setError("");
    if (step === 1 && (!preview || !String(data.get("name") || "").trim() || !String(data.get("description") || "").trim() || !data.get("date") || !data.get("endDate"))) { setError("Agrega el arte, nombre, descripción y ambas fechas para continuar."); return; }
    if (step === 1 && String(data.get("endDate")) < String(data.get("date"))) { setError("La fecha de término debe ser posterior a la fecha de inicio."); return; }
    setStep((current) => Math.min(4, current + 1));
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    if (!preview) { event.preventDefault(); setStep(1); setError("Carga el arte del coleccionable para continuar."); return; }
    const data = new FormData(event.currentTarget);
    const qr = data.get("distributionQr"); const secret = data.get("distributionSecret");
    if (!qr && !secret) { event.preventDefault(); setError("Selecciona QR, palabra secreta o ambos métodos."); return; }
    if (secret && !String(data.get("secretWord") || "").trim()) { event.preventDefault(); setError("Escribe la palabra secreta para continuar."); return; }
    onSubmit(event);
  }
  const steps = [{ title: "Detalles", note: "Arte, nombre y contexto" }, { title: "Propiedades", note: "Información adicional" }, { title: "Emisión", note: "Cantidad y acceso" }, { title: "Distribución", note: "Dónde se colecciona" }];
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal collectible-modal wizard-modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><aside className="wizard-sidebar"><span className="eyebrow">NUEVO COLECCIONABLE</span><h3>Borrador</h3><p>Completa cada paso para preparar tu Pill.</p><nav>{steps.map((item, index) => <button type="button" key={item.title} className={`${step === index + 1 ? "active" : ""} ${step > index + 1 ? "complete" : ""}`} onClick={() => setStep(index + 1)}><i>{step > index + 1 ? <Check /> : index + 1}</i><span><strong>{item.title}</strong><small>{item.note}</small></span></button>)}</nav></aside><form ref={formRef} className="wizard-main" onSubmit={submit}><div className="modal-head"><div><span className="section-kicker"><span /> PASO {step} DE 4</span><h2 id="create-title">{steps[step - 1].title}</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></div><div className={`wizard-panel ${step === 1 ? "active" : ""}`}><div className="collectible-form"><div className="artwork-column"><span className="field-title">Arte del coleccionable *</span><label className={`artwork-uploader ${preview ? "has-artwork" : ""}`}><input name="artwork" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void selectArtwork(event.target.files?.[0])} />{preview ? <span className="artwork-preview" style={{ backgroundImage: `url(${preview})` }} /> : <><span className="upload-icon"><ImagePlus /></span><strong>Cargar insignia</strong><small>Cuadrada, proporción 1:1</small><small>Máximo 5 MB</small></>}</label><p>PNG, JPG, WEBP o GIF. Recomendado: 500 × 500 px y menos de 200 KB.</p></div><div className="collectible-fields"><label><span>Nombre del coleccionable *</span><input name="name" maxLength={150} placeholder="Ej. Una noche en el Nacional" autoFocus /></label><label><span>Descripción *</span><textarea name="description" maxLength={1500} placeholder="¿Qué hace especial a esta experiencia?" /></label><div className="form-grid"><label><span>Fecha de inicio *</span><input name="date" type="date" /></label><label><span>Fecha de término *</span><input name="endDate" type="date" /></label></div><label><span>URL del evento</span><input name="eventUrl" type="url" placeholder="https://" /></label></div></div></div><div className={`wizard-panel ${step === 2 ? "active" : ""}`}><div className="wizard-fields"><label><span>Tipo de evento</span><select name="type" defaultValue="Concierto"><option>Concierto</option><option>Fútbol</option><option>Festival</option><option>Cultura</option><option>Marca</option><option>Comunidad</option></select></label><label><span>Lugar</span><input name="location" placeholder="Ej. Estadio Nacional, Santiago" /></label><label><span>Etiquetas</span><input name="tags" placeholder="música, santiago, comunidad" /></label><div className="form-note"><Sparkles /><p><strong>Este paso es opcional.</strong> Agrega contexto para que las personas encuentren y entiendan mejor el coleccionable.</p></div></div></div><div className={`wizard-panel ${step === 3 ? "active" : ""}`}><div className="wizard-fields"><label><span>Cantidad disponible</span><input name="supply" type="number" min="1" defaultValue="5000" /></label><label><span>Quién puede coleccionarla</span><select name="audience" defaultValue="Asistentes"><option>Asistentes</option><option>Cualquier persona</option><option>Solo invitados</option></select></label><label><span>Estado inicial</span><select name="status" defaultValue="Borrador"><option>Borrador</option><option>Programado</option></select></label><div className="form-note"><ShieldCheck /><p><strong>Primero guardaremos un borrador.</strong> Nada se publica hasta que revises la configuración final.</p></div></div></div><div className={`wizard-panel ${step === 4 ? "active" : ""}`}><div className="wizard-fields"><span className="field-title">Métodos públicos *</span><div className="distribution-options"><label><input type="checkbox" name="distributionQr" defaultChecked /><span><strong>Código QR</strong><small>Ideal para mostrar en el recinto o material del evento.</small></span></label><label><input type="checkbox" name="distributionSecret" /><span><strong>Palabra secreta</strong><small>Los asistentes escriben una palabra para coleccionar.</small></span></label></div><label><span>Palabra secreta</span><input name="secretWord" maxLength={60} placeholder="Ej. PILLS2026" /></label><div className="expiration-rule"><CalendarDays /><p><strong>Vigencia automática</strong>El QR y la palabra secreta funcionarán desde la fecha de inicio hasta la fecha de término. Después quedarán bloqueados.</p></div><div className="admin-link-rule"><ShieldCheck /><p><strong>Enlaces individuales de administrador</strong>Después de crear el coleccionable podrás generar enlaces únicos, uno por persona. No vencen y cada uno puede utilizarse una sola vez.</p></div></div></div>{error && <p className="wizard-error">{error}</p>}<div className="modal-actions wizard-actions"><button type="button" className="secondary-button" onClick={step === 1 ? onClose : () => { setError(""); setStep((current) => current - 1); }}>{step === 1 ? "Cancelar" : "Atrás"}</button>{step < 4 ? <button className="primary-button" type="button" onClick={goNext}>Continuar <ArrowRight size={17} /></button> : <button className="primary-button" type="submit">Crear borrador <ArrowRight size={17} /></button>}</div></form></div></div>;
}
