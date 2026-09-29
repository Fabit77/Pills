import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-access";

type Row = Record<string, unknown>;

export async function GET(request: Request) {
  const access = await requirePlatformAdmin(["super_admin", "admin"]);
  if (access.error || !access.admin) return access.error;

  const query = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  const authUsers = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await access.admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return NextResponse.json({ error: "No pudimos cargar las cuentas." }, { status: 500 });
    authUsers.push(...data.users);
    if (data.users.length < 200) break;
  }

  const ids = authUsers.map((user) => user.id);
  if (!ids.length) return NextResponse.json({ users: [], viewerRole: access.role });
  const [{ data: profiles }, { data: usernames }, { data: roles }, { data: campaigns }, { data: claims }] = await Promise.all([
    access.admin.from("profiles").select("id,full_name,first_name,last_name,bio,avatar_url,account_status,moderation_reason,moderated_at,created_at,updated_at").in("id", ids),
    access.admin.from("public_usernames").select("user_id,username").in("user_id", ids),
    access.admin.from("app_admins").select("user_id,role").in("user_id", ids),
    access.admin.from("campaigns").select("id,created_by,is_paused").in("created_by", ids),
    access.admin.from("collectible_claims").select("id,collector_id").in("collector_id", ids),
  ]);

  const byId = <T extends Row>(rows: T[] | null, key: string) => new Map((rows ?? []).map((row) => [String(row[key]), row]));
  const profileMap = byId(profiles, "id");
  const usernameMap = byId(usernames, "user_id");
  const roleMap = byId(roles, "user_id");
  const campaignCounts = new Map<string, number>();
  const claimCounts = new Map<string, number>();
  for (const item of campaigns ?? []) campaignCounts.set(item.created_by, (campaignCounts.get(item.created_by) ?? 0) + 1);
  for (const item of claims ?? []) claimCounts.set(item.collector_id, (claimCounts.get(item.collector_id) ?? 0) + 1);

  const users = authUsers.map((authUser) => {
    const profile = profileMap.get(authUser.id);
    const username = usernameMap.get(authUser.id);
    const role = roleMap.get(authUser.id);
    const email = authUser.email ?? "";
    return {
      id: authUser.id,
      email: access.role === "super_admin" ? email : email.replace(/^(.{2}).*(@.*)$/, "$1••••$2"),
      username: String(username?.username ?? ""),
      fullName: String(profile?.full_name ?? ""),
      firstName: String(profile?.first_name ?? ""),
      lastName: String(profile?.last_name ?? ""),
      bio: String(profile?.bio ?? ""),
      avatarUrl: String(profile?.avatar_url ?? ""),
      status: String(profile?.account_status ?? "active"),
      moderationReason: String(profile?.moderation_reason ?? ""),
      moderatedAt: profile?.moderated_at ?? null,
      role: role?.role ?? null,
      createdAt: profile?.created_at ?? authUser.created_at,
      lastSignInAt: authUser.last_sign_in_at ?? null,
      emailConfirmedAt: authUser.email_confirmed_at ?? null,
      campaignCount: campaignCounts.get(authUser.id) ?? 0,
      claimCount: claimCounts.get(authUser.id) ?? 0,
      providers: authUser.app_metadata?.providers ?? [],
      isCurrentUser: authUser.id === access.user?.id,
    };
  }).filter((user) => !query || `${user.email} ${user.username} ${user.fullName}`.toLowerCase().includes(query));

  users.sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
  return NextResponse.json({ users, viewerRole: access.role });
}
