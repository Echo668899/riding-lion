function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i]! ^ bb[i]!;
  return diff === 0;
}

export type MediaTicket = {
  key: string;
  exp: number;
  disposition?: "inline" | "attachment";
};

export async function createMediaTicket(
  secret: string,
  ticket: MediaTicket,
): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(ticket)));
  const sig = await signPayload(secret, body);
  return `${body}.${sig}`;
}

export async function verifyMediaTicket(
  secret: string,
  token: string,
): Promise<MediaTicket | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await signPayload(secret, body);
  if (!(await timingSafeEqual(sig, expected))) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(body));
    const ticket = JSON.parse(json) as MediaTicket;
    if (!ticket.key || !ticket.exp || ticket.exp < Math.floor(Date.now() / 1000)) return null;
    return ticket;
  } catch {
    return null;
  }
}
