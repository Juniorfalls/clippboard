import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not configured. Add it to the server environment."
    );
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;

  return createHash("sha256").update(raw).digest();
}

export function encryptToken(token: string): string {
  if (!token) return token;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptToken(value: string): string {
  if (!value) return value;

  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) {
    throw new Error("Stored token is malformed.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
