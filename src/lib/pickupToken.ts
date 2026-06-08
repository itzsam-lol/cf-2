import crypto from 'crypto';

export interface PickupTokenPayload {
  claimId: string;
  itemId: string;
  expiresAt: number;
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  return secret;
}

function sign(payloadEncoded: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payloadEncoded).digest('base64url');
}

// Single-use, 24h-expiring token: base64url(payload) + '.' + HMAC-SHA256 signature,
// signed with SUPABASE_SERVICE_ROLE_KEY (private, server-only — avoids a new secret).
export function generatePickupToken(claimId: string, itemId: string) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload: PickupTokenPayload = { claimId, itemId, expiresAt };
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${payloadEncoded}.${sign(payloadEncoded)}`;
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

export function verifyPickupToken(token: string): PickupTokenPayload | null {
  if (typeof token !== 'string') return null;
  const [payloadEncoded, signature] = token.split('.');
  if (!payloadEncoded || !signature) return null;

  const expected = sign(payloadEncoded);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadEncoded, 'base64url').toString('utf-8'));
    if (
      typeof payload?.claimId !== 'string'
      || typeof payload?.itemId !== 'string'
      || typeof payload?.expiresAt !== 'number'
    ) {
      return null;
    }
    return payload as PickupTokenPayload;
  } catch {
    return null;
  }
}
