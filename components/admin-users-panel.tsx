"use client";

import { Ban, CalendarDays, Check, Crown, Mail, PauseCircle, Play, Search, ShieldCheck, Sparkles, Trash2, UserCog, Users, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type AdminUser = {
  id: string; email: string; username: string; fullName: string; firstName: string; lastName: string; bio: string; avatarUrl: string;
  status: "active" | "paused" | "blocked"; moderationReason: string; moderatedAt: string | null; role: "super_admin" | "admin" | "curator" | null;
  createdAt: string; lastSignInAt: string | null; emailConfirmedAt: string | null; campaignCount: number; claimCount: number; providers: string[]; isCurrentUser: boolean;
};

const date = (value: string | null) => value ? new Date(value).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }) : "Sin registro";
const statusText = (status: AdminUser["status"]) => status === "active" ? "Activo" : status === "paused" ? "Pausado" : "Bloqueado";

export function AdminUsersPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | AdminUser["status"] | "admins">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setUsers(result.users);
      setSelected((current) => current ? result.users.find((item: AdminUser) => item.id === current.id) ?? null : null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos cargar las cuentas."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/users", { cache: "no-store" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (active) setUsers(result.users);
    }).catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "No pudimos cargar las cuentas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => users.filter((user) => {
    const matches = `${user.email} ${user.username} ${user.fullName}`.toLowerCase().includes(query.trim().toLowerCase());
    const inFilter = filter === "all" || filter === "admins" ? filter === "all" || Boolean(user.role) : user.status === filter;
    return matches && inFilter;
  }), [filter, query, users]);

  async function act(action: "pause" | "resume" | "block" | "unblock" | "make_admin" | "remove_admin") {
    if (!selected) return;
    setSaving(true); setMessage("");
    const response = await fetch(`/api/admin/users/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setMessage(result.error); return; }
    setReason(""); await load();
  }

  async function remove() {
    if (!selected || !window.confirm(`¿Eliminar definitivamente la cuenta ${selected.email}? Se borrarán su perfil, sus Pills y sus registros asociados.`)) return;
    setSaving(true); setMessage("");
    const response = await fetch(`/api/admin/users/${selected.id}`, { method: "DELETE" });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(result.error); return; }
    setSelected(null); await load();
  }

  const counts = { active: users.filter((item) => item.status === "active").length, paused: users.filter((item) => item.status === "paused").length, blocked: users.filter((item) => item.status === "blocked").length };
  return <section><div className="page-intro"><div><span className="section-kicker"><span /> ADMINISTRACIÓN</span><h2>Personas y<br />cuentas.</h2><p>Busca perfiles, revisa su actividad y aplica permisos o medidas de moderación.</p></div></div>
    <div className="user-admin-summary"><article><Users /><div><strong>{loading ? "—" : users.length}</strong><span>Cuentas</span></div></article><article><Check /><div><strong>{loading ? "—" : counts.active}</strong><span>Activas</span></div></article><article><PauseCircle /><div><strong>{loading ? "—" : counts.paused}</strong><span>Pausadas</span></div></article><article><Ban /><div><strong>{loading ? "—" : counts.blocked}</strong><span>Bloqueadas</span></div></article></div>
    <div className="user-admin-toolbar"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por @usuario, nombre o correo" /></label><div>{(["all", "active", "paused", "blocked", "admins"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Todos" : item === "active" ? "Activos" : item === "paused" ? "Pausados" : item === "blocked" ? "Bloqueados" : "Administradores"}</button>)}</div></div>
    {message && <p className="form-error user-admin-message">{message}</p>}
    <div className="user-admin-list">{visible.map((user) => <button key={user.id} onClick={() => { setSelected(user); setReason(user.moderationReason); setMessage(""); }}><span className="user-admin-avatar">{(user.username || user.email).slice(0, 2).toUpperCase()}</span><span className="user-admin-identity"><strong>{user.username ? `@${user.username}` : user.fullName || "Perfil sin configurar"}</strong><small>{user.email}</small></span><span className="user-admin-activity"><b>{user.campaignCount}</b><small>Pills</small></span><span className="user-admin-activity"><b>{user.claimCount}</b><small>Coleccionadas</small></span>{user.role && <span className={`admin-role-badge ${user.role}`}>{user.role === "super_admin" ? <Crown /> : <ShieldCheck />}{user.role === "super_admin" ? "Super Admin" : user.role === "admin" ? "Admin" : "Curador"}</span>}<span className={`account-status ${user.status}`}>{statusText(user.status)}</span></button>)}{!loading && !visible.length && <div className="empty-state"><Search /><h3>No encontramos cuentas</h3><p>Prueba con otra búsqueda o filtro.</p></div>}</div>
    {selected && <div className="modal-backdrop account-backdrop"><div className="modal account-modal"><div className="modal-head"><div><span className="section-kicker"><span /> PERFIL DE CUENTA</span><h2>{selected.username ? `@${selected.username}` : "Sin @usuario"}</h2></div><button className="icon-button" onClick={() => setSelected(null)}><X /></button></div><div className="account-detail-scroll"><div className="account-profile-head"><span className="user-admin-avatar large">{(selected.username || selected.email).slice(0, 2).toUpperCase()}</span><div><strong>{selected.fullName || [selected.firstName, selected.lastName].filter(Boolean).join(" ") || "Nombre sin configurar"}</strong><span><Mail />{selected.email}</span><em className={`account-status ${selected.status}`}>{statusText(selected.status)}</em></div></div>
      {selected.bio && <p className="account-bio">{selected.bio}</p>}
      <div className="account-data-grid"><article><Sparkles /><span><small>Pills creadas</small><strong>{selected.campaignCount}</strong></span></article><article><Users /><span><small>Pills coleccionadas</small><strong>{selected.claimCount}</strong></span></article><article><CalendarDays /><span><small>Cuenta creada</small><strong>{date(selected.createdAt)}</strong></span></article><article><Play /><span><small>Último acceso</small><strong>{date(selected.lastSignInAt)}</strong></span></article></div>
      <dl className="account-metadata"><div><dt>Rol</dt><dd>{selected.role === "super_admin" ? "Super Admin" : selected.role === "admin" ? "Admin" : selected.role === "curator" ? "Curador" : "Usuario"}</dd></div><div><dt>Acceso</dt><dd>{selected.providers.join(", ") || "Correo"}</dd></div><div><dt>Correo verificado</dt><dd>{selected.emailConfirmedAt ? "Sí" : "No"}</dd></div>{selected.moderationReason && <div><dt>Motivo actual</dt><dd>{selected.moderationReason}</dd></div>}</dl>
      {!selected.isCurrentUser && <><label className="account-reason"><span>Motivo administrativo</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Agrega una nota para dejar registro de la decisión" maxLength={500} /></label><div className="account-actions"><div><strong>Moderación reversible</strong><p>Un Admin puede pausar el perfil y después reactivarlo.</p>{selected.status === "paused" ? <button className="secondary-button" disabled={saving} onClick={() => void act("resume")}><Play />Reactivar perfil</button> : <button className="secondary-button pause-button" disabled={saving || selected.status === "blocked"} onClick={() => void act("pause")}><PauseCircle />Pausar perfil</button>}</div>{isSuperAdmin && <><div><strong>Acceso administrativo</strong><p>Admin puede curar y pausar Pills o perfiles, pero no eliminar.</p>{selected.role === "admin" ? <button className="secondary-button" disabled={saving} onClick={() => void act("remove_admin")}><UserCog />Quitar Admin</button> : !selected.role && <button className="secondary-button admin-promote-button" disabled={saving} onClick={() => void act("make_admin")}><ShieldCheck />Agregar como Admin</button>}</div><div><strong>Bloqueo de correo</strong><p>Impide iniciar sesión hasta que un Super Admin lo revierta.</p>{selected.status === "blocked" ? <button className="secondary-button" disabled={saving} onClick={() => void act("unblock")}><Play />Desbloquear correo</button> : <button className="secondary-button danger-button" disabled={saving} onClick={() => void act("block")}><Ban />Bloquear correo</button>}</div><div className="account-delete-zone"><strong>Eliminar cuenta</strong><p>Borra la cuenta, el perfil, sus Pills y datos asociados.</p><button className="secondary-button delete-button" disabled={saving} onClick={() => void remove()}><Trash2 />Eliminar definitivamente</button></div></>}</div></>}
      {selected.isCurrentUser && <div className="permissions-note"><LockMessage /><div><strong>Esta es tu cuenta</strong><p>Para evitar perder el acceso principal, no puedes moderarte ni cambiar tu propio rol.</p></div></div>}
    </div></div></div>}
  </section>;
}

function LockMessage() { return <ShieldCheck />; }
