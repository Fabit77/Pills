import { createHash, randomBytes } from "node:crypto";

export const hashValue = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
export const createPublicToken = () => randomBytes(24).toString("base64url");

type CampaignManager = { userId: string; username: string; role: "reader" };
type CampaignAccess = { role: "owner" | "reader"; canManage: boolean };

export function campaignJson(row: Record<string, unknown>, collaborators: CampaignManager[] = [], access: CampaignAccess = { role: "owner", canManage: true }, secretWord = "") {
  const startsAt = typeof row.starts_at === "string" ? row.starts_at : null;
  const endsAt = typeof row.ends_at === "string" ? row.ends_at : null;
  const submittedAt = typeof row.submitted_at === "string" ? row.submitted_at : null;
  const reviewStatus = submittedAt ? String(row.review_status ?? "pending") : "draft";
  const isPaused = Boolean(row.is_paused);
  const now = Date.now();
  const startTime = startsAt ? new Date(startsAt).getTime() : 0;
  const endTime = endsAt ? new Date(endsAt).getTime() : Number.POSITIVE_INFINITY;
  const status = reviewStatus === "draft"
    ? "Borrador"
    : reviewStatus === "rejected"
    ? "Rechazado"
    : reviewStatus === "pending"
      ? "Pendiente de aprobación"
      : isPaused
        ? "Pausado"
      : now > endTime
        ? "Finalizado"
        : now < startTime
          ? "Programado"
          : "Activo";

  return {
    id: row.id,
    collectionId: row.collection_id ?? null,
    name: row.name,
    description: row.description ?? "",
    eventType: row.event_type,
    venue: row.venue ?? "Por confirmar",
    startsAt,
    endsAt,
    eventUrl: row.event_url ?? "",
    total: row.supply ?? 0,
    claimed: row.claimed_count ?? 0,
    status,
    reviewStatus,
    isPaused,
    imageUrl: row.artwork_url ?? "",
    qrEnabled: Boolean(row.qr_enabled),
    qrToken: reviewStatus === "approved" ? row.qr_token ?? null : null,
    publicSlug: row.public_slug ?? "",
    secretEnabled: Boolean(row.secret_word_hash),
    editable: Number(row.claimed_count ?? 0) === 0 && !row.first_claimed_at,
    rejectionReason: row.rejection_reason ?? "",
    collaborators,
    accessRole: access.role,
    canManage: access.canManage,
    secretWord,
    submittedAt,
    createdAt: row.created_at,
  };
}
