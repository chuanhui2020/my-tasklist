import { SignJWT, jwtVerify } from 'jose'

type SessionClaims = { user_id: number; role: string; session_version?: string; iat?: number }

const ALG = 'HS256'
const TOKEN_MAX_AGE = '24h'

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function generateToken(payload: SessionClaims & { session_version: string }, secret: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(TOKEN_MAX_AGE)
    .sign(getSecretKey(secret))
}

export async function verifyToken(token: string, secret: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret), { algorithms: [ALG] })
    if (typeof payload.user_id !== 'number' || typeof payload.role !== 'string') return null
    return payload as SessionClaims
  } catch {
    return null
  }
}
