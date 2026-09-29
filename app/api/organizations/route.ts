import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { normalizeWebsiteUrl } from "@/lib/website";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const admin = serviceClient();
  const { data: memberships } = await admin.from("organization_members").select("organization_id,role").eq("user_id", data.user.id);
  const ids = (memberships ?? []).map((item) => item.organization_id);
  if (!ids.length) return NextResponse.json({ organizations: [] });
  const { data: organizations, error } = await admin.from("organizations")
    .select("id,name,username,description,website_url,logo_url,verification_status,verification_evidence,rejection_reason,submitted_at,verified_at,created_at")
    .in("id", ids).eq("kind", "official").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No pudimos cargar tus organizaciones." }, { status: 500 });
  const officialIds = (organizations ?? []).map((item) => item.id);
  const { data: members } = officialIds.length
    ? await admin.from("organization_members").select("organization_id,user_id,role").in("organization_id", officialIds)
    : { data: [] };
  const memberIds = [...new Set((members ?? []).map((item) => item.user_id))];
  const { data: names } = memberIds.length ? await admin.from("public_usernames").select("user_id,username").in("user_id", memberIds) : { data: [] };
  const nameMap = new Map((names ?? []).map((item) => [item.user_id, item.username]));
  const roleMap = new Map((memberships ?? []).map((item) => [item.organization_id, item.role]));
  return NextResponse.json({ organizations: (organizations ?? []).map((organization) => ({
    id: organization.id, name: organization.name, username: organization.username ?? "", description: organization.description ?? "",
    websiteUrl: organization.website_url ?? "", logoUrl: organization.logo_url ?? "", status: organization.verification_status,
    evidence: organization.verification_evidence ?? "", rejectionReason: organization.rejection_reason ?? "",
    submittedAt: organization.submitted_at, verifiedAt: organization.verified_at, createdAt: organization.created_at,
    role: roleMap.get(organization.id), members: (members ?? []).filter((member) => member.organization_id === organization.id)
      .map((member) => ({ userId: member.user_id, username: nameMap.get(member.user_id) ?? "usuario", role: member.role })),
  })) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase().replace(/^@/, "") : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const evidence = typeof body.evidence === "string" ? body.evidence.trim() : "";
  const rawWebsite = typeof body.website === "string" ? body.website.trim() : "";
  const website = normalizeWebsiteUrl(rawWebsite);
  if (name.length < 2) return NextResponse.json({ error: "Escribe el nombre de la organización." }, { status: 400 });
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return NextResponse.json({ error: "El @ debe tener entre 3 y 24 caracteres: letras, números, punto o guion bajo." }, { status: 400 });
  if (evidence.length < 10) return NextResponse.json({ error: "Explica cómo podemos verificar tu vínculo con la organización." }, { status: 400 });
  if (rawWebsite && !website) return NextResponse.json({ error: "Escribe un sitio web válido." }, { status: 400 });
  const { data: id, error } = await supabase.rpc("create_official_organization", {
    organization_name: name, organization_username: username, organization_description: description,
    organization_website: website ?? "", ownership_evidence: evidence,
  });
  if (error || !id) {
    const duplicate = error?.message?.toLowerCase().includes("username") || error?.code === "23505";
    return NextResponse.json({ error: duplicate ? "Ese @ ya está en uso." : "No pudimos enviar la solicitud." }, { status: duplicate ? 409 : 400 });
  }
  return NextResponse.json({ created: true, id }, { status: 201 });
}
