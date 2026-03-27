import crypto from 'crypto';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

function getSessionSecret() {
  return (process.env.API_SESSION_SECRET || '').trim();
}

function toBase64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function createPasswordPayload(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return { salt, passwordHash };
}

export function verifyPassword(password, payload) {
  const candidate = crypto.pbkdf2Sync(password, payload.salt, 120000, 32, 'sha256');
  const current = Buffer.from(payload.passwordHash, 'hex');
  if (candidate.length !== current.length) return false;
  return crypto.timingSafeEqual(candidate, current);
}

export function createSessionToken(user) {
  const secret = getSessionSecret();
  if (!secret) return null;

  const payload = {
    userId: user.userId,
    email: user.email,
    name: user.name,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  const secret = getSessionSecret();
  if (!secret || !token) return null;

  const [encodedPayload, signature] = String(token).split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
  if (signature !== expectedSignature) return null;

  const payload = JSON.parse(fromBase64Url(encodedPayload));
  if (!payload?.userId || !payload?.email || !payload?.expiresAt) return null;
  if (Date.now() > payload.expiresAt) return null;
  return payload;
}

export function readBearerToken(request) {
  const header = String(request.header('authorization') || '');
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}
