import { randomBytes } from "node:crypto";

const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomSegment(length = 6) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function generatePublicSlug() {
  return `${randomSegment()}-${randomSegment()}-${randomSegment()}`;
}
