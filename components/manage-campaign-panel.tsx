"use client";

import Image from "next/image";
import { ArrowRight, CalendarDays, Check, LockKeyhole, QrCode, ShieldCheck, Sparkles, Trash2, UserPlus, X } from "lucide-react";
import QRCode from "qrcode";
import { FormEvent, useEffect, useState } from "react";
import { ArtworkCropper } from "@/components/artwork-cropper";

type Reader = { userId: string; username: string; role: "reader" };
type Campaign = {
  id: string; name: string; description: string; eventType: string; venue: string;
  startsAt: string | null; endsAt: string | null; eventUrl: string; total: number; claimed: number;
  status: string; reviewStatus: string; submittedAt: string | null; isPaused: boolean; imageUrl: string;
  qrEnabled: boolean; qrToken: string | null; publicSlug: string; secretEnabled: boolean; secretWord: string; editable: boolean;
  rejectionReason: string; collaborators: Reader[]; accessRole: "owner" | "reader"; canManage: boolean; createdAt: string;
};
type AdminLink = { id: string; recipientLabel: string; tokenValue: string | null; redeemedAt: string | null; createdAt: string };

const fansUrl = process.env.NEXT_PUBLIC_PILLSFANS_URL || "https://pills-fans-web.vercel.app";
const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
const statusClass = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "-");
const localPart = (value: string | null, part: "date" | "time") => { if (!value) return ""; const date = new Date(value); const pad = (item: number) => String(item).padStart(2, "0"); return part === "date" ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : `${pad(date.getHours())}:${pad(date.getMinutes())}`; };

function LiveArtwork({ imageUrl, title }: { imageUrl: string; title: string }) {
  const initials = title.split(" ").map((word) => word[0]).join("").slice(0, 3).toUpperCase();
  return <div className="draft-pill-preview" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}>{!imageUrl && <><Sparkles /><strong>{initials || "P"}</strong></>}</div>;
}

