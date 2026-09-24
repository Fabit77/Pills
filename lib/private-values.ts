import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const encoded = process.env.PILLS_DISTRIBUTION_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Missing distribution encryption key");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("Invalid distribution encryption key");
  return key;
}

export function encryptPrivateValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptPrivateValue(value: string | null | undefined) {
  if (!value) return "";
  try {
    const [version, encodedIv, encodedTag, encodedValue] = value.split(".");
    if (version !== "v1" || !encodedIv || !encodedTag || !encodedValue) return "";
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encodedValue, "base64url")), decipher.final()]).toString("utf8");
  } catch { return ""; }
}

