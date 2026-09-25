import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });

  const { id } = await params;
  const { data: campaign } = await supabase.from("campaigns").select("id").eq("id", id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "No tienes acceso a esta Pill." }, { status: 403 });

  const { data: claims, error } = await supabase
    .from("collectible_claims")
    .select("id,collector_id,method,created_at")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No pudimos cargar las personas que coleccionaron esta Pill." }, { status: 500 });

  const collectorIds = [...new Set((claims ?? []).map((claim) => claim.collector_id))];
  const { data: usernames } = collectorIds.length
    ? await supabase.from("public_usernames").select("user_id,username").in("user_id", collectorIds)
    : { data: [] };
  const usernameByUser = new Map((usernames ?? []).map((item) => [item.user_id, item.username]));

  return NextResponse.json({
    collectors: (claims ?? []).map((claim) => ({
      claimId: claim.id,
      userId: claim.collector_id,
      username: usernameByUser.get(claim.collector_id) ?? null,
      method: claim.method,
      claimedAt: claim.created_at,
    })),
  });
}
