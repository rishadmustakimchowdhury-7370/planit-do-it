// AES-GCM helpers for encrypting tenant-owned API keys at rest.
// Key source: env var APP_ENCRYPTION_KEY (64 hex chars = 32 bytes).
const enc = new TextEncoder();
const dec = new TextDecoder();

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex key length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const hex = Deno.env.get("APP_ENCRYPTION_KEY");
  if (!hex || hex.length !== 64) {
    throw new Error("APP_ENCRYPTION_KEY not configured (must be 64 hex chars)");
  }
  return await crypto.subtle.importKey(
    "raw",
    hexToBytes(hex),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Returns "v1:<iv_b64>:<ciphertext_b64>" */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext)),
  );
  return `v1:${bytesToB64(iv)}:${bytesToB64(ct)}`;
}

export async function decryptSecret(payload: string): Promise<string> {
  const parts = payload.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("Invalid ciphertext format");
  }
  const key = await getKey();
  const iv = b64ToBytes(parts[1]);
  const ct = b64ToBytes(parts[2]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(pt);
}

export function maskKey(plaintext: string): string {
  if (!plaintext) return "";
  if (plaintext.length <= 8) return "••••";
  return `${plaintext.slice(0, 4)}••••${plaintext.slice(-4)}`;
}
