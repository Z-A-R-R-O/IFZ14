export type PasswordPayload = {
  passwordHash: string;
  salt: string;
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(input: string) {
  const bytes = new Uint8Array(input.length / 2);
  for (let i = 0; i < input.length; i += 2) {
    bytes[i / 2] = Number.parseInt(input.slice(i, i + 2), 16);
  }
  return bytes;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createSalt() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function sha256(input: string) {
  const encoded = new TextEncoder().encode(input);
  const digest = await window.crypto.subtle.digest('SHA-256', encoded);
  return toHex(new Uint8Array(digest));
}

export async function createPasswordPayload(password: string): Promise<PasswordPayload> {
  const salt = createSalt();
  const passwordHash = await sha256(`${salt}:${password}`);
  return { passwordHash, salt };
}

export async function verifyPassword(password: string, payload: PasswordPayload) {
  const candidate = await sha256(`${payload.salt}:${password}`);
  const current = fromHex(payload.passwordHash);
  const next = fromHex(candidate);

  if (current.length !== next.length) return false;

  let diff = 0;
  for (let i = 0; i < current.length; i += 1) diff |= current[i] ^ next[i];
  return diff === 0;
}
