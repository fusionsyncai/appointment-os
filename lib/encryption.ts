import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  }
  return crypto.createHash("sha256").update(key).digest();
}

export function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(payload: string): string {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function safeEncrypt(value: string | null | undefined) {
  if (!value) return null;
  try {
    return encrypt(value);
  } catch {
    return value;
  }
}

export function safeDecrypt(value: string | null | undefined) {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return value;
  }
}
