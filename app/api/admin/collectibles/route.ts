import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-access";
import { campaignJson } from "@/lib/collectibles";

export async function GET(request: Request) {
  const access = await requirePlatformAdmin();
  if (access.error || !access.admin) return access.error;
  const includeDrafts = new URL(request.url).searchParams.get("scope") === "all" && access.role === "super_admin";
  let query = access.admin.from("campaigns").select("id,name,description,event_type,venue,starts_at,ends_at,event_url,supply,status,artwork_url,qr_enabled,qr_token,secret_word_hash,public_slug,review_status,submitted_at,rejection_reason,claimed_count,first_claimed_at,is_paused,created_by,created_at");
  if (!includeDrafts) query = query.not("submitted_at", "is", null);
  const { data, error } = await query.order(includeDrafts ? "created_at" : "submitted_at", { ascending: includeDrafts ? false : true });
  if (error) return NextResponse.json({ error: "No pudimos cargar la cola de revisión." }, { status: 500 });
  const creatorIds = [...new Set((data ?? []).map((row) => row.created_by))];
  const [{ data: profiles }, { data: usernames }] = creatorIds.length ? await Promise.all([
    access.admin.from("profiles").select("id,full_name,first_name,last_name,avatar_url").in("id", creatorIds),
    access.admin.from("public_usernames").select("user_id,username").in("user_id", creatorIds),
  ]) : [{ data: [] }, { data: [] }];
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const usernameMap = new Map((usernames ?? []).map((username) => [username.user_id, username.username]));
  return NextResponse.json({ collectibles: (data ?? []).map((row) => {
    const profile = profileMap.get(row.created_by);
    return campaignJson({
      ...row,
      creator_id: row.created_by,
      creator_username: usernameMap.get(row.created_by) ?? "",
      creator_display_name: profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "",
      creator_avatar_url: profile?.avatar_url ?? "",
    });
  }) });
}
