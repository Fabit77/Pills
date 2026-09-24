import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { supabase, role: null, error: NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 }) };
  const { data: admin } = await supabase.from("app_admins").select("role").eq("user_id", authData.user.id).maybeSingle();
  if (!admin || !["super_admin", "curator", "admin"].includes(admin.role)) return { supabase, role: null, error: NextResponse.json({ error: "Acceso reservado para Curaduría." }, { status: 403 }) };
  return { supabase, role: admin.role as string, error: null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await params;
  const body = await request.json();
  if (body.action !== "pause" && body.action !== "resume") return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  const { error } = await auth.supabase.rpc("set_collectible_paused", { target_campaign_id: id, should_pause: body.action === "pause" });
  if (error) return NextResponse.json({ error: body.action === "pause" ? "No pudimos pausar esta Pill." : "No pudimos reactivar esta Pill." }, { status: 400 });
  return NextResponse.json({ updated: true, action: body.action });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  if (auth.role !== "super_admin") return NextResponse.json({ error: "Solo un Super Admin puede eliminar una Pill." }, { status: 403 });
  const { id } = await params;
  const { data: artworkUrl, error } = await auth.supabase.rpc("delete_collectible_as_super_admin", { target_campaign_id: id });
  if (error) return NextResponse.json({ error: "No pudimos eliminar esta Pill." }, { status: 400 });

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (supabaseUrl && serviceKey && typeof artworkUrl === "string") {
    const marker = "/storage/v1/object/public/collectible-artwork/";
    const markerIndex = artworkUrl.indexOf(marker);
    if (markerIndex >= 0) {
      const path = decodeURIComponent(artworkUrl.slice(markerIndex + marker.length));
      const adminClient = createAdminClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      await adminClient.storage.from("collectible-artwork").remove([path]);
    }
  }
  return NextResponse.json({ deleted: true });
}

