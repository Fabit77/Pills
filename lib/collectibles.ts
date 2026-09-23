import { createHash, randomBytes } from "node:crypto";

export const hashValue = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
export const createPublicToken = () => randomBytes(24).toString("base64url");

export function campaignJson(row: Record<string, unknown>, collaborators: string[] = []) {
  const startsAt = typeof row.starts_at === "string" ? row.starts_at : null;
  const endsAt = typeof row.ends_at === "string" ? row.ends_at : null;
  const reviewStatus = String(row.review_status ?? "pending");
  const now = Date.now();
  const startTime = startsAt ? new Date(startsAt).getTime() : 0;
  const endTime = endsAt ? new Date(endsAt).getTime() : Number.POSITIVE_INFINITY;
  const status = reviewStatus === "rejected" ? "Rechazado" : reviewStatus === "pending" ? "En revisión" : now < startTime ? "Programado" : now > endTime ? "Finalizado" : "Aprobado";

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    eventType: row.event_type,
    venue: row.venue ?? "Por confirmar",
    startsAt,
    endsAt,
    total: row.supply ?? 0,
    claimed: row.claimed_count ?? 0,
    status,
    reviewStatus,
    imageUrl: row.artwork_url ?? "",
    qrEnabled: Boolean(row.qr_enabled),
    qrToken: reviewStatus === "approved" ? row.qr_token ?? null : null,
    secretEnabled: Boolean(row.secret_word_hash),
    editable: Number(row.claimed_count ?? 0) === 0 && !row.first_claimed_at,
    rejectionReason: row.rejection_reason ?? "",
    collaborators,
    createdAt: row.created_at,
  };
}
