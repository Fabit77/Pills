import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requirePlatformAdmin();
  if (access.error || !access.admin) return access.error;
  const { id } = await params;

  const [{ data: authUser }, { data: profile }, { data: publicName }, { data: campaigns }, { count: claimCount }] = await Promise.all([
    access.admin.auth.admin.getUserById(id),
    access.admin.from("profiles").select("id,full_name,first_name,last_name,bio,avatar_url,account_status,created_at").eq("id", id).maybeSingle(),
    access.admin.from("public_usernames").select("username").eq("user_id", id).maybeSingle(),
    access.admin.from("campaigns").select("id,review_status,claimed_count,is_paused").eq("created_by", id),
    access.admin.from("collectible_claims").select("id", { count: "exact", head: true }).eq("collector_id", id),
  ]);
  if (!authUser.user || !profile) return NextResponse.json({ error: "No encontramos este creador." }, { status: 404 });

  const rows = campaigns ?? [];
  return NextResponse.json({ creator: {
    id,
    username: publicName?.username ?? "",
    displayName: profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Creador de Pills",
    bio: profile.bio ?? "",
    avatarUrl: profile.avatar_url ?? "",
    accountStatus: profile.account_status ?? "active",
    accountCreatedAt: profile.created_at || authUser.user.created_at,
    emailVerified: Boolean(authUser.user.email_confirmed_at),
    hasEmail: Boolean(authUser.user.email),
    providers: authUser.user.app_metadata?.providers ?? [],
    createdCount: rows.length,
    approvedCount: rows.filter((item) => item.review_status === "approved").length,
    pendingCount: rows.filter((item) => item.review_status === "pending").length,
    rejectedCount: rows.filter((item) => item.review_status === "rejected").length,
    collectedCount: claimCount ?? 0,
    receivedCollections: rows.reduce((sum, item) => sum + Number(item.claimed_count ?? 0), 0),
    pausedCount: rows.filter((item) => item.is_paused).length,
  } });
}
