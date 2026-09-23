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
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type View = "overview" | "campaigns" | "collections" | "verification" | "team";
type CampaignStatus = "Activa" | "Borrador" | "Programada";

type Campaign = {
  id: number;
  name: string;
  event: string;
  date: string;
  status: CampaignStatus;
  claimed: number;
  total: number;
  color: string;
  accent: string;
  initials: string;
};

const initialCampaigns: Campaign[] = [
  { id: 1, name: "Horizonte 2026", event: "Festival · Santiago", date: "18 OCT 2026", status: "Activa", claimed: 8624, total: 12000, color: "#f05a28", accent: "#ffd9c8", initials: "H26" },
  { id: 2, name: "La noche de Aurora", event: "Fútbol · Estadio Central", date: "02 NOV 2026", status: "Programada", claimed: 0, total: 24000, color: "#7857e8", accent: "#ddd3ff", initials: "AFC" },
  { id: 3, name: "Tendencias 2025", event: "Cultura · Madrid", date: "14 DIC 2025", status: "Activa", claimed: 3142, total: 5000, color: "#14796f", accent: "#bdeee5", initials: "T25" },
  { id: 4, name: "Sesión secreta #01", event: "Música · Valparaíso", date: "Sin fecha", status: "Borrador", claimed: 0, total: 800, color: "#cfaa2e", accent: "#fff0b7", initials: "SS1" },
];

const navItems: { id: View; label: string; icon: typeof Gauge }[] = [
  { id: "overview", label: "Inicio", icon: Gauge },
  { id: "campaigns", label: "Campañas", icon: Zap },
  { id: "collections", label: "Colecciones", icon: FolderHeart },
  { id: "verification", label: "Verificación", icon: ShieldCheck },
  { id: "team", label: "Equipo", icon: Users },
];

const formatNumber = (value: number) => new Intl.NumberFormat("es-CL").format(value);

