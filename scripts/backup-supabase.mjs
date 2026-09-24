import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const databaseUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
if (!databaseUrl || !supabaseUrl || !serviceKey) throw new Error("Faltan credenciales de Supabase en .env.local");

const root = path.resolve(process.env.PILLS_BACKUP_DIR || "backups");
const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
const target = path.join(root, stamp);
await mkdir(target, { recursive: true, mode: 0o700 });

const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = [
  "public.profiles", "public.public_usernames", "public.organizations", "public.organization_members",
  "public.collections", "public.collection_collaborators", "public.campaigns", "public.campaign_collaborators",
  "public.collectible_claims", "public.collectible_admin_links", "public.app_admins",
  "auth.users", "auth.identities", "auth.audit_log_entries", "storage.buckets", "storage.objects",
];
const manifest = { createdAt: new Date().toISOString(), format: 1, tables: {}, storage: {}, warnings: [] };

try {
  const dataDir = path.join(target, "database");
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  for (const table of tables) {
    try {
      const rows = await sql.unsafe(`select * from ${table}`);
      const body = `${JSON.stringify(rows, jsonReplacer, 2)}\n`;
      const filename = `${table.replace(".", "__")}.json`;
      await writeFile(path.join(dataDir, filename), body, { mode: 0o600 });
      manifest.tables[table] = { rows: rows.length, sha256: digest(body) };
    } catch (error) {
      manifest.warnings.push(`${table}: ${error.message}`);
    }
  }

  const files = await listFiles(admin, "collectible-artwork");
  const bucketDir = path.join(target, "storage", "collectible-artwork");
  for (const file of files) {
    const { data, error } = await admin.storage.from("collectible-artwork").download(file);
    if (error) { manifest.warnings.push(`collectible-artwork/${file}: ${error.message}`); continue; }
    const bytes = Buffer.from(await data.arrayBuffer());
    const destination = safeDestination(bucketDir, file);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await writeFile(destination, bytes, { mode: 0o600 });
    manifest.storage[`collectible-artwork/${file}`] = { bytes: bytes.length, sha256: digest(bytes) };
  }
  await writeFile(path.join(target, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
} finally {
  await sql.end();
}

await removeExpiredBackups(root, 56);
console.log(`Backup complete: ${target}`);
console.log(`Tables: ${Object.keys(manifest.tables).length}; files: ${Object.keys(manifest.storage).length}; warnings: ${manifest.warnings.length}`);
if (manifest.warnings.length) process.exitCode = 2;

async function listFiles(client, bucket, prefix = "") {
  const found = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const item of data || []) {
      const name = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) found.push(name); else found.push(...await listFiles(client, bucket, name));
    }
    if (!data || data.length < 1000) break;
  }
  return found;
}

function safeDestination(base, objectName) {
  const destination = path.resolve(base, objectName);
  if (!destination.startsWith(`${path.resolve(base)}${path.sep}`)) throw new Error(`Ruta de objeto inválida: ${objectName}`);
  return destination;
}

function jsonReplacer(_key, value) {
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return { type: "Buffer", base64: value.toString("base64") };
  return value;
}

function digest(value) { return createHash("sha256").update(value).digest("hex"); }

async function removeExpiredBackups(directory, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const parsed = Date.parse(entry.name.replace(/-(\d{2})-(\d{2})Z$/, ":$1:$2Z"));
    if (Number.isFinite(parsed) && parsed < cutoff) await rm(path.join(directory, entry.name), { recursive: true, force: true });
  }
}
