import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const admin = serviceClient();
  const { data: contributions } = await admin.from("collection_contributors").select("collection_id").eq("user_id", data.user.id);
  const contributedIds = (contributions ?? []).map((item) => item.collection_id);
  let query = admin.from("collections").select("id,name,description,cover_url,created_by,created_at,updated_at");
  query = contributedIds.length ? query.or(`created_by.eq.${data.user.id},id.in.(${contributedIds.join(",")})`) : query.eq("created_by", data.user.id);
  const { data: collections, error } = await query.order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "No pudimos cargar tus colecciones." }, { status: 500 });
  const ids = (collections ?? []).map((item) => item.id);
  const [{ data: pills }, { data: contributors }] = await Promise.all([
    ids.length ? admin.from("campaigns").select("id,collection_id,name,artwork_url,created_by,review_status").in("collection_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? admin.from("collection_contributors").select("collection_id,user_id,role").in("collection_id", ids) : Promise.resolve({ data: [] }),
  ]);
  const contributorIds = [...new Set((contributors ?? []).map((item) => item.user_id))];
  const ownerIds = [...new Set((collections ?? []).map((item) => item.created_by))];
  const pillCreatorIds = [...new Set((pills ?? []).map((item) => item.created_by))];
  const identityIds = [...new Set([...contributorIds, ...ownerIds, ...pillCreatorIds])];
  const { data: names } = identityIds.length ? await admin.from("public_usernames").select("user_id,username").in("user_id", identityIds) : { data: [] };
  const nameMap = new Map((names ?? []).map((item) => [item.user_id, item.username]));
  const result = (collections ?? []).map((collection) => ({
    id: collection.id, name: collection.name, description: collection.description ?? "", coverUrl: collection.cover_url ?? "",
    createdAt: collection.created_at, isOwner: collection.created_by === data.user.id,
    owner: nameMap.get(collection.created_by) ?? "usuario",
    pills: (pills ?? []).filter((item) => item.collection_id === collection.id).map((item) => ({ id: item.id, name: item.name, imageUrl: item.artwork_url ?? "", creator: nameMap.get(item.created_by) ?? "creador", createdBy: item.created_by, canRemove: collection.created_by === data.user.id || item.created_by === data.user.id })),
    contributors: (contributors ?? []).filter((item) => item.collection_id === collection.id).map((item) => ({ userId: item.user_id, username: nameMap.get(item.user_id) ?? "usuario", role: item.role })),
  }));
  const { data: ownPills } = await admin.from("campaigns").select("id,collection_id,name,artwork_url,review_status").eq("created_by", data.user.id).order("created_at", { ascending: false });
  return NextResponse.json({ collections: result, ownPills: (ownPills ?? []).map((item) => ({ id: item.id, collectionId: item.collection_id, name: item.name, imageUrl: item.artwork_url ?? "", reviewStatus: item.review_status })) });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Tu sesión expiró." }, { status: 401 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 600) : "";
  if (name.length < 2) return NextResponse.json({ error: "Escribe un nombre para la colección." }, { status: 400 });
  const admin = serviceClient();
  const { data: memberships } = await admin.from("organization_members").select("organization_id").eq("user_id", data.user.id);
  const orgIds = (memberships ?? []).map((item) => item.organization_id);
  const { data: personal } = orgIds.length ? await admin.from("organizations").select("id").in("id", orgIds).eq("kind", "personal").limit(1).maybeSingle() : { data: null };
  if (!personal) return NextResponse.json({ error: "Primero crea una Pill para preparar tu espacio personal." }, { status: 409 });
  const { data: collection, error } = await admin.from("collections").insert({ organization_id: personal.id, name, description: description || null, created_by: data.user.id }).select("id").single();
  if (error || !collection) return NextResponse.json({ error: "No pudimos crear la colección." }, { status: 400 });
  return NextResponse.json({ created: true, id: collection.id }, { status: 201 });
}