function PillArtwork({ campaign, large = false }: { campaign: Campaign; large?: boolean }) {
  return (
    <div className={`pill-art ${large ? "pill-art-large" : ""}`} style={{ "--pill": campaign.color, "--pill-soft": campaign.accent } as React.CSSProperties}>
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

  const filtered = useMemo(() => campaigns.filter((campaign) => `${campaign.name} ${campaign.event}`.toLowerCase().includes(search.toLowerCase())), [campaigns, search]);

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
    const date = dateValue ? new Date(`${dateValue}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "SIN FECHA";
    const next: Campaign = { id: Date.now(), name, event: `${eventType} · ${location}`, date, status: "Borrador", claimed: 0, total: supply, color: "#1f6f78", accent: "#c6eff1", initials: name.split(" ").map((word) => word[0]).join("").slice(0, 3).toUpperCase() };
    setCampaigns((current) => [next, ...current]);
    setShowCreate(false);
    setView("campaigns");
    setToast("Campaña guardada como borrador");
  }

  const title = navItems.find((item) => item.id === view)?.label ?? "Inicio";

  return (
    <main className="app-shell">
      <aside className={`sidebar ${showMenu ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><span /></span><strong>Pills</strong><em>Creator Studio</em></div>
        <button className="workspace-switch"><span className="avatar avatar-orange">LN</span><span><strong>Luz Norte</strong><small>Organización verificada</small></span><ChevronDown size={15} /></button>
        <nav>
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => <button key={item.id} className={view === item.id ? "nav-active" : ""} onClick={() => { setView(item.id); setShowMenu(false); }}><item.icon size={18} />{item.label}{item.id === "verification" && <span className="nav-dot" />}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <button><CircleHelp size={18} />Centro de ayuda</button>
          <button><Settings size={18} />Configuración</button>
          <div className="plan-card"><span>PLAN PRO</span><strong>8.624 / 20.000</strong><small>Pills coleccionadas este mes</small><div><i style={{ width: "43%" }} /></div></div>
          <button className="user-row" onClick={async () => { await fetch("/auth/signout", { method: "POST" }); router.replace("/login"); router.refresh(); }}><span className="avatar">FM</span><span><strong>Felipe Morales</strong><small>Administrador · Cerrar sesión</small></span><MoreHorizontal size={17} /></button>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setShowMenu((value) => !value)}>{showMenu ? <X /> : <Menu />}</button>
          <div><span className="eyebrow">Creator Studio</span><h1>{title}</h1></div>
          <div className="top-actions"><label className="global-search"><Search size={17} /><input aria-label="Buscar campañas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" /></label><button className="icon-button" aria-label="Notificaciones"><Bell size={19} /><span /></button><button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={18} />Nueva campaña</button></div>
        </header>

        <div className="content">
          {view === "overview" && <Overview campaigns={campaigns} onCreate={() => setShowCreate(true)} onNavigate={setView} />}
          {view === "campaigns" && <Campaigns campaigns={filtered} onCreate={() => setShowCreate(true)} />}
          {view === "collections" && <Collections campaigns={campaigns} />}
          {view === "verification" && <Verification />}
          {view === "team" && <Team />}
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
    <section className="welcome"><div><span className="section-kicker"><span /> TU ESPACIO DE CREACIÓN</span><h2>Convierte cada evento<br />en una colección.</h2><p>Diseña, publica y mide experiencias digitales que tus fans van a querer guardar.</p></div><button className="primary-button primary-large" onClick={onCreate}>Crear una campaña <ArrowRight size={19} /></button></section>
    <section className="metrics-grid">
      <article><div className="metric-icon"><TicketCheck /></div><span>Pills coleccionadas</span><strong>11.766</strong><small className="positive">↗ 18,4% <em>vs. mes anterior</em></small></article>
      <article><div className="metric-icon purple"><Users /></div><span>Coleccionistas únicos</span><strong>9.284</strong><small className="positive">↗ 12,1% <em>vs. mes anterior</em></small></article>
      <article><div className="metric-icon green"><Activity /></div><span>Tasa de colección</span><strong>72,4%</strong><small className="positive">↗ 4,8% <em>vs. mes anterior</em></small></article>
      <article><div className="metric-icon gold"><FolderHeart /></div><span>Campañas activas</span><strong>2</strong><small><em>de {campaigns.length} campañas</em></small></article>
    </section>
    <section className="dashboard-grid">
      <article className="panel performance-panel"><div className="panel-head"><div><span className="eyebrow">Últimos 30 días</span><h3>Actividad de colecciones</h3></div><button className="ghost-button">Ver reporte <ArrowRight size={15} /></button></div><div className="chart-wrap"><div className="chart-y"><span>800</span><span>600</span><span>400</span><span>200</span><span>0</span></div><div className="chart"><i /><i /><i /><i /><svg viewBox="0 0 700 200" preserveAspectRatio="none" aria-label="Gráfico de actividad"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ef5b2a" stopOpacity=".22"/><stop offset="1" stopColor="#ef5b2a" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 168 C52 157 65 142 105 148 S164 120 206 134 S267 113 310 119 S366 92 405 103 S465 88 504 98 S558 55 600 70 S652 39 700 22 L700 200 L0 200 Z"/><path className="line" d="M0 168 C52 157 65 142 105 148 S164 120 206 134 S267 113 310 119 S366 92 405 103 S465 88 504 98 S558 55 600 70 S652 39 700 22"/><circle cx="700" cy="22" r="5" /></svg><div className="chart-x"><span>25 Ago</span><span>1 Sep</span><span>8 Sep</span><span>15 Sep</span><span>22 Sep</span></div></div></div></article>
      <article className="panel spotlight"><div className="panel-head"><div><span className="eyebrow">Campaña destacada</span><h3>{active.name}</h3></div><span className="status active"><i />En vivo</span></div><div className="spotlight-body"><PillArtwork campaign={active} large /><div className="spotlight-stats"><span>Progreso de colección</span><strong>{formatNumber(active.claimed)} <small>/ {formatNumber(active.total)}</small></strong><div className="progress"><i style={{ width: `${(active.claimed / active.total) * 100}%` }} /></div><div><span><strong>{Math.round((active.claimed / active.total) * 100)}%</strong><small>coleccionadas</small></span><span><strong>38%</strong><small>compartidas</small></span></div><button onClick={() => onNavigate("campaigns")}>Gestionar campaña <ArrowRight size={16} /></button></div></div></article>
    </section>
    <section className="panel recent-panel"><div className="panel-head"><div><span className="eyebrow">Tus campañas</span><h3>Actividad reciente</h3></div><button className="ghost-button" onClick={() => onNavigate("campaigns")}>Ver todas <ArrowRight size={15} /></button></div><CampaignTable campaigns={campaigns.slice(0, 3)} /></section>
  </>;
}

function Campaigns({ campaigns, onCreate }: { campaigns: Campaign[]; onCreate: () => void }) {
  return <section><div className="page-intro"><div><span className="section-kicker"><span /> CAMPAÑAS</span><h2>Crea experiencias<br />que continúan.</h2><p>Cada campaña reúne un evento, su colección y las personas que lo vivieron.</p></div><button className="primary-button primary-large" onClick={onCreate}><Plus size={18} />Crear campaña</button></div><div className="filter-row"><button className="filter-active">Todas <span>{campaigns.length}</span></button><button>Activas</button><button>Programadas</button><button>Borradores</button></div>{campaigns.length ? <div className="campaign-card-grid">{campaigns.map((campaign) => <article className="campaign-card" key={campaign.id}><div className="campaign-art-wrap"><PillArtwork campaign={campaign} /><span className={`status ${campaign.status.toLowerCase()}`}><i />{campaign.status}</span></div><div className="campaign-card-copy"><span>{campaign.event}</span><h3>{campaign.name}</h3><small><CalendarDays size={14} />{campaign.date}</small><div><span><strong>{formatNumber(campaign.claimed)}</strong> coleccionadas</span><span><strong>{campaign.total ? Math.round((campaign.claimed / campaign.total) * 100) : 0}%</strong> conversión</span></div><button>Gestionar campaña <ArrowRight size={16} /></button></div></article>)}</div> : <div className="empty-state"><Search /><h3>No encontramos campañas</h3><p>Prueba con otro término de búsqueda.</p></div>}</section>;
}

function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  return <div className="campaign-table">{campaigns.map((campaign) => <div className="campaign-row" key={campaign.id}><PillArtwork campaign={campaign} /><div className="campaign-name"><strong>{campaign.name}</strong><span>{campaign.event}</span></div><div className="table-stat"><span>Estado</span><strong className={`status ${campaign.status.toLowerCase()}`}><i />{campaign.status}</strong></div><div className="table-stat"><span>Coleccionadas</span><strong>{formatNumber(campaign.claimed)} <small>/ {formatNumber(campaign.total)}</small></strong></div><div className="mini-progress"><i style={{ width: `${(campaign.claimed / campaign.total) * 100}%` }} /></div><button className="icon-button"><MoreHorizontal size={18} /></button></div>)}</div>;
}

function Collections({ campaigns }: { campaigns: Campaign[] }) {
  return <section><div className="page-intro"><div><span className="section-kicker"><span /> COLECCIONES</span><h2>Una historia puede tener<br />muchas Pills.</h2><p>Agrupa campañas, suma colaboradores y construye una identidad que crece con cada evento.</p></div><button className="primary-button primary-large"><Plus size={18} />Nueva colección</button></div><div className="collection-grid"><article className="collection-feature"><div className="stacked-pills">{campaigns.slice(0,3).map((campaign, index) => <div key={campaign.id} style={{ transform: `translate(${index * 54}px, ${index * 8}px) rotate(${(index - 1) * 7}deg)`, zIndex: index }}><PillArtwork campaign={campaign} /></div>)}</div><div><span className="eyebrow">COLECCIÓN COLABORATIVA</span><h3>Tendencias 2025</h3><p>Diseño, cultura y experiencias que definieron el año.</p><div className="creator-line"><span className="avatar avatar-orange">N</span><span className="avatar avatar-dark">G</span><span>Creada por <strong>Nike <BadgeCheck size={14} /></strong> y <strong>Guillermo del Toro <BadgeCheck size={14} /></strong></span></div><button>Ver colección <ArrowRight size={16} /></button></div></article><article className="new-collection"><span><Plus /></span><h3>Crea una nueva colección</h3><p>Reúne tus campañas bajo una misma historia e invita a otros creadores.</p><button>Comenzar</button></article></div></section>;
}

function Verification() {
  return <section><div className="page-intro"><div><span className="section-kicker"><span /> CONFIANZA</span><h2>Tu identidad,<br />reconocida.</h2><p>La verificación ayuda a tus fans a identificar experiencias oficiales y colaboradores auténticos.</p></div></div><div className="verification-grid"><article className="panel verify-card"><div className="verify-hero"><span className="avatar avatar-orange">LN</span><BadgeCheck /></div><span className="status active"><i />Verificación activa</span><h3>Luz Norte</h3><p>Tu organización cumple con los estándares de autenticidad de Pills.</p><ul><li><Check />Identidad de la organización</li><li><Check />Dominio y presencia pública</li><li><Check />Representante autorizado</li></ul></article><article className="panel verify-info"><span className="eyebrow">SEÑALES DE CONFIANZA</span><h3>Tres capas, un contexto claro</h3><div><span><BadgeCheck /></span><p><strong>Creador verificado</strong>La identidad detrás de la cuenta fue validada.</p></div><div><span><TicketCheck /></span><p><strong>Experiencia oficial</strong>La Pill está vinculada oficialmente al evento.</p></div><div><span><Sparkles /></span><p><strong>Selección Pills</strong>Una colección destacada por su relevancia creativa.</p></div></article></div></section>;
}

function Team() {
  const members = [{ name: "Felipe Morales", email: "felipe@luznorte.cl", role: "Administrador", initials: "FM" }, { name: "Sofía Rojas", email: "sofia@luznorte.cl", role: "Editora", initials: "SR" }, { name: "Tomás Silva", email: "tomas@luznorte.cl", role: "Analista", initials: "TS" }];
  return <section><div className="page-intro"><div><span className="section-kicker"><span /> ORGANIZACIÓN</span><h2>Crear juntos<br />se siente mejor.</h2><p>Invita a tu equipo y define quién puede crear, publicar o revisar resultados.</p></div><button className="primary-button primary-large"><Plus size={18} />Invitar persona</button></div><article className="panel team-panel"><div className="panel-head"><div><span className="eyebrow">Luz Norte</span><h3>3 miembros</h3></div></div>{members.map((member, index) => <div className="member-row" key={member.email}><span className={`avatar ${index === 0 ? "avatar-orange" : ""}`}>{member.initials}</span><div><strong>{member.name}{index === 0 && <BadgeCheck size={14} />}</strong><span>{member.email}</span></div><label>{member.role}<ChevronDown size={14} /></label><button className="icon-button"><MoreHorizontal size={18} /></button></div>)}</article></section>;
}

function CreateCampaign({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="modal-head"><div><span className="section-kicker"><span /> NUEVA CAMPAÑA</span><h2 id="create-title">¿Qué experiencia<br />vamos a guardar?</h2></div><button className="icon-button" onClick={onClose}><X /></button></div><form onSubmit={onSubmit}><label><span>Nombre de la experiencia</span><input name="name" required placeholder="Ej. Una noche en el Nacional" autoFocus /></label><div className="form-grid"><label><span>Tipo de evento</span><select name="type" defaultValue="Concierto"><option>Concierto</option><option>Fútbol</option><option>Festival</option><option>Cultura</option><option>Marca</option><option>Comunidad</option></select></label><label><span>Fecha</span><input name="date" type="date" /></label></div><label><span>Lugar</span><input name="location" placeholder="Ej. Estadio Nacional, Santiago" /></label><div className="form-grid"><label><span>Cantidad disponible</span><input name="supply" type="number" min="1" defaultValue="5000" /></label><label><span>Quién puede coleccionarla</span><select defaultValue="Asistentes"><option>Asistentes</option><option>Cualquier persona</option><option>Solo invitados</option></select></label></div><div className="form-note"><ShieldCheck /><p><strong>Primero crearemos el borrador.</strong> Podrás diseñar la Pill, sumar colaboradores y definir cómo se colecciona antes de publicarla.</p></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit">Crear borrador <ArrowRight size={17} /></button></div></form></div></div>;
}
