// AES-256-GCM encryption for at-rest secrets stored in the Setting table.
// Key comes from SETTINGS_ENC_KEY (64 hex chars = 32 bytes). If unset, values
// pass through unencrypted with a one-time warning — usable for dev, but the
// deploy checklist for Cardknox includes generating and setting this key.

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const PREFIX = "enc:v1:";
let warned = false;

function key(): Buffer | null {
  const hex = process.env.SETTINGS_ENC_KEY;
  if (!hex) {
    if (!warned) {
      console.warn("[crypto] SETTINGS_ENC_KEY is unset — secrets stored in plaintext. Set a 64-hex-char key before enabling live payments.");
      warned = true;
    }
    return null;
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("SETTINGS_ENC_KEY must be exactly 64 hex characters (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return "";
  const k = key();
  if (!k) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) return stored;
  const parts = stored.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted secret");
  const [ivHex, tagHex, dataHex] = parts;
  const k = key();
  if (!k) throw new Error("Cannot decrypt: SETTINGS_ENC_KEY is not set but stored value is encrypted");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return dec.toString("utf8");
}

export function isEncrypted(stored: string): boolean {
  return typeof stored === "string" && stored.startsWith(PREFIX);
}
