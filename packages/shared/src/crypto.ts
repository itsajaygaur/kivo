const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
export async function sha256(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
export async function sha256Bytes(value: ArrayBuffer): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", value)));
}
export async function generateApiKey(): Promise<{ token: string; prefix: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = `kivo_${btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")}`;
  return { token, prefix: token.slice(0, 12), hash: await sha256(token) };
}
export async function encryptSecret(value: string, base64Key: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0)),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value)),
  );
  return btoa(String.fromCharCode(...iv, ...ciphertext));
}
export async function decryptSecret(payload: string, base64Key: string): Promise<string> {
  const bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const body = bytes.slice(12);
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0)),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body));
}
