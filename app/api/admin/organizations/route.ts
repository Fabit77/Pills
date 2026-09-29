import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-access";

export async function GET() {
  const access = await requirePlatformAdmin(["super_admin", "admin", "curator"]);
  if (access.error || !access.admin) return access.error;
  const { data: organizations, error } = await access.admin.from("organizations")
    .select("id,name,username,description,website_url,verification_status,verification_evidence,rejection_reason,submitted_at,verified_at,created_by,created_at")
    .eq("kind", "official").order("submitted_at", { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: "No pudimos cargar las solicitudes." }, { status: 500 });
  const creatorIds = [...new Set((organizations ?? []).map((item) => item.created_by))];
  const { data: names } = creatorIds.length ? await access.admin.from("public_usernames").select("user_id,username").in("user_id", creatorIds) : { data: [] };
  const nameMap = new Map((names ?? []).map((item) => [item.user_id, item.username]));
  return NextResponse.json({ organizations: (organizations ?? []).map((item) => ({
    id: item.id, name: item.name, username: item.username ?? "", description: item.description ?? "", websiteUrl: item.website_url ?? "",
    status: item.verification_status, evidence: item.verification_evidence ?? "", rejectionReason: item.rejection_reason ?? "",
    submittedAt: item.submitted_at, verifiedAt: item.verified_at, createdAt: item.created_at, owner: nameMap.get(item.created_by) ?? "usuario",
  })) });
}
