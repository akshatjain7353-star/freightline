import { randomBytes, createHash } from "node:crypto";

const KEY_PREFIX = "tb_live_";

/** Generates a new client API key. Only the hash is ever stored — the
 * plaintext is returned once, to the caller who requested generation. */
export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { plaintext, hash: hashApiKey(plaintext) };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
