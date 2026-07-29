/**
 * ocrowley-commons encryption layer
 * AES-256-GCM authenticated encryption for all sensitive stored data.
 * Every encrypted value includes: iv (12 bytes) + authTag (16 bytes) + ciphertext.
 * Format on disk: base64(iv):base64(authTag):base64(ciphertext)
 */

import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SEPARATOR = ":";

function getMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw || raw.length < 64) {
    throw new Error("[Encryption] ENCRYPTION_MASTER_KEY is missing or too short. Must be 64 hex chars.");
  }
  return Buffer.from(raw.slice(0, 64), "hex");
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a portable string safe to store in the database.
 */
export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(SEPARATOR);
}

/**
 * Decrypt a value produced by encrypt().
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export function decrypt(stored: string): string {
  const key = getMasterKey();
  const parts = stored.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error("[Encryption] Invalid ciphertext format.");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Returns true if the stored value looks like an encrypted blob (not plaintext).
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(SEPARATOR);
  return parts.length === 3 && parts[0].length >= 16;
}

/**
 * HMAC-SHA256 signature for integrity verification of critical records.
 */
export function sign(data: string): string {
  const key = getMasterKey();
  return createHmac("sha256", key).update(data).digest("hex");
}

/**
 * Constant-time HMAC verification.
 */
export function verify(data: string, signature: string): boolean {
  try {
    const expected = sign(data);
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Safe encrypt: if value is already encrypted, return as-is.
 */
export function safeEncrypt(value: string): string {
  if (isEncrypted(value)) return value;
  return encrypt(value);
}

/**
 * Safe decrypt: if value is not encrypted (legacy plaintext), return as-is.
 */
export function safeDecrypt(value: string): string {
  if (!isEncrypted(value)) return value;
  return decrypt(value);
}