export function ManageCampaignPanel({ campaign, onClose, onSaved, onDeleted }: { campaign: Campaign; onClose: () => void; onSaved: (campaign: Campaign) => void; onDeleted: (id: string) => void }) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description);
  const [city, setCity] = useState(campaign.venue);
  const [startsAt, setStartsAt] = useState(localPart(campaign.startsAt, "date"));
  const [startTime, setStartTime] = useState(localPart(campaign.startsAt, "time") || "00:00");
  const [endsAt, setEndsAt] = useState(localPart(campaign.endsAt, "date"));
  const [endTime, setEndTime] = useState(localPart(campaign.endsAt, "time") || "23:59");
  const [hasEndDate, setHasEndDate] = useState(Boolean(campaign.endsAt));
  const [eventUrl, setEventUrl] = useState(campaign.eventUrl);
  const [supply, setSupply] = useState(campaign.total);
  const [qrEnabled, setQrEnabled] = useState(campaign.qrEnabled);
  const [secretEnabled, setSecretEnabled] = useState(campaign.secretEnabled);
  const [secretWord, setSecretWord] = useState(campaign.secretWord);
  const [artwork, setArtwork] = useState<File | null>(null);
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState(campaign.imageUrl);
  const [readerUsername, setReaderUsername] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState("");
  const [adminLinks, setAdminLinks] = useState<AdminLink[]>([]);
  const [recipientLabel, setRecipientLabel] = useState("");
  const [newClaimUrl, setNewClaimUrl] = useState("");
  const isOwner = campaign.accessRole === "owner";
  const isDraft = campaign.reviewStatus === "draft";
  const canEditContent = isOwner && campaign.editable;

  useEffect(() => () => { if (artworkPreview && artworkPreview !== campaign.imageUrl) URL.revokeObjectURL(artworkPreview); }, [artworkPreview, campaign.imageUrl]);
  useEffect(() => { if (!campaign.publicSlug) return; void QRCode.toDataURL(`${fansUrl}/collect/${campaign.publicSlug}`, { width: 280, margin: 1, color: { dark: "#181816", light: "#ffffff" } }).then(setQr); }, [campaign.publicSlug]);
  useEffect(() => { if (campaign.reviewStatus !== "approved") return; fetch(`/api/collectibles/${campaign.id}/admin-links`, { cache: "no-store" }).then(async (response) => { const result = await response.json(); if (response.ok) setAdminLinks(result.links); }).catch(() => undefined); }, [campaign.id, campaign.reviewStatus]);

  function mergeSaved(result: Campaign) {
    onSaved({ ...campaign, ...result, collaborators: campaign.collaborators, accessRole: campaign.accessRole, canManage: campaign.canManage });
  }

  async function selectArtwork(file?: File) {
    setMessage("");
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMessage("La imagen debe pesar menos de 5 MB."); return; }
    try { const bitmap = await createImageBitmap(file); bitmap.close(); } catch { setMessage("No pudimos leer esta imagen."); return; }
    if (file.type === "image/gif") {
      if (artworkPreview && artworkPreview !== campaign.imageUrl) URL.revokeObjectURL(artworkPreview);
      setArtwork(file); setArtworkPreview(URL.createObjectURL(file)); return;
    }
    setCropSource(file);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditContent) return;
    if (isDraft && !startsAt) { setMessage("Agrega una fecha de inicio."); return; }
    if (isDraft && hasEndDate && (!endsAt || new Date(`${endsAt}T${endTime || "23:59"}`) <= new Date(`${startsAt}T${startTime || "00:00"}`))) { setMessage("La fecha y hora de término deben ser posteriores al inicio."); return; }
    if (campaign.reviewStatus === "approved" && !window.confirm("Estos cambios devolverán la Pill a Curaduría y pausarán su distribución hasta una nueva aprobación. ¿Continuar?")) return;
    setSaving(true); setMessage("");
    let response: Response;
    if (isDraft) {
      const body = new FormData();
      body.set("name", name); body.set("description", description); body.set("city", city); body.set("date", startsAt); body.set("endDate", endsAt);
      body.set("startTime", startTime); body.set("eventUrl", eventUrl); body.set("supply", String(supply)); body.set("secretWord", secretWord);
      body.set("startsAtIso", new Date(`${startsAt}T${startTime || "00:00"}`).toISOString());
      if (hasEndDate && endsAt) { body.set("endDate", endsAt); body.set("endTime", endTime); body.set("endsAtIso", new Date(`${endsAt}T${endTime || "23:59"}`).toISOString()); } else { body.delete("endDate"); }
      if (qrEnabled) body.set("distributionQr", "on");
      if (secretEnabled) body.set("distributionSecret", "on");
      if (artwork) body.set("artwork", artwork);
      response = await fetch(`/api/collectibles/${campaign.id}`, { method: "PUT", body });
    } else {
      response = await fetch(`/api/collectibles/${campaign.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) });
    }
    const result = await response.json(); setSaving(false);
    if (response.ok) { mergeSaved(result.collectible); setMessage(isDraft ? "Borrador guardado." : campaign.reviewStatus === "approved" ? "Cambios enviados nuevamente a Curaduría." : "Cambios guardados."); }
    else setMessage(result.error);
  }

  async function changeLifecycle(action: "submit" | "withdraw") {
    const prompt = action === "submit" ? "¿Enviar esta Pill a Curaduría?" : "¿Retirar la solicitud y devolverla a borrador?";
    if (!window.confirm(prompt)) return;
    setSaving(true); setMessage("");
    const response = await fetch(`/api/collectibles/${campaign.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const result = await response.json(); setSaving(false);
    if (response.ok) { mergeSaved(result.collectible); setMessage(action === "submit" ? "Pill enviada a Curaduría." : "La Pill volvió a borrador."); }
    else setMessage(result.error);
  }

  async function addReader() {
    setMessage("");
    const response = await fetch(`/api/collectibles/${campaign.id}/collaborators`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: readerUsername }) });
    const result = await response.json();
    if (response.ok) { onSaved({ ...campaign, collaborators: [...campaign.collaborators, result.manager] }); setReaderUsername(""); setMessage(`@${result.manager.username} ahora tiene acceso de lectura.`); }
    else setMessage(result.error);
  }

  async function removeReader(reader: Reader) {
    if (!window.confirm(`¿Retirar el acceso de @${reader.username}?`)) return;
    const response = await fetch(`/api/collectibles/${campaign.id}/collaborators`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: reader.userId }) });
    const result = await response.json();
    if (response.ok) onSaved({ ...campaign, collaborators: campaign.collaborators.filter((item) => item.userId !== reader.userId) }); else setMessage(result.error);
  }

  async function deleteDraft() {
    if (!window.confirm(`¿Eliminar definitivamente el borrador “${campaign.name}”?`)) return;
    setSaving(true); const response = await fetch(`/api/collectibles/${campaign.id}`, { method: "DELETE" }); const result = await response.json(); setSaving(false);
    if (response.ok) onDeleted(campaign.id); else setMessage(result.error);
  }

  async function createAdminLink() {
    setMessage(""); setNewClaimUrl("");
    const response = await fetch(`/api/collectibles/${campaign.id}/admin-links`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientLabel }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error); return; }
    setNewClaimUrl(`${fansUrl}/claim/admin/${result.token}`); setAdminLinks((items) => [result.link, ...items]); setRecipientLabel("");
  }

  const publicClaimUrl = `${fansUrl}/collect/${campaign.publicSlug}`;
  return <><div className="modal-backdrop"><div className="modal manage-modal"><div className="modal-head"><div><span className="section-kicker"><span /> GESTIONAR</span><h2>{campaign.name}</h2><small className="access-label">Acceso: {isOwner ? "Propietario" : "Lector"}</small></div><button className="icon-button" onClick={onClose}><X /></button></div><div className="manage-layout"><section>
    {isDraft && isOwner && <div className="draft-live-preview"><LiveArtwork imageUrl={artworkPreview} title={name} /><div><span>PREVISUALIZACIÓN EN VIVO</span><strong>{name || "Sin título"}</strong><small>{city || "Ciudad por definir"} · {startsAt ? formatDate(startsAt) : "Sin fecha"}</small></div></div>}
    <form onSubmit={save}>{isDraft && isOwner && <label className="draft-artwork-control"><span>Imagen o GIF de la insignia</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => void selectArtwork(event.target.files?.[0])} /></label>}<label><span>Título</span><input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEditContent} maxLength={150} /></label><label><span>Descripción</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEditContent} maxLength={1500} /></label>
      {isDraft && isOwner && <div className="draft-fields"><label><span>Ciudad</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label><div className="date-window"><label><span>Fecha de inicio</span><input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><button type="button" className="add-end-date" onClick={() => setHasEndDate((value) => !value)}>{hasEndDate ? "Quitar fecha de término" : "+ Agregar fecha de término"}</button>{hasEndDate && <label><span>Fecha de término</span><input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></label>}<div className="time-window"><label><span>Hora de inicio</span><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>{hasEndDate && <label><span>Hora de término</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>}</div><p><CalendarDays />La colección estará disponible dentro del periodo definido.</p></div><label><span>URL del evento</span><input type="url" value={eventUrl} onChange={(event) => setEventUrl(event.target.value)} placeholder="https://" /></label><label><span>Cantidad disponible</span><input type="number" min="1" max="100" value={supply} onChange={(event) => setSupply(Math.max(1, Math.min(100, Number(event.target.value))))} /></label><div className="distribution-options compact"><label><input type="checkbox" checked={qrEnabled} onChange={(event) => setQrEnabled(event.target.checked)} /><span><strong>Código QR</strong></span></label><label><input type="checkbox" checked={secretEnabled} onChange={(event) => setSecretEnabled(event.target.checked)} /><span><strong>Frase secreta</strong></span></label></div>{secretEnabled && <label><span>Frase secreta</span><input value={secretWord} onChange={(event) => setSecretWord(event.target.value)} maxLength={60} /></label>}</div>}
      {!isOwner ? <p className="edit-rule locked"><LockKeyhole />Tu acceso de lector permite consultar datos y distribución sin editar la Pill.</p> : campaign.editable ? <p className="edit-rule"><Check />{isDraft ? "Puedes editar todos los campos mientras la Pill siga como borrador." : campaign.reviewStatus === "approved" ? "Cambiar título o descripción devolverá la Pill a Curaduría." : "Puedes editar título y descripción. La revisión continuará pendiente."}</p> : <p className="edit-rule locked"><LockKeyhole />La primera Pill ya fue coleccionada. El contenido quedó bloqueado.</p>}
      {isOwner && <button className="primary-button" disabled={!canEditContent || saving}>{saving ? "Guardando…" : isDraft ? "Guardar borrador" : "Guardar cambios"}</button>}
    </form>
    {isOwner && <div className="lifecycle-actions">{isDraft && <button className="primary-button" disabled={saving} onClick={() => void changeLifecycle("submit")}>Enviar a Curaduría <ArrowRight /></button>}{(campaign.reviewStatus === "pending" || campaign.reviewStatus === "rejected") && <button className="secondary-button" disabled={saving} onClick={() => void changeLifecycle("withdraw")}>Volver a borrador</button>}</div>}
    {isOwner && <div className="collaborator-box"><span className="field-title">Personas con acceso</span><p>Las personas añadidas son lectoras: pueden consultar estadísticas, QR, frase y enlaces, sin modificar la Pill.</p><div className="manager-add-row"><input value={readerUsername} onChange={(event) => setReaderUsername(event.target.value)} placeholder="@usuario" /><button className="secondary-button" onClick={addReader}><UserPlus size={16} />Agregar lector</button></div>{campaign.collaborators.length > 0 ? <div className="manager-list">{campaign.collaborators.map((reader) => <div key={reader.userId}><span><strong>@{reader.username}</strong><small>Solo lectura</small></span><em>Lector</em><button type="button" aria-label={`Retirar acceso de @${reader.username}`} onClick={() => void removeReader(reader)}><Trash2 /></button></div>)}</div> : <small>Aún no has dado acceso a otras personas.</small>}</div>}
    {isOwner && isDraft && campaign.claimed === 0 && <div className="delete-draft-box"><div><strong>Eliminar borrador</strong><p>Esta acción elimina la Pill y su imagen de forma permanente.</p></div><button type="button" disabled={saving} onClick={() => void deleteDraft()}><Trash2 />Eliminar borrador</button></div>}{message && <p className="form-error">{message}</p>}
  </section><aside className="distribution-card"><span className={`status ${statusClass(campaign.status)}`}><i />{campaign.status}</span>{campaign.reviewStatus === "approved" ? <>{campaign.qrEnabled && campaign.publicSlug && <div className="qr-preview">{qr ? <Image src={qr} alt="Código QR de la Pill" width={210} height={210} unoptimized /> : <QrCode />}<strong>QR listo para compartir</strong><a download={`${campaign.name}-qr.png`} href={qr}>Descargar QR</a><div className="claim-url public-claim-url"><input readOnly value={publicClaimUrl} /><button type="button" onClick={() => void navigator.clipboard.writeText(publicClaimUrl)}>Copiar enlace</button></div></div>}{campaign.secretEnabled && <div className="secret-ready secret-details"><ShieldCheck /><span><strong>Frase secreta</strong><b>{campaign.secretWord || "No recuperable para esta Pill antigua"}</b><small>{campaign.secretWord ? "Visible para el propietario y lectores autorizados." : "La frase sigue funcionando, pero fue creada antes de habilitar su recuperación."}</small></span>{campaign.secretWord && <button type="button" onClick={() => void navigator.clipboard.writeText(campaign.secretWord)}>Copiar frase</button>}</div>}<div className="individual-links"><strong>Enlaces individuales</strong><p>No vencen y solo pueden utilizarse una vez.</p>{isOwner && <div><input value={recipientLabel} onChange={(event) => setRecipientLabel(event.target.value)} placeholder="Persona o referencia" /><button type="button" onClick={createAdminLink}>Generar</button></div>}{newClaimUrl && <div className="claim-url"><input readOnly value={newClaimUrl} /><button type="button" onClick={() => void navigator.clipboard.writeText(newClaimUrl)}>Copiar</button></div>}<ul>{adminLinks.map((item) => { const url = item.tokenValue ? `${fansUrl}/claim/admin/${item.tokenValue}` : ""; return <li key={item.id}><span><b>{item.recipientLabel}</b><small>{item.redeemedAt ? "Utilizado" : item.tokenValue ? "Disponible" : "Enlace antiguo no recuperable"}</small></span>{url ? <button type="button" onClick={() => void navigator.clipboard.writeText(url)}>Copiar</button> : <em className={item.redeemedAt ? "used" : ""}>{item.redeemedAt ? "Canjeado" : "1 uso"}</em>}</li>; })}</ul></div></> : <div className="pending-distribution"><ShieldCheck /><h3>{isDraft ? "Borrador privado" : "Distribución bloqueada"}</h3><p>{isDraft ? "Guarda los cambios y envía la Pill a Curaduría cuando esté lista." : "El QR, la frase secreta y los enlaces se habilitan después de la aprobación."}</p></div>}</aside></div></div></div>{cropSource && <ArtworkCropper file={cropSource} onCancel={() => setCropSource(null)} onApply={(file) => { if (artworkPreview && artworkPreview !== campaign.imageUrl) URL.revokeObjectURL(artworkPreview); setArtwork(file); setArtworkPreview(URL.createObjectURL(file)); setCropSource(null); }} />}</>;
}
